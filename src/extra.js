/* ============ Rakz — objections, client reports, finance, consultations ============ */

/* ---------------- Objection deadlines (استئناف / نقض / التماس) ---------------- */
const OBJECTIONS = {
  appeal:    { t: "الاستئناف", days: 30, urgentDays: 10, status: "appeal", pleading: "appeal", from: "تاريخ تسلّم صورة الحكم", note: "ثلاثون يومًا من تسلّم صورة الحكم، وعشرة أيام في المسائل المستعجلة." },
  cassation: { t: "النقض", days: 30, status: "cassation", pleading: "cassation", from: "تاريخ تسلّم صورة حكم الاستئناف", note: "ثلاثون يومًا من تسلّم صورة حكم محكمة الاستئناف." },
  review:    { t: "التماس إعادة النظر", days: 30, status: "review", pleading: "review", from: "تاريخ العلم بسبب الالتماس", note: "ثلاثون يومًا تبدأ بحسب سبب الالتماس (كظهور الورقة القاطعة أو ثبوت التزوير أو العلم بالحكم الغيابي)." },
};
A.deadline = (el) => {
  const c = caseById(el.dataset.id); const j = c.judgment || {};
  modal("احتساب مهلة الاعتراض", `<form id="dl-form" data-form="deadline" class="grid2"><input type="hidden" name="caseId" value="${c.id}">
    <div class="field span2"><label for="dl-type">طريق الاعتراض</label><select id="dl-type" class="inp" name="type">${Object.entries(OBJECTIONS).map(([k, v]) => opt(k, v.t, j.type || (c.status === "appeal" ? "cassation" : "appeal"))).join("")}</select></div>
    <div class="field"><label for="dl-date">التاريخ الذي تبدأ منه المهلة</label><input id="dl-date" class="inp" type="date" name="date" required value="${esc(j.receivedAt || todayStr())}"><span class="hint">تسلّم صورة الحكم، أو العلم بسبب الالتماس</span></div>
    <div class="field"><label for="dl-no">رقم الحكم</label><input id="dl-no" class="inp num" name="no" value="${esc(j.no)}"></div>
    <div class="field"><label for="dl-jd">تاريخ الحكم</label><input id="dl-jd" class="inp" type="date" name="jdate" value="${esc(j.date)}"></div>
    <div class="field"><label for="dl-court">المحكمة المصدرة</label><input id="dl-court" class="inp" name="court" value="${esc(j.court || c.court || "")}"></div>
    <label class="chk span2"><input type="checkbox" name="urgent" value="1"> مسألة مستعجلة (مهلة الاستئناف عشرة أيام)</label>
    <div class="span2 small muted">المهل الواردة: ${Object.values(OBJECTIONS).map((o) => `<b>${o.t}</b>: ${o.note}`).join(" · ")} لا يُحسب يوم التسلّم، وإذا صادف آخر المهلة عطلة رسمية امتدت إلى أول يوم عمل. تحقّق من النظام الخاص بالقضية.</div></form>`,
    `<button class="btn primary" type="submit" form="dl-form">${icon("cal")}احسب وأضف للتذكيرات</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
};
F.deadline = async (d) => {
  const o = OBJECTIONS[d.type]; const days = d.type === "appeal" && d.urgent === "1" ? o.urgentDays : o.days;
  const start = parseDay(d.date); const due = new Date(start); due.setDate(due.getDate() + days);
  const prep = new Date(due); prep.setDate(prep.getDate() - Math.min(5, Math.floor(days / 2)));
  const c = caseById(d.caseId); const lid = c.lawyerId || "";
  const title = `آخر موعد لتقديم لائحة ${o.t}`;
  await add("tasks", { title, kind: "memo", due: ymd(due), caseId: c.id, assignee: lid, priority: "high", status: "open", source: "manual", notes: `${days} يومًا من ${fmtDate(d.date)} (${o.from}).` });
  await add("tasks", { title: `تجهيز لائحة ${o.t} ومراجعتها`, kind: "task", due: ymd(prep), caseId: c.id, assignee: lid, priority: "high", status: "open", source: "manual" });
  await upd(`cases/${c.id}`, { status: o.status, judgment: { type: d.type, no: d.no, date: d.jdate, court: d.court, receivedAt: d.date, deadline: ymd(due), urgent: d.urgent === "1" } });
  await logCase(c.id, "status", `بدء مهلة ${o.t}: ${days} يومًا من ${fmtDate(d.date)}؛ آخر موعد ${fmtDate(ymd(due))}${d.no ? ` — الحكم رقم ${d.no}` : ""}`);
  modal("أُضيفت المهلة", `<p style="margin:0">آخر موعد لتقديم لائحة ${o.t}: <b>${fmtDate(ymd(due), true)}</b> الموافق ${esc(fmtHijri(ymd(due)))}.</p><p class="muted small" style="margin:0">أُضيف تذكيران: موعد التقديم، وتجهيز اللائحة قبله.</p>`,
    `<button class="btn gold" data-act="draftObjection" data-id="${c.id}" data-type="${o.pleading}">${icon("spark")}صياغة لائحة ${o.t} الآن</button><button class="btn ghost" data-act="closeModal">لاحقًا</button>`);
};
A.draftObjection = (el) => { closeModal(); S.drafts["pl.case"] = el.dataset.id; S.drafts["pl.type"] = el.dataset.type; go("drafting", null, "pleading"); };

/* ---------------- Client reports (WhatsApp) ---------------- */
function waNumber(p) {
  let d = String(p || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("05") && d.length === 10) d = "966" + d.slice(1);
  else if (d.startsWith("5") && d.length === 9) d = "966" + d;
  return d;
}
function waHref(phone, text) { const n = waNumber(phone); return `https://wa.me/${n}?text=${encodeURIComponent(text || "")}`; }
CASE_TABS.reports = (c) => {
  const cl = byId(S.data.clients, c.clientId) || {};
  const key = "rep." + c.id; const text = S.drafts[key] ?? "";
  const since = S.drafts["repSince." + c.id] || (c.lastReportAt || c.openedAt || (c.createdAt || "").slice(0, 10) || todayStr()).slice(0, 10);
  const gen = S.gen?.kind === "report" && S.gen.caseId === c.id;
  return `<div class="cols"><div class="card stack" style="gap:14px"><div class="card-h"><h3>تقرير مستجدات للعميل</h3><span class="ai-tag">${icon("wa")}يُرسل عبر واتساب</span></div>
    <div class="grid2"><div class="field"><label for="rep-since">المستجدات منذ</label><input id="rep-since" class="inp" type="date" value="${esc(since)}" data-ch="repSince" data-id="${c.id}"></div>
      <div class="field"><label for="rep-phone">جوال العميل</label><input id="rep-phone" class="inp num" value="${esc(S.drafts["repPhone." + c.id] ?? cl.phone ?? "")}" data-draft="repPhone.${c.id}" data-live="repLive" placeholder="05xxxxxxxx"></div></div>
    <div class="row">${gen ? `<span class="thinking">يكتب المساعد التقرير…</span><button class="btn sm" data-act="stopGen">إيقاف</button>` : `<button class="btn gold" data-act="genReport" data-id="${c.id}" ${S.caps.sample ? "" : "disabled"}>${icon("spark")}إعداد التقرير بالمساعد</button><button class="btn" data-act="tplReport" data-id="${c.id}">${icon("report")}تقرير من السجل مباشرة</button>`}</div>
    <div class="field"><label for="rep-text">نص الرسالة (يمكن تعديله)</label><textarea id="rep-text" class="inp" rows="12" data-draft="${key}" data-live="repLive" ${gen ? "readonly" : ""}>${esc(gen ? S.gen.text : text)}</textarea></div>
    <div class="row"><a id="wa-link" class="btn primary" href="${esc(waHref(S.drafts["repPhone." + c.id] ?? cl.phone, text))}" target="_blank" rel="noopener" style="background:#1F8F55;border-color:#1F8F55">${icon("wa")}فتح واتساب بالرسالة</a>
      <button class="btn" data-act="copyReport">${icon("copy")}نسخ</button><button class="btn" data-act="markSent" data-id="${c.id}">${icon("check")}تسجيل كمُرسل</button></div>
    <p class="small muted" style="margin:0">يفتح واتساب برسالة جاهزة للعميل، والإرسال يتم منك. بعد الإرسال اضغط «تسجيل كمُرسل» ليُحفظ التقرير في سجل القضية.${cl.phone ? "" : " لا يوجد جوال مسجل لهذا العميل؛ أضفه من صفحة العملاء أو اكتبه أعلاه."}</p></div>
    <div class="card"><div class="card-h"><h3>التقارير السابقة</h3><span class="sub num">${S.caseReports.length}</span></div>
      ${S.caseReports.length ? `<div class="list">${S.caseReports.map((r) => `<details class="li" style="display:block"><summary style="cursor:pointer"><b>${fmtWhen(r.at)}</b> <span class="muted small">· ${esc(lawyerName(r.by) === "غير مسند" ? "" : lawyerName(r.by))}</span></summary><div class="prose small" style="margin-top:6px">${esc(r.text)}</div></details>`).join("")}</div>` : emptyBox("wa", "لم يُرسل تقرير بعد", "")}</div></div>`;
};
CH.repSince = (el) => { S.drafts["repSince." + el.dataset.id] = el.value; };
CH.repLive = () => { const a = $("#wa-link"); if (a) a.href = waHref($("#rep-phone")?.value, $("#rep-text")?.value); };
A.copyReport = async () => { const t = $("#rep-text"); try { await navigator.clipboard.writeText(t.value); toast("نُسخت الرسالة"); } catch { t.select(); toast("حدّد النص وانسخه يدويًا"); } };
function reportFacts(c, since) {
  const log = [...S.caseLog].reverse().filter((e) => (e.at || "").slice(0, 10) >= since && !["ai", "assign"].includes(e.kind));
  const up = openTasks().filter((t) => t.caseId === c.id && t.due && t.due >= todayStr() && ["session", "memo", "event", "requirement"].includes(t.kind)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
  const reqs = S.caseFiles.flatMap((f) => (f.analysis?.requirements || [])).slice(0, 6);
  return { log, up, reqs };
}
A.tplReport = (el) => {
  const c = caseById(el.dataset.id); const since = $("#rep-since").value; const { log, up } = reportFacts(c, since);
  const cl = byId(S.data.clients, c.clientId) || {};
  const text = `السلام عليكم ${cl.name ? "أ. " + cl.name : ""}،
نفيدكم بمستجدات قضيتكم «${c.title}»${c.najiz ? ` (رقم ${c.najiz})` : ""} منذ ${fmtDate(since)}:

${log.length ? log.map((e) => `• ${fmtDate((e.at || "").slice(0, 10))}: ${e.text}`).join("\n") : "• لا توجد إجراءات جديدة خلال هذه الفترة، والقضية تحت المتابعة."}
${up.length ? `\nالمواعيد القادمة:\n${up.map((t) => `• ${TASK_KINDS[t.kind].t}: ${fmtDate(t.due, true)}${t.time ? " الساعة " + t.time : ""}`).join("\n")}` : ""}

نسعد بالرد على استفساراتكم.
${S.firm.nameAr}`;
  S.drafts["rep." + c.id] = text; render();
};
A.genReport = async (el) => {
  if (!needSample()) return;
  const c = caseById(el.dataset.id); const since = $("#rep-since").value; const { log, up, reqs } = reportFacts(c, since);
  const cl = byId(S.data.clients, c.clientId) || {};
  const prompt = `اكتب رسالة واتساب لعميل مكتب «${S.firm.nameAr}» تطلعه على مستجدات قضيته.
العميل: ${cl.name || "—"} (صفته في القضية: ${c.clientRole || "—"})
القضية: ${c.title}${c.najiz ? ` — رقم ${c.najiz}` : ""} — ${c.court || ""} — الحالة: ${STATUSES[c.status]?.t || ""}
الفترة: منذ ${fmtDate(since)} حتى ${fmtDate(todayStr())}
الإجراءات خلال الفترة:
${log.map((e) => `- ${(e.at || "").slice(0, 10)}: ${e.text}`).join("\n") || "لا يوجد"}
المواعيد القادمة:
${up.map((t) => `- ${TASK_KINDS[t.kind].t}: ${t.title} — ${t.due}${t.time ? " " + t.time : ""}`).join("\n") || "لا يوجد"}
ما قد يُطلب من العميل:
${reqs.map((r) => "- " + r).join("\n") || "لا يوجد"}

الشروط: عربية مهذبة وواضحة لغير المختص، تبدأ بالسلام وتسمية العميل، فقرات قصيرة ونقاط تبدأ بـ «•»، تذكر التواريخ باليوم والشهر، بلا مصطلحات داخلية أو أسماء ملفات أو ملاحظات تقييمية عن الموقف، ولا وعود بنتيجة. إن وُجد مطلوب من العميل فاذكره بوضوح مع موعده. اختم بعبارة لطيفة واسم المكتب. لا تتجاوز 180 كلمة. أعد نص الرسالة فقط.`;
  const ctl = new AbortController(); S.gen = { kind: "report", caseId: c.id, text: "", ctl }; render();
  try {
    const { text } = await S.caps.sample(prompt, { signal: ctl.signal, cache: false, onText: ({ text }) => { S.gen.text = text; const t = $("#rep-text"); if (t) { t.value = text; CH.repLive(); } } });
    S.drafts["rep." + c.id] = text.trim();
  } catch (e) { aiErr(e); }
  finally { S.gen = null; render(); }
};
A.markSent = async (el) => {
  const c = caseById(el.dataset.id); const text = $("#rep-text").value.trim(); if (!text) return toast("اكتب نص التقرير أولًا", true);
  if (!guardWrite()) return;
  try { await S.caps.db.collection(`cases/${c.id}/reports`).doc().set(clean({ text, at: nowIso(), by: myLid() || S.me.id, phone: waNumber($("#rep-phone").value), since: $("#rep-since").value })); } catch (e) { dbErr(e); }
  await upd(`cases/${c.id}`, { lastReportAt: nowIso() });
  await logCase(c.id, "note", "أُرسل تقرير مستجدات للعميل عبر واتساب");
  delete S.drafts["rep." + c.id]; delete S.drafts["repSince." + c.id]; toast("سُجّل التقرير");
};

/* ---------------- Finance ---------------- */
const PAY_METHODS = ["تحويل بنكي", "نقدًا", "شبكة / مدى", "شيك", "سداد"];
const EXP_CATS = ["رسوم قضائية", "رسوم توثيق", "ترجمة", "خبرة / تقييم", "سفر وتنقل", "طباعة وتصوير", "أخرى"];
const fin = (type) => S.data.finance.filter((x) => x.type === type);
const num = (v) => Number(String(v ?? "").replace(/[,٬\s]/g, "")) || 0;
function invPaid(inv) { return fin("payment").filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + num(p.amount), 0); }
function invState(inv) {
  if (inv.status === "void") return { k: "void", t: "ملغاة", c: "" };
  const paid = invPaid(inv);
  if (paid >= num(inv.total) - 0.009) return { k: "paid", t: "مسددة", c: "ok" };
  if (inv.due && daysLeft(inv.due) < 0) return { k: "late", t: paid ? "متأخرة (جزئي)" : "متأخرة", c: "bad" };
  return paid ? { k: "partial", t: "مسددة جزئيًا", c: "warn" } : { k: "open", t: "غير مسددة", c: "info" };
}
function finTotals(filter = () => true) {
  const inv = fin("invoice").filter((x) => x.status !== "void" && filter(x));
  const invoiced = inv.reduce((s, x) => s + num(x.total), 0);
  const collected = fin("payment").filter(filter).reduce((s, x) => s + num(x.amount), 0);
  const late = inv.filter((x) => invState(x).k === "late").reduce((s, x) => s + num(x.total) - invPaid(x), 0);
  const expenses = fin("expense").filter(filter).reduce((s, x) => s + num(x.amount), 0);
  return { invoiced, collected, outstanding: Math.max(0, inv.reduce((s, x) => s + Math.max(0, num(x.total) - invPaid(x)), 0)), late, expenses };
}
const sar = (n) => `${money(n)} <span class="small muted">ر.س</span>`;
function invRow(x) {
  const st = invState(x); const paid = invPaid(x);
  return `<tr><td class="primary-cell"><div class="t">${esc(x.desc || "مطالبة")}</div><div class="ref">${esc(x.no || "")} · ${fmtDate(x.date)}</div></td><td data-label="العميل">${esc(clientName(x.clientId))}</td>
    <td data-label="الإجمالي" class="num">${money(x.total)}</td><td data-label="المسدد" class="num">${money(paid)}</td><td data-label="الاستحقاق" class="num">${x.due ? fmtDate(x.due) : "—"}</td><td data-label="الحالة">${pill(st.t, st.c)}</td>
    <td data-noact="1"><div class="row" style="gap:4px;flex-wrap:nowrap">${st.k !== "paid" && st.k !== "void" ? `<button class="btn sm" data-act="newPayment" data-inv="${x.id}">${icon("plus")}دفعة</button>` : ""}<button class="btn sm ghost" data-act="invoiceDoc" data-id="${x.id}" title="مستند المطالبة">${icon("docs")}</button><button class="btn sm ghost" data-act="editFin" data-id="${x.id}" title="تعديل">${icon("edit")}</button></div></td></tr>`;
}
const invTable = (rows) => rows.length ? `<div class="tbl-wrap"><table class="tbl resp"><thead><tr><th>المطالبة</th><th>العميل</th><th>الإجمالي</th><th>المسدد</th><th>الاستحقاق</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(invRow).join("")}</tbody></table></div>` : "";
const payTable = (rows) => rows.length ? `<div class="tbl-wrap"><table class="tbl resp"><thead><tr><th>الدفعة</th><th>العميل</th><th>المبلغ</th><th>الطريقة</th><th></th></tr></thead><tbody>${rows.map((x) => `<tr><td class="primary-cell"><div class="t">${fmtDate(x.date)}</div><div class="ref">${x.invoiceId ? esc(byId(S.data.finance, x.invoiceId)?.no || "") : "دفعة مقدمة"}${x.ref ? " · " + esc(x.ref) : ""}</div></td><td data-label="العميل">${esc(clientName(x.clientId))}</td><td data-label="المبلغ" class="num">${money(x.amount)}</td><td data-label="الطريقة">${esc(x.method || "")}</td><td data-noact="1"><button class="btn sm ghost" data-act="editFin" data-id="${x.id}">${icon("edit")}</button></td></tr>`).join("")}</tbody></table></div>` : "";
const expTable = (rows) => rows.length ? `<div class="tbl-wrap"><table class="tbl resp"><thead><tr><th>المصروف</th><th>القضية</th><th>المبلغ</th><th>على العميل</th><th></th></tr></thead><tbody>${rows.map((x) => `<tr><td class="primary-cell"><div class="t">${esc(x.category || "")}${x.desc ? " — " + esc(x.desc) : ""}</div><div class="ref">${fmtDate(x.date)}</div></td><td data-label="القضية">${esc(caseById(x.caseId)?.title || "—")}</td><td data-label="المبلغ" class="num">${money(x.amount)}</td><td data-label="على العميل">${x.billable ? pill("نعم", "gold") : pill("لا", "plain")}</td><td data-noact="1"><button class="btn sm ghost" data-act="editFin" data-id="${x.id}">${icon("edit")}</button></td></tr>`).join("")}</tbody></table></div>` : "";

VIEWS.finance = () => {
  const tab = S.route.tab || "invoices"; const t = finTotals();
  const agreed = S.data.cases.filter((c) => c.status !== "closed").reduce((s, c) => s + num(c.fee), 0) + S.data.consults.filter((c) => c.status !== "done").reduce((s, c) => s + num(c.fee), 0);
  const invs = [...fin("invoice")].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const recv = S.data.clients.map((cl) => [cl, finTotals((x) => x.clientId === cl.id)]).filter(([, v]) => v.invoiced || v.collected).sort((a, b) => b[1].outstanding - a[1].outstanding);
  return `<div class="page-head"><div><h1>المالية</h1><p>الأتعاب والمطالبات والتحصيل والمصروفات لكل قضية وعميل.</p></div>
    <div class="row"><button class="btn gold" data-act="newInvoice">${icon("receipt")}مطالبة جديدة</button><button class="btn" data-act="newPayment">${icon("plus")}تسجيل دفعة</button><button class="btn" data-act="newExpense">${icon("plus")}مصروف</button></div></div>
  <div class="kpis">
    <div class="kpi"><span class="lbl">أتعاب متفق عليها (جارية)</span><span class="val">${money(agreed)}</span><span class="foot">قضايا واستشارات غير منتهية</span></div>
    <div class="kpi"><span class="lbl">المحصّل</span><span class="val" style="color:var(--ok)">${money(t.collected)}</span><span class="foot">من ${money(t.invoiced)} مفوتر</span></div>
    <div class="kpi attn"><span class="lbl">المستحق على العملاء</span><span class="val">${money(t.outstanding)}</span><span class="foot">مطالبات لم تُسدد</span></div>
    <div class="kpi ${t.late ? "alert" : ""}"><span class="lbl">متأخر السداد</span><span class="val">${money(t.late)}</span><span class="foot">المصروفات ${money(t.expenses)}</span></div></div>
  <div class="tabs">${[["invoices", "المطالبات", invs.length], ["payments", "المدفوعات", fin("payment").length], ["expenses", "المصروفات", fin("expense").length], ["receivables", "ذمم العملاء"]].map(([k, l, n]) => `<a class="${tab === k ? "on" : ""}" data-act="tab" data-tab="${k}">${l}${n ? `<span class="n num">${n}</span>` : ""}</a>`).join("")}</div>
  ${tab === "invoices" ? invTable(invs) || `<div class="card">${emptyBox("receipt", "لا مطالبات بعد", "أنشئ مطالبة بأتعاب قضية أو استشارة، ثم سجّل دفعاتها.", `<button class="btn gold" data-act="newInvoice">${icon("receipt")}مطالبة جديدة</button>`)}</div>`
  : tab === "payments" ? payTable([...fin("payment")].sort((a, b) => (b.date || "").localeCompare(a.date || ""))) || `<div class="card">${emptyBox("coin", "لا مدفوعات مسجلة", "")}</div>`
  : tab === "expenses" ? expTable([...fin("expense")].sort((a, b) => (b.date || "").localeCompare(a.date || ""))) || `<div class="card">${emptyBox("coin", "لا مصروفات مسجلة", "")}</div>`
  : recv.length ? `<div class="tbl-wrap"><table class="tbl resp"><thead><tr><th>العميل</th><th>المفوتر</th><th>المحصّل</th><th>المستحق</th><th>المتأخر</th></tr></thead><tbody>${recv.map(([cl, v]) => `<tr data-act="clientCases" data-id="${cl.id}"><td class="primary-cell"><div class="t">${esc(cl.name)}</div></td><td data-label="المفوتر" class="num">${money(v.invoiced)}</td><td data-label="المحصّل" class="num">${money(v.collected)}</td><td data-label="المستحق" class="num"><b>${money(v.outstanding)}</b></td><td data-label="المتأخر" class="num" style="color:${v.late ? "var(--bad)" : "inherit"}">${money(v.late)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="card">${emptyBox("clients", "لا ذمم بعد", "")}</div>`}`;
};
CASE_TABS.finance = (c) => {
  const t = finTotals((x) => x.caseId === c.id); const fee = num(c.fee);
  const invs = fin("invoice").filter((x) => x.caseId === c.id); const pays = fin("payment").filter((x) => x.caseId === c.id); const exps = fin("expense").filter((x) => x.caseId === c.id);
  return `<div class="kpis">
    <div class="kpi"><span class="lbl">الأتعاب المتفق عليها</span><span class="val">${money(fee)}</span><span class="foot">${fee ? `غير مفوتر ${money(Math.max(0, fee - t.invoiced))}` : `<a data-act="editCase" data-id="${c.id}" style="cursor:pointer">حدّد الأتعاب</a>`}</span></div>
    <div class="kpi"><span class="lbl">المفوتر</span><span class="val">${money(t.invoiced)}</span><span class="foot">${invs.length} مطالبة</span></div>
    <div class="kpi"><span class="lbl">المحصّل</span><span class="val" style="color:var(--ok)">${money(t.collected)}</span><span class="foot">المستحق ${money(t.outstanding)}</span></div>
    <div class="kpi"><span class="lbl">المصروفات</span><span class="val">${money(t.expenses)}</span><span class="foot">على العميل ${money(exps.filter((x) => x.billable).reduce((s, x) => s + num(x.amount), 0))}</span></div></div>
  <div class="row"><button class="btn gold" data-act="newInvoice" data-case="${c.id}">${icon("receipt")}مطالبة</button><button class="btn" data-act="newPayment" data-case="${c.id}">${icon("plus")}دفعة</button><button class="btn" data-act="newExpense" data-case="${c.id}">${icon("plus")}مصروف</button></div>
  ${invTable(invs)}${payTable(pays)}${expTable(exps)}
  ${!invs.length && !pays.length && !exps.length ? `<div class="card">${emptyBox("coin", "لا حركات مالية لهذه القضية", "")}</div>` : ""}`;
};
function finNo(type) { const y = new Date().getFullYear(); const p = type === "invoice" ? "RK-I" : "RK-R"; return `${p}-${y}-${String(fin(type).length + 1).padStart(3, "0")}`; }
function invoiceForm(x = {}) {
  const c = caseById(x.caseId); const cs = byId(S.data.consults, x.consultId);
  return `<form id="fin-form" data-form="saveInvoice" class="grid2"><input type="hidden" name="id" value="${esc(x.id || "")}"><input type="hidden" name="consultId" value="${esc(x.consultId || "")}">
    <div class="field"><label for="iv-client">العميل</label><select id="iv-client" class="inp" name="clientId" required>${clientOpts(x.clientId || c?.clientId || cs?.clientId)}</select></div>
    <div class="field"><label for="iv-case">القضية</label><select id="iv-case" class="inp" name="caseId">${caseOpts(x.caseId)}</select></div>
    <div class="field span2"><label for="iv-desc">البيان</label><input id="iv-desc" class="inp" name="desc" required value="${esc(x.desc || (c ? `أتعاب ${c.title}` : cs ? `أتعاب استشارة: ${cs.subject}` : ""))}"></div>
    <div class="field"><label for="iv-amt">المبلغ قبل الضريبة (ر.س)</label><input id="iv-amt" class="inp num" name="amount" inputmode="decimal" required value="${esc(x.amount ?? (c ? Math.max(0, num(c.fee) - finTotals((f) => f.caseId === c.id).invoiced) || "" : cs?.fee || ""))}"></div>
    <div class="field"><label for="iv-vat">ضريبة القيمة المضافة</label><select id="iv-vat" class="inp" name="vat">${opt("15", "15%", x.vat ?? "15")}${opt("0", "بدون ضريبة", x.vat)}</select></div>
    <div class="field"><label for="iv-date">التاريخ</label><input id="iv-date" class="inp" type="date" name="date" value="${esc(x.date || todayStr())}"></div>
    <div class="field"><label for="iv-due">تاريخ الاستحقاق</label><input id="iv-due" class="inp" type="date" name="due" value="${esc(x.due || ymd(new Date(Date.now() + 14 * 864e5)))}"></div>
    <div class="field span2"><label for="iv-note">ملاحظات</label><input id="iv-note" class="inp" name="note" value="${esc(x.note)}"></div>
    ${x.id ? `<label class="chk span2"><input type="checkbox" name="void" value="1" ${x.status === "void" ? "checked" : ""}> إلغاء المطالبة</label>` : ""}</form>`;
}
A.newInvoice = (el) => { if (!guardWrite()) return; modal("مطالبة مالية جديدة", invoiceForm({ caseId: el.dataset.case || "", consultId: el.dataset.consult || "" }), `<button class="btn primary" type="submit" form="fin-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
F.saveInvoice = async (d) => {
  const amount = num(d.amount); const vat = Number(d.vat) || 0; const total = Math.round(amount * (1 + vat / 100) * 100) / 100;
  const data = { type: "invoice", clientId: d.clientId, caseId: d.caseId, consultId: d.consultId, desc: d.desc, amount, vat: d.vat, vatAmount: total - amount, total, date: d.date, due: d.due, note: d.note };
  if (d.id) { data.status = d.void === "1" ? "void" : "active"; await upd(`finance/${d.id}`, data); }
  else { data.no = finNo("invoice"); data.status = "active"; await add("finance", data); if (d.caseId) await logCase(d.caseId, "note", `صدرت مطالبة مالية ${data.no} بمبلغ ${money(total)} ر.س`); }
  closeModal(); toast("حُفظت المطالبة");
};
function paymentForm(x = {}) {
  const inv = byId(S.data.finance, x.invoiceId); const open = fin("invoice").filter((i) => i.status !== "void" && (invState(i).k !== "paid" || i.id === x.invoiceId));
  return `<form id="fin-form" data-form="savePayment" class="grid2"><input type="hidden" name="id" value="${esc(x.id || "")}">
    <div class="field span2"><label for="pm-inv">المطالبة</label><select id="pm-inv" class="inp" name="invoiceId">${opt("", "— دفعة غير مرتبطة بمطالبة —", x.invoiceId)}${open.map((i) => opt(i.id, `${i.no} · ${clientName(i.clientId)} · المتبقي ${money(num(i.total) - invPaid(i))}`, x.invoiceId)).join("")}</select></div>
    <div class="field"><label for="pm-client">العميل</label><select id="pm-client" class="inp" name="clientId">${clientOpts(x.clientId || inv?.clientId || caseById(x.caseId)?.clientId)}</select></div>
    <div class="field"><label for="pm-case">القضية</label><select id="pm-case" class="inp" name="caseId">${caseOpts(x.caseId || inv?.caseId)}</select></div>
    <div class="field"><label for="pm-amt">المبلغ (ر.س)</label><input id="pm-amt" class="inp num" name="amount" inputmode="decimal" required value="${esc(x.amount ?? (inv ? num(inv.total) - invPaid(inv) : ""))}"></div>
    <div class="field"><label for="pm-date">التاريخ</label><input id="pm-date" class="inp" type="date" name="date" value="${esc(x.date || todayStr())}"></div>
    <div class="field"><label for="pm-m">طريقة السداد</label><select id="pm-m" class="inp" name="method">${PAY_METHODS.map((m) => opt(m, m, x.method)).join("")}</select></div>
    <div class="field"><label for="pm-ref">المرجع</label><input id="pm-ref" class="inp" name="ref" value="${esc(x.ref)}" placeholder="رقم الحوالة أو الشيك"></div>
    ${x.id ? `<label class="chk span2"><input type="checkbox" name="remove" value="1"> حذف هذه الدفعة</label>` : ""}</form>`;
}
A.newPayment = (el) => { if (!guardWrite()) return; modal("تسجيل دفعة", paymentForm({ invoiceId: el.dataset.inv || "", caseId: el.dataset.case || "" }), `<button class="btn primary" type="submit" form="fin-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
F.savePayment = async (d) => {
  const inv = byId(S.data.finance, d.invoiceId);
  const data = { type: "payment", invoiceId: d.invoiceId, clientId: d.clientId || inv?.clientId || "", caseId: d.caseId || inv?.caseId || "", amount: num(d.amount), date: d.date, method: d.method, ref: d.ref };
  if (d.id && d.remove === "1") await del(`finance/${d.id}`);
  else if (d.id) await upd(`finance/${d.id}`, data);
  else { data.no = finNo("payment"); await add("finance", data); if (data.caseId) await logCase(data.caseId, "note", `استُلمت دفعة ${money(data.amount)} ر.س (${d.method})`); }
  closeModal(); toast("حُفظت الدفعة");
};
function expenseForm(x = {}) {
  return `<form id="fin-form" data-form="saveExpense" class="grid2"><input type="hidden" name="id" value="${esc(x.id || "")}">
    <div class="field"><label for="ex-case">القضية</label><select id="ex-case" class="inp" name="caseId">${caseOpts(x.caseId, "— مصروف عام —")}</select></div>
    <div class="field"><label for="ex-cat">التصنيف</label><select id="ex-cat" class="inp" name="category">${EXP_CATS.map((m) => opt(m, m, x.category)).join("")}</select></div>
    <div class="field"><label for="ex-amt">المبلغ (ر.س)</label><input id="ex-amt" class="inp num" name="amount" inputmode="decimal" required value="${esc(x.amount)}"></div>
    <div class="field"><label for="ex-date">التاريخ</label><input id="ex-date" class="inp" type="date" name="date" value="${esc(x.date || todayStr())}"></div>
    <div class="field span2"><label for="ex-desc">البيان</label><input id="ex-desc" class="inp" name="desc" value="${esc(x.desc)}"></div>
    <label class="chk span2"><input type="checkbox" name="billable" value="1" ${x.billable !== false ? "checked" : ""}> يُحمَّل على العميل</label>
    ${x.id ? `<label class="chk span2"><input type="checkbox" name="remove" value="1"> حذف هذا المصروف</label>` : ""}</form>`;
}
A.newExpense = (el) => { if (!guardWrite()) return; modal("مصروف", expenseForm({ caseId: el.dataset.case || "" }), `<button class="btn primary" type="submit" form="fin-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
F.saveExpense = async (d) => {
  const data = { type: "expense", caseId: d.caseId, clientId: caseById(d.caseId)?.clientId || "", category: d.category, amount: num(d.amount), date: d.date, desc: d.desc, billable: d.billable === "1" };
  if (d.id && d.remove === "1") await del(`finance/${d.id}`);
  else if (d.id) await upd(`finance/${d.id}`, data);
  else { await add("finance", data); if (d.caseId) await logCase(d.caseId, "note", `صُرف ${money(data.amount)} ر.س: ${d.category}${d.desc ? " — " + d.desc : ""}`); }
  closeModal(); toast("حُفظ المصروف");
};
A.editFin = (el) => {
  const x = byId(S.data.finance, el.dataset.id); if (!x) return;
  const [t, f, form] = x.type === "invoice" ? ["تعديل المطالبة", "fin-form", invoiceForm(x)] : x.type === "payment" ? ["تعديل الدفعة", "fin-form", paymentForm(x)] : ["تعديل المصروف", "fin-form", expenseForm(x)];
  modal(t, form, `<button class="btn primary" type="submit" form="${f}">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
};
A.invoiceDoc = async (el) => {
  const x = byId(S.data.finance, el.dataset.id); const cl = byId(S.data.clients, x.clientId) || {}; const f = S.firm; const paid = invPaid(x);
  const body = `# مطالبة مالية

رقم المطالبة: ${x.no}
التاريخ: ${fmtDate(x.date)} الموافق ${fmtHijri(x.date)}
تاريخ الاستحقاق: ${x.due ? fmtDate(x.due) : "—"}

السادة / ${cl.name || ""}${cl.idNo ? `\nرقم الهوية / السجل: ${cl.idNo}` : ""}
السلام عليكم ورحمة الله وبركاته، وبعد:

نرفق لكم المطالبة المالية التالية:

| البيان | المبلغ (ر.س) |
| ${x.desc} | ${money(x.amount)} |
| ضريبة القيمة المضافة (${x.vat || 0}%) | ${money(x.vatAmount || 0)} |
| الإجمالي | ${money(x.total)} |
${paid ? `| المسدد | ${money(paid)} |\n| المتبقي | ${money(num(x.total) - paid)} |` : ""}

## طريقة السداد
${f.iban ? `- تحويل إلى حساب ${f.nameAr} لدى ${f.bank || "البنك"}، رقم الآيبان: ${f.iban}` : "- [بيانات الحساب البنكي]"}
${f.vat ? `- الرقم الضريبي للمكتب: ${f.vat}` : ""}
${x.note ? `\n${x.note}` : ""}

> وتفضلوا بقبول فائق الاحترام،،

!| ${f.nameAr} |
!| التوقيع والختم: ........................ |`;
  const id = await add("docs", { kind: "invoice", title: `مطالبة مالية ${x.no} — ${cl.name || ""}`, caseId: x.caseId || "", clientId: x.clientId, body, status: "draft", updatedAt: nowIso() });
  go("doc", id);
};

/* ---------------- Consultations ---------------- */
const CONSULT_STATUS = { new: { t: "جديدة", c: "info" }, progress: { t: "قيد الدراسة", c: "gold" }, done: { t: "مكتملة", c: "ok" } };
const CONSULT_TYPES = ["استشارة مكتوبة", "استشارة شفهية", "مراجعة عقد", "دراسة نظامية", "صياغة عقد"];
VIEWS.consults = () => {
  const f = S.ui.consultFilter || (S.ui.consultFilter = { status: "", mine: false });
  let rows = S.data.consults.filter((x) => (!f.status || x.status === f.status) && (!f.mine || x.lawyerId === myLid()));
  rows.sort((a, b) => (a.status === "done") - (b.status === "done") || (a.due || "9").localeCompare(b.due || "9"));
  return `<div class="page-head"><div><h1>الاستشارات</h1><p>${S.data.consults.filter((x) => x.status !== "done").length} استشارة مفتوحة من ${S.data.consults.length}</p></div><button class="btn gold" data-act="newConsult">${icon("plus")}استشارة جديدة</button></div>
  <div class="row"><div class="chips"><span class="chip ${!f.status ? "on" : ""}" data-act="csf" data-k="status" data-v="">الكل</span>${Object.entries(CONSULT_STATUS).map(([k, v]) => `<span class="chip ${f.status === k ? "on" : ""}" data-act="csf" data-k="status" data-v="${k}">${v.t}</span>`).join("")}</div>
    <label class="chk"><input type="checkbox" data-ch="csfMine" ${f.mine ? "checked" : ""}> المسندة إليّ</label></div>
  ${rows.length ? `<div class="tbl-wrap"><table class="tbl resp"><thead><tr><th>الاستشارة</th><th>العميل</th><th>النوع</th><th>المستشار</th><th>الحالة</th><th>موعد التسليم</th></tr></thead><tbody>
    ${rows.map((x) => `<tr data-act="openConsult" data-id="${x.id}"><td class="primary-cell"><div class="t">${esc(x.subject)}</div><div class="ref">${esc(x.no || "")} · ${esc(x.field || "")}</div></td><td data-label="العميل">${esc(x.clientId ? clientName(x.clientId) : x.prospect || "—")}</td><td data-label="النوع">${esc(x.type || "")}</td><td data-label="المستشار">${x.lawyerId ? esc(lawyerName(x.lawyerId)) : pill("بانتظار الإسناد", "warn")}</td><td data-label="الحالة">${pill(CONSULT_STATUS[x.status]?.t || "", CONSULT_STATUS[x.status]?.c)}</td><td data-label="التسليم">${x.due ? `<span class="num">${fmtDate(x.due)}</span> ${x.status !== "done" ? countdown(x.due) : ""}` : "—"}</td></tr>`).join("")}</tbody></table></div>`
  : `<div class="card">${emptyBox("chat", S.data.consults.length ? "لا استشارات مطابقة" : "لا استشارات بعد", "سجّل سؤال العميل، ويصوغ المساعد مسودة الرأي القانوني ليراجعها المستشار.", `<button class="btn gold" data-act="newConsult">${icon("plus")}استشارة جديدة</button>`)}</div>`}`;
};
A.csf = (el) => { S.ui.consultFilter[el.dataset.k] = el.dataset.v; render(); };
CH.csfMine = (el) => { S.ui.consultFilter.mine = el.checked; render(); };
A.openConsult = (el) => go("consult", el.dataset.id);
function consultForm(x = {}) {
  return `<form id="cs-form" data-form="saveConsult" class="grid2"><input type="hidden" name="id" value="${esc(x.id || "")}">
    <div class="field"><label for="cs-client">العميل</label><select id="cs-client" class="inp" name="clientId">${clientOpts(x.clientId)}</select></div>
    <div class="field"><label for="cs-pros">أو عميل جديد (الاسم)</label><input id="cs-pros" class="inp" name="prospect" value="${esc(x.prospect)}"></div>
    <div class="field"><label for="cs-phone">جوال السائل</label><input id="cs-phone" class="inp num" name="phone" value="${esc(x.phone)}" placeholder="05xxxxxxxx"></div>
    <div class="field"><label for="cs-type">النوع</label><select id="cs-type" class="inp" name="type">${CONSULT_TYPES.map((t) => opt(t, t, x.type)).join("")}</select></div>
    <div class="field span2"><label for="cs-sub">الموضوع</label><input id="cs-sub" class="inp" name="subject" required value="${esc(x.subject)}" placeholder="مثال: مدى نظامية فصل موظف خلال فترة التجربة"></div>
    <div class="field"><label for="cs-field">المجال</label><select id="cs-field" class="inp" name="field">${CASE_TYPES.map((t) => opt(t, t, x.field)).join("")}</select></div>
    <div class="field"><label for="cs-due">موعد التسليم</label><input id="cs-due" class="inp" type="date" name="due" value="${esc(x.due || ymd(new Date(Date.now() + 3 * 864e5)))}"></div>
    <div class="field"><label for="cs-fee">الأتعاب (ر.س)</label><input id="cs-fee" class="inp num" name="fee" inputmode="decimal" value="${esc(x.fee)}"></div>
    ${isManager() ? `<div class="field"><label for="cs-law">المستشار المسؤول</label><select id="cs-law" class="inp" name="lawyerId">${lawyerOpts(x.lawyerId, "— لاحقًا —")}</select></div>` : `<div class="field"><span class="hint">يسند المدير الاستشارة إلى المستشار المناسب.</span></div>`}
    <div class="field span2"><label for="cs-q">سؤال العميل ووقائعه</label><textarea id="cs-q" class="inp" name="question" rows="6" required>${esc(x.question)}</textarea></div></form>`;
}
A.newConsult = () => { if (!guardWrite()) return; modal("استشارة جديدة", consultForm(), `<button class="btn primary" type="submit" form="cs-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`, true); };
A.editConsult = (el) => modal("تعديل الاستشارة", consultForm(byId(S.data.consults, el.dataset.id)), `<button class="btn primary" type="submit" form="cs-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`, true);
F.saveConsult = async (d) => {
  let clientId = d.clientId;
  if (!clientId && d.prospect.trim()) clientId = await add("clients", { name: d.prospect.trim(), phone: d.phone, kind: "individual" });
  const data = { clientId: clientId || "", prospect: d.prospect, phone: d.phone, type: d.type, subject: d.subject.trim(), field: d.field, due: d.due, fee: num(d.fee) || "", question: d.question };
  if (isManager() && d.lawyerId !== undefined) data.lawyerId = d.lawyerId;
  if (d.id) { await upd(`consults/${d.id}`, data); closeModal(); toast("حُفظت"); return; }
  const no = `RK-Q-${new Date().getFullYear()}-${String(S.data.consults.length + 1).padStart(3, "0")}`;
  const id = await add("consults", { ...data, no, status: "new", lawyerId: data.lawyerId || "", answer: "", updatedAt: nowIso() });
  if (d.due) await add("tasks", { title: `تسليم استشارة: ${data.subject}`, kind: "task", due: d.due, consultId: id, assignee: data.lawyerId || "", priority: "normal", status: "open", source: "manual" });
  closeModal(); toast("سُجّلت الاستشارة"); go("consult", id);
};
VIEWS.consult = () => {
  const x = byId(S.data.consults, S.route.id);
  if (!x) return S.loaded.consults ? `<div class="card">${emptyBox("chat", "لم نجد الاستشارة", "", `<button class="btn" data-act="go" data-r="consults">العودة</button>`)}</div>` : `<div class="thinking">جارٍ التحميل…</div>`;
  const gen = S.gen?.kind === "consult" && S.gen.id === x.id; const key = "csa." + x.id; const ans = gen ? S.gen.text : S.drafts[key] ?? x.answer ?? "";
  const phone = x.phone || byId(S.data.clients, x.clientId)?.phone;
  return `<div class="crumbs"><a data-act="go" data-r="consults">الاستشارات</a><span>/</span><span class="num">${esc(x.no || "")}</span></div>
  <div class="case-head"><div class="row" style="align-items:flex-start"><div class="grow"><h1>${esc(x.subject)}</h1><div class="row small muted" style="margin-top:4px">${pill(CONSULT_STATUS[x.status]?.t, CONSULT_STATUS[x.status]?.c)}<span>${esc(x.type || "")}</span><span>${esc(x.field || "")}</span>${x.due ? `<span>التسليم ${fmtDate(x.due)}</span>${x.status !== "done" ? countdown(x.due) : ""}` : ""}</div></div>
    <div class="row"><button class="btn" data-act="editConsult" data-id="${x.id}">${icon("edit")}تعديل</button><select class="inp" style="width:auto" data-ch="consultStatus" data-id="${x.id}" aria-label="الحالة">${Object.entries(CONSULT_STATUS).map(([k, v]) => opt(k, v.t, x.status)).join("")}</select></div></div>
    <div class="facts"><div class="fact"><div class="k">العميل</div><div class="v">${esc(x.clientId ? clientName(x.clientId) : x.prospect || "—")}</div></div><div class="fact"><div class="k">الجوال</div><div class="v num">${esc(phone || "—")}</div></div>
      <div class="fact"><div class="k">المستشار</div><div class="v">${x.lawyerId ? esc(lawyerName(x.lawyerId)) : isManager() ? `<a data-act="editConsult" data-id="${x.id}" style="cursor:pointer">إسناد</a>` : "بانتظار إسناد المدير"}</div></div><div class="fact"><div class="k">الأتعاب</div><div class="v num">${x.fee ? money(x.fee) + " ر.س" : "—"}</div></div></div></div>
  <div class="cols"><div class="stack">
    <div class="card"><div class="card-h"><h3>الرأي القانوني</h3><div class="row">${gen ? `<span class="thinking small">يكتب المساعد…</span><button class="btn sm" data-act="stopGen">إيقاف</button>` : S.caps.sample ? `<button class="btn sm gold" data-act="genOpinion" data-id="${x.id}">${icon("spark")}${ans ? "إعادة الصياغة" : "صياغة المسودة"}</button>` : ans ? "" : `<button class="btn sm gold" data-act="opinionTemplate" data-id="${x.id}">${icon("docs")}أدرج هيكل الرأي</button>`}</div></div>
      <textarea id="cs-answer" class="inp" rows="16" style="font-family:var(--f-doc);font-size:15.5px;line-height:1.9" data-draft="${key}" data-live="csLive" ${gen ? "readonly" : ""}>${esc(ans)}</textarea>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-act="saveAnswer" data-id="${x.id}">${icon("check")}حفظ</button><button class="btn" data-act="opinionDoc" data-id="${x.id}">${icon("docs")}مستند Word بترويسة المكتب</button>
        <a id="cs-wa" class="btn" href="${esc(waHref(phone, ans))}" target="_blank" rel="noopener">${icon("wa")}إرسال واتساب</a></div></div></div>
    <div class="stack"><div class="card"><div class="card-h"><h3>السؤال والوقائع</h3></div><div class="prose">${esc(x.question || "")}</div></div>
      <div class="card"><div class="card-h"><h3>إجراءات</h3></div><div class="stack" style="gap:8px">
        ${x.caseId ? `<button class="btn" data-act="openCase" data-id="${x.caseId}">${icon("cases")}فتح القضية المرتبطة</button>` : `<button class="btn" data-act="consultToCase" data-id="${x.id}">${icon("cases")}تحويل إلى قضية</button>`}
        <button class="btn" data-act="newInvoice" data-consult="${x.id}">${icon("receipt")}مطالبة بالأتعاب</button>
        <button class="btn danger" data-act="deleteConsult" data-id="${x.id}">${icon("trash")}حذف</button></div></div></div></div>`;
};
CH.csLive = () => { const a = $("#cs-wa"); const x = byId(S.data.consults, S.route.id); if (a && x) a.href = waHref(x.phone || byId(S.data.clients, x.clientId)?.phone, $("#cs-answer").value); };
CH.consultStatus = async (el) => { await upd(`consults/${el.dataset.id}`, { status: el.value, ...(el.value === "done" ? { doneAt: nowIso() } : {}) }); if (el.value === "done") { for (const t of S.data.tasks.filter((t) => t.consultId === el.dataset.id && t.status !== "done")) await upd(`tasks/${t.id}`, { status: "done", doneAt: nowIso() }); } toast("حُدّثت الحالة"); };
A.opinionTemplate = (el) => {
  const x = byId(S.data.consults, el.dataset.id); const B0 = "[........]";
  const t = `> بسم الله الرحمن الرحيم
# مذكرة رأي قانوني
| البيان | التفاصيل |
| العميل | ${x.clientId ? clientName(x.clientId) : x.prospect || B0} |
| الموضوع | ${x.subject} |
| التاريخ | ${fmtDate(todayStr())} |

## أولًا: الوقائع كما وردت
${x.question || B0}

## ثانيًا: المسألة القانونية
${B0}

## ثالثًا: الأساس النظامي
1. ${B0}

## رابعًا: التحليل
${B0}

## خامسًا: الرأي والتوصيات
1. ${B0}

## سادسًا: الجهة المختصة والمهل النظامية
${B0}

## سابعًا: تحفظات
هذا الرأي مبني على الوقائع والمستندات المقدمة فقط، ويتغير بتغيرها.

!| ${lawyerName(x.lawyerId) === "غير مسند" ? B0 : lawyerName(x.lawyerId)} |
!| ${S.firm.nameAr} |`;
  S.drafts["csa." + x.id] = t; render();
};
A.saveAnswer = async (el) => { const x = byId(S.data.consults, el.dataset.id); await upd(`consults/${x.id}`, { answer: $("#cs-answer").value, status: x.status === "new" ? "progress" : x.status }); delete S.drafts["csa." + x.id]; toast("حُفظ الرأي"); };
A.genOpinion = async (el) => {
  if (!needSample()) return;
  const x = byId(S.data.consults, el.dataset.id);
  const prompt = `أنت مستشار قانوني سعودي أول في «${S.firm.nameAr}». اكتب مذكرة رأي قانوني مهنية ردًا على الاستشارة التالية، وفق الأنظمة السارية في المملكة العربية السعودية.
تاريخ اليوم: ${todayStr()} الموافق ${fmtHijri(todayStr())}.
نوع الاستشارة: ${x.type} — المجال: ${x.field}
الموضوع: ${x.subject}
السؤال والوقائع:
"""
${x.question}
"""
${JURIS_GUIDE}

الهيكل والصيغة (عناوين تبدأ بـ "## "، قوائم مرقمة "1. "، نقاط "- "، بلا ** ولا ###):
> بسم الله الرحمن الرحيم
# مذكرة رأي قانوني
| البيان | التفاصيل |
| العميل | ${x.clientId ? clientName(x.clientId) : x.prospect || "[........]"} |
| الموضوع | ${x.subject} |
| التاريخ | ${fmtDate(todayStr())} |
## الوقائع كما وردت
## المسألة القانونية
## الأساس النظامي (اذكر النظام والمادة، واكتب «يُتحقق من رقم المادة» عند عدم اليقين)
## التحليل
## الرأي والتوصيات العملية
## الجهة المختصة والمهل النظامية إن وجدت
## تحفظات (الرأي مبني على الوقائع المقدمة فقط)
لا تخترع وقائع؛ ضع [........] لكل معلومة ناقصة.
اختم بكتلة التوقيع بهذه الصيغة:
!| ${lawyerName(x.lawyerId) === "غير مسند" ? "[........]" : lawyerName(x.lawyerId)} |
!| ${S.firm.nameAr} |`;
  const ctl = new AbortController(); S.gen = { kind: "consult", id: x.id, text: "", ctl }; render();
  try {
    const { text } = await S.caps.sample(prompt, { signal: ctl.signal, cache: false, onText: ({ text }) => { S.gen.text = text; const t = $("#cs-answer"); if (t) t.value = text; } });
    await upd(`consults/${x.id}`, { answer: text.trim(), status: x.status === "new" ? "progress" : x.status }); delete S.drafts["csa." + x.id];
  } catch (e) { aiErr(e); }
  finally { S.gen = null; render(); }
};
A.opinionDoc = async (el) => {
  const x = byId(S.data.consults, el.dataset.id); const body = $("#cs-answer").value.trim(); if (!body) return toast("اكتب الرأي أولًا", true);
  const id = await add("docs", { kind: "opinion", title: `رأي قانوني — ${x.subject}`, consultId: x.id, clientId: x.clientId || "", caseId: x.caseId || "", body: body.startsWith("#") ? body : `# مذكرة رأي قانوني\n\n${body}`, status: "draft", updatedAt: nowIso() });
  go("doc", id);
};
A.consultToCase = async (el) => {
  const x = byId(S.data.consults, el.dataset.id); const cl = byId(S.data.clients, x.clientId);
  if (!clientComplete(cl)) {
    toast("لا تُفتح قضية قبل استكمال بيانات العميل. أكملها ثم أعد التحويل.", true);
    if (cl) modal("استكمال بيانات العميل", clientForm(cl), `<button class="btn primary" type="submit" form="cl-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`, true);
    else A.newClient();
    return;
  }
  const id = await add("cases", { title: x.subject, clientId: x.clientId, type: CASE_TYPES.includes(x.field) ? x.field : "عام / مدني", status: "intake", description: x.question, ref: caseRef(), lawyerId: x.lawyerId || "", openedAt: todayStr(), updatedAt: nowIso(), consultId: x.id });
  await upd(`consults/${x.id}`, { caseId: id });
  await logCase(id, "status", `فُتح ملف القضية من الاستشارة ${x.no}`);
  toast("فُتح ملف قضية من الاستشارة"); go("case", id);
};
A.deleteConsult = (el) => confirmBox("حذف الاستشارة", "ستُحذف الاستشارة ورأيها نهائيًا.", "حذف", async () => { await del(`consults/${el.dataset.id}`); go("consults"); toast("حُذفت"); }, true);
