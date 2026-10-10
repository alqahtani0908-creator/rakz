/* ============ Rakz — views ============ */
const VIEWS = {};

/* ---------------- Dashboard ---------------- */
VIEWS.dashboard = () => {
  const me = myLawyer();
  const h = new Date().getHours();
  const greet = h < 12 ? "صباح الخير" : "مساء الخير";
  const act = activeCases();
  const week = openTasks().filter((t) => t.kind === "session" && daysLeft(t.due) !== null && daysLeft(t.due) >= 0 && daysLeft(t.due) <= 7);
  const late = openTasks().filter((t) => daysLeft(t.due) !== null && daysLeft(t.due) < 0);
  const lateMine = late.filter(isMine);
  const pend = pendingForMe();
  const pendAll = S.data.cases.filter((c) => c.assignment?.status === "pending");
  const upcoming = openTasks().filter((t) => t.due && daysLeft(t.due) >= 0 && daysLeft(t.due) <= 14 && ["session", "memo", "requirement", "event"].includes(t.kind)).sort((a, b) => (a.due + (a.time || "")).localeCompare(b.due + (b.time || ""))).slice(0, 8);
  const urgent = openTasks().filter((t) => t.due).sort((a, b) => a.due.localeCompare(b.due)).filter((t) => daysLeft(t.due) <= 3).slice(0, 7);

  const statusCounts = Object.keys(STATUSES).map((k) => [k, S.data.cases.filter((c) => (c.status || "intake") === k).length]);
  const total = S.data.cases.length || 1;
  const colorFor = { intake: "var(--info)", active: "var(--accent)", judgment: "var(--warn)", appeal: "var(--bad)", cassation: "#8A3A6B", review: "#B07A2A", execution: "var(--ink-2)", closed: "var(--ok)" };
  const load = S.data.lawyers.filter((l) => l.active !== false).map((l) => [l, act.filter((c) => c.lawyerId === l.id).length]).sort((a, b) => b[1] - a[1]);
  const maxLoad = Math.max(1, ...load.map((x) => x[1]));
  const recent = [...S.data.cases].filter((c) => c.lastAction).sort((a, b) => (b.lastAction.at || "").localeCompare(a.lastAction.at || "")).slice(0, 6);

  const empty = S.loaded.cases && !S.data.cases.length;
  const steps = [
    { done: S.data.lawyers.length > 0, t: "أضف فريق العمل", d: "المحامون والمستشارون الذين تُسند إليهم القضايا", r: "team" },
    { done: !!me, t: "اختر اسمك", d: "من «تعمل باسم» أسفل القائمة", r: "team" },
    { done: S.data.clients.length > 0, t: "أضف أول عميل", d: "بيانات الهوية أو السجل التجاري للعقود", r: "clients" },
    { done: S.data.cases.length > 0, t: "افتح أول قضية", d: "ثم ارفع مرفقاتها ليقرأها المساعد", act: "newCase" },
  ];
  return `
  <div class="page-head"><div><h1>${greet}${me ? "، " + esc(me.name.split(" ")[0]) : ""}</h1>
    <p>${fmtDate(todayStr(), true)} · <span class="num">${esc(fmtHijri(todayStr()))}</span></p></div>
    <div class="row"><button class="btn" data-act="newTask">${icon("plus")}مهمة أو موعد</button><button class="btn" data-act="go" data-r="drafting">${icon("docs")}صياغة مستند</button></div></div>
  ${steps.some((s) => !s.done) ? `<div class="card"><div class="card-h"><h3>تهيئة المنصة</h3><span class="sub">${steps.filter((s) => s.done).length} من 4</span></div>
    <div class="onb">${steps.map((s, i) => `<div class="step ${s.done ? "done" : ""}" data-act="${s.act || "go"}" data-r="${s.r || ""}"><span class="n">${s.done ? "✓" : i + 1}</span><b>${s.t}</b><span class="muted small">${s.d}</span></div>`).join("")}</div></div>` : ""}
  <div class="kpis">
    <button class="kpi" data-act="go" data-r="cases"><span class="lbl">القضايا المنظورة</span><span class="val">${act.length}</span><span class="foot">${S.data.cases.filter((c) => c.status === "intake").length} قيد الدراسة</span></button>
    <button class="kpi attn" data-act="go" data-r="tasks"><span class="lbl">جلسات خلال 7 أيام</span><span class="val">${week.length}</span><span class="foot">${week[0] ? "أقربها " + fmtDate(week[0].due) : "لا جلسات قريبة"}</span></button>
    <button class="kpi ${late.length ? "alert" : ""}" data-act="go" data-r="tasks"><span class="lbl">مهام متأخرة</span><span class="val">${late.length}</span><span class="foot">${lateMine.length} منها لك</span></button>
    <button class="kpi ${pend.length ? "attn" : ""}" data-act="go" data-r="assign"><span class="lbl">إسنادات بانتظار القبول</span><span class="val">${pend.length || pendAll.length}</span><span class="foot">${pend.length ? "بانتظار ردّك" : `${pendAll.length} في المكتب`}</span></button>
  </div>
  <div class="cols">
    <div class="stack">
      <div class="card"><div class="card-h"><h3>الجلسات والمواعيد القادمة</h3><span class="sub">14 يومًا</span></div>
        ${upcoming.length ? `<div class="list">${upcoming.map(taskRowDated).join("")}</div>` : emptyBox("cal", empty ? "ستظهر هنا الجلسات ومواعيد رفع اللوائح" : "لا مواعيد خلال الأسبوعين القادمين", "أضف موعدًا يدويًا أو ارفع محضر جلسة ليستخرج المساعد المواعيد منه.", `<button class="btn sm" data-act="newTask">${icon("plus")}إضافة موعد</button>`)}
      </div>
      <div class="card"><div class="card-h"><h3>يتطلب انتباهك</h3><a class="sub" data-act="go" data-r="tasks" style="cursor:pointer">كل المهام ←</a></div>
        ${urgent.length ? `<div class="list">${urgent.map((t) => taskRow(t)).join("")}</div>` : emptyBox("check", "لا شيء متأخر أو مستحق خلال 3 أيام", "")}
      </div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-h"><h3>القضايا حسب الحالة</h3><span class="sub num">${S.data.cases.length} قضية</span></div>
        <div class="stackbar">${statusCounts.filter((x) => x[1]).map(([k, n]) => `<span title="${STATUSES[k].t}: ${n}" style="width:${(n / total) * 100}%;background:${colorFor[k]}"></span>`).join("")}</div>
        <div class="legend">${statusCounts.map(([k, n]) => `<span><i style="background:${colorFor[k]}"></i>${STATUSES[k].t} <b class="num">${n}</b></span>`).join("")}</div>
      </div>
      <div class="card"><div class="card-h"><h3>حمل العمل لدى الفريق</h3><span class="sub">قضايا غير منتهية</span></div>
        ${load.length ? `<div class="bars">${load.map(([l, n]) => `<div class="bar-row"><span>${esc(l.name)}</span><div class="track"><div class="fill ${l.id === myLid() ? "gold" : ""}" style="width:${(n / maxLoad) * 100}%"></div></div><span class="n">${n}</span></div>`).join("")}</div>` : emptyBox("team", "لم يُضف أحد إلى الفريق بعد", "", `<button class="btn sm" data-act="go" data-r="team">إضافة محامٍ</button>`)}
      </div>
      ${(() => { const due = act.filter((c) => c.clientId && (!c.lastReportAt || Date.now() - new Date(c.lastReportAt) > 14 * 864e5) && (!myLid() || c.lawyerId === myLid())).slice(0, 5);
        return due.length ? `<div class="card"><div class="card-h"><h3>عملاء بانتظار تقرير مستجدات</h3><span class="sub">لم يصلهم تقرير منذ 14 يومًا</span></div><div class="list">${due.map((c) => `<div class="li clickable" data-act="openCase" data-id="${c.id}" data-tab="reports"><span class="ic" style="color:var(--ok)">${icon("wa")}</span><div class="body"><div class="ttl">${esc(clientName(c.clientId))}</div><div class="meta"><span>${esc(c.title)}</span><span>${c.lastReportAt ? "آخر تقرير " + ago(c.lastReportAt) : "لم يُرسل تقرير"}</span></div></div></div>`).join("")}</div></div>` : ""; })()}
      <div class="card"><div class="card-h"><h3>آخر الإجراءات</h3></div>
        ${recent.length ? `<div class="list">${recent.map((c) => `<div class="li clickable" data-act="openCase" data-id="${c.id}"><div class="body"><div class="ttl">${esc(c.title)}</div><div class="meta"><span>${esc(c.lastAction.text)}</span><span>${ago(c.lastAction.at)}</span></div></div></div>`).join("")}</div>` : emptyBox("flag", "سيظهر هنا ما يُضاف إلى سجلات القضايا", "")}
      </div>
    </div>
  </div>`;
};
function emptyBox(ic, title, text, cta = "") { return `<div class="empty">${icon(ic)}<b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ""}${cta}</div>`; }
function dateBox(s) { const d = parseDay(s); const n = daysLeft(s); return `<div class="datebox ${n === 0 ? "today" : n < 0 ? "late" : ""}"><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()]}</span></div>`; }
function taskRowDated(t) {
  const c = caseById(t.caseId);
  return `<div class="li clickable" data-act="${c ? "openCase" : "editTask"}" data-id="${c ? c.id : t.id}" data-tab="tasks">${dateBox(t.due)}
    <div class="body"><div class="ttl">${esc(t.title)}</div><div class="meta">${kindPill(t.kind)}${t.time ? `<span class="num">${esc(t.time)}</span>` : ""}${c ? `<span>${esc(c.title)}</span>` : ""}<span>${esc(fmtHijri(t.due))}</span></div></div>${countdown(t.due)}</div>`;
}
function taskRow(t, opts = {}) {
  const c = caseById(t.caseId); const p = effPriority(t);
  return `<div class="li"><input type="checkbox" class="chk-done" data-act="toggleTask" data-id="${t.id}" ${t.status === "done" ? "checked" : ""} aria-label="تم">
    <span class="prio ${p}" title="الأولوية: ${PRIOS[p]}"></span>
    <div class="body" data-act="editTask" data-id="${t.id}" style="cursor:pointer"><div class="ttl" style="${t.status === "done" ? "text-decoration:line-through;opacity:.6" : ""}">${esc(t.title)}</div>
      <div class="meta">${kindPill(t.kind)}${c && !opts.noCase ? `<span>${esc(c.title)}</span>` : ""}<span>${esc(lawyerName(t.assignee || c?.lawyerId))}</span>${t.due ? `<span class="num">${fmtDate(t.due)}${t.time ? " · " + esc(t.time) : ""}</span>` : ""}${t.source === "ai" ? `<span class="ai-tag">${icon("spark")}مستخرج آليًا</span>` : ""}</div></div>
    ${t.status !== "done" ? countdown(t.due) : '<span class="pill ok">تم</span>'}</div>`;
}

/* ---------------- Cases list ---------------- */
VIEWS.cases = () => {
  const f = S.ui.caseFilter; const l = myLid();
  let rows = S.data.cases.filter((c) => (!f.status || (c.status || "intake") === f.status) && (!f.type || c.type === f.type) && (!f.lawyer || c.lawyerId === f.lawyer) && (!f.mine || c.lawyerId === l || c.assignment?.to === l) && (!f.client || c.clientId === f.client));
  if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter((c) => [c.title, c.ref, c.najiz, c.opponent, clientName(c.clientId), c.court, c.circuit].join(" ").toLowerCase().includes(q)); }
  rows.sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
  const sel = S.ui.selected;
  return `
  <div class="page-head"><div><h1>القضايا</h1><p>${S.data.cases.length} قضية في المكتب · ${activeCases().length} غير منتهية</p></div>
    <div class="row"><button class="btn gold" data-act="newCase">${icon("plus")}قضية جديدة</button></div></div>
  <div class="row">
    <input id="case-q" class="inp" style="max-width:280px" placeholder="بحث بالعنوان أو الخصم أو رقم ناجز" data-filter="1" value="${esc(f.q)}">
    <select class="inp" style="width:auto" data-ch="cf" data-k="status">${opt("", "كل الحالات", f.status)}${Object.entries(STATUSES).map(([k, v]) => opt(k, v.t, f.status)).join("")}</select>
    <select class="inp" style="width:auto" data-ch="cf" data-k="type">${opt("", "كل الأنواع", f.type)}${CASE_TYPES.map((t) => opt(t, t, f.type)).join("")}</select>
    <select class="inp" style="width:auto" data-ch="cf" data-k="lawyer">${lawyerOpts(f.lawyer, "كل المحامين")}</select>
    ${f.client ? `<span class="chip on" data-act="clearClient">العميل: ${esc(clientName(f.client))} ✕</span>` : ""}
    <label class="chk"><input type="checkbox" data-ch="cf" data-k="mine" ${f.mine ? "checked" : ""}> قضاياي فقط</label>
  </div>
  ${rows.length ? `<div class="tbl-wrap"><table class="tbl resp"><thead><tr><th style="width:30px"><input type="checkbox" data-ch="selAll" aria-label="تحديد الكل" ${rows.length && rows.every((r) => sel.has(r.id)) ? "checked" : ""}></th><th>القضية</th><th>العميل</th><th>المحكمة</th><th>المحامي</th><th>الحالة</th><th>الموعد القادم</th></tr></thead><tbody>
    ${rows.map((c) => { const nx = nextDateForCase(c.id); return `<tr data-act="openCase" data-id="${c.id}">
      <td data-noact="1"><input type="checkbox" data-ch="sel" data-id="${c.id}" ${sel.has(c.id) ? "checked" : ""} aria-label="تحديد"></td>
      <td class="primary-cell"><div class="t">${esc(c.title)}</div><div class="ref">${esc(c.ref || "")}${c.najiz ? " · ناجز " + esc(c.najiz) : ""}</div></td>
      <td data-label="العميل">${esc(clientName(c.clientId))}</td><td data-label="المحكمة">${esc(c.court || "—")}${c.ai?.jurisdiction?.matchesCase === false ? ` <span class="pill bad" title="${esc(c.ai.jurisdiction.note || "")}">اختصاص؟</span>` : ""}</td>
      <td data-label="المحامي">${c.assignment?.status === "pending" ? `<span class="pill warn">بانتظار ${esc(lawyerName(c.assignment.to))}</span>` : esc(lawyerName(c.lawyerId))}</td>
      <td data-label="الحالة">${statusPill(c.status || "intake")}</td>
      <td data-label="الموعد القادم">${nx ? `<span class="num">${fmtDate(nx.due)}</span><br>${countdown(nx.due)}` : '<span class="muted">—</span>'}</td></tr>`; }).join("")}
  </tbody></table></div>` : `<div class="card">${emptyBox("cases", S.data.cases.length ? "لا توجد قضايا مطابقة للتصفية" : "لا توجد قضايا بعد", S.data.cases.length ? "غيّر عوامل التصفية أو امسح البحث." : "افتح ملف القضية الأولى ثم ارفع مرفقاتها.", S.data.cases.length ? "" : `<button class="btn gold" data-act="newCase">${icon("plus")}قضية جديدة</button>`)}</div>`}
  ${sel.size ? `<div class="bulkbar"><b class="num">${sel.size}</b> قضية محددة<span class="grow"></span>${isManager() ? `<button class="btn sm" data-act="bulkAssign">${icon("send")}إسناد المحدد</button>` : ""}<button class="btn sm" data-act="bulkStatus">تغيير الحالة</button><button class="btn sm ghost" style="color:inherit;background:transparent" data-act="clearSel">إلغاء التحديد</button></div>` : ""}`;
};
CH.cf = (el) => { const k = el.dataset.k; S.ui.caseFilter[k] = el.type === "checkbox" ? el.checked : el.value; render(); };
CH.sel = (el) => { el.checked ? S.ui.selected.add(el.dataset.id) : S.ui.selected.delete(el.dataset.id); render(); };
CH.selAll = (el) => { $$('input[data-ch="sel"]').forEach((i) => (el.checked ? S.ui.selected.add(i.dataset.id) : S.ui.selected.delete(i.dataset.id))); render(); };
A.clearSel = () => { S.ui.selected.clear(); render(); };
A.clearClient = () => { S.ui.caseFilter.client = ""; render(); };
A.clientCases = (el) => { S.ui.caseFilter = { q: "", status: "", type: "", lawyer: "", mine: false, client: el.dataset.id }; go("cases"); };

/* ---------------- Case form ---------------- */
function caseForm(c = {}) {
  return `<form id="case-form" data-form="saveCase" class="grid2"><input type="hidden" name="id" value="${esc(c.id || "")}">
    <div class="field span2"><label for="cf-title">عنوان القضية</label><input id="cf-title" class="inp" name="title" required value="${esc(c.title)}" placeholder="مثال: مطالبة بمستحقات عقد توريد"></div>
    <div class="field span2"><label for="cf-client" class="req">العميل (الموكل)</label><select id="cf-client" class="inp" name="clientId" required data-ch="caseClient">${clientOpts(c.clientId)}${opt("__new", "+ عميل جديد…")}</select></div>
    <div class="span2" id="cf-client-box">${caseClientBox(c.clientId)}</div>
    <div class="field"><label for="cf-role">صفة الموكل</label><select id="cf-role" class="inp" name="clientRole">${["مدعٍ", "مدعى عليه", "مستأنِف", "مستأنَف ضده", "طالب تنفيذ", "منفذ ضده", "مستشير"].map((x) => opt(x, x, c.clientRole)).join("")}</select></div>
    <div class="field"><label for="cf-opp">الخصم</label><input id="cf-opp" class="inp" name="opponent" value="${esc(c.opponent)}"></div>
    <div class="field"><label for="cf-type">نوع القضية</label><select id="cf-type" class="inp" name="type">${CASE_TYPES.map((t) => opt(t, t, c.type)).join("")}</select></div>
    <div class="field"><label for="cf-court">المحكمة / الجهة</label><select id="cf-court" class="inp" name="court">${opt("", "— لم تُحدد —", c.court)}${COURTS.map((t) => opt(t, t, c.court)).join("")}</select></div>
    <div class="field"><label for="cf-city">المدينة</label><input id="cf-city" class="inp" name="city" value="${esc(c.city || "الرياض")}"></div>
    <div class="field"><label for="cf-circ">الدائرة</label><input id="cf-circ" class="inp" name="circuit" value="${esc(c.circuit)}" placeholder="مثال: الدائرة التجارية الثالثة"></div>
    <div class="field"><label for="cf-najiz">رقم القضية في ناجز</label><input id="cf-najiz" class="inp num" name="najiz" value="${esc(c.najiz)}"></div>
    <div class="field"><label for="cf-status">الحالة</label><select id="cf-status" class="inp" name="status">${Object.entries(STATUSES).map(([k, v]) => opt(k, v.t, c.status || "intake")).join("")}</select></div>
    <div class="field"><label for="cf-value">قيمة المطالبة (ر.س)</label><input id="cf-value" class="inp num" name="value" inputmode="decimal" value="${esc(c.value)}"></div>
    <div class="field"><label for="cf-fee">الأتعاب المتفق عليها (ر.س)</label><input id="cf-fee" class="inp num" name="fee" inputmode="decimal" value="${esc(c.fee)}"></div>
    ${c.id ? "" : !isManager() ? `<div class="field span2"><span class="hint">ستظهر القضية للمدير لإسنادها إلى المحامي المناسب.</span></div>` : `<div class="field span2"><label for="cf-lawyer">إسناد إلى</label><select id="cf-lawyer" class="inp" name="assignTo">${lawyerOpts(myLid() || "", "— لاحقًا —")}</select><span class="hint">إذا اخترت محاميًا غيرك يصله طلب إسناد ولا تُنقل إليه القضية إلا بعد قبوله.</span></div>`}
    <div class="field span2"><label for="cf-desc">وقائع مختصرة</label><textarea id="cf-desc" class="inp" name="description" rows="4">${esc(c.description)}</textarea></div>
  </form>`;
}
function caseClientBox(id) {
  if (id === "__new") return `<div class="client-box"><h4>بيانات العميل الجديد كاملة</h4>${clientFields({}, "nc_")}<span class="small muted">لا تُفتح القضية إلا بعد استكمال الحقول المعلّمة بـ *.</span></div>`;
  const cl = byId(S.data.clients, id); if (!cl || clientComplete(cl)) return "";
  return `<div class="client-box"><h4>بيانات هذا العميل ناقصة: ${esc(clientErrors(cl).join("، "))}</h4>${clientFields(cl, "nc_")}<span class="small muted">أكملها هنا وستُحفظ في ملف العميل.</span></div>`;
}
CH.caseClient = (el) => { const box = $("#cf-client-box"); if (box) box.innerHTML = caseClientBox(el.value); };
A.newCase = () => { if (!guardWrite()) return; modal("قضية جديدة", caseForm(), `<button class="btn primary" type="submit" form="case-form">حفظ القضية</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`, true); };
A.editCase = (el) => { const c = caseById(el.dataset.id); modal("تعديل بيانات القضية", caseForm(c), `<button class="btn primary" type="submit" form="case-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`, true); };
F.saveCase = async (d) => {
  let clientId = d.clientId;
  if (!clientId) return toast("اختر العميل أو أضف عميلًا جديدًا ببياناته الكاملة.", true);
  const existing = byId(S.data.clients, clientId);
  if (clientId === "__new" || (existing && !clientComplete(existing))) {
    const cl = pickClient(d, "nc_"); const errs = clientErrors(cl);
    if (errs.length) return toast("أكمل بيانات العميل: " + errs.join("، "), true);
    const dup = clientId === "__new" && S.data.clients.find((x) => x.idNo && x.idNo === cl.idNo);
    if (dup) return toast(`العميل برقم ${cl.idNo} موجود باسم «${dup.name}». اختره من القائمة.`, true);
    if (clientId === "__new") clientId = await add("clients", cl); else await upd(`clients/${clientId}`, cl);
  }
  const base = { title: d.title.trim(), clientId: clientId || "", clientRole: d.clientRole, opponent: d.opponent, type: d.type, court: d.court, city: d.city, circuit: d.circuit, najiz: d.najiz, status: d.status, value: d.value, fee: d.fee, description: d.description };
  if (d.id) {
    const old = caseById(d.id); await upd(`cases/${d.id}`, base);
    if (old && old.status !== d.status) await logCase(d.id, "status", `تغيير الحالة إلى «${STATUSES[d.status].t}»`);
    else await logCase(d.id, "note", "تحديث بيانات القضية");
    closeModal(); toast("حُفظت التعديلات"); return;
  }
  const me = myLid(); const to = isManager() ? d.assignTo : "";
  const id = await add("cases", { ...base, ref: caseRef(), lawyerId: to && to === me ? me : "", openedAt: todayStr(), updatedAt: nowIso(),
    assignment: to && to !== me ? { to, from: me || "", status: "pending", at: nowIso(), note: "" } : null });
  await logCase(id, "status", `فتح ملف القضية${to && to !== me ? ` وطلب إسنادها إلى ${lawyerName(to)}` : to ? " وإسنادها إليّ" : ""}`);
  closeModal(); toast("فُتح ملف القضية"); go("case", id);
};

/* ---------------- Case detail ---------------- */
VIEWS.case = () => {
  const c = caseById(S.route.id);
  if (!c) return S.loaded.cases ? `<div class="card">${emptyBox("cases", "لم نجد هذه القضية", "ربما حُذفت.", `<button class="btn" data-act="go" data-r="cases">العودة للقضايا</button>`)}</div>` : `<div class="thinking">جارٍ التحميل…</div>`;
  const tab = S.route.tab || "overview";
  const tasks = S.data.tasks.filter((t) => t.caseId === c.id);
  const docs = S.data.docs.filter((d) => d.caseId === c.id);
  const asg = c.assignment;
  const tabs = [["overview", "نظرة عامة"], ["log", "سجل الإجراءات", S.caseLog.length], ["files", "المرفقات", S.caseFiles.length], ["tasks", "المهام والمواعيد", tasks.filter((t) => t.status !== "done").length], ["docs", "المستندات", docs.length], ["reports", "تقارير العميل"], ["finance", "المالية"]];
  return `
  <div class="crumbs"><a data-act="go" data-r="cases">القضايا</a><span>/</span><span class="num">${esc(c.ref || "")}</span></div>
  <div class="case-head">
    <div class="row" style="align-items:flex-start"><div class="grow"><h1>${esc(c.title)}</h1>
      <div class="row small muted" style="margin-top:4px">${statusPill(c.status || "intake")}<span>${esc(c.type || "")}</span>${c.najiz ? `<span class="num">ناجز: ${esc(c.najiz)}</span>` : ""}<span>فُتحت ${fmtDate(c.openedAt || (c.createdAt || "").slice(0, 10))}</span></div></div>
      <div class="row"><button class="btn" data-act="editCase" data-id="${c.id}">${icon("edit")}تعديل</button>${isManager() ? `<button class="btn" data-act="assignCase" data-id="${c.id}">${icon("send")}إسناد</button>` : ""}<button class="btn" data-act="deadline" data-id="${c.id}">${icon("gavel")}مهلة اعتراض</button><button class="btn gold" data-act="uploadPick" data-id="${c.id}">${icon("upload")}رفع مرفق</button></div></div>
    ${asg?.status === "pending" ? `<div class="banner ${asg.to === myLid() ? "gold" : "warn"}"><div class="grow"><b>${asg.to === myLid() ? "أُسندت إليك هذه القضية وتنتظر قبولك" : `طلب إسناد إلى ${esc(lawyerName(asg.to))} بانتظار القبول`}</b><span class="small">أرسله ${esc(lawyerName(asg.from))} ${ago(asg.at)}${asg.note ? ` · «${esc(asg.note)}»` : ""}</span></div>
      ${asg.to === myLid() ? `<button class="btn primary" data-act="acceptAsg" data-id="${c.id}">${icon("check")}قبول</button><button class="btn" data-act="declineAsg" data-id="${c.id}">اعتذار</button>` : isManager() ? `<button class="btn sm" data-act="cancelAsg" data-id="${c.id}">إلغاء الطلب</button>` : ""}</div>` : ""}
    ${!c.lawyerId && asg?.status !== "pending" ? `<div class="banner warn"><div class="grow"><b>القضية بلا محامٍ مسؤول</b><span class="small">${isManager() ? "أسندها إلى أحد أعضاء الفريق." : "بانتظار إسناد المدير."}</span></div>${isManager() ? `<button class="btn primary sm" data-act="assignCase" data-id="${c.id}">${icon("send")}إسناد</button>` : ""}</div>` : ""}
    <div class="facts">
      <div class="fact"><div class="k">العميل</div><div class="v">${esc(clientName(c.clientId))} <span class="muted small">(${esc(c.clientRole || "—")})</span></div></div>
      <div class="fact"><div class="k">الخصم</div><div class="v">${esc(c.opponent || "—")}</div></div>
      <div class="fact"><div class="k">المحكمة</div><div class="v">${esc(c.court || "—")}${c.circuit ? ` · ${esc(c.circuit)}` : ""}${c.city ? ` · ${esc(c.city)}` : ""}</div></div>
      <div class="fact"><div class="k">المحامي المسؤول</div><div class="v">${esc(lawyerName(c.lawyerId))}</div></div>
      <div class="fact"><div class="k">قيمة المطالبة</div><div class="v num">${c.value ? money(c.value) + " ر.س" : "—"}</div></div>
      <div class="fact"><div class="k">الأتعاب</div><div class="v num">${c.fee ? money(c.fee) + " ر.س" : "—"}</div></div>
    </div>
    <div class="tabs">${tabs.map(([k, t, n]) => `<a class="${tab === k ? "on" : ""}" data-act="tab" data-tab="${k}">${t}${n ? `<span class="n num">${n}</span>` : ""}</a>`).join("")}</div>
  </div>
  ${CASE_TABS[tab](c, tasks, docs)}
  <input type="file" id="file-in" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt" data-ch="filesPicked" data-id="${c.id}">`;
};

const CASE_TABS = {};
CASE_TABS.overview = (c, tasks) => {
  const up = tasks.filter((t) => t.status !== "done").sort((a, b) => (a.due || "9").localeCompare(b.due || "9")).slice(0, 6);
  const j = c.ai?.jurisdiction;
  const gen = S.gen?.kind === "brief" && S.gen.caseId === c.id;
  return `<div class="cols">
    <div class="stack">
      ${S.caps.sample || c.ai?.brief ? `<div class="card"><div class="card-h"><h3>${icon("spark", "")} قراءة المساعد لمجريات القضية</h3>
        <div class="row">${c.ai?.briefAt ? `<span class="sub">آخر تحديث ${ago(c.ai.briefAt)}</span>` : ""}${gen ? `<button class="btn sm" data-act="stopGen">إيقاف</button>` : `<button class="btn sm gold" data-act="caseBrief" data-id="${c.id}" ${S.caps.sample ? "" : "hidden"}>${icon("spark")}${c.ai?.brief ? "تحديث القراءة" : "حلّل القضية"}</button>`}</div></div>
        ${gen ? `<div class="prose" id="gen-out">${S.gen.text ? esc(S.gen.text) : '<span class="thinking">يقرأ المساعد المرفقات وسجل الإجراءات…</span>'}</div>`
          : c.ai?.brief ? `<div class="prose">${esc(c.ai.brief)}</div><p class="small muted" style="margin:10px 0 0">مخرجات آلية للمساعدة؛ يراجعها المحامي المسؤول قبل الاعتماد.</p>`
          : emptyBox("spark", "لم تُحلَّل القضية بعد", "ارفع صحيفة الدعوى والمذكرات والأحكام، ثم اطلب من المساعد قراءة المجريات والتحقق من جهة الاختصاص.")}
      </div>` : ""}
      <div class="card"><div class="card-h"><h3>الوقائع</h3></div><div class="prose">${esc(c.description || "لم تُكتب وقائع بعد.")}</div></div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-h"><h3>جهة الاختصاص</h3></div>
        ${j ? `<div class="juris ${j.matchesCase === true ? "ok" : j.matchesCase === false ? "bad" : "unk"}"><div><b>${j.matchesCase === true ? "الجهة المسجلة تبدو مختصة" : j.matchesCase === false ? "يُحتمل عدم الاختصاص" : "يحتاج تحققًا"}</b><div class="small">الجهة المقترحة: ${esc(j.expectedCourt || "—")}</div><div class="small">${esc(j.note || j.basis || "")}</div></div></div>`
          : `<p class="muted small" style="margin:0">${S.caps.sample ? "يتحقق المساعد من الاختصاص النوعي والمكاني عند تحليل المرفقات أو القضية." : "سجّل المحكمة والدائرة والمدينة في بيانات القضية، وراجع الاختصاص النوعي والمكاني قبل القيد."}</p>`}
      </div>
      <div class="card"><div class="card-h"><h3>القادم في هذه القضية</h3><button class="btn sm" data-act="newTask" data-case="${c.id}">${icon("plus")}إضافة</button></div>
        ${up.length ? `<div class="list">${up.map((t) => taskRow(t, { noCase: true })).join("")}</div>` : `<p class="muted small" style="margin:0">لا توجد مواعيد أو مهام مفتوحة.</p>`}
      </div>
      <div class="card"><div class="card-h"><h3>صياغة سريعة</h3></div><div class="row">
        <button class="btn sm" data-act="draftFor" data-kind="pleading" data-id="${c.id}">${icon("scale")}لائحة أو رد</button>
        <button class="btn sm" data-act="draftFor" data-kind="contract" data-id="${c.id}">${icon("contract")}عقد</button>
        <button class="btn sm" data-act="draftFor" data-kind="proposal" data-id="${c.id}">${icon("coin")}عرض أتعاب</button></div></div>
    </div></div>`;
};
CASE_TABS.log = (c) => `<div class="cols"><div class="card"><div class="card-h"><h3>سجل الإجراءات</h3><span class="sub">يُحدَّث تلقائيًا عند رفع المرفقات والإسناد وتغيير الحالة</span></div>
    ${S.caseLog.length ? `<div class="tl">${S.caseLog.map((e) => `<div class="tl-item k-${esc(e.kind)}"><div class="when">${fmtWhen(e.at)} · ${esc(lawyerName(e.by) === "غير مسند" ? "" : lawyerName(e.by))}</div><div class="what">${esc(e.text)}</div>${e.fileId ? `<a class="small" data-act="tab" data-tab="files" style="cursor:pointer">عرض المرفق</a>` : ""}</div>`).join("")}</div>` : emptyBox("flag", "السجل فارغ", "")}
  </div>
  <div class="card"><h3>إضافة إجراء</h3><form data-form="addLog" class="stack" style="gap:12px;margin-top:12px"><input type="hidden" name="caseId" value="${c.id}">
    <div class="field"><label for="lg-kind">نوع الإجراء</label><select id="lg-kind" class="inp" name="kind">${[["session", "حضور جلسة"], ["memo", "تقديم مذكرة / لائحة"], ["note", "ملاحظة"], ["call", "تواصل مع العميل"], ["status", "قرار / حكم"]].map(([k, t]) => opt(k, t)).join("")}</select></div>
    <div class="field"><label for="lg-date">التاريخ</label><input id="lg-date" class="inp" type="date" name="date" value="${todayStr()}"></div>
    <div class="field"><label for="lg-text">التفاصيل</label><textarea id="lg-text" class="inp" name="text" required rows="4" placeholder="مثال: حضرنا الجلسة وقدمنا مذكرة الرد، وقررت الدائرة التأجيل للمداولة."></textarea></div>
    <button class="btn primary" type="submit">إضافة إلى السجل</button></form></div></div>`;
F.addLog = async (d, f) => { const kinds = { session: "حضور جلسة", memo: "تقديم مذكرة", note: "ملاحظة", call: "تواصل مع العميل", status: "قرار / حكم" }; await logCase(d.caseId, d.kind === "status" ? "status" : "note", `${kinds[d.kind]}: ${d.text.trim()}`, { at: new Date(d.date + "T12:00:00").toISOString() }); f.reset(); toast("أُضيف الإجراء إلى السجل"); };

CASE_TABS.files = (c) => `
  <div class="drop" data-act="uploadPick" data-id="${c.id}" id="dropzone">${icon("upload")}<div><b>اسحب الملفات هنا أو اضغط للاختيار</b></div><div class="small">PDF، صور، Word أو نص · تُحفظ في ملف القضية${S.caps.sample ? " ويقرؤها المساعد ليستخرج المواعيد والمتطلبات ويتحقق من الاختصاص" : " ويُسجَّل رفعها في سجل الإجراءات"}</div></div>
  ${S.caps.assets === null && S.booted ? `<div class="banner warn"><div class="grow">رفع الملفات يحتاج صلاحية «محرر» على المنصة. اطلب من المالك ترقية صلاحيتك.</div></div>` : ""}
  ${(S.uploads || []).filter((u) => u.caseId === c.id).map((u) => `<div class="file"><div class="file-h"><span class="ic">${esc(ext(u.name))}</span><div class="grow"><b>${esc(u.name)}</b><div class="thinking small">${esc(u.stage)}</div></div></div></div>`).join("")}
  ${S.caseFiles.length ? S.caseFiles.map((f) => fileCard(c, f)).join("") : (S.uploads || []).some((u) => u.caseId === c.id) ? "" : `<div class="card">${emptyBox("docs", "لا توجد مرفقات بعد", "ابدأ بصحيفة الدعوى أو آخر محضر جلسة.")}</div>`}`;
const ext = (n) => (String(n).split(".").pop() || "").slice(0, 4).toUpperCase();
function fileCard(c, f) {
  const a = f.analysis; const open = S.ui.openFile === f.id; const busy = S.analyzing?.[f.id];
  return `<div class="file"><div class="file-h"><span class="ic">${esc(ext(f.name))}</span>
    <div class="grow" style="min-width:160px"><b style="overflow-wrap:anywhere">${esc(f.name)}</b><div class="small muted">${esc(f.category || "")} · ${fmtWhen(f.at)} · ${esc(lawyerName(f.by) === "غير مسند" ? "" : lawyerName(f.by))}</div>
      ${a ? `<div class="small" style="margin-top:2px">${esc(a.docType || "")}${a.jurisdiction?.matchesCase === false ? ' · <span class="pill bad">تنبيه اختصاص</span>' : ""}${(a.events || []).length ? ` · <span class="pill gold">${a.events.length} موعد مستخرج</span>` : ""}</div>` : ""}</div>
    <div class="row">${f.assetId ? `<button class="btn sm ghost" data-act="viewFile" data-id="${f.id}">${icon("eye")}عرض</button>` : ""}
      ${busy ? `<span class="thinking small">${esc(busy)}</span>` : S.caps.sample ? `<button class="btn sm ${a ? "" : "gold"}" data-act="analyzeFile" data-id="${f.id}">${icon("spark")}${a ? "إعادة التحليل" : "تحليل"}</button>` : ""}
      ${a ? `<button class="btn sm ghost" data-act="toggleFile" data-id="${f.id}">${open ? "إخفاء" : "النتائج"}</button>` : ""}
      <button class="btn sm ghost danger" data-act="deleteFile" data-id="${f.id}" aria-label="حذف">${icon("trash")}</button></div></div>
    ${a && open ? analysisBox(c, f, a) : ""}</div>`;
}
function analysisBox(c, f, a) {
  const evs = a.events || [];
  const added = new Set(f.addedEvents || []);
  return `<div class="ai-box">
    <div><h4>الخلاصة</h4><div class="prose">${esc(a.summary || "")}</div></div>
    ${(a.keyPoints || []).length ? `<div><h4>أهم ما ورد</h4><ul>${a.keyPoints.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${a.court?.name || a.court?.caseNumber ? `<div class="small">الجهة الواردة في المستند: <b>${esc([a.court.name, a.court.circuit, a.court.city].filter(Boolean).join(" · "))}</b>${a.court.caseNumber ? ` · رقم القضية <span class="num">${esc(a.court.caseNumber)}</span>` : ""}</div>` : ""}
    ${a.jurisdiction ? `<div class="juris ${a.jurisdiction.matchesCase === true ? "ok" : a.jurisdiction.matchesCase === false ? "bad" : "unk"}"><div><b>الاختصاص: ${a.jurisdiction.matchesCase === true ? "متوافق مع الجهة المسجلة" : a.jurisdiction.matchesCase === false ? "يُحتمل عدم الاختصاص" : "غير محسوم"}</b><div class="small">الجهة المختصة المرجحة: ${esc(a.jurisdiction.expectedCourt || "—")}</div><div class="small">${esc(a.jurisdiction.note || a.jurisdiction.basis || "")}</div></div></div>` : ""}
    ${evs.length ? `<div><div class="row" style="justify-content:space-between"><h4>المواعيد والمتطلبات المستخرجة</h4>${evs.some((_, i) => !added.has(i)) ? `<button class="btn sm gold" data-act="addAllEvents" data-id="${f.id}">${icon("cal")}إضافة الكل للتذكيرات</button>` : ""}</div>
      <div class="stack" style="gap:6px;margin-top:8px">${evs.map((e, i) => `<div class="ev">${kindPill(e.kind)}<div class="grow"><b>${esc(e.title)}</b><div class="small muted">${e.date ? `<span class="num">${fmtDate(e.date, true)}${e.time ? " · " + esc(e.time) : ""}</span> · ${esc(fmtHijri(e.date))}` : "بدون تاريخ"}${e.note ? " · " + esc(e.note) : ""}</div></div>
        ${added.has(i) ? '<span class="pill ok">أُضيف</span>' : `<button class="btn sm" data-act="addEvent" data-id="${f.id}" data-i="${i}">${icon("plus")}تذكير</button>`}</div>`).join("")}</div></div>` : ""}
    ${(a.requirements || []).length ? `<div><h4>المتطلبات</h4><ul>${a.requirements.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${(a.nextSteps || []).length ? `<div><h4>الخطوات المقترحة</h4><ul>${a.nextSteps.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${(a.risks || []).length ? `<div><h4>ملاحظات ومخاطر</h4><ul>${a.risks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    <div class="small muted">تحليل آلي بتاريخ ${fmtWhen(f.analyzedAt)} · يُراجع قبل الاعتماد.</div></div>`;
}
A.toggleFile = (el) => { S.ui.openFile = S.ui.openFile === el.dataset.id ? null : el.dataset.id; render(); };

CASE_TABS.tasks = (c, tasks) => {
  const open = tasks.filter((t) => t.status !== "done").sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
  const done = tasks.filter((t) => t.status === "done");
  return `<div class="card"><div class="card-h"><h3>المهام والمواعيد</h3><button class="btn sm gold" data-act="newTask" data-case="${c.id}">${icon("plus")}إضافة</button></div>
    ${open.length ? `<div class="list">${open.map((t) => taskRow(t, { noCase: true })).join("")}</div>` : emptyBox("cal", "لا مهام مفتوحة", "")}
    ${done.length ? `<details style="margin-top:12px"><summary class="muted small" style="cursor:pointer">المنجزة (${done.length})</summary><div class="list">${done.map((t) => taskRow(t, { noCase: true })).join("")}</div></details>` : ""}</div>`;
};
CASE_TABS.docs = (c, _t, docs) => `<div class="card"><div class="card-h"><h3>مستندات القضية</h3><div class="row">
    <button class="btn sm" data-act="draftFor" data-kind="pleading" data-id="${c.id}">${icon("scale")}لائحة أو رد</button>
    <button class="btn sm" data-act="draftFor" data-kind="contract" data-id="${c.id}">${icon("contract")}عقد</button>
    <button class="btn sm" data-act="draftFor" data-kind="proposal" data-id="${c.id}">${icon("coin")}عرض أتعاب</button></div></div>
  ${docs.length ? `<div class="list">${docs.sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "")).map(docRow).join("")}</div>` : emptyBox("docs", "لا مستندات بعد", "")}</div>`;

/* ---------------- Assignment ---------------- */
function assignBody(ids) {
  const act = activeCases();
  const ls = S.data.lawyers.filter((l) => l.active !== false);
  if (!ls.length) return `<p>أضف أعضاء الفريق أولًا من صفحة «فريق العمل».</p>`;
  const cur = ids.length === 1 ? caseById(ids[0])?.lawyerId : "";
  return `<form id="asg-form" data-form="assign" class="stack" style="gap:14px"><input type="hidden" name="ids" value="${esc(ids.join(","))}">
    ${ids.length > 1 ? `<p class="muted" style="margin:0">ستُرسل ${ids.length} طلبات إسناد دفعة واحدة.</p>` : ""}
    <div class="pick">${ls.map((l) => `<label><input type="radio" name="to" value="${l.id}" ${l.id === cur ? "disabled" : ""} required><span class="avatar">${esc(initials(l.name))}</span><span><b>${esc(l.name)}</b><br><span class="small muted">${esc(ROLES[l.role] || "")}${l.specialty ? " · " + esc(l.specialty) : ""}${l.id === cur ? " · المسؤول الحالي" : ""}</span></span><span class="load">${act.filter((c) => c.lawyerId === l.id).length} قضية</span></label>`).join("")}</div>
    <div class="field"><label for="asg-note">ملاحظة للمحامي</label><textarea id="asg-note" class="inp" name="note" rows="2" placeholder="مثال: الجلسة القادمة الأحد، والمذكرة مطلوبة قبلها بثلاثة أيام."></textarea></div>
    <label class="chk"><input type="checkbox" name="direct" value="1"> نقل مباشر دون انتظار القبول (عند إسنادها لنفسك أو بتوجيه الشريك)</label>
  </form>`;
}
A.assignCase = (el) => { if (!guardWrite()) return; if (!isManager()) return toast("الإسناد من صلاحية المدير فقط.", true); modal("إسناد القضية", assignBody([el.dataset.id]), `<button class="btn primary" type="submit" form="asg-form">${icon("send")}إرسال طلب الإسناد</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
A.bulkAssign = () => { if (!guardWrite()) return; if (!isManager()) return toast("الإسناد من صلاحية المدير فقط.", true); modal("إسناد القضايا المحددة", assignBody([...S.ui.selected]), `<button class="btn primary" type="submit" form="asg-form">${icon("send")}إرسال الطلبات</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
F.assign = async (d) => {
  if (!isManager()) return toast("الإسناد من صلاحية المدير فقط.", true);
  const ids = d.ids.split(",").filter(Boolean); const me = myLid(); const direct = d.direct === "1" || d.to === me;
  for (const id of ids) {
    if (direct) { await upd(`cases/${id}`, { lawyerId: d.to, assignment: { to: d.to, from: me || "", status: "accepted", at: nowIso(), respondedAt: nowIso(), note: d.note || "", direct: true } }); await logCase(id, "assign", `إسناد مباشر إلى ${lawyerName(d.to)}${d.note ? ` — ${d.note}` : ""}`); }
    else { await upd(`cases/${id}`, { assignment: { to: d.to, from: me || "", status: "pending", at: nowIso(), note: d.note || "" } }); await logCase(id, "assign", `طلب إسناد إلى ${lawyerName(d.to)} بانتظار القبول${d.note ? ` — ${d.note}` : ""}`); }
  }
  closeModal(); S.ui.selected.clear(); toast(direct ? "تم الإسناد" : `أُرسل ${ids.length > 1 ? ids.length + " طلبات" : "طلب"} الإسناد. ستُنقل القضية بعد القبول.`); render();
};
A.acceptAsg = async (el) => { const c = caseById(el.dataset.id); await upd(`cases/${c.id}`, { lawyerId: c.assignment.to, status: c.status === "intake" ? "active" : c.status, assignment: { ...c.assignment, status: "accepted", respondedAt: nowIso() } }); await logCase(c.id, "assign", `قبل ${lawyerName(c.assignment.to)} الإسناد وأصبح المسؤول عن القضية`); toast("قبلت القضية وأصبحت ضمن قضاياك"); };
A.declineAsg = (el) => {
  const c = caseById(el.dataset.id);
  modal("الاعتذار عن الإسناد", `<form id="dec-form" data-form="decline"><input type="hidden" name="id" value="${c.id}"><div class="field"><label for="dec-r">سبب الاعتذار</label><textarea id="dec-r" class="inp" name="reason" required rows="3" placeholder="مثال: تعارض مصالح، أو ضغط في الجدول هذا الأسبوع."></textarea></div></form>`, `<button class="btn primary" type="submit" form="dec-form">إرسال الاعتذار</button><button class="btn ghost" data-act="closeModal">رجوع</button>`);
};
F.decline = async (d) => { const c = caseById(d.id); await upd(`cases/${c.id}`, { assignment: { ...c.assignment, status: "declined", reason: d.reason, respondedAt: nowIso() } }); await logCase(c.id, "assign", `اعتذر ${lawyerName(c.assignment.to)} عن الإسناد: ${d.reason}`); closeModal(); toast("أُرسل الاعتذار إلى من أسند القضية"); };
A.cancelAsg = async (el) => { const c = caseById(el.dataset.id); await upd(`cases/${c.id}`, { assignment: { ...c.assignment, status: "cancelled", respondedAt: nowIso() } }); await logCase(c.id, "assign", `أُلغي طلب الإسناد إلى ${lawyerName(c.assignment.to)}`); toast("أُلغي الطلب"); };
A.bulkStatus = () => modal("تغيير حالة القضايا المحددة", `<form id="bs-form" data-form="bulkStatus"><div class="field"><label for="bs-s">الحالة الجديدة</label><select id="bs-s" class="inp" name="status">${Object.entries(STATUSES).map(([k, v]) => opt(k, v.t)).join("")}</select></div></form>`, `<button class="btn primary" type="submit" form="bs-form">تطبيق</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
F.bulkStatus = async (d) => { for (const id of S.ui.selected) { await upd(`cases/${id}`, { status: d.status }); await logCase(id, "status", `تغيير الحالة إلى «${STATUSES[d.status].t}»`); } closeModal(); S.ui.selected.clear(); toast("حُدّثت الحالات"); render(); };

VIEWS.assign = () => {
  const l = myLid();
  const incoming = pendingForMe();
  const outgoing = S.data.cases.filter((c) => c.assignment && c.assignment.from === l && l).sort((a, b) => (b.assignment.at || "").localeCompare(a.assignment.at || ""));
  const all = S.data.cases.filter((c) => c.assignment?.status === "pending");
  const asgPill = (s) => ({ pending: pill("بانتظار القبول", "warn"), accepted: pill("مقبول", "ok"), declined: pill("اعتذار", "bad"), cancelled: pill("ملغى") }[s] || "");
  const mgr = isManager(); const unassigned = activeCases().filter((c) => !c.lawyerId && c.assignment?.status !== "pending");
  return `<div class="page-head"><div><h1>طلبات الإسناد</h1><p>يُسند المدير القضايا، ولا تنتقل القضية إلى المحامي إلا بعد قبوله، ويُسجَّل ذلك في سجلها.</p></div></div>
  ${mgr ? `<div class="card"><div class="card-h"><h3>قضايا بلا محامٍ</h3><span class="sub num">${unassigned.length}</span></div>${unassigned.length ? `<div class="list">${unassigned.map((c) => `<div class="li"><div class="body"><div class="ttl" data-act="openCase" data-id="${c.id}" style="cursor:pointer">${esc(c.title)}</div><div class="meta"><span>${esc(clientName(c.clientId))}</span><span>${esc(c.type || "")}</span><span>${ago(c.createdAt)}</span></div></div><button class="btn sm primary" data-act="assignCase" data-id="${c.id}">${icon("send")}إسناد</button></div>`).join("")}</div>` : `<p class="muted small" style="margin:0">كل القضايا لها محامٍ مسؤول.</p>`}</div>` : `<div class="banner"><div class="grow">الإسناد من صلاحية المدير. تظهر لك هنا القضايا المسندة إليك لقبولها أو الاعتذار عنها.</div></div>`}
  ${!l ? `<div class="banner gold"><div class="grow">اختر اسمك من «تعمل باسم» أسفل القائمة لتظهر لك الطلبات الموجهة إليك.</div></div>` : ""}
  <div class="card"><div class="card-h"><h3>موجهة إليك</h3><span class="sub num">${incoming.length}</span></div>
    ${incoming.length ? `<div class="list">${incoming.map((c) => `<div class="li"><div class="body"><div class="ttl" data-act="openCase" data-id="${c.id}" style="cursor:pointer">${esc(c.title)}</div><div class="meta"><span>${esc(clientName(c.clientId))}</span><span>${esc(c.court || "")}</span><span>من ${esc(lawyerName(c.assignment.from))} · ${ago(c.assignment.at)}</span>${nextDateForCase(c.id) ? `<span>الموعد القادم ${fmtDate(nextDateForCase(c.id).due)}</span>` : ""}</div>${c.assignment.note ? `<div class="small" style="margin-top:4px">«${esc(c.assignment.note)}»</div>` : ""}</div>
      <button class="btn primary sm" data-act="acceptAsg" data-id="${c.id}">${icon("check")}قبول</button><button class="btn sm" data-act="declineAsg" data-id="${c.id}">اعتذار</button></div>`).join("")}</div>` : emptyBox("inbox", "لا طلبات بانتظارك", "")}</div>
  ${mgr ? `<div class="cols"><div class="card"><div class="card-h"><h3>طلبات أرسلتها</h3></div>
    ${outgoing.length ? `<div class="list">${outgoing.map((c) => `<div class="li clickable" data-act="openCase" data-id="${c.id}"><div class="body"><div class="ttl">${esc(c.title)}</div><div class="meta"><span>إلى ${esc(lawyerName(c.assignment.to))}</span><span>${ago(c.assignment.at)}</span>${c.assignment.reason ? `<span>السبب: ${esc(c.assignment.reason)}</span>` : ""}</div></div>${asgPill(c.assignment.status)}</div>`).join("")}</div>` : emptyBox("send", "لم ترسل طلبات بعد", "")}</div>
  <div class="card"><div class="card-h"><h3>المعلّق في المكتب</h3><span class="sub num">${all.length}</span></div>
    ${all.length ? `<div class="list">${all.map((c) => `<div class="li clickable" data-act="openCase" data-id="${c.id}"><div class="body"><div class="ttl">${esc(c.title)}</div><div class="meta"><span>${esc(lawyerName(c.assignment.from))} ← ${esc(lawyerName(c.assignment.to))}</span><span>${ago(c.assignment.at)}</span></div></div></div>`).join("")}</div>` : `<p class="muted small" style="margin:0">لا شيء معلّق.</p>`}</div></div>` : ""}`;
};

/* ---------------- Tasks ---------------- */
VIEWS.tasks = () => {
  const f = S.ui.taskFilter;
  let ts = S.data.tasks.filter((t) => (f.done ? true : t.status !== "done") && (!f.kind || t.kind === f.kind) && (!f.mine || isMine(t)));
  const prioRank = { high: 0, normal: 1, low: 2 };
  ts.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || prioRank[effPriority(a)] - prioRank[effPriority(b)]);
  const groups = [["متأخرة", (n) => n !== null && n < 0], ["اليوم", (n) => n === 0], ["غدًا", (n) => n === 1], ["خلال 7 أيام", (n) => n > 1 && n <= 7], ["لاحقًا", (n) => n > 7], ["بدون تاريخ", (n) => n === null]];
  const body = groups.map(([g, test]) => { const items = ts.filter((t) => test(daysLeft(t.due))); return items.length ? `<div class="card"><div class="card-h"><h3>${g}</h3><span class="sub num">${items.length}</span></div><div class="list">${items.map((t) => taskRow(t)).join("")}</div></div>` : ""; }).join("");
  return `<div class="page-head"><div><h1>المهام والتذكيرات</h1><p>مرتبة حسب موعد التسليم ثم الأولوية؛ ترتفع الأولوية تلقائيًا كلما اقترب الموعد.</p></div>
    <button class="btn gold" data-act="newTask">${icon("plus")}مهمة أو موعد</button></div>
  <div class="row"><div class="chips"><span class="chip ${f.mine ? "on" : ""}" data-act="tf" data-k="mine" data-v="1">مهامي</span><span class="chip ${!f.mine ? "on" : ""}" data-act="tf" data-k="mine" data-v="">كل المكتب</span></div>
    <span class="muted">|</span><div class="chips"><span class="chip ${!f.kind ? "on" : ""}" data-act="tf" data-k="kind" data-v="">الكل</span>${Object.entries(TASK_KINDS).map(([k, v]) => `<span class="chip ${f.kind === k ? "on" : ""}" data-act="tf" data-k="kind" data-v="${k}">${v.t}</span>`).join("")}</div>
    <label class="chk"><input type="checkbox" data-ch="tfDone" ${f.done ? "checked" : ""}> إظهار المنجز</label></div>
  ${f.mine && !myLid() ? `<div class="banner gold"><div class="grow">اختر اسمك من «تعمل باسم» أسفل القائمة لتظهر «مهامي».</div></div>` : ""}
  ${body || `<div class="card">${emptyBox("check", "لا توجد مهام هنا", "أضف مهمة أو موعد جلسة، أو حلّل مرفقات القضايا ليستخرج المساعد المواعيد.", `<button class="btn" data-act="newTask">${icon("plus")}إضافة</button>`)}</div>`}`;
};
A.tf = (el) => { S.ui.taskFilter[el.dataset.k] = el.dataset.k === "mine" ? !!el.dataset.v : el.dataset.v; render(); };
CH.tfDone = (el) => { S.ui.taskFilter.done = el.checked; render(); };
function taskForm(t = {}) {
  return `<form id="task-form" data-form="saveTask" class="grid2"><input type="hidden" name="id" value="${esc(t.id || "")}">
    <div class="field span2"><label for="tk-title">العنوان</label><input id="tk-title" class="inp" name="title" required value="${esc(t.title)}" placeholder="مثال: جلسة المرافعة الثانية / رفع مذكرة الرد"></div>
    <div class="field"><label for="tk-kind">النوع</label><select id="tk-kind" class="inp" name="kind">${Object.entries(TASK_KINDS).map(([k, v]) => opt(k, v.t, t.kind || "task")).join("")}</select></div>
    <div class="field"><label for="tk-prio">الأولوية</label><select id="tk-prio" class="inp" name="priority">${Object.entries(PRIOS).map(([k, v]) => opt(k, v, t.priority || "normal")).join("")}</select></div>
    <div class="field"><label for="tk-due">الموعد</label><input id="tk-due" class="inp" type="date" name="due" value="${esc(t.due)}"></div>
    <div class="field"><label for="tk-time">الوقت</label><input id="tk-time" class="inp" type="time" name="time" value="${esc(t.time)}"></div>
    <div class="field"><label for="tk-case">القضية</label><select id="tk-case" class="inp" name="caseId">${caseOpts(t.caseId)}</select></div>
    <div class="field"><label for="tk-as">المسؤول</label><select id="tk-as" class="inp" name="assignee">${lawyerOpts(t.assignee ?? myLid() ?? "", "— المحامي المسؤول عن القضية —")}</select></div>
    <div class="field span2"><label for="tk-notes">ملاحظات</label><textarea id="tk-notes" class="inp" name="notes" rows="3">${esc(t.notes)}</textarea></div></form>`;
}
A.newTask = (el) => { if (!guardWrite()) return; modal("مهمة أو موعد جديد", taskForm({ caseId: el.dataset.case || "" }), `<button class="btn primary" type="submit" form="task-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
A.editTask = (el) => { const t = byId(S.data.tasks, el.dataset.id); if (!t) return; modal("تعديل المهمة", taskForm(t), `<button class="btn primary" type="submit" form="task-form">حفظ</button><button class="btn danger" data-act="deleteTask" data-id="${t.id}">${icon("trash")}حذف</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
F.saveTask = async (d) => {
  const data = { title: d.title.trim(), kind: d.kind, priority: d.priority, due: d.due, time: d.time, caseId: d.caseId, assignee: d.assignee, notes: d.notes };
  if (d.id) await upd(`tasks/${d.id}`, data);
  else { await add("tasks", { ...data, status: "open", source: "manual" }); if (d.caseId) await logCase(d.caseId, "task", `أُضيف ${TASK_KINDS[d.kind].t}: ${data.title}${d.due ? ` (${fmtDate(d.due)})` : ""}`); }
  closeModal(); toast("حُفظ");
};
A.toggleTask = async (el) => { const t = byId(S.data.tasks, el.dataset.id); const done = t.status !== "done"; await upd(`tasks/${t.id}`, { status: done ? "done" : "open", doneAt: done ? nowIso() : null, doneBy: myLid() }); if (done && t.caseId) await logCase(t.caseId, "task", `أُنجز: ${t.title}`); };
A.deleteTask = (el) => confirmBox("حذف المهمة", "سيُحذف هذا الموعد نهائيًا من التذكيرات.", "حذف", async () => { await del(`tasks/${el.dataset.id}`); toast("حُذفت"); }, true);

/* ---------------- Clients ---------------- */
/* A client is complete when the data a contract, power of attorney and court filing need is present. */
const CLIENT_REQ = [["name", "الاسم"], ["idNo", "رقم الهوية / السجل التجاري"], ["phone", "الجوال"], ["address", "العنوان الوطني"]];
function clientErrors(d) {
  const e = [];
  for (const [k, t] of CLIENT_REQ) if (!String(d[k] || "").trim()) e.push(`${t} مطلوب`);
  if (d.kind === "company" && !String(d.rep || "").trim()) e.push("الممثل النظامي مطلوب للمنشآت");
  const id = String(d.idNo || "").replace(/\s/g, "");
  if (id && !/^\d{10}$/.test(id)) e.push("رقم الهوية أو السجل التجاري يتكون من 10 أرقام");
  if (id && d.kind !== "company" && !/^[12]/.test(id)) e.push("رقم الهوية الوطنية يبدأ بـ 1 والإقامة بـ 2");
  const ph = String(d.phone || "").replace(/[\s-]/g, "");
  if (ph && !/^(05\d{8}|\+?9665\d{8})$/.test(ph)) e.push("الجوال بصيغة 05xxxxxxxx");
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) e.push("البريد الإلكتروني غير صحيح");
  return e;
}
const clientComplete = (c) => !!c && clientErrors(c).length === 0;
function clientFields(c = {}, p = "") {
  const f = (k, label, req, extra = "") => `<div class="field"><label for="${p}${k}" class="${req ? "req" : ""}">${label}</label><input id="${p}${k}" class="inp ${["idNo", "phone"].includes(k) ? "num" : ""}" name="${p}${k}" value="${esc(c[k])}" ${extra}></div>`;
  return `<div class="grid2">
    <div class="field span2"><label for="${p}name" class="req">الاسم الكامل كما في الهوية / السجل</label><input id="${p}name" class="inp" name="${p}name" value="${esc(c.name)}"></div>
    <div class="field"><label for="${p}kind" class="req">النوع</label><select id="${p}kind" class="inp" name="${p}kind">${opt("individual", "فرد", c.kind)}${opt("company", "منشأة", c.kind)}</select></div>
    ${f("idNo", "رقم الهوية / السجل التجاري", true, 'inputmode="numeric" maxlength="10" placeholder="10 أرقام"')}
    ${f("rep", "الممثل النظامي (للمنشآت)", false)}
    ${f("phone", "الجوال", true, 'inputmode="tel" placeholder="05xxxxxxxx"')}
    ${f("email", "البريد الإلكتروني", false, 'type="email"')}
    ${f("address", "العنوان الوطني", true, 'placeholder="المدينة – الحي – الشارع – الرمز البريدي"')}
  </div>`;
}
const pickClient = (d, p) => ({ name: (d[p + "name"] || "").trim(), kind: d[p + "kind"] || "individual", idNo: (d[p + "idNo"] || "").replace(/\s/g, ""), rep: (d[p + "rep"] || "").trim(), phone: (d[p + "phone"] || "").replace(/[\s-]/g, ""), email: (d[p + "email"] || "").trim(), address: (d[p + "address"] || "").trim() });
VIEWS.clients = () => `<div class="page-head"><div><h1>العملاء</h1><p>${S.data.clients.length} عميل</p></div><button class="btn gold" data-act="newClient">${icon("plus")}عميل جديد</button></div>
  ${S.data.clients.length ? `<div class="tbl-wrap"><table class="tbl resp"><thead><tr><th>الاسم</th><th>النوع</th><th>الهوية / السجل</th><th>الجوال</th><th>البريد</th><th>القضايا</th><th></th></tr></thead><tbody>
  ${[...S.data.clients].sort((a, b) => a.name.localeCompare(b.name, "ar")).map((c) => `<tr data-act="clientCases" data-id="${c.id}"><td class="t primary-cell">${esc(c.name)}${clientComplete(c) ? "" : ` <span class="pill warn">بيانات ناقصة</span>`}</td><td>${c.kind === "company" ? "منشأة" : "فرد"}</td><td class="num">${esc(c.idNo || "—")}</td><td class="num">${esc(c.phone || "—")}</td><td>${esc(c.email || "—")}</td><td class="num">${S.data.cases.filter((x) => x.clientId === c.id).length}</td>
    <td data-noact="1"><button class="btn sm ghost" data-act="editClient" data-id="${c.id}">${icon("edit")}</button></td></tr>`).join("")}</tbody></table></div>`
  : `<div class="card">${emptyBox("clients", "لا يوجد عملاء بعد", "بيانات العميل تُستخدم تلقائيًا في العقود وعروض الأتعاب.", `<button class="btn gold" data-act="newClient">${icon("plus")}عميل جديد</button>`)}</div>`}`;
function clientForm(c = {}) {
  return `<form id="cl-form" data-form="saveClient" class="stack" style="gap:14px"><input type="hidden" name="id" value="${esc(c.id || "")}">
    ${c.id && !clientComplete(c) ? `<div class="banner warn"><div class="grow">بيانات ناقصة: ${esc(clientErrors(c).join("، "))}</div></div>` : ""}
    ${clientFields(c, "cl_")}
    <div class="field"><label for="cl-no">ملاحظات</label><textarea id="cl-no" class="inp" name="notes" rows="2">${esc(c.notes)}</textarea></div></form>`;
}
A.newClient = () => { if (!guardWrite()) return; modal("عميل جديد", clientForm(), `<button class="btn primary" type="submit" form="cl-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
A.editClient = (el) => modal("تعديل العميل", clientForm(byId(S.data.clients, el.dataset.id)), `<button class="btn primary" type="submit" form="cl-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
F.saveClient = async (d) => {
  const data = { ...pickClient(d, "cl_"), notes: d.notes }; const errs = clientErrors(data);
  if (errs.length) return toast("أكمل البيانات: " + errs.join("، "), true);
  const dup = S.data.clients.find((x) => x.id !== d.id && x.idNo && x.idNo === data.idNo);
  if (dup) return toast(`رقم الهوية/السجل مسجل للعميل «${dup.name}».`, true);
  if (d.id) await upd(`clients/${d.id}`, data); else await add("clients", data);
  closeModal(); toast("حُفظ العميل");
};

/* ---------------- Team ---------------- */
VIEWS.team = () => {
  const act = activeCases();
  return `<div class="page-head"><div><h1>فريق العمل</h1><p>اختر اسمك من «تعمل باسم» أسفل القائمة. صفة «مدير» أو «شريك» تمنح صلاحية إسناد القضايا والاستشارات.</p></div><button class="btn gold" data-act="newLawyer">${icon("plus")}إضافة عضو</button></div>
  ${S.data.lawyers.length ? `<div class="tbl-wrap"><table class="tbl resp"><thead><tr><th>الاسم</th><th>الصفة</th><th>التخصص</th><th>رقم الترخيص</th><th>قضايا جارية</th><th>الحساب</th><th></th></tr></thead><tbody>
    ${S.data.lawyers.map((l) => `<tr><td class="t"><span class="who"><span class="avatar">${esc(initials(l.name))}</span>${esc(l.name)}${l.active === false ? ' <span class="pill">موقوف</span>' : ""}</span></td><td>${esc(ROLES[l.role] || "")}</td><td>${esc(l.specialty || "—")}</td><td class="num">${esc(l.license || "—")}</td><td class="num">${act.filter((c) => c.lawyerId === l.id).length}</td>
      <td><div class="row" style="gap:6px;flex-wrap:nowrap">${l.id === myLid() ? pill("أنت", "gold") : `<button class="btn sm" data-act="linkThis" data-id="${l.id}">${icon("user")}أعمل باسمه</button>`}${window.RAKZ_PASSWORD && l.id !== myLid() ? (l.email ? `<a class="btn sm" href="${esc(teamInviteHref(l))}" target="_blank" rel="noopener" title="إرسال دعوة الدخول عبر واتساب">${icon("wa")}دعوة</a>` : `<span class="pill warn" title="أضف بريده حتى يستطيع إنشاء حسابه">بلا بريد</span>`) : ""}</div></td>
      <td><button class="btn sm ghost" data-act="editLawyer" data-id="${l.id}">${icon("edit")}</button></td></tr>`).join("")}</tbody></table></div>`
  : `<div class="card">${emptyBox("team", "أضف أعضاء المكتب", "أضف الشركاء والمحامين، ثم اختر اسمك من «تعمل باسم» أسفل القائمة.", `<button class="btn gold" data-act="createMe">${icon("plus")}ابدأ بملفك أنت</button>`)}</div>`}
  <div class="card"><h3>دعوة الفريق</h3><p class="muted" style="margin:6px 0 0">${window.RAKZ_PASSWORD ? "١) أضف العضو هنا ببريده الإلكتروني. ٢) اضغط «دعوة» لترسل له رابط المنصة عبر واتساب. ٣) يفتح الرابط ويختار «إنشاء حساب» بنفس البريد وكلمة مرور يختارها. لا يدخل المنصة إلا بريد مضاف هنا، وإيقاف العضو يمنع دخوله فورًا." : "شارك رابط المنصة مع الفريق من زر المشاركة، ويختار كل عضو اسمه من «تعمل باسم» أسفل القائمة."}</p></div>`;
};
function teamInviteHref(l) {
  const url = location.origin + location.pathname;
  const text = `السلام عليكم ${l.name}،\nأُضفت إلى منصة ${S.firm.nameAr}.\n\nالرابط: ${url}\nاختر «إنشاء حساب» وسجّل بهذا البريد: ${l.email}\nثم اختر كلمة مرور خاصة بك.`;
  return waHref(l.phone || "", text);
};
function lawyerForm(l = {}) {
  return `<form id="lw-form" data-form="saveLawyer" class="grid2"><input type="hidden" name="id" value="${esc(l.id || "")}"><input type="hidden" name="self" value="${l.self ? "1" : ""}">
    <div class="field span2"><label for="lw-name">الاسم الكامل</label><input id="lw-name" class="inp" name="name" required value="${esc(l.name)}"></div>
    <div class="field"><label for="lw-role">الصفة</label><select id="lw-role" class="inp" name="role">${Object.entries(ROLES).map(([k, v]) => opt(k, v, l.role || "lawyer")).join("")}</select></div>
    <div class="field"><label for="lw-sp">التخصص</label><input id="lw-sp" class="inp" name="specialty" value="${esc(l.specialty)}" placeholder="تجاري، عمالي، أحوال…"></div>
    <div class="field"><label for="lw-lic">رقم ترخيص المحاماة</label><input id="lw-lic" class="inp num" name="license" value="${esc(l.license)}"></div>
    <div class="field"><label for="lw-ph">الجوال</label><input id="lw-ph" class="inp num" name="phone" value="${esc(l.phone)}"></div>
    <div class="field span2"><label for="lw-em">البريد</label><input id="lw-em" class="inp" type="email" name="email" value="${esc(l.email)}" dir="ltr">${window.RAKZ_PASSWORD ? '<span class="hint">يدخل به العضو إلى المنصة. لا يُفتح الحساب إلا لبريد مسجل هنا.</span>' : ""}</div>
    ${l.id ? `<label class="chk span2"><input type="checkbox" name="inactive" value="1" ${l.active === false ? "checked" : ""}> إيقاف العضو (لا يظهر في الإسناد)</label>${l.userId ? `<label class="chk span2"><input type="checkbox" name="unlink" value="1"> فك ربط الحساب بهذا الملف</label>` : ""}` : ""}</form>`;
}
A.newLawyer = () => { if (!guardWrite()) return; modal("عضو جديد", lawyerForm(), `<button class="btn primary" type="submit" form="lw-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
A.editLawyer = (el) => modal("تعديل العضو", lawyerForm(byId(S.data.lawyers, el.dataset.id)), `<button class="btn primary" type="submit" form="lw-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
A.createMe = () => { if (!guardWrite()) return; modal("أنشئ ملفك في الفريق", lawyerForm({ name: S.me.name, self: true, role: S.me.isOwner ? "partner" : "lawyer" }), `<button class="btn primary" type="submit" form="lw-form">حفظ وربط حسابي</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`); };
F.saveLawyer = async (d) => {
  const data = { name: d.name.trim(), role: d.role, specialty: d.specialty, license: d.license, phone: d.phone, email: d.email };
  if (d.id) { data.active = d.inactive !== "1"; if (d.unlink === "1") data.userId = ""; await upd(`lawyers/${d.id}`, data); }
  else { const nid = await add("lawyers", { ...data, active: true, userId: "" }); if (d.self || !myLid()) { S.ui.asLid = nid; lsSet("as", nid); } }
  closeModal(); toast("حُفظ");
};
A.linkThis = (el) => { S.ui.asLid = el.dataset.id; lsSet("as", el.dataset.id); render(); toast(`تعمل الآن باسم ${lawyerName(el.dataset.id)}`); };
A.linkMe = async () => { const id = $("#link-sel")?.value; if (id) { await upd(`lawyers/${id}`, { userId: S.me.id }); toast("رُبط حسابك بملفك"); } };

/* ---------------- Settings ---------------- */
VIEWS.settings = () => {
  const f = S.firm; const ro = false;
  const fld = (k, label, cls = "") => `<div class="field ${cls}"><label for="st-${k}">${label}</label><input id="st-${k}" class="inp" name="${k}" value="${esc(f[k])}" ${ro ? "disabled" : ""}></div>`;
  return `<div class="page-head"><div><h1>الإعدادات</h1><p>بيانات المكتب تظهر في ترويسة العقود وعروض الأتعاب واللوائح.</p></div></div>
  ${ro ? `<div class="banner warn"><div class="grow">تعديل الإعدادات متاح للشريك المدير وأصحاب صلاحية التحرير الكاملة.</div></div>` : ""}
  <div class="card"><div class="card-h"><h3>بيانات المكتب</h3></div>
    <form data-form="saveFirm" class="grid2">${fld("nameAr", "الاسم بالعربية", "span2")}${fld("nameEn", "الاسم بالإنجليزية", "span2")}${fld("cr", "السجل التجاري")}${fld("license", "ترخيص الشركة المهنية")}${fld("vat", "الرقم الضريبي")}${fld("phone", "الهاتف")}${fld("email", "البريد")}${fld("website", "الموقع")}${fld("address", "العنوان", "span2")}${fld("bank", "البنك")}${fld("iban", "رقم الآيبان")}
      <div class="field span2"><label for="st-pt">شروط السداد الافتراضية</label><input id="st-pt" class="inp" name="paymentTerms" value="${esc(f.paymentTerms)}" ${ro ? "disabled" : ""}></div>
      <div class="field"><label for="st-pv">صلاحية عرض الأتعاب (يوم)</label><input id="st-pv" class="inp num" name="proposalValidity" value="${esc(f.proposalValidity)}" ${ro ? "disabled" : ""}></div>
      ${ro ? "" : `<div class="span2"><button class="btn primary" type="submit">حفظ البيانات</button></div>`}</form></div>
  <div class="card"><div class="card-h"><h3>نماذج العقود الأساسية</h3><span class="sub">تُملأ الحقول بين {{ }} تلقائيًا من بيانات العميل والقضية</span></div>
    <p class="small muted" style="margin:0 0 12px">الحقول المتاحة: ${PLACEHOLDERS.map((p) => `<code>{{${p[0]}}}</code> ${p[1]}`).join(" · ")}</p>
    <form data-form="saveTemplates" class="stack" style="gap:14px">${Object.entries(CONTRACT_TEMPLATES).map(([k, t]) => `<div class="field"><label for="tp-${k}">${t.name}</label><textarea id="tp-${k}" class="inp" name="${k}" rows="10" style="font-family:var(--f-doc)" ${ro ? "disabled" : ""}>${esc(S.templates[k] || t.body)}</textarea></div>`).join("")}
      ${ro ? "" : `<div class="row"><button class="btn primary" type="submit">حفظ النماذج</button><button class="btn ghost" type="button" data-act="resetTemplates">استعادة النصوص الافتراضية</button></div>`}</form></div>`;
};
F.saveFirm = async (d) => { await put("settings/firm", { ...S.firm, ...d, updatedAt: nowIso() }); toast("حُفظت بيانات المكتب"); };
F.saveTemplates = async (d) => { await put("settings/templates", { ...d, updatedAt: nowIso() }); toast("حُفظت النماذج"); };
A.resetTemplates = () => confirmBox("استعادة النماذج", "ستُستبدل النماذج المعدلة بالنصوص الافتراضية.", "استعادة", async () => { await put("settings/templates", { updatedAt: nowIso() }); toast("استُعيدت النصوص الافتراضية"); });
