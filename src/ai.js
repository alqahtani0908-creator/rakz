/* ============ Rakz — files & AI ============ */
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const MAMMOTH = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
const ASSET_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "text/plain"];

const JURIS_GUIDE = `مرجع الاختصاص في المملكة العربية السعودية (للاسترشاد، مع التحقق):
- المحكمة العامة: الدعاوى العينية المتعلقة بالعقار، والدعاوى المدنية التي لا تدخل في اختصاص محكمة أخرى، وحوادث السير.
- المحكمة التجارية (نظام المحاكم التجارية): المنازعات بين التجار بسبب أعمالهم التجارية الأصلية أو التبعية، ومنازعات الشركات والشركاء، والإفلاس، والعقود التجارية، والمطالبات التي تزيد على النصاب المحدد ضد التاجر في أعماله التجارية.
- المحكمة العمالية: منازعات عقود العمل والأجور والحقوق والمكافآت وإصابات العمل والفصل والعقوبات التأديبية ومنازعات التأمينات المتعلقة بالعمل.
- محكمة الأحوال الشخصية: الزواج والطلاق والخلع والحضانة والنفقة والزيارة والإرث وإثبات الوقف والوصية والولاية.
- المحكمة الجزائية: الدعاوى الجزائية والحدود والتعزيرات والقصاص.
- المحاكم الإدارية (ديوان المظالم): الدعاوى ضد الجهات الحكومية، وإلغاء القرارات الإدارية، والعقود الإدارية، والتعويض عن أعمال الإدارة، والدعاوى التأديبية.
- محكمة التنفيذ: طلبات تنفيذ السندات التنفيذية (الأحكام، الشيكات، السندات لأمر، العقود الموثقة…).
- لجان شبه قضائية: لجنة المنازعات المصرفية والتمويلية (البنك المركزي)، لجان الفصل في منازعات الأوراق المالية، لجان الفصل في المخالفات والمنازعات الضريبية والجمركية، وغيرها حسب النظام الخاص.
- الاختصاص المكاني: الأصل أن تقام الدعوى في محكمة موطن المدعى عليه، مع استثناءات (العقار: محل العقار؛ الأحوال الشخصية: للمرأة والقاصر خيارات؛ العمالية: مكان العمل…).
- المواعيد: مدة الاعتراض على الأحكام بالاستئناف أو النقض ثلاثون يومًا من تاريخ تسلم صورة الحكم، وعشرة أيام في المسائل المستعجلة (نظام المرافعات الشرعية)؛ مع التحقق من الأنظمة الخاصة.`;

/* ---------- capability helpers ---------- */
function aiErr(e) {
  const m = { not_granted: "لم يُسمح للمنصة باستخدام Claude. فعّل الإذن من قائمة الأذونات.", rate_limited: "طلبات كثيرة في وقت قصير. انتظر دقيقة ثم أعد المحاولة.", prompt_too_large: "المستند طويل جدًا. جرّب ملفًا أصغر أو قسّمه.", refused: "تعذّر على المساعد معالجة هذا المحتوى.", invalid_json: "لم يُرجع المساعد نتيجة منظمة. أعد المحاولة.", session_expired: "انتهت الجلسة. سجّل الدخول من جديد.", sampling_disabled: "المساعد غير متاح لهذا الحساب.", image_rejected: "تعذّرت قراءة الصورة. جرّب ملفًا أوضح.", not_configured: "مفتاح المساعد غير مضاف أو غير صالح أو بلا رصيد. راجع ANTHROPIC_API_KEY في Supabase ورصيد حسابك في platform.claude.com." };
  if (e?.code === "cancelled") return;
  toast(m[e?.code] || "تعذّر الاتصال بالمساعد. حاول مرة أخرى.", true); console.warn(e);
}
function needSample() { if (!S.caps.sample) { toast("المساعد الذكي غير متاح في هذا العرض. افتح المنصة من Claude.", true); return false; } return true; }

/* ---------- upload ---------- */
A.uploadPick = (el) => { if (!guardWrite()) return; if (!S.caps.assets) { toast("رفع الملفات يحتاج صلاحية «محرر» على المنصة.", true); return; } $("#file-in")?.click(); };
CH.filesPicked = (el) => { const files = [...el.files]; el.value = ""; uploadFiles(el.dataset.id, files); };
function bindDrop() {
  const dz = $("#dropzone"); if (!dz) return;
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("over"));
  dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("over"); if (!guardWrite() || !S.caps.assets) return toast("رفع الملفات يحتاج صلاحية «محرر».", true); uploadFiles(S.route.id, [...e.dataTransfer.files]); });
}
function guessCat(name) {
  const n = name.replace(/[_\-.]/g, " ");
  const rules = [[/صحيفة|دعوى/, "صحيفة دعوى"], [/حكم|صك/, "حكم"], [/محضر|ضبط|جلسة/, "محضر جلسة"], [/وكالة/, "وكالة"], [/عقد|اتفاقية/, "عقد"], [/رد|جواب|خصم/, "مذكرة الخصم"], [/مذكرة|لائحة|اعتراض/, "مذكرة / لائحة"]];
  for (const [re, c] of rules) if (re.test(n)) return c;
  return "مستند / بينة";
}
async function uploadFiles(caseId, files) {
  S.uploads = S.uploads || [];
  for (const file of files) {
    if (file.size > 20 * 1024 * 1024) { toast(`${file.name}: الحد الأقصى 20 ميجابايت`, true); continue; }
    const u = { caseId, name: file.name, stage: "جارٍ الرفع…" }; S.uploads.push(u); render();
    try {
      let blob = file, type = file.type, wrapped = false;
      if (!ASSET_TYPES.includes(type)) { // e.g. .docx — store inside a JSON container
        const b64 = await blobToB64(file);
        blob = new Blob([JSON.stringify({ name: file.name, type: file.type || "application/octet-stream", b64 })], { type: "application/json" }); type = "application/json"; wrapped = true;
      }
      const res = await S.caps.assets.upload(blob, { type });
      u.stage = "قراءة النص…"; render();
      let text = ""; try { text = (await extractText(file)).text; } catch (e) { console.warn("extract", e); }
      const ref = S.caps.db.collection(`cases/${caseId}/files`).doc();
      await ref.set(clean({ name: file.name, mime: file.type, size: file.size, assetId: res.id, wrapped, category: guessCat(file.name), text: text.slice(0, 60000), at: nowIso(), by: myLid() || S.me.id }));
      await logCase(caseId, "file", `رُفع مرفق: ${file.name}`, { fileId: ref.id });
      S.uploads = S.uploads.filter((x) => x !== u); render();
      if (S.caps.sample) analyzeFile(caseId, ref.id, file);
    } catch (e) {
      S.uploads = S.uploads.filter((x) => x !== u); render();
      const m = { too_large: "الملف أكبر من المسموح", unsupported_type: "نوع الملف غير مدعوم", quota_or_state: "امتلأت مساحة التخزين", not_granted: "لا تملك صلاحية رفع الملفات" };
      toast(`${file.name}: ${m[e?.code] || "تعذّر الرفع"}`, true); console.error(e);
    }
  }
}
function blobToB64(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); }); }
function b64ToBlob(b64, type) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); }

async function fetchOriginal(f) {
  const r = await fetch(await assetSrc(f.assetId)); if (!r.ok) throw new Error("fetch " + r.status);
  if (f.wrapped) { const j = await r.json(); return new File([b64ToBlob(j.b64, j.type)], j.name, { type: j.type }); }
  return new File([await r.blob()], f.name, { type: f.mime });
}
A.viewFile = async (el) => {
  const f = byId(S.caseFiles, el.dataset.id); if (!f) return;
  const src = await assetSrc(f.assetId);
  const body = f.mime?.startsWith("image/") ? `<img src="${src}" alt="${esc(f.name)}" style="max-width:100%">` : f.mime === "application/pdf" ? `<iframe src="${src}" title="${esc(f.name)}"></iframe>` : f.text ? `<div class="paper" style="min-height:auto;white-space:pre-wrap">${esc(f.text)}</div>` : `<p>لا تتوفر معاينة لهذا النوع. استخدم «تنزيل».</p>`;
  modal(esc(f.name), body, `<button class="btn primary" data-act="downloadFile" data-id="${f.id}">${icon("download")}تنزيل</button><button class="btn ghost" data-act="closeModal">إغلاق</button>`, true);
};
A.downloadFile = async (el) => {
  const f = byId(S.caseFiles, el.dataset.id);
  if (!S.caps.downloads) return toast("التنزيل غير متاح في هذا العرض.", true);
  try { const file = await fetchOriginal(f); await S.caps.downloads.save({ filename: f.name, data: file }); }
  catch (e) { if (e?.code !== "declined") toast(e?.code === "rejected_extension" ? "هذا النوع من الملفات لا يمكن تنزيله من المنصة." : "تعذّر التنزيل.", true); }
};
A.deleteFile = (el) => confirmBox("حذف المرفق", "سيُحذف المرفق وتحليله من ملف القضية نهائيًا.", "حذف", async () => {
  const f = byId(S.caseFiles, el.dataset.id); const cid = S.route.id;
  await del(`cases/${cid}/files/${f.id}`);
  try { if (S.caps.assets) await S.caps.assets.delete(f.assetId); } catch (e) { console.warn(e); }
  await logCase(cid, "file", `حُذف مرفق: ${f.name}`); toast("حُذف المرفق");
}, true);

/* Inside Claude an asset is served at /_blob/<id>; the standalone build hands out short-lived signed URLs. */
async function assetSrc(id) { return S.caps.assets?.signedUrl ? S.caps.assets.signedUrl(id) : "/_blob/" + id; }

/* ---------- extraction ---------- */
async function ensurePdf() { if (!window.pdfjsLib) { await loadScript(PDFJS_WORKER); await loadScript(PDFJS); } return window.pdfjsLib; }
async function extractText(file) {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    const pdfjs = await ensurePdf();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let text = ""; const pages = Math.min(doc.numPages, 60);
    for (let i = 1; i <= pages; i++) { const p = await doc.getPage(i); const c = await p.getTextContent(); text += c.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join("") + "\n\n"; }
    return { text: text.trim(), doc, pages: doc.numPages };
  }
  if (name.endsWith(".docx")) { await loadScript(MAMMOTH); const r = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() }); return { text: r.value.trim() }; }
  if (file.type.startsWith("text/") || name.endsWith(".txt")) return { text: (await file.text()).trim() };
  return { text: "" };
}
async function pdfToImages(doc, max) {
  const out = [];
  for (let i = 1; i <= Math.min(doc.numPages, max); i++) {
    const page = await doc.getPage(i); const vp = page.getViewport({ scale: 1.6 });
    const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
    await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
    out.push(await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85)));
  }
  return out;
}

/* ---------- attachment analysis ---------- */
function caseContext(c) {
  return `بيانات القضية المسجلة في المكتب:
- العنوان: ${c.title}
- النوع: ${c.type || "غير محدد"}
- المحكمة/الجهة المسجلة: ${c.court || "غير محددة"}${c.circuit ? " — " + c.circuit : ""}${c.city ? " — " + c.city : ""}
- رقم ناجز: ${c.najiz || "—"}
- الموكل: ${clientName(c.clientId)} (${c.clientRole || "—"})
- الخصم: ${c.opponent || "—"}
- قيمة المطالبة: ${c.value || "—"}
- الوقائع المختصرة: ${(c.description || "—").slice(0, 2000)}${c.judgment ? `\n- الحكم المسجل: رقم ${c.judgment.no || "—"} بتاريخ ${c.judgment.date || "—"} من ${c.judgment.court || "—"}، تسلّمه ${c.judgment.receivedAt || "—"}، طريق الاعتراض: ${OBJECTIONS[c.judgment.type]?.t || "—"}، آخر موعد ${c.judgment.deadline || "—"}` : ""}`;
}
A.analyzeFile = async (el) => { const f = byId(S.caseFiles, el.dataset.id); if (f) analyzeFile(S.route.id, f.id); };
async function analyzeFile(caseId, fileId, fileObj) {
  if (!needSample()) return;
  const c = caseById(caseId); S.analyzing = S.analyzing || {};
  const setBusy = (s) => { S.analyzing[fileId] = s; scheduleRender(); };
  try {
    setBusy("يقرأ المستند…");
    let f = byId(S.caseFiles, fileId) || (await S.caps.db.doc(`cases/${caseId}/files/${fileId}`).get()).data();
    let text = f?.text || ""; let images = [];
    if (text.length < 300) { // scanned PDF or image: send page images
      const lim = await S.caps.sample.limits().catch(() => null);
      const maxImg = Math.min(lim?.images?.maxCount || 0, 6);
      if (maxImg) {
        const file = fileObj || (f.assetId ? await fetchOriginal({ ...f, id: fileId }) : null);
        if (file?.type?.startsWith("image/")) images = [file];
        else if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) { setBusy("يقرأ الصفحات الممسوحة…"); const { doc } = await extractText(file); images = await pdfToImages(doc, maxImg); }
      }
      if (!text && !images.length) { delete S.analyzing[fileId]; scheduleRender(); return toast("لا يحتوي الملف على نص قابل للقراءة.", true); }
    }
    setBusy("يحلل المحتوى…");
    const prompt = `أنت محامٍ سعودي خبير في مكتب «ركز النظامية للمحاماة». حلّل المستند المرفق في سياق القضية، واستخرج كل ما يلزم لإدارة القضية.
تاريخ اليوم: ${todayStr()} (${fmtHijri(todayStr())}).
${caseContext(c)}

${JURIS_GUIDE}

اسم الملف: ${f.name} — تصنيفه المبدئي: ${f.category || "—"}
${text ? `نص المستند:\n"""\n${text.slice(0, 55000)}\n"""` : "المستند مرفق كصور لصفحاته (ممسوح ضوئيًا). اقرأه بعناية."}

التعليمات:
1) حوّل أي تاريخ هجري إلى ميلادي بصيغة YYYY-MM-DD (تقويم أم القرى). لا تخترع تواريخ.
2) استخرج كل جلسة قادمة، وكل موعد لتقديم لائحة أو مذكرة أو مستند، وكل مهلة نظامية (مثل مهلة الاعتراض 30 يومًا من تسلم الحكم) واحسب تاريخها إن أمكن، وضع حسابك في note.
3) تحقق من جهة الاختصاص النوعي والمكاني لموضوع النزاع، وقارنها بالجهة المسجلة للقضية؛ matchesCase تكون true أو false أو null إن لم تكفِ المعلومات.
4) اكتب بالعربية الفصحى المختصرة.

أعد JSON فقط بهذا الشكل:
{"docType":"نوع المستند (صحيفة دعوى/مذكرة جوابية/حكم ابتدائي/محضر جلسة/عقد/…)","summary":"خلاصة في 3-6 أسطر","keyPoints":["…"],"parties":[{"name":"…","role":"…"}],"court":{"name":"","circuit":"","city":"","caseNumber":""},"jurisdiction":{"expectedCourt":"","basis":"السند المختصر","matchesCase":true,"note":""},"events":[{"title":"…","kind":"session|memo|requirement|task|event","date":"YYYY-MM-DD أو فارغ","time":"HH:MM أو فارغ","note":""}],"requirements":["مستندات أو إجراءات مطلوبة"],"nextSteps":["…"],"risks":["…"],"suggestedCategory":"${FILE_CATS.join("|")}"}`;
    const opts = { modelTier: "default" }; if (images.length) opts.images = images;
    const a = await S.caps.sample.json(prompt, opts);
    if (!a || typeof a !== "object") throw { code: "invalid_json" };
    a.events = (Array.isArray(a.events) ? a.events : []).filter((e) => e && e.title).map((e) => ({ title: String(e.title), kind: TASK_KINDS[e.kind] ? e.kind : "task", date: /^\d{4}-\d{2}-\d{2}$/.test(e.date || "") ? e.date : "", time: /^\d{1,2}:\d{2}$/.test(e.time || "") ? e.time : "", note: String(e.note || "") }));
    const patch = { analysis: a, analyzedAt: nowIso(), addedEvents: [] };
    if (a.suggestedCategory && FILE_CATS.includes(a.suggestedCategory)) patch.category = a.suggestedCategory;
    await upd(`cases/${caseId}/files/${fileId}`, patch);
    const caseUpd = {}; if (a.jurisdiction) caseUpd.ai = { ...(c.ai || {}), jurisdiction: a.jurisdiction, jurisAt: nowIso() };
    if (!c.najiz && a.court?.caseNumber) caseUpd.najiz = String(a.court.caseNumber);
    if (Object.keys(caseUpd).length) await upd(`cases/${caseId}`, caseUpd);
    await logCase(caseId, "ai", `حلّل المساعد «${f.name}»: ${a.docType || ""}${a.events.length ? ` — ${a.events.length} موعد/متطلب مستخرج` : ""}${a.jurisdiction?.matchesCase === false ? " — تنبيه: يُحتمل عدم الاختصاص" : ""}`, { fileId });
    S.ui.openFile = fileId; toast("اكتمل تحليل المستند");
  } catch (e) { aiErr(e); }
  finally { delete S.analyzing[fileId]; scheduleRender(); }
}
async function addEventsFrom(fileId, idxs) {
  const f = byId(S.caseFiles, fileId); const c = caseById(S.route.id); const done = new Set(f.addedEvents || []);
  for (const i of idxs) {
    if (done.has(i)) continue; const e = f.analysis.events[i];
    await add("tasks", { title: e.title, kind: e.kind, due: e.date, time: e.time, notes: e.note, caseId: c.id, assignee: "", priority: e.kind === "memo" || e.kind === "session" ? "high" : "normal", status: "open", source: "ai", fileId });
    done.add(i);
  }
  await upd(`cases/${c.id}/files/${fileId}`, { addedEvents: [...done] });
  await logCase(c.id, "task", `أُضيف ${idxs.length} تذكير من تحليل «${f.name}»`);
  toast("أُضيفت إلى المهام والتذكيرات");
}
A.addEvent = (el) => addEventsFrom(el.dataset.id, [Number(el.dataset.i)]);
A.addAllEvents = (el) => { const f = byId(S.caseFiles, el.dataset.id); addEventsFrom(el.dataset.id, f.analysis.events.map((_, i) => i)); };

/* ---------- case brief ---------- */
A.stopGen = () => { S.gen?.ctl?.abort(); };
A.caseBrief = async (el) => {
  if (!needSample() || !guardWrite()) return;
  const c = caseById(el.dataset.id);
  const files = S.caseFiles.map((f) => `• ${f.name} (${f.category || ""}، رُفع ${fmtDate((f.at || "").slice(0, 10))})${f.analysis ? `\n  النوع: ${f.analysis.docType || ""}\n  الخلاصة: ${f.analysis.summary || ""}\n  أهم النقاط: ${(f.analysis.keyPoints || []).join("؛ ")}` : f.text ? `\n  مقتطف: ${f.text.slice(0, 1500)}` : ""}`).join("\n");
  const log = [...S.caseLog].reverse().slice(-80).map((e) => `- ${(e.at || "").slice(0, 10)}: ${e.text}`).join("\n");
  const tasks = S.data.tasks.filter((t) => t.caseId === c.id).map((t) => `- [${t.status === "done" ? "منجز" : "مفتوح"}] ${TASK_KINDS[t.kind]?.t}: ${t.title} ${t.due ? "(" + t.due + ")" : ""}`).join("\n");
  const prompt = `أنت شريك أول في مكتب «ركز النظامية للمحاماة» بالرياض. اكتب قراءة مهنية لمجريات القضية التالية لمساعدة المحامي المسؤول.
تاريخ اليوم: ${todayStr()} (${fmtHijri(todayStr())}).
${caseContext(c)}

${JURIS_GUIDE}

المرفقات وتحليلاتها:
${files || "لا توجد مرفقات."}

سجل الإجراءات (الأقدم أولًا):
${log || "فارغ"}

المهام والمواعيد:
${tasks || "لا يوجد"}

اكتب نصًا عربيًا منظمًا بعناوين قصيرة يسبقها «■ »، بلا Markdown، بهذه الأقسام:
■ ملخص القضية
■ المجريات بالترتيب الزمني
■ الموقف الحالي
■ جهة الاختصاص (هل الجهة المسجلة مختصة نوعيًا ومكانيًا؟ ولماذا؟)
■ المواعيد والمهل القادمة (مع أي مهلة نظامية يجب احتسابها)
■ المتطلبات الناقصة
■ نقاط القوة والضعف
■ التوصيات العملية
كن دقيقًا ولا تخترع وقائع غير واردة؛ إن نقصت معلومة فاذكر ذلك.`;
  const ctl = new AbortController(); S.gen = { kind: "brief", caseId: c.id, text: "", ctl }; render();
  try {
    const { text } = await S.caps.sample(prompt, { signal: ctl.signal, cache: false, onText: ({ text }) => { S.gen.text = text; const o = $("#gen-out"); if (o) o.textContent = text; } });
    await upd(`cases/${c.id}`, { ai: { ...(c.ai || {}), brief: text, briefAt: nowIso() } });
    await logCase(c.id, "ai", "حدّث المساعد قراءة مجريات القضية");
  } catch (e) { aiErr(e); }
  finally { S.gen = null; render(); }
};
