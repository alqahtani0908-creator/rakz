/* ============ Rakz — fee approvals and double-entry journal ============
   Fees: a lawyer proposes the fee for their own case/consultation; it stays pending until a manager
   approves (it then becomes the case fee) or rejects it. The database enforces who may do what.
   Journal: every claim, payment and expense posts a balanced entry automatically. Posted entries are
   immutable (database trigger), so an edit or deletion posts a correcting entry for the difference. */
const ACCOUNTS = {
  "1100": { t: "الصندوق والبنك", type: "asset" },
  "1200": { t: "ذمم العملاء", type: "asset" },
  "2100": { t: "ضريبة القيمة المضافة المستحقة", type: "liability" },
  "2200": { t: "دفعات مقدمة من العملاء", type: "liability" },
  "3100": { t: "جاري الشركاء ورأس المال", type: "equity" },
  "4100": { t: "إيرادات أتعاب القضايا", type: "revenue" },
  "4200": { t: "إيرادات الاستشارات", type: "revenue" },
  "5100": { t: "مصروفات القضايا", type: "expense" },
  "5200": { t: "مصروفات تشغيلية", type: "expense" },
};
const accName = (a) => `${a} ${ACCOUNTS[a]?.t || ""}`;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const FEE_TYPES = { fixed: "مبلغ مقطوع", stages: "على مراحل", percent: "نسبة من المحكوم به", hourly: "بالساعة", retainer: "اشتراك دوري" };
const FEE_STATUS = { pending: { t: "بانتظار اعتماد المدير", c: "warn" }, approved: { t: "معتمدة", c: "ok" }, rejected: { t: "مرفوضة", c: "bad" } };

/* ---------- journal posting ---------- */
function linesFor(type, rec) {
  if (!rec) return [];
  const c = { clientId: rec.clientId || "", caseId: rec.caseId || "" };
  if (type === "invoice") {
    if (rec.status === "void") return [];
    const total = r2(rec.total), net = r2(rec.amount), vat = r2(total - net);
    return [{ acc: "1200", dr: total, ...c }, { acc: rec.consultId ? "4200" : "4100", cr: net, ...c }, ...(vat ? [{ acc: "2100", cr: vat, ...c }] : [])];
  }
  if (type === "payment") { const a = r2(rec.amount); return [{ acc: "1100", dr: a, ...c }, { acc: rec.invoiceId ? "1200" : "2200", cr: a, ...c }]; }
  if (type === "expense") { const a = r2(rec.amount); return rec.billable ? [{ acc: "1200", dr: a, ...c }, { acc: "1100", cr: a, ...c }] : [{ acc: "5100", dr: a, ...c }, { acc: "1100", cr: a, ...c }]; }
  return [];
}
const lineKey = (l) => `${l.acc}|${l.clientId || ""}|${l.caseId || ""}`;
function netOf(lines) { const m = new Map(); for (const l of lines) { const k = lineKey(l); m.set(k, r2((m.get(k) || 0) + r2(l.dr) - r2(l.cr))); } return m; }
async function journalAll() { const s = await S.caps.db.collection("journal").get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }
function nextJv(all) { const y = new Date().getFullYear(); return `JV-${y}-${String(all.filter((j) => (j.no || "").includes(`-${y}-`)).length + 1).padStart(4, "0")}`; }
async function postEntry(entry, all) {
  all = all || (await journalAll());
  return add("journal", { ...entry, no: nextJv(all), postedBy: myLid() || "", lines: entry.lines.map((l) => ({ acc: l.acc, dr: r2(l.dr), cr: r2(l.cr), clientId: l.clientId || "", caseId: l.caseId || "", memo: l.memo || "" })) });
}
/* Bring the journal in line with a finance record (null = deleted): post only the difference. */
async function syncJournal(type, id, rec, memo) {
  if (!isManager() || !S.caps.db) return;
  try {
    const all = await journalAll();
    const have = netOf(all.filter((j) => j.source?.id === id).flatMap((j) => j.lines || []));
    const want = netOf(linesFor(type, rec));
    const keys = new Set([...have.keys(), ...want.keys()]); const lines = [];
    for (const k of keys) { const d = r2((want.get(k) || 0) - (have.get(k) || 0)); if (!d) continue; const [acc, clientId, caseId] = k.split("|"); lines.push({ acc, clientId, caseId, dr: d > 0 ? d : 0, cr: d < 0 ? -d : 0 }); }
    if (!lines.length) return;
    const first = !all.some((j) => j.source?.id === id);
    await postEntry({ date: rec?.date || todayStr(), memo: (first ? "" : "تسوية: ") + memo, source: { type, id }, auto: true, lines }, all);
  } catch (e) { console.error(e); toast("حُفظت الحركة، وتعذّر ترحيل قيدها. أعد الحفظ أو أضف قيدًا يدويًا.", true); }
}

/* ---------- finance page tabs ---------- */
const jr = () => [...(S.data.journal || [])].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.no || "").localeCompare(a.no || ""));
const FIN_TABS = {};
FIN_TABS.fees = () => {
  const list = [...S.data.fees].sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  return list.length ? `<div class="card"><div class="list">${list.map((f) => feeRow(f, true)).join("")}</div></div>` : `<div class="card">${emptyBox("coin", "لا طلبات أتعاب", "يقترح المحامي أتعاب قضاياه من صفحة القضية، وتظهر هنا لاعتمادها.")}</div>`;
};
FIN_TABS.journal = () => {
  const list = jr();
  return `<div class="row"><button class="btn gold" data-act="manualEntry">${icon("plus")}قيد يدوي</button><span class="muted small">القيود المرحّلة لا تُعدَّل ولا تُحذف؛ التصحيح يكون بقيد تسوية.</span></div>
  ${list.length ? `<div class="stack" style="gap:10px">${list.map((j) => `<div class="card" style="padding:12px 14px"><div class="row" style="justify-content:space-between"><div><b class="num">${esc(j.no || "")}</b> · <span class="num">${fmtDate(j.date)}</span> · ${esc(j.memo || "")}</div>${j.auto ? pill("آلي", "info") : pill("يدوي", "gold")}</div>
    <div class="tbl-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>الحساب</th><th>العميل / القضية</th><th>مدين</th><th>دائن</th></tr></thead><tbody>${(j.lines || []).map((l) => `<tr style="cursor:default"><td>${esc(accName(l.acc))}</td><td class="small">${esc([l.clientId ? clientName(l.clientId) : "", l.caseId ? caseById(l.caseId)?.title || "" : "", l.memo || ""].filter(Boolean).join(" · ") || "—")}</td><td class="num">${l.dr ? money(l.dr) : ""}</td><td class="num">${l.cr ? money(l.cr) : ""}</td></tr>`).join("")}</tbody></table></div></div>`).join("")}</div>`
    : `<div class="card">${emptyBox("receipt", "لا قيود بعد", "تُرحَّل القيود تلقائيًا عند تسجيل المطالبات والدفعات والمصروفات.")}</div>`}`;
};
function trialRows() {
  const t = {}; for (const j of S.data.journal || []) for (const l of j.lines || []) { const a = (t[l.acc] = t[l.acc] || { dr: 0, cr: 0 }); a.dr = r2(a.dr + r2(l.dr)); a.cr = r2(a.cr + r2(l.cr)); }
  return Object.keys(ACCOUNTS).concat(Object.keys(t).filter((k) => !ACCOUNTS[k])).filter((k) => t[k]).map((k) => ({ acc: k, ...t[k], bal: r2(t[k].dr - t[k].cr) }));
}
FIN_TABS.trial = () => {
  const rows = trialRows(); const dr = r2(rows.reduce((s, r) => s + r.dr, 0)), cr = r2(rows.reduce((s, r) => s + r.cr, 0));
  return rows.length ? `<div class="row"><span>${dr === cr ? pill("الميزان متوازن", "ok") : pill("الميزان غير متوازن", "bad")}</span><button class="btn sm" data-act="csvTrial">${icon("download")}تنزيل CSV</button></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الحساب</th><th>مجموع المدين</th><th>مجموع الدائن</th><th>الرصيد</th></tr></thead><tbody>
  ${rows.map((r) => `<tr style="cursor:default"><td>${esc(accName(r.acc))}</td><td class="num">${money(r.dr)}</td><td class="num">${money(r.cr)}</td><td class="num"><b>${money(Math.abs(r.bal))}</b> <span class="small muted">${r.bal >= 0 ? "مدين" : "دائن"}</span></td></tr>`).join("")}
  <tr style="cursor:default"><td><b>الإجمالي</b></td><td class="num"><b>${money(dr)}</b></td><td class="num"><b>${money(cr)}</b></td><td></td></tr></tbody></table></div>`
    : `<div class="card">${emptyBox("scale", "لا أرصدة بعد", "")}</div>`;
};
function statementRows(clientId) {
  const out = [];
  for (const j of S.data.journal || []) for (const l of j.lines || []) if (l.clientId === clientId && (l.acc === "1200" || l.acc === "2200")) out.push({ date: j.date, no: j.no, memo: j.memo, acc: l.acc, dr: r2(l.dr), cr: r2(l.cr) });
  out.sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.no || "").localeCompare(b.no || ""));
  let bal = 0; for (const r of out) { bal = r2(bal + r.dr - r.cr); r.bal = bal; } return out;
}
FIN_TABS.statement = () => {
  const cid = S.ui.stmtClient || ""; const rows = cid ? statementRows(cid) : []; const last = rows.length ? rows[rows.length - 1].bal : 0;
  return `<div class="row"><select class="inp" style="max-width:320px" data-ch="stmtClient" aria-label="العميل">${clientOpts(cid)}</select>${cid ? `<span>${pill(last > 0 ? `مستحق على العميل ${money(last)} ر.س` : last < 0 ? `رصيد دائن للعميل ${money(-last)} ر.س` : "الرصيد صفر", last > 0 ? "warn" : "ok")}</span><button class="btn sm" data-act="csvStatement">${icon("download")}تنزيل CSV</button>` : ""}</div>
  ${!cid ? `<div class="card">${emptyBox("clients", "اختر العميل لعرض كشف حسابه", "")}</div>` : rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>التاريخ</th><th>القيد</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>
    ${rows.map((r) => `<tr style="cursor:default"><td class="num">${fmtDate(r.date)}</td><td class="num">${esc(r.no || "")}</td><td>${esc(r.memo || "")}${r.acc === "2200" ? ' <span class="small muted">(دفعة مقدمة)</span>' : ""}</td><td class="num">${r.dr ? money(r.dr) : ""}</td><td class="num">${r.cr ? money(r.cr) : ""}</td><td class="num"><b>${money(r.bal)}</b></td></tr>`).join("")}</tbody></table></div>` : `<div class="card">${emptyBox("receipt", "لا حركات لهذا العميل", "")}</div>`}`;
};
CH.stmtClient = (el) => { S.ui.stmtClient = el.value; render(); };
async function saveCsv(name, rows) {
  if (!S.caps.downloads) return toast("التنزيل غير متاح هنا.", true);
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  try { await S.caps.downloads.save({ filename: name, data: csv }); } catch (e) { if (e?.code !== "declined") toast("تعذّر التنزيل.", true); }
}
A.csvTrial = () => saveCsv(`ميزان-المراجعة-${todayStr()}.csv`, [["الحساب", "مدين", "دائن", "الرصيد"], ...trialRows().map((r) => [accName(r.acc), r.dr, r.cr, r.bal])]);
A.csvStatement = () => { const cid = S.ui.stmtClient; saveCsv(`كشف-حساب-${clientName(cid)}-${todayStr()}.csv`, [["التاريخ", "القيد", "البيان", "مدين", "دائن", "الرصيد"], ...statementRows(cid).map((r) => [r.date, r.no, r.memo, r.dr, r.cr, r.bal])]); };

/* ---------- manual entry ---------- */
A.manualEntry = () => {
  if (!isManager()) return toast("القيود من صلاحية المدير.", true);
  S.drafts["je.rows"] = [{ acc: "1100", dr: "", cr: "", clientId: "" }, { acc: "3100", dr: "", cr: "", clientId: "" }];
  modal("قيد يدوي", manualEntryBody(), `<button class="btn primary" type="submit" form="je-form">ترحيل القيد</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`, true);
};
function manualEntryBody() {
  const rows = S.drafts["je.rows"]; const dr = r2(rows.reduce((s, r) => s + r2(r.dr), 0)), cr = r2(rows.reduce((s, r) => s + r2(r.cr), 0));
  const accOpts = (v) => Object.keys(ACCOUNTS).map((k) => opt(k, accName(k), v)).join("");
  return `<form id="je-form" data-form="manualEntry" class="stack" style="gap:12px"><div class="grid2"><div class="field"><label for="je-date">التاريخ</label><input id="je-date" class="inp" type="date" name="date" value="${todayStr()}"></div><div class="field"><label for="je-memo" class="req">البيان</label><input id="je-memo" class="inp" name="memo" required placeholder="مثال: إيداع رأس مال، سداد إيجار المكتب"></div></div>
    <div id="je-rows" class="stack" style="gap:8px">${rows.map((r, i) => `<div class="row" style="flex-wrap:nowrap;gap:6px"><select class="inp" style="flex:2;min-width:0" data-ch="jeRow" data-i="${i}" data-k="acc" aria-label="الحساب">${accOpts(r.acc)}</select><select class="inp" style="flex:1.4;min-width:0" data-ch="jeRow" data-i="${i}" data-k="clientId" aria-label="العميل">${opt("", "— بدون عميل —", r.clientId)}${S.data.clients.map((c) => opt(c.id, c.name, r.clientId)).join("")}</select><input class="inp num" style="flex:1;min-width:0" placeholder="مدين" inputmode="decimal" value="${esc(r.dr)}" data-ch="jeRow" data-i="${i}" data-k="dr" aria-label="مدين"><input class="inp num" style="flex:1;min-width:0" placeholder="دائن" inputmode="decimal" value="${esc(r.cr)}" data-ch="jeRow" data-i="${i}" data-k="cr" aria-label="دائن"></div>`).join("")}</div>
    <div class="row"><button type="button" class="btn sm" data-act="jeAdd">${icon("plus")}سطر</button><span class="grow"></span><span class="num">مدين ${money(dr)} · دائن ${money(cr)}</span>${dr && dr === cr ? pill("متوازن", "ok") : pill("غير متوازن", "bad")}</div></form>`;
}
const refreshJe = () => { const b = $("#modal .modal-b"); if (b) { const memo = $("#je-memo")?.value, date = $("#je-date")?.value; b.innerHTML = manualEntryBody(); if (memo) $("#je-memo").value = memo; if (date) $("#je-date").value = date; } };
CH.jeRow = (el) => { S.drafts["je.rows"][Number(el.dataset.i)][el.dataset.k] = el.value; refreshJe(); };
A.jeAdd = () => { S.drafts["je.rows"].push({ acc: "5200", dr: "", cr: "", clientId: "" }); refreshJe(); };
F.manualEntry = async (d) => {
  const lines = S.drafts["je.rows"].map((r) => ({ acc: r.acc, clientId: r.clientId, dr: r2(num(r.dr)), cr: r2(num(r.cr)) })).filter((l) => l.dr || l.cr);
  const dr = r2(lines.reduce((s, l) => s + l.dr, 0)), cr = r2(lines.reduce((s, l) => s + l.cr, 0));
  if (!dr || dr !== cr) return toast("القيد غير متوازن: مجموع المدين يجب أن يساوي مجموع الدائن.", true);
  if (lines.some((l) => l.dr && l.cr)) return toast("لا يجمع السطر الواحد مدينًا ودائنًا.", true);
  try { await postEntry({ date: d.date, memo: d.memo.trim(), source: { type: "manual" }, auto: false, lines }); } catch (e) { return; }
  closeModal(); toast("رُحّل القيد");
};

/* ---------- fees: lawyer proposes, manager decides ---------- */
const feesFor = (key, id) => S.data.fees.filter((f) => f[key] === id).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
function feeRow(f, showSubject) {
  const st = FEE_STATUS[f.status] || FEE_STATUS.pending; const mine = f.lawyerId === myLid() && f.status === "pending";
  const subj = f.caseId ? caseById(f.caseId)?.title : f.consultId ? byId(S.data.consults, f.consultId)?.subject : "";
  return `<div class="li" style="align-items:flex-start"><div class="body"><div class="ttl"><span class="num">${money(f.amount)}</span> ر.س <span class="small muted">قبل الضريبة · ${esc(FEE_TYPES[f.type] || "")}</span></div>
    <div class="meta">${pill(st.t, st.c)}${showSubject && subj ? `<span>${esc(subj)}</span>` : ""}<span>اقترحها ${esc(lawyerName(f.proposedBy || f.lawyerId))}</span><span>${ago(f.createdAt)}</span>${f.decidedBy ? `<span>${f.status === "approved" ? "اعتمدها" : "رفضها"} ${esc(lawyerName(f.decidedBy))}</span>` : ""}</div>
    ${f.terms ? `<div class="small" style="margin-top:4px;white-space:pre-wrap">${esc(f.terms)}</div>` : ""}${f.reason ? `<div class="small" style="color:var(--bad);margin-top:4px">سبب الرفض: ${esc(f.reason)}</div>` : ""}</div>
    <div class="row" style="gap:4px;flex-wrap:nowrap">${isManager() && f.status === "pending" ? `<button class="btn sm primary" data-act="approveFee" data-id="${f.id}">${icon("check")}اعتماد</button><button class="btn sm" data-act="rejectFee" data-id="${f.id}">رفض</button>` : ""}
      ${mine || (isManager() && f.status === "pending") ? `<button class="btn sm ghost" data-act="editFee" data-id="${f.id}" aria-label="تعديل">${icon("edit")}</button><button class="btn sm ghost danger" data-act="deleteFee" data-id="${f.id}" aria-label="حذف">${icon("trash")}</button>` : ""}</div></div>`;
}
function feeCard(key, rec) {
  const canPropose = isManager() || rec.lawyerId === myLid(); if (!canPropose) return "";
  const list = feesFor(key, rec.id);
  return `<div class="card"><div class="card-h"><h3>الأتعاب</h3><button class="btn sm gold" data-act="newFee" data-key="${key}" data-id="${rec.id}">${icon("plus")}${isManager() ? "إضافة أتعاب" : "اقتراح أتعاب"}</button></div>
    ${list.length ? `<div class="list">${list.map((f) => feeRow(f, false)).join("")}</div>` : `<p class="muted small" style="margin:0">${isManager() ? "لا أتعاب مقترحة بعد." : "اقترح أتعاب هذه القضية، وتُعتمد من المدير."}</p>`}</div>`;
}
function feeForm(f) {
  return `<form id="fee-form" data-form="saveFee" class="stack" style="gap:12px"><input type="hidden" name="id" value="${esc(f.id || "")}"><input type="hidden" name="key" value="${esc(f.key)}"><input type="hidden" name="ref" value="${esc(f.ref)}">
    <div class="grid2"><div class="field"><label for="fe-amt" class="req">المبلغ قبل الضريبة (ر.س)</label><input id="fe-amt" class="inp num" name="amount" inputmode="decimal" required value="${esc(f.amount ?? "")}"></div>
      <div class="field"><label for="fe-type">طريقة الاحتساب</label><select id="fe-type" class="inp" name="type">${Object.entries(FEE_TYPES).map(([k, v]) => opt(k, v, f.type || "fixed")).join("")}</select></div></div>
    <div class="field"><label for="fe-terms">الشروط ومراحل السداد</label><textarea id="fe-terms" class="inp" name="terms" rows="3" placeholder="مثال: 50% عند التوقيع، و50% عند صدور الحكم الابتدائي">${esc(f.terms || "")}</textarea></div>
    ${isManager() ? "" : `<p class="small muted" style="margin:0">تبقى الأتعاب «بانتظار اعتماد المدير»، ويمكنك تعديلها أو حذفها حتى تُعتمد.</p>`}</form>`;
}
A.newFee = (el) => { if (!guardWrite()) return; modal(isManager() ? "إضافة أتعاب" : "اقتراح أتعاب", feeForm({ key: el.dataset.key, ref: el.dataset.id }), `<button class="btn primary" type="submit" form="fee-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
A.editFee = (el) => { const f = byId(S.data.fees, el.dataset.id); if (!f) return; modal("تعديل الأتعاب", feeForm({ ...f, key: f.caseId ? "caseId" : "consultId", ref: f.caseId || f.consultId }), `<button class="btn primary" type="submit" form="fee-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
F.saveFee = async (d) => {
  const amount = r2(num(d.amount)); if (!amount) return toast("أدخل مبلغ الأتعاب.", true);
  const rec = d.key === "caseId" ? caseById(d.ref) : byId(S.data.consults, d.ref);
  const data = { amount, type: d.type, terms: d.terms };
  if (d.id) await upd(`fees/${d.id}`, data);
  else {
    await add("fees", { ...data, [d.key]: d.ref, clientId: rec?.clientId || "", lawyerId: rec?.lawyerId || myLid() || "", proposedBy: myLid() || "", status: "pending" });
    if (d.key === "caseId") await logCase(d.ref, "note", `اقتُرحت أتعاب بمبلغ ${money(amount)} ر.س (${FEE_TYPES[d.type]}) بانتظار اعتماد المدير`);
  }
  closeModal(); toast(isManager() ? "حُفظت الأتعاب" : "أُرسلت الأتعاب لاعتماد المدير");
};
A.deleteFee = (el) => confirmBox("حذف الأتعاب المقترحة", "ستُحذف هذه الأتعاب المقترحة.", "حذف", async () => { await del(`fees/${el.dataset.id}`); toast("حُذفت"); }, true);
A.approveFee = async (el) => {
  const f = byId(S.data.fees, el.dataset.id); if (!f || !isManager()) return;
  await upd(`fees/${f.id}`, { status: "approved", decidedBy: myLid() || "", decidedAt: nowIso() });
  if (f.caseId) { await upd(`cases/${f.caseId}`, { fee: String(f.amount) }); await logCase(f.caseId, "status", `اعتُمدت الأتعاب: ${money(f.amount)} ر.س (${FEE_TYPES[f.type] || ""})`); }
  if (f.consultId) await upd(`consults/${f.consultId}`, { fee: f.amount });
  toast("اعتُمدت الأتعاب وأصبحت أتعاب القضية المعتمدة");
};
A.rejectFee = (el) => modal("رفض الأتعاب المقترحة", `<form id="rf-form" data-form="rejectFee"><input type="hidden" name="id" value="${el.dataset.id}"><div class="field"><label for="rf-r" class="req">سبب الرفض</label><textarea id="rf-r" class="inp" name="reason" rows="3" required></textarea></div></form>`, `<button class="btn primary" type="submit" form="rf-form">رفض</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
F.rejectFee = async (d) => {
  const f = byId(S.data.fees, d.id); await upd(`fees/${d.id}`, { status: "rejected", reason: d.reason.trim(), decidedBy: myLid() || "", decidedAt: nowIso() });
  if (f?.caseId) await logCase(f.caseId, "note", `رُفضت الأتعاب المقترحة (${money(f.amount)} ر.س): ${d.reason.trim()}`);
  closeModal(); toast("رُفضت الأتعاب المقترحة");
};
