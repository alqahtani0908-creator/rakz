/* ============ Rakz — Najiz (ناجز) centre ============
   The Ministry of Justice offers no open API to law firms; its official APIs (developers.najiz.sa) need a developer
   account and production approval. Until then the platform pulls from Najiz three ways, all reviewed before saving:
   1) paste text from a Najiz page or SMS, 2) upload judgments / minutes / screenshots, 3) a browser bookmark that
   sends the open Najiz page straight here. The assistant extracts case numbers, sessions, judgments and deadlines;
   items are matched to cases by Najiz number, and nothing is written until the user approves each change. */

const NAJIZ_URL = "https://najiz.sa";
const NAJIZ_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*najiz\.sa$/i;
const digits = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "");

/* Pages sent from the bookmark arrive by postMessage; only najiz.sa may send, and they land as a draft. */
window.addEventListener("message", (e) => {
  if (!NAJIZ_ORIGIN.test(e.origin) || !e.data || e.data.rakzNajiz !== 1) return;
  try { e.source?.postMessage("rakz-ok", e.origin); } catch {}
  const text = String(e.data.text || "").slice(0, 200000);
  if (S.najizIn?.text === text) return;
  S.najizIn = { text, url: String(e.data.url || ""), title: String(e.data.title || ""), at: nowIso() };
  S.najizText = text; S.najizRes = null;
  if (S.booted) { go("najiz"); toast("وصلت صفحة من ناجز. راجعها ثم اضغط «تحليل»."); }
  else S.route.name = "najiz";
});
function najizBookmarklet() {
  const target = location.origin + location.pathname + "#najiz";
  const code = `(()=>{const t=document.body.innerText.slice(0,200000);const w=window.open(${JSON.stringify(target)},"rakz");let n=0;const i=setInterval(()=>{try{w.postMessage({rakzNajiz:1,text:t,url:location.href,title:document.title},${JSON.stringify(location.origin)})}catch(e){}if(++n>120)clearInterval(i)},500);addEventListener("message",e=>{if(e.data==="rakz-ok")clearInterval(i)})})()`;
  return "javascript:" + encodeURIComponent(code);
}

/* Hijri (Umm al-Qura) → Gregorian, by scanning around an estimate with the browser's own calendar. */
const HIJRI_FMT = (() => { try { return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }); } catch { return null; } })();
function hijriToGreg(y, m, d) {
  if (!HIJRI_FMT || !y || !m || !d) return "";
  // 1 Muharram 1 AH ≈ 19 July 622 (proleptic Gregorian); a mean lunar year is 354.367 days.
  const start = new Date(Date.UTC(622, 6, 19)); start.setUTCDate(start.getUTCDate() + Math.round((y - 1) * 354.36707 + (m - 1) * 29.5306 + (d - 1)));
  for (let k = -45; k <= 45; k++) {
    const t = new Date(start); t.setUTCDate(t.getUTCDate() + k);
    const p = Object.fromEntries(HIJRI_FMT.formatToParts(t).map((x) => [x.type, x.value]));
    if (+p.year === y && +p.month === m && +p.day === d) return t.toISOString().slice(0, 10);
  }
  return "";
}
/* A date as the assistant read it: {date:"YYYY-MM-DD", cal:"h"|"g"} → Gregorian YYYY-MM-DD. */
function normDate(x) {
  if (!x) return "";
  const s = typeof x === "string" ? x : x.date; const cal = typeof x === "string" ? "" : x.cal;
  const m = String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return "";
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (cal === "h" || y < 1600) return hijriToGreg(y, mo, d);
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

VIEWS.najiz = () => {
  const res = S.najizRes; const busy = S.najizBusy;
  const withNo = S.data.cases.filter((c) => c.najiz && c.status !== "closed");
  return `<div class="page-head"><div><h1>ناجز</h1><p>اسحب مستجدات قضاياك من ناجز إلى المنصة: الجلسات، والأحكام، والمهل، وبيانات الدوائر. كل تغيير يُعرض عليك قبل حفظه.</p></div>
    <div class="row"><a class="btn" href="${NAJIZ_URL}" target="_blank" rel="noopener">${icon("link")}فتح ناجز</a></div></div>
  <div class="cols"><div class="stack">
    <div class="card"><div class="card-h"><h3>استيراد من ناجز</h3>${S.najizIn ? `<span class="pill ok">وصلت صفحة من ناجز ${ago(S.najizIn.at)}</span>` : ""}</div>
      <div class="stack" style="gap:12px">
        <div class="field"><label for="nj-case">القضية (اختياري)</label><select id="nj-case" class="inp" data-ch="najizCase">${opt("", "— يحددها المساعد من رقم القضية —", S.najizCase || "")}${S.data.cases.filter((c) => c.status !== "closed").map((c) => opt(c.id, `${c.title}${c.najiz ? " · " + c.najiz : ""}`, S.najizCase || "")).join("")}</select></div>
        <div class="field"><label for="nj-text">الصق النص من ناجز</label><textarea id="nj-text" class="inp" rows="9" data-ch="najizText" placeholder="انسخ من صفحة القضية في ناجز (التفاصيل، الجلسات، الأحكام)، أو من قائمة «قضاياي»، أو رسالة SMS من ناجز عن موعد جلسة، والصقه هنا.">${esc(S.najizText || "")}</textarea></div>
        <div class="drop" data-act="najizPick">${icon("upload")}<div><b>أو ارفع ملفات من ناجز</b></div><div class="small">صك الحكم، محضر الجلسة، أو لقطات شاشة من تطبيق ناجز (PDF أو صور)</div></div>
        <input type="file" id="nj-files" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt" data-ch="najizFiles">
        ${(S.najizFiles || []).length ? `<div class="chips">${S.najizFiles.map((f, i) => `<span class="chip">${esc(f.name)} <a data-act="najizDropFile" data-i="${i}" style="cursor:pointer" aria-label="إزالة">×</a></span>`).join("")}</div>` : ""}
        <div class="row">${busy ? `<span class="thinking">${esc(busy)}</span>` : `<button class="btn gold" data-act="najizAnalyze" ${S.caps.sample ? "" : "disabled"}>${icon("spark")}تحليل واستخراج المستجدات</button>`}
          ${S.najizText || (S.najizFiles || []).length || res ? `<button class="btn ghost" data-act="najizReset">مسح</button>` : ""}</div>
        ${S.caps.sample ? "" : `<div class="banner warn"><div class="grow">الاستخراج يحتاج المساعد الذكي.</div></div>`}
      </div></div>
    ${res ? najizReview(res) : ""}
  </div><div class="stack">
    <div class="card"><div class="card-h"><h3>زر «إرسال إلى ركز»</h3><span class="sub">للحاسب</span></div>
      <p class="small" style="margin:0 0 10px">اسحب هذا الزر إلى شريط الإشارات المرجعية في متصفحك مرة واحدة. بعدها، وأنت في أي صفحة قضية داخل ناجز، اضغطه فتصل الصفحة إلى هنا جاهزة للتحليل، دون نسخ أو لصق.</p>
      <a class="btn gold" href="${esc(najizBookmarklet())}" data-noact="1" onclick="event.preventDefault();toast('اسحب الزر إلى شريط الإشارات، ثم اضغطه من داخل ناجز.')">${icon("send")}إرسال إلى ركز</a>
      <p class="small muted" style="margin:10px 0 0">لا يقرأ الزر إلا الصفحة المفتوحة أمامك عند ضغطه، ولا يحفظ بيانات دخولك إلى ناجز.</p></div>
    <div class="card"><div class="card-h"><h3>من الجوال</h3></div>
      <p class="small" style="margin:0">في تطبيق ناجز: صوّر شاشة القضية أو الجلسات أو انسخ رسالة الإشعار، ثم ارفع الصورة أو الصق النص هنا. يقرأ المساعد الصور أيضًا.</p></div>
    <div class="card"><div class="card-h"><h3>الربط الرسمي (واجهات وزارة العدل)</h3>${pill("بانتظار الاعتماد", "warn")}</div>
      <p class="small" style="margin:0 0 8px">توفر وزارة العدل واجهات برمجية رسمية عبر «ناجز مطورين»، منها: خدمات تقاضي، والاستعلام عن بيانات القضايا، وملخص الحكم، ومحاضر الجلسات، والتحقق من الوكالات. تتطلب حساب مطور باسم المكتب، ثم طلب اعتماد بيئة الإنتاج من الوزارة.</p>
      <ol class="small" style="margin:0;padding-inline-start:18px;line-height:1.9"><li>أنشئ حسابًا في <a href="https://developers.najiz.sa" target="_blank" rel="noopener">developers.najiz.sa</a>.</li><li>اشترك في المنتجات أعلاه واطلب مفاتيح البيئة التجريبية.</li><li>اطلب الانتقال للإنتاج (Takamul@moj.gov.sa).</li><li>عند وصول المفاتيح والوثائق أربطها بالمنصة لتتحدث القضايا تلقائيًا.</li></ol></div>
    <div class="card"><div class="card-h"><h3>قضايا مرتبطة برقم ناجز</h3><span class="sub num">${withNo.length}</span></div>
      ${withNo.length ? `<div class="list">${withNo.slice(0, 12).map((c) => `<div class="li clickable" data-act="openCase" data-id="${c.id}"><div class="body"><div class="ttl">${esc(c.title)}</div><div class="meta"><span class="num">${esc(c.najiz)}</span><span>${esc(c.court || "")}</span>${c.najizSyncAt ? `<span>آخر مزامنة ${ago(c.najizSyncAt)}</span>` : ""}</div></div></div>`).join("")}</div>` : `<p class="small muted" style="margin:0">أضف رقم القضية في ناجز إلى بيانات كل قضية ليطابق المساعد المستجدات معها تلقائيًا.</p>`}</div>
  </div></div>`;
};
CH.najizText = () => { S.najizText = $("#nj-text").value; };
CH.najizCase = (el) => { S.najizCase = el.value; };
A.najizPick = () => $("#nj-files")?.click();
CH.najizFiles = (el) => { S.najizFiles = [...(S.najizFiles || []), ...[...el.files].filter((f) => f.size <= 20 * 1024 * 1024)].slice(0, 6); el.value = ""; render(); };
A.najizDropFile = (el) => { S.najizFiles.splice(+el.dataset.i, 1); render(); };
A.najizReset = () => { S.najizText = ""; S.najizFiles = []; S.najizRes = null; S.najizIn = null; render(); };
A.najizFrom = (el) => { S.najizCase = el.dataset.id; go("najiz"); };

A.najizAnalyze = async () => {
  if (!needSample()) return;
  const text = ($("#nj-text")?.value || S.najizText || "").trim(); S.najizText = text;
  const files = S.najizFiles || [];
  if (!text && !files.length) return toast("الصق نصًا من ناجز أو ارفع ملفًا أولًا.", true);
  S.najizBusy = "يقرأ الملفات…"; render();
  try {
    let docs = ""; const images = [];
    for (const f of files) {
      if (f.type.startsWith("image/")) { images.push(f); continue; }
      try {
        const r = await extractText(f);
        if ((r.text || "").length > 200) docs += `\n--- ${f.name} ---\n${r.text.slice(0, 40000)}\n`;
        else if (r.doc) images.push(...(await pdfToImages(r.doc, 4)));
      } catch (e) { console.warn(e); }
    }
    const pinned = S.najizCase ? caseById(S.najizCase) : null;
    const known = S.data.cases.filter((c) => c.status !== "closed").map((c) => `- ${c.title}${c.najiz ? ` | رقم ناجز ${c.najiz}` : ""}${c.court ? ` | ${c.court}` : ""}${c.opponent ? ` | الخصم ${c.opponent}` : ""} | عميلنا ${clientName(c.clientId)}`).join("\n").slice(0, 12000);
    S.najizBusy = "يستخرج المستجدات…"; render();
    const prompt = `أنت مساعد إداري قانوني في «${S.firm.nameAr}». أمامك محتوى منقول من منصة ناجز (وزارة العدل السعودية): نص صفحة، أو رسالة إشعار، أو صك حكم، أو محضر جلسة، أو لقطات شاشة.
تاريخ اليوم: ${todayStr()} الموافق ${fmtHijri(todayStr())}.
استخرج كل قضية يرد ذكرها ومستجداتها بدقة حرفية، دون استنتاج ما لم يرد.
${pinned ? `المحتوى يخص هذه القضية تحديدًا: ${pinned.title}${pinned.najiz ? ` (رقم ناجز ${pinned.najiz})` : ""}.` : ""}
قضايا المكتب الجارية (للمطابقة فقط):
${known || "—"}
${text ? `\nالنص المنقول:\n"""\n${text.slice(0, 60000)}\n"""` : ""}${docs ? `\nالملفات:\n"""${docs.slice(0, 80000)}"""` : ""}${images.length ? "\nومرفق صور لصفحات أو لقطات شاشة؛ اقرأها بعناية." : ""}

قواعد التواريخ: انقل كل تاريخ كما ورد، مع تحديد تقويمه: "cal":"h" للهجري و"cal":"g" للميلادي، بصيغة YYYY-MM-DD. لا تحوّل بين التقويمين بنفسك.
الحالة status واحدة من: intake (قيد الدراسة/قيد القيد)، active (منظورة/جارية)، judgment (صدر حكم ابتدائي)، appeal (في الاستئناف)، cassation (في النقض/المحكمة العليا)، execution (قيد التنفيذ)، closed (منتهية/محفوظة)، أو فارغ إن لم يتضح.
judgment.objection: appeal إن كان حكمًا ابتدائيًا قابلًا للاستئناف، cassation إن كان حكم استئناف قابلًا للنقض، أو فارغ.

أعد JSON فقط:
{"cases":[{"najizNo":"رقم القضية كما ورد","title":"وصف مختصر للقضية/الدعوى","court":"","circuit":"الدائرة","city":"","parties":[{"name":"","role":"مدعٍ/مدعى عليه/…"}],"status":"","matchTitle":"عنوان القضية المطابقة من قائمة المكتب حرفيًا أو فارغ","sessions":[{"date":{"date":"YYYY-MM-DD","cal":"h|g"},"time":"HH:MM","title":"جلسة …","note":"عن بُعد/حضوري/…"}],"deadlines":[{"title":"","date":{"date":"","cal":""},"note":""}],"judgment":{"no":"","date":{"date":"","cal":""},"receivedAt":{"date":"","cal":""},"objection":"","summary":"منطوق الحكم باختصار","urgent":false},"updates":["مستجدات أخرى مهمة بجمل قصيرة"]}]}`;
    const opts = { modelTier: "default" }; if (images.length) opts.images = images.slice(0, 8);
    const out = await S.caps.sample.json(prompt, opts);
    const list = (Array.isArray(out?.cases) ? out.cases : []).filter((x) => x && (x.najizNo || x.title || (x.sessions || []).length || x.judgment?.no));
    if (!list.length) { S.najizRes = null; toast("لم أجد بيانات قضايا في المحتوى.", true); return; }
    S.najizRes = list.map((x, i) => najizPrepare(x, i, pinned));
    if (S.najizIn) S.najizIn = null;
  } catch (e) { aiErr(e); }
  finally { S.najizBusy = null; render(); }
};

/* Turn one extracted case into proposed changes, matched to an office case. */
function najizPrepare(x, i, pinned) {
  const no = digits(x.najizNo);
  const match = pinned || (no && S.data.cases.find((c) => digits(c.najiz) === no)) || (x.matchTitle && S.data.cases.find((c) => c.title === x.matchTitle)) || null;
  const ch = [];
  const add = (k, label, data, on = true) => ch.push({ k, label, data, on });
  if (no && (!match || digits(match.najiz) !== no)) add("najiz", `رقم القضية في ناجز: ${x.najizNo}`, { najiz: String(x.najizNo) });
  for (const [f, l] of [["court", "المحكمة"], ["circuit", "الدائرة"], ["city", "المدينة"]]) if (x[f] && (!match || match[f] !== x[f])) add("field", `${l}: ${x[f]}${match?.[f] ? ` (بدل «${match[f]}»)` : ""}`, { [f]: x[f] }, !match?.[f]);
  if (x.status && STATUSES[x.status] && (!match || match.status !== x.status)) add("field", `الحالة: ${STATUSES[x.status].t}${match ? ` (بدل «${STATUSES[match.status]?.t || "—"}»)` : ""}`, { status: x.status });
  for (const s of x.sessions || []) {
    const due = normDate(s.date); if (!due) continue;
    const dup = match && S.data.tasks.some((t) => t.caseId === match.id && t.kind === "session" && t.due === due);
    add("task", `جلسة ${fmtDate(due)}${s.time ? " الساعة " + s.time : ""} — ${fmtHijri(due)}${s.note ? ` (${s.note})` : ""}${dup ? " — مسجلة مسبقًا" : ""}`, { title: s.title || "جلسة", kind: "session", due, time: /^\d{1,2}:\d{2}$/.test(s.time || "") ? s.time : "", notes: s.note || "" }, !dup && daysLeft(due) >= 0);
  }
  for (const d of x.deadlines || []) {
    const due = normDate(d.date); if (!due || !d.title) continue;
    const dup = match && S.data.tasks.some((t) => t.caseId === match.id && t.due === due && t.title === d.title);
    add("task", `${d.title}: ${fmtDate(due)}${d.note ? ` (${d.note})` : ""}${dup ? " — مسجلة مسبقًا" : ""}`, { title: d.title, kind: "memo", due, notes: d.note || "", priority: "high" }, !dup && daysLeft(due) >= 0);
  }
  const j = x.judgment || {};
  if (j.no || j.summary) {
    const jdate = normDate(j.date), recv = normDate(j.receivedAt); const o = OBJECTIONS[j.objection];
    const same = match?.judgment?.no && digits(match.judgment.no) === digits(j.no);
    add("judgment", `الحكم ${j.no ? "رقم " + j.no : ""}${jdate ? " بتاريخ " + fmtDate(jdate) : ""}${j.summary ? ": " + j.summary : ""}${o && recv ? ` — مهلة ${o.t} من التسلّم ${fmtDate(recv)}` : o ? ` — طريق الاعتراض: ${o.t} (حدّد تاريخ التسلّم لاحتساب المهلة)` : ""}${same ? " — مسجل مسبقًا" : ""}`,
      { no: j.no || "", date: jdate, receivedAt: recv, type: o ? j.objection : "", summary: j.summary || "", urgent: !!j.urgent }, !same);
  }
  for (const u of x.updates || []) if (u) add("note", u, { text: String(u) });
  return { i, x, caseId: match?.id || "", changes: ch };
}
function najizReview(res) {
  const n = res.reduce((s, r) => s + r.changes.filter((c) => c.on).length, 0);
  return `<div class="card"><div class="card-h"><h3>المستجدات المستخرجة</h3><span class="sub">${res.length} قضية · ${n} تغيير محدد</span></div>
    <div class="stack" style="gap:14px">${res.map((r, ri) => `<div class="file" style="padding:14px 16px">
      <div class="row" style="justify-content:space-between;align-items:flex-start"><div class="grow"><b>${esc(r.x.title || "قضية")}</b><div class="small muted">${[r.x.najizNo && "رقم " + r.x.najizNo, r.x.court, r.x.circuit, (r.x.parties || []).map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join("، ")].filter(Boolean).map(esc).join(" · ")}</div></div>
        ${r.caseId ? pill("مطابقة", "ok") : pill("بلا مطابقة", "warn")}</div>
      <div class="field" style="margin-top:10px"><label for="nj-m-${ri}">تُحفظ في القضية</label><select id="nj-m-${ri}" class="inp" data-ch="najizMatch" data-r="${ri}">${opt("", "— اختر القضية أو تجاهل —", r.caseId)}${S.data.cases.map((c) => opt(c.id, `${c.title}${c.najiz ? " · " + c.najiz : ""}`, r.caseId)).join("")}</select></div>
      ${r.changes.length ? `<div class="pick" style="margin-top:10px">${r.changes.map((c, ci) => `<label><input type="checkbox" data-ch="najizToggle" data-r="${ri}" data-c="${ci}" ${c.on ? "checked" : ""}> <span class="pill ${{ task: "gold", judgment: "bad", note: "plain", najiz: "info", field: "info" }[c.k]}">${{ task: "موعد", judgment: "حكم", note: "مستجد", najiz: "رقم", field: "بيانات" }[c.k]}</span> <span>${esc(c.label)}</span></label>`).join("")}</div>` : `<p class="small muted">لا تغييرات جديدة على هذه القضية.</p>`}
    </div>`).join("")}
    <div class="row"><button class="btn primary" data-act="najizApply">${icon("check")}اعتماد التغييرات المحددة</button><span class="small muted">تُضاف المواعيد إلى التذكيرات ويُسجَّل كل تغيير في سجل القضية.</span></div></div></div>`;
}
CH.najizMatch = (el) => { const r = S.najizRes[+el.dataset.r]; const keep = r.x; S.najizRes[+el.dataset.r] = najizPrepare(keep, r.i, el.value ? caseById(el.value) : null); if (!el.value) S.najizRes[+el.dataset.r].caseId = ""; render(); };
CH.najizToggle = (el) => { S.najizRes[+el.dataset.r].changes[+el.dataset.c].on = el.checked; };

A.najizApply = async () => {
  if (!guardWrite()) return;
  let done = 0, skipped = 0;
  for (const r of S.najizRes || []) {
    const sel = r.changes.filter((c) => c.on); if (!sel.length) continue;
    const c = caseById(r.caseId); if (!c) { skipped += sel.length; continue; }
    const patch = {}; const lines = [];
    for (const ch of sel) {
      if (ch.k === "najiz" || ch.k === "field") { Object.assign(patch, ch.data); lines.push(ch.label); }
      else if (ch.k === "task") {
        await add("tasks", clean({ title: ch.data.title, kind: ch.data.kind, due: ch.data.due, time: ch.data.time, caseId: c.id, assignee: c.lawyerId || "", priority: ch.data.priority || (ch.data.kind === "session" ? "high" : "normal"), status: "open", source: "najiz", notes: ch.data.notes }));
        lines.push(ch.label);
      } else if (ch.k === "judgment") {
        const j = ch.data; const o = OBJECTIONS[j.type];
        let deadline = "";
        if (o && j.receivedAt) {
          const days = j.type === "appeal" && j.urgent ? o.urgentDays : o.days; const due = parseDay(j.receivedAt); due.setDate(due.getDate() + days); deadline = ymd(due);
          const prep = new Date(due); prep.setDate(prep.getDate() - 5);
          await add("tasks", { title: `آخر موعد لتقديم لائحة ${o.t}`, kind: "memo", due: deadline, caseId: c.id, assignee: c.lawyerId || "", priority: "high", status: "open", source: "najiz", notes: `${days} يومًا من ${fmtDate(j.receivedAt)} (${o.from}).` });
          await add("tasks", { title: `تجهيز لائحة ${o.t} ومراجعتها`, kind: "task", due: ymd(prep), caseId: c.id, assignee: c.lawyerId || "", priority: "high", status: "open", source: "najiz" });
          patch.status = o.status;
        } else if (!patch.status && ["intake", "active"].includes(c.status)) patch.status = "judgment";
        patch.judgment = clean({ ...(c.judgment || {}), type: j.type || c.judgment?.type || "", no: j.no, date: j.date, court: c.court, receivedAt: j.receivedAt, deadline: deadline || c.judgment?.deadline || "", urgent: j.urgent, summary: j.summary });
        lines.push(ch.label);
      } else if (ch.k === "note") lines.push(ch.label);
      done++;
    }
    patch.najizSyncAt = nowIso();
    await upd(`cases/${c.id}`, patch);
    await logCase(c.id, "status", `مستجدات من ناجز:\n- ${lines.join("\n- ")}`);
  }
  S.najizRes = null; S.najizText = ""; S.najizFiles = []; render();
  toast(done ? `اعتُمد ${done} تغيير${skipped ? `، وتُرك ${skipped} لعدم تحديد القضية` : ""}` : "لم يُعتمد شيء: حدّد القضية والتغييرات أولًا", !done);
};
