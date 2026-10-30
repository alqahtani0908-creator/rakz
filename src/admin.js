/* ============ Rakz — two systems after sign-in: the professional (المهني) and the administrative (الإداري) ============
   The professional system holds cases, consultations, drafting, contracts, the library and the assistant — no money.
   The administrative system (managers) holds all of finance: the financial file of every case until it is financially
   closed, claims, tax invoices, payments, expenses, the journal and reports, the approval queue, the team and settings.
   Lawyers raise «طلبات مالية» from a case (an expense, a payment received, a claim to issue, or their fee proposal);
   nothing touches the books until a manager approves it (database triggers guard_finreq / guard_finclose). */

const ADMIN_ROUTES = ["admin", "finfiles", "finfile", "finance", "finreqs", "team", "settings"];
const SHARED_ROUTES = ["clients", "doc", "portal"];
const portalOf = (r) => (ADMIN_ROUTES.includes(r) ? "admin" : SHARED_ROUTES.includes(r) ? null : "pro");
const REQ_TYPES = {
  expense: { t: "مصروف على القضية", ic: "coin", hint: "رسوم أو أتعاب خبير أو ترجمة أو تنقل… أرفق الإيصال." },
  payment: { t: "دفعة استلمتها من العميل", ic: "receipt", hint: "حوالة أو شيك أو نقد استلمته؛ أرفق ما يثبتها." },
  invoice: { t: "طلب إصدار مطالبة للعميل", ic: "send", hint: "عند استحقاق دفعة من الأتعاب بحسب الاتفاق." },
};
const REQ_STATUS = { pending: { t: "بانتظار اعتماد المدير", c: "warn" }, approved: { t: "معتمد", c: "ok" }, rejected: { t: "مرفوض", c: "bad" } };
const reqs = () => S.data.finreq || [];
const pendingReqs = () => reqs().filter((r) => (r.status || "pending") === "pending");
const pendingFees = () => S.data.fees.filter((f) => f.status === "pending");

/* ---------- portal chooser ---------- */
VIEWS.portal = () => {
  if (!S.booted || (S.caps.db && !S.loaded.lawyers)) return `<div class="thinking">جارٍ التحميل…</div>`;
  if (!isManager()) { S.portal = "pro"; setTimeout(() => go("dashboard"), 0); return ""; }
  const me = myLawyer(); const np = pendingReqs().length + pendingFees().length;
  const openFiles = S.data.cases.filter((c) => c.status === "closed" && !c.finClosed).length;
  const card = (k, t, ic, sub, items, badge) => `<button class="portal-card ${k}" data-act="portalGo" data-p="${k}"><span class="portal-ic">${icon(ic)}</span><span class="portal-t">${t}</span><span class="portal-s">${sub}</span>
    <span class="portal-items">${items.map((i) => `<span>${i}</span>`).join("")}</span>${badge ? `<span class="portal-badge">${badge}</span>` : ""}<span class="portal-go">${icon("send")} الدخول</span></button>`;
  return `<section class="portal"><div class="portal-head"><img src="${LOGO.iconLight}" alt="" class="portal-logo"><h1>أهلًا${me ? "، " + esc(me.name.split(" ")[0]) : ""}</h1><p>اختر النظام الذي تعمل عليه الآن؛ تستطيع التنقل بينهما في أي وقت من أعلى القائمة.</p></div>
    <div class="portal-grid">
      ${card("pro", "النظام المهني", "gavel", "العمل القانوني اليومي", ["القضايا والجلسات", "الاستشارات", "العقود والصياغة", "المكتبة النظامية والمساعد", "ناجز"], `${activeCases().length} قضية منظورة`)}
      ${card("admin", "النظام الإداري", "building", "المالية والإدارة", ["الملفات المالية للقضايا", "المطالبات والفواتير الضريبية", "اعتماد الطلبات المالية", "القيود والتقارير", "الفريق والإعدادات"], np ? `${np} طلب بانتظار اعتمادك` : openFiles ? `${openFiles} ملف مالي بانتظار الإقفال` : "")}
    </div></section>`;
};
A.portalGo = (el) => { S.portal = el.dataset.p; lsSet("portal", S.portal); go(S.portal === "admin" ? "admin" : "dashboard"); };
A.portalSwitch = (el) => A.portalGo(el);

/* ---------- administrative dashboard ---------- */
VIEWS.admin = () => {
  if (!isManager()) return noAdmin();
  const t = finTotals(); const np = pendingReqs(); const nf = pendingFees();
  const toClose = S.data.cases.filter((c) => c.status === "closed" && !c.finClosed);
  const recent = [...S.data.finance].sort((a, b) => (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || "")).slice(0, 8);
  const label = { invoice: "مطالبة", payment: "دفعة", expense: "مصروف", credit: "إشعار دائن" };
  return `<section class="hero admin-hero"><div><span class="eyebrow">النظام الإداري · ${fmtDate(todayStr(), true)}</span><h1>الإدارة المالية</h1><p>كل حركة مالية تمر باعتمادك، وكل قضية تبقى بملفها المالي حتى إقفاله.</p>
      <div class="row"><button class="btn gold" data-act="go" data-r="finreqs">${icon("check")}الطلبات المالية${np.length + nf.length ? ` (${np.length + nf.length})` : ""}</button><button class="btn" data-act="go" data-r="finfiles">${icon("cases")}الملفات المالية</button></div></div>
    <div class="kpis">
      <button class="kpi" data-act="go" data-r="finance"><span class="lbl">المحصّل</span><span class="val">${money(t.collected)}</span><span class="foot">من ${money(t.invoiced)} مفوتر</span></button>
      <button class="kpi attn" data-act="go" data-r="finance"><span class="lbl">المستحق على العملاء</span><span class="val">${money(t.outstanding)}</span><span class="foot">متأخر ${money(t.late)}</span></button>
      <button class="kpi ${np.length + nf.length ? "alert" : ""}" data-act="go" data-r="finreqs"><span class="lbl">بانتظار اعتمادك</span><span class="val">${np.length + nf.length}</span><span class="foot">${np.length} طلب مالي · ${nf.length} أتعاب</span></button>
      <button class="kpi ${toClose.length ? "attn" : ""}" data-act="finfilesFilter" data-f="toclose"><span class="lbl">ملفات بانتظار الإقفال</span><span class="val">${toClose.length}</span><span class="foot">قضايا منتهية بملف مالي مفتوح</span></button></div></section>
  ${adminInsights()}
  ${sectionHead("المتابعة والاعتماد")}
  <div class="cols"><div class="stack">
    <div class="card"><div class="card-h"><h3>بانتظار اعتمادك</h3><a class="sub" data-act="go" data-r="finreqs" style="cursor:pointer">الكل ←</a></div>
      ${np.length || nf.length ? `<div class="list">${[...np.map(reqRow), ...nf.map((f) => feeRow(f, true))].slice(0, 8).join("")}</div>` : emptyBox("check", "لا طلبات معلقة", "تصل هنا طلبات المحامين المالية واقتراحات الأتعاب.")}</div>
    <div class="card"><div class="card-h"><h3>آخر الحركات المالية</h3><a class="sub" data-act="go" data-r="finance" style="cursor:pointer">المالية ←</a></div>
      ${recent.length ? `<div class="list">${recent.map((x) => `<div class="li"><div class="body"><div class="ttl">${label[x.type] || x.type}${x.tax ? ` <span class="pill info">${esc(x.tax.no)}</span>` : x.no ? ` <span class="num muted small">${esc(x.no)}</span>` : ""}</div><div class="meta"><span>${esc(clientName(x.clientId))}</span>${x.caseId ? `<span>${esc(caseById(x.caseId)?.title || "")}</span>` : ""}<span>${fmtDate(x.date)}</span></div></div><b class="num">${money(x.total ?? x.amount)}</b></div>`).join("")}</div>` : emptyBox("coin", "لا حركات بعد", "")}</div></div>
  <div class="stack">
    <div class="card"><div class="card-h"><h3>قضايا منتهية بملف مالي مفتوح</h3></div>
      ${toClose.length ? `<div class="list">${toClose.slice(0, 8).map((c) => { const f = caseFin(c); return `<div class="li clickable" data-act="openFinFile" data-id="${c.id}"><div class="body"><div class="ttl">${esc(c.title)}</div><div class="meta"><span>${esc(clientName(c.clientId))}</span><span>المستحق ${money(f.outstanding)}</span></div></div>${pill(f.outstanding > 0 ? "مستحقات قائمة" : "جاهز للإقفال", f.outstanding > 0 ? "warn" : "ok")}</div>`; }).join("")}</div>` : emptyBox("check", "كل الملفات المنتهية مقفلة ماليًا", "")}</div>
    <div class="card"><div class="card-h"><h3>الإدارة</h3></div><div class="stack" style="gap:8px">
      <button class="btn" data-act="go" data-r="finance">${icon("receipt")}المطالبات والفواتير والقيود</button>
      <button class="btn" data-act="go" data-r="team">${icon("team")}فريق العمل والصلاحيات</button>
      <button class="btn" data-act="go" data-r="settings">${icon("settings")}الإعدادات والهوية</button></div></div></div></div>`;
};
const noAdmin = () => `<div class="card">${emptyBox("building", "النظام الإداري من صلاحية المدير", "تُرفع الطلبات المالية من صفحة القضية في النظام المهني، ويعتمدها المدير.", `<button class="btn" data-act="go" data-r="dashboard">العودة إلى النظام المهني</button>`)}</div>`;

/* ---------- financial files of cases ---------- */
function caseFin(c) {
  const t = finTotals((x) => x.caseId === c.id); const fee = num(c.fee);
  return { ...t, fee, uninvoiced: Math.max(0, fee - t.invoiced), pending: pendingReqs().filter((r) => r.caseId === c.id).length + pendingFees().filter((f) => f.caseId === c.id).length };
}
const finState = (c, f) => c.finClosed ? { t: "مقفل ماليًا", c: "ok" } : c.status === "closed" ? { t: "بانتظار الإقفال المالي", c: "warn" } : f.pending ? { t: "طلبات معلقة", c: "warn" } : { t: "مفتوح", c: "info" };
VIEWS.finfiles = () => {
  if (!isManager()) return noAdmin();
  const f = S.finFilter || "open";
  let rows = S.data.cases.map((c) => ({ c, f: caseFin(c) }));
  rows = rows.filter(({ c, f: x }) => f === "all" ? true : f === "closed" ? !!c.finClosed : f === "toclose" ? c.status === "closed" && !c.finClosed : f === "due" ? x.outstanding > 0 : !c.finClosed);
  rows.sort((a, b) => b.f.outstanding - a.f.outstanding || b.f.pending - a.f.pending);
  const sum = (k) => rows.reduce((s, r) => s + (r.f[k] || 0), 0);
  return `<div class="page-head"><div><h1>الملفات المالية للقضايا</h1><p>لكل قضية ملف مالي يبقى مفتوحًا حتى يُقفل بعد تسوية مستحقاتها، ولو انتهت القضية.</p></div></div>
  <div class="chips">${[["open", "المفتوحة"], ["toclose", "بانتظار الإقفال"], ["due", "عليها مستحقات"], ["closed", "المقفلة"], ["all", "الكل"]].map(([k, t]) => `<span class="chip ${f === k ? "on" : ""}" data-act="finfilesFilter" data-f="${k}">${t}</span>`).join("")}</div>
  <div class="kpis"><div class="kpi"><span class="lbl">الأتعاب المتفق عليها</span><span class="val">${money(sum("fee"))}</span></div><div class="kpi"><span class="lbl">المفوتر</span><span class="val">${money(sum("invoiced"))}</span></div><div class="kpi"><span class="lbl">المحصّل</span><span class="val" style="color:var(--ok)">${money(sum("collected"))}</span></div><div class="kpi attn"><span class="lbl">المستحق</span><span class="val">${money(sum("outstanding"))}</span></div></div>
  ${rows.length ? `<div class="tbl-wrap"><table class="tbl resp"><thead><tr><th>القضية</th><th>العميل</th><th>الأتعاب</th><th>المفوتر</th><th>المحصّل</th><th>المستحق</th><th>المصروفات</th><th>الحالة</th></tr></thead><tbody>
    ${rows.map(({ c, f: x }) => { const st = finState(c, x); return `<tr data-act="openFinFile" data-id="${c.id}"><td class="primary-cell"><div class="t">${esc(c.title)}</div><div class="ref">${esc(c.ref || "")} · ${statusPill(c.status || "intake")}</div></td><td data-label="العميل">${esc(clientName(c.clientId))}</td><td data-label="الأتعاب" class="num">${money(x.fee)}</td><td data-label="المفوتر" class="num">${money(x.invoiced)}</td><td data-label="المحصّل" class="num">${money(x.collected)}</td><td data-label="المستحق" class="num"><b>${money(x.outstanding)}</b></td><td data-label="المصروفات" class="num">${money(x.expenses)}</td><td data-label="الحالة">${pill(st.t, st.c)}${x.pending ? ` <span class="pill warn">${x.pending}</span>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="card">${emptyBox("cases", "لا ملفات في هذا التصنيف", "")}</div>`}`;
};
A.finfilesFilter = (el) => { S.finFilter = el.dataset.f; go("finfiles"); };
A.openFinFile = (el) => { S.portal = "admin"; go("finfile", el.dataset.id); };
VIEWS.finfile = () => {
  if (!isManager()) return noAdmin();
  const c = caseById(S.route.id); if (!c) return `<div class="card">${emptyBox("cases", "لم نجد القضية", "", `<button class="btn" data-act="go" data-r="finfiles">العودة</button>`)}</div>`;
  const f = caseFin(c); const st = finState(c, f); const rq = reqs().filter((r) => r.caseId === c.id).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const fees = S.data.fees.filter((x) => x.caseId === c.id);
  return `<div class="crumbs"><a data-act="go" data-r="finfiles">الملفات المالية</a><span>/</span><span class="num">${esc(c.ref || "")}</span></div>
  <div class="case-head"><div class="row" style="align-items:flex-start"><div class="grow"><h1>${esc(c.title)}</h1><div class="row small muted" style="margin-top:4px">${statusPill(c.status || "intake")}${pill(st.t, st.c)}<span>${esc(clientName(c.clientId))}</span><span>المحامي: ${esc(lawyerName(c.lawyerId))}</span></div></div>
    <div class="row"><button class="btn" data-act="openCaseFromAdmin" data-id="${c.id}">${icon("gavel")}فتح القضية</button>${c.finClosed ? `<button class="btn ghost" data-act="finReopen" data-id="${c.id}">إعادة فتح الملف المالي</button>` : `<button class="btn gold" data-act="finClose" data-id="${c.id}">${icon("check")}إقفال الملف المالي</button>`}</div></div>
    ${c.finClosed ? `<div class="banner"><div class="grow">أُقفل الملف المالي ${fmtWhen(c.finClosed.at)}${c.finClosed.note ? ` — ${esc(c.finClosed.note)}` : ""}.</div></div>` : ""}</div>
  ${CASE_TABS.finance(c)}
  <div class="cols"><div class="card"><div class="card-h"><h3>الطلبات المالية لهذه القضية</h3><span class="sub">${rq.length}</span></div>
      ${rq.length ? `<div class="list">${rq.map(reqRow).join("")}</div>` : `<p class="small muted" style="margin:0">لا طلبات من المحامي بعد.</p>`}</div>
    <div class="card"><div class="card-h"><h3>الأتعاب</h3></div>${fees.length ? `<div class="list">${fees.map((x) => feeRow(x, true)).join("")}</div>` : `<p class="small muted" style="margin:0">لا أتعاب مقترحة أو معتمدة.</p>`}</div></div>`;
};
A.openCaseFromAdmin = (el) => { S.portal = "pro"; go("case", el.dataset.id); };
A.finClose = (el) => {
  const c = caseById(el.dataset.id); const f = caseFin(c);
  if (f.pending) return toast(`لا يُقفل الملف وعليه ${f.pending} طلب معلق؛ اعتمدها أو ارفضها أولًا.`, true);
  modal("إقفال الملف المالي", `<form id="fc-form" data-form="finClose" class="stack" style="gap:12px"><input type="hidden" name="id" value="${c.id}">
    <div class="facts"><div class="fact"><div class="k">الأتعاب</div><div class="v num">${money(f.fee)}</div></div><div class="fact"><div class="k">المفوتر</div><div class="v num">${money(f.invoiced)}</div></div><div class="fact"><div class="k">المحصّل</div><div class="v num">${money(f.collected)}</div></div><div class="fact"><div class="k">المستحق</div><div class="v num"><b style="color:var(--${f.outstanding > 0 ? "bad" : "ok"})">${money(f.outstanding)}</b></div></div></div>
    ${f.outstanding > 0 ? `<div class="banner warn"><div class="grow">على العميل ${money(f.outstanding)} ر.س غير مسددة. الإقفال لا يلغيها من دفاتر المكتب؛ لتسويتها أصدر إشعارًا دائنًا أو سجّل الدفعة قبل الإقفال.</div></div>` : ""}
    ${f.uninvoiced > 0 ? `<div class="banner warn"><div class="grow">بقي ${money(f.uninvoiced)} ر.س من الأتعاب المتفق عليها دون مطالبة.</div></div>` : ""}
    <div class="field"><label for="fc-note">ملاحظة الإقفال</label><input id="fc-note" class="inp" name="note" placeholder="مثل: سُددت الأتعاب كاملة، أو: تنازل عن الدفعة الأخيرة بقرار المدير"></div></form>`,
    `<button class="btn gold" type="submit" form="fc-form">${icon("check")}إقفال الملف</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
};
F.finClose = async (d) => {
  const c = caseById(d.id); const f = caseFin(c);
  await upd(`cases/${c.id}`, { finClosed: { at: nowIso(), by: myLid() || S.me.id, note: d.note || "", outstanding: f.outstanding } });
  await logCase(c.id, "status", `أُقفل الملف المالي للقضية${f.outstanding > 0 ? ` (مستحق قائم ${money(f.outstanding)} ر.س)` : ""}${d.note ? ` — ${d.note}` : ""}`);
  closeModal(); toast("أُقفل الملف المالي");
};
A.finReopen = (el) => confirmBox("إعادة فتح الملف المالي", "يعود الملف مفتوحًا لتسجيل حركات جديدة عليه.", "إعادة الفتح", async () => { await upd(`cases/${el.dataset.id}`, { finClosed: null }); await logCase(el.dataset.id, "status", "أُعيد فتح الملف المالي"); toast("أُعيد فتح الملف"); });

/* ---------- financial requests (raised in the professional system) ---------- */
function finReqCard(c, key = "caseId") {
  const mine = isManager() || c.lawyerId === myLid(); if (!mine) return "";
  const rq = reqs().filter((r) => r[key] === c.id).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 6);
  const fees = feesFor(key, c.id);
  return `<div class="card"><div class="card-h"><h3>الطلبات المالية</h3><div class="row" style="gap:6px">${isManager() && key === "caseId" ? `<button class="btn sm ghost" data-act="openFinFile" data-id="${c.id}">${icon("building")}الملف المالي</button>` : ""}<button class="btn sm gold" data-act="newReq" data-key="${key}" data-id="${c.id}">${icon("plus")}طلب مالي</button></div></div>
    <p class="small muted" style="margin:0 0 8px">المالية في النظام الإداري؛ ترفع هنا الطلب ويعتمده المدير قبل أن يُسجَّل.</p>
    ${fees.length || rq.length ? `<div class="list">${fees.map((f) => feeRow(f, false)).join("")}${rq.map(reqRow).join("")}</div>` : `<p class="small muted" style="margin:0">لا طلبات بعد.</p>`}
    ${c.finClosed ? `<div class="small" style="margin-top:8px">${pill("الملف المالي مقفل", "ok")}</div>` : ""}</div>`;
}
function reqRow(r) {
  const T = REQ_TYPES[r.type] || { t: r.type, ic: "coin" }; const st = REQ_STATUS[r.status || "pending"]; const c = caseById(r.caseId);
  return `<div class="li"><span class="ic" style="color:var(--accent-ink)">${icon(T.ic)}</span><div class="body"><div class="ttl">${T.t} <b class="num">${money(r.amount)}</b> ر.س</div>
    <div class="meta">${c ? `<span>${esc(c.title)}</span>` : ""}<span>${esc(lawyerName(r.by))}</span><span>${ago(r.createdAt)}</span>${r.desc ? `<span>${esc(r.desc)}</span>` : ""}${r.receipt ? `<a data-act="viewFile" data-id="req:${r.id}" style="cursor:pointer">الإيصال</a>` : ""}${r.decisionNote ? `<span>ملاحظة المدير: ${esc(r.decisionNote)}</span>` : ""}</div></div>
    ${pill(st.t, st.c)}${isManager() && (r.status || "pending") === "pending" ? `<button class="btn sm gold" data-act="reviewReq" data-id="${r.id}">مراجعة</button>` : !isManager() && (r.status || "pending") === "pending" && r.by === (myLid() || S.me.id) ? `<button class="btn sm ghost danger" data-act="cancelReq" data-id="${r.id}" aria-label="سحب الطلب">${icon("trash")}</button>` : ""}</div>`;
}
A.newReq = (el) => {
  if (!guardWrite()) return; const key = el.dataset.key || "caseId"; const rec = key === "caseId" ? caseById(el.dataset.id) : byId(S.data.consults, el.dataset.id);
  S.reqFile = null;
  modal("طلب مالي جديد", `<form id="rq-form" data-form="saveReq" class="stack" style="gap:12px"><input type="hidden" name="key" value="${key}"><input type="hidden" name="ref" value="${rec.id}">
    <div class="pick">${[...Object.entries(REQ_TYPES), ["fee", { t: "اقتراح أتعاب", ic: "contract", hint: "أتعاب القضية أو الاستشارة وطريقة سدادها." }]].map(([k, v], i) => `<label><input type="radio" name="type" value="${k}" ${i === 0 ? "checked" : ""} data-ch="reqType"><div><b>${v.t}</b><div class="small muted">${v.hint}</div></div></label>`).join("")}</div>
    <div class="grid2"><div class="field"><label for="rq-amt" class="req">المبلغ (ر.س)</label><input id="rq-amt" class="inp num" name="amount" inputmode="decimal" required></div>
      <div class="field"><label for="rq-date">التاريخ</label><input id="rq-date" class="inp" type="date" name="date" value="${todayStr()}"></div></div>
    <div class="field"><label for="rq-desc">البيان</label><input id="rq-desc" class="inp" name="desc" placeholder="مثل: رسوم ترجمة صك، أو: حوالة من العميل رقم 1234"></div>
    <div class="field"><label for="rq-file">الإيصال أو المستند (اختياري)</label><input id="rq-file" class="inp" type="file" accept="image/*,.pdf" data-ch="reqFile"></div></form>`,
    `<button class="btn gold" type="submit" form="rq-form">${icon("send")}رفع الطلب للمدير</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
};
CH.reqType = () => { const fee = document.querySelector('#rq-form input[name="type"]:checked')?.value === "fee"; if (fee) { const f = $("#rq-form"); const key = f.key.value, ref = f.ref.value; closeModal(); A.newFee({ dataset: { key, id: ref } }); } };
CH.reqFile = (el) => { S.reqFile = el.files[0] || null; };
F.saveReq = async (d) => {
  const amount = num(d.amount); if (amount <= 0) return toast("أدخل المبلغ.", true);
  const rec = d.key === "caseId" ? caseById(d.ref) : byId(S.data.consults, d.ref);
  const data = { type: d.type, amount, date: d.date, desc: d.desc, [d.key]: d.ref, clientId: rec?.clientId || "", status: "pending", by: myLid() || S.me.id };
  try { if (S.reqFile && S.caps.assets) data.receipt = await storeFile(S.reqFile, "finreq"); } catch (e) { return fileErr(e, "الإيصال"); }
  await add("finreq", data); S.reqFile = null;
  if (d.key === "caseId") await logCase(d.ref, "note", `رُفع طلب مالي: ${REQ_TYPES[d.type].t} بمبلغ ${money(amount)} ر.س`);
  closeModal(); toast("رُفع الطلب للمدير");
};
A.cancelReq = (el) => confirmBox("سحب الطلب", "سيُحذف الطلب قبل أن يراجعه المدير.", "سحب", async () => { await del(`finreq/${el.dataset.id}`); toast("سُحب الطلب"); }, true);

/* Manager review: adjust, then approve (posts the finance record and its journal entry) or reject with a note. */
A.reviewReq = (el) => {
  const r = byId(reqs(), el.dataset.id); if (!r) return; const T = REQ_TYPES[r.type]; const c = caseById(r.caseId);
  const open = fin("invoice").filter((i) => i.status !== "void" && i.clientId === r.clientId && invState(i).k !== "paid");
  modal(`مراجعة طلب: ${T.t}`, `<form id="rv-form" data-form="decideReq" class="stack" style="gap:12px"><input type="hidden" name="id" value="${r.id}">
    <div class="facts"><div class="fact"><div class="k">مقدم الطلب</div><div class="v">${esc(lawyerName(r.by))}</div></div><div class="fact"><div class="k">القضية</div><div class="v">${esc(c?.title || "—")}</div></div><div class="fact"><div class="k">العميل</div><div class="v">${esc(clientName(r.clientId))}</div></div></div>
    <div class="grid2"><div class="field"><label for="rv-amt">المبلغ المعتمد (ر.س)</label><input id="rv-amt" class="inp num" name="amount" value="${r.amount}"></div>
      <div class="field"><label for="rv-desc">البيان</label><input id="rv-desc" class="inp" name="desc" value="${esc(r.desc || "")}"></div>
      ${r.type === "expense" ? `<div class="field"><label for="rv-cat">التصنيف</label><select id="rv-cat" class="inp" name="category">${EXP_CATS.map((m) => opt(m, m, "")).join("")}</select></div><label class="chk"><input type="checkbox" name="billable" value="1" checked> يُحمَّل على العميل</label>` : ""}
      ${r.type === "payment" ? `<div class="field"><label for="rv-inv">على المطالبة</label><select id="rv-inv" class="inp" name="invoiceId">${opt("", "— دفعة مقدمة —", "")}${open.map((i) => opt(i.id, `${i.tax?.no || i.no} · المتبقي ${money(num(i.total) - invPaid(i))}`, open.length === 1 ? i.id : "")).join("")}</select></div><div class="field"><label for="rv-m">الطريقة</label><select id="rv-m" class="inp" name="method">${PAY_METHODS.map((m) => opt(m, m, "")).join("")}</select></div>` : ""}
      ${r.type === "invoice" ? `<div class="field"><label for="rv-vat">الضريبة</label><select id="rv-vat" class="inp" name="vat">${opt("15", "15%", "15")}${opt("0", "بدون ضريبة", "")}</select></div><div class="field"><label for="rv-due">الاستحقاق</label><input id="rv-due" class="inp" type="date" name="due" value="${ymd(new Date(Date.now() + 14 * 864e5))}"></div>` : ""}</div>
    ${r.receipt ? `<button class="btn sm" type="button" data-act="viewFile" data-id="req:${r.id}">${icon("eye")}عرض الإيصال</button>` : ""}
    <div class="field"><label for="rv-note">ملاحظة للمحامي</label><input id="rv-note" class="inp" name="note"></div></form>`,
    `<button class="btn gold" type="submit" form="rv-form" name="decision" value="approve">${icon("check")}اعتماد وتسجيل</button><button class="btn danger" data-act="rejectReq" data-id="${r.id}">رفض</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
};
F.decideReq = async (d) => {
  const r = byId(reqs(), d.id); if (!r) return; const amount = num(d.amount); if (amount <= 0) return toast("أدخل مبلغًا صحيحًا.", true);
  const base = { clientId: r.clientId || caseById(r.caseId)?.clientId || "", caseId: r.caseId || "", consultId: r.consultId || "", date: r.date || todayStr(), fromReq: r.id };
  let data, kind, memo;
  if (r.type === "expense") { kind = "expense"; data = { ...base, type: "expense", category: d.category, amount, desc: d.desc, billable: d.billable === "1", ...(r.receipt ? { receipt: r.receipt } : {}) }; memo = `مصروف ${d.category}${d.desc ? " — " + d.desc : ""}`; }
  else if (r.type === "payment") { kind = "payment"; data = { ...base, type: "payment", invoiceId: d.invoiceId || "", amount, method: d.method, ref: d.desc, no: finNo("payment"), ...(r.receipt ? { receipt: r.receipt } : {}) }; memo = `دفعة من ${clientName(base.clientId)}${d.desc ? " — " + d.desc : ""}`; }
  else { kind = "invoice"; const vat = Number(d.vat) || 0; const total = Math.round(amount * (1 + vat / 100) * 100) / 100; data = { ...base, type: "invoice", desc: d.desc || "أتعاب", amount, vat: d.vat, vatAmount: total - amount, total, due: d.due, status: "active", no: finNo("invoice") }; memo = `مطالبة ${data.no} — ${clientName(base.clientId)}: ${data.desc}`; }
  const fid = await add("finance", data);
  await syncJournal(kind, fid, data, memo);
  await upd(`finreq/${r.id}`, { status: "approved", finId: fid, decidedBy: myLid() || S.me.id, decidedAt: nowIso(), approvedAmount: amount, decisionNote: d.note || "" });
  if (r.caseId) await logCase(r.caseId, "note", `اعتمد المدير ${REQ_TYPES[r.type].t} بمبلغ ${money(amount)} ر.س`);
  closeModal(); toast("اعتُمد الطلب وسُجّل في المالية");
};
A.rejectReq = async (el) => {
  const note = $("#rv-note")?.value || ""; const r = byId(reqs(), el.dataset.id);
  await upd(`finreq/${r.id}`, { status: "rejected", decidedBy: myLid() || S.me.id, decidedAt: nowIso(), decisionNote: note });
  if (r.caseId) await logCase(r.caseId, "note", `رفض المدير ${REQ_TYPES[r.type].t}${note ? ` — ${note}` : ""}`);
  closeModal(); toast("رُفض الطلب");
};
VIEWS.finreqs = () => {
  if (!isManager()) return noAdmin();
  const np = pendingReqs(), nf = pendingFees(); const done = reqs().filter((r) => r.status && r.status !== "pending").sort((a, b) => (b.decidedAt || "").localeCompare(a.decidedAt || "")).slice(0, 20);
  return `<div class="page-head"><div><h1>الطلبات المالية</h1><p>طلبات المحامين المالية واقتراحات الأتعاب؛ لا يُسجَّل شيء في المالية قبل اعتمادك.</p></div></div>
  <div class="cols"><div class="card"><div class="card-h"><h3>بانتظار الاعتماد</h3><span class="sub">${np.length}</span></div>${np.length ? `<div class="list">${np.map(reqRow).join("")}</div>` : emptyBox("check", "لا طلبات معلقة", "")}</div>
    <div class="card"><div class="card-h"><h3>اقتراحات الأتعاب</h3><span class="sub">${nf.length}</span></div>${nf.length ? `<div class="list">${nf.map((f) => feeRow(f, true)).join("")}</div>` : emptyBox("check", "لا اقتراحات معلقة", "")}</div></div>
  ${done.length ? `<div class="card"><div class="card-h"><h3>آخر القرارات</h3></div><div class="list">${done.map(reqRow).join("")}</div></div>` : ""}`;
};
