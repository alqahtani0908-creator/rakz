/* ============ Rakz — insights: comparisons and charts for both dashboards ============
   Charts are plain HTML/SVG (no library). Every series carries a legend; every mark carries a hover tooltip. */

/* ---------- periods ---------- */
const mKey = (d) => (d || "").slice(0, 7); // "YYYY-MM"
const monthKeys = (n, end = todayStr()) => { const d = parseDay(end); const out = []; for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); } return out; };
const mLabel = (k, yr = false) => { const [y, m] = k.split("-").map(Number); return MONTHS[m - 1] + (yr ? " " + y : ""); };
const thisM = () => mKey(todayStr());
const prevM = () => monthKeys(2)[0];
const sameMLastYear = () => { const [y, m] = thisM().split("-"); return `${+y - 1}-${m}`; };
const inM = (d, k) => mKey(d) === k;
/* year to date, and the same span of the previous year */
const ytd = (d) => { const t = todayStr(); return !!d && d.slice(0, 4) === t.slice(0, 4) && d <= t; };
const ytdLast = (d) => { const t = todayStr(); const y = String(+t.slice(0, 4) - 1); return !!d && d.slice(0, 4) === y && d.slice(5) <= t.slice(5); };
const caseOpened = (c) => c.openedAt || (c.createdAt || "").slice(0, 10);
const caseClosed = (c) => c.status === "closed" ? (c.closedAt || (c.updatedAt || "").slice(0, 10)) : "";

/* ---------- money by period ---------- */
const sumIf = (rows, k, f) => rows.filter(f).reduce((s, x) => s + num(x[k]), 0);
function finPeriod(f) {
  const invoiced = sumIf(fin("invoice").filter((x) => x.status !== "void"), "total", (x) => f(x.date)) - sumIf(fin("credit"), "total", (x) => f(x.date));
  const collected = sumIf(fin("payment"), "amount", (x) => f(x.date));
  const expenses = sumIf(fin("expense"), "amount", (x) => f(x.date));
  return { invoiced, collected, expenses, net: collected - expenses };
}

/* ---------- small pieces ---------- */
/* change from b to a; good = "up" when a rise is good news, "down" when a fall is */
function delta(a, b, good = "up", label = "") {
  const lbl = label ? `<small>${esc(label)}</small>` : "";
  if (!b && !a) return `<span class="delta flat">—${lbl}</span>`;
  if (!b) return `<span class="delta ${good === "up" ? "good" : "bad"}">${icon("up", "")}جديد${lbl}</span>`;
  const p = Math.round(((a - b) / Math.abs(b)) * 100);
  if (!p) return `<span class="delta flat">ثابت${lbl}</span>`;
  const up = p > 0; const ok = up === (good === "up");
  return `<span class="delta ${ok ? "good" : "bad"}" title="${money(b)} ← ${money(a)}">${icon(up ? "up" : "down", "")}<b class="num">${Math.abs(p)}%</b>${lbl}</span>`;
}
const short = (n) => { n = Number(n) || 0; const a = Math.abs(n); return a >= 1e6 ? (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + " مليون" : a >= 1e3 ? (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + " ألف" : String(Math.round(n)); };
const legend = (series) => `<div class="legend">${series.map((s) => `<span><i class="sw ${s.cls}"></i>${esc(s.name)}</span>`).join("")}</div>`;

/* grouped columns: keys on the x axis, up to three series of the same unit */
function colChart(keys, series, { fmt = money, label = (k) => mLabel(k), height = 180 } = {}) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const step = niceStep(max); const top = Math.ceil(max / step) * step;
  const ticks = []; for (let v = 0; v <= top; v += step) ticks.push(v);
  return `<div class="gchart" style="--h:${height}px">
    <div class="gc-axis">${ticks.slice().reverse().map((v) => `<span>${short(v)}</span>`).join("")}</div>
    <div class="gc-plot" style="--rows:${ticks.length - 1}">${keys.map((k, i) => `<div class="gc-col${k === thisM() ? " now" : ""}">
      <div class="gc-bars">${series.map((s) => { const v = s.values[i] || 0; return `<i class="${s.cls}" style="height:${(v / top) * 100}%" data-tip="${esc(s.name)} · ${esc(label(k, true))}: ${fmt(v)}"></i>`; }).join("")}</div>
      <span class="gc-x">${esc(label(k))}</span></div>`).join("")}</div></div>${legend(series)}`;
}
function niceStep(max) { const raw = max / 4; const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }

/* donut of parts of a whole; parts: [{name, value, color}] */
function donut(parts, centre, sub) {
  const total = parts.reduce((s, p) => s + p.value, 0); const R = 52, C = 2 * Math.PI * R; let off = 0;
  const arcs = total ? parts.filter((p) => p.value).map((p) => { const len = (p.value / total) * C; const gap = parts.filter((x) => x.value).length > 1 ? 2 : 0; const a = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${p.color}" stroke-width="16" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}"><title>${esc(p.name)}: ${p.value} (${Math.round((p.value / total) * 100)}%)</title></circle>`; off += len; return a; }).join("") : "";
  return `<div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="${esc(sub)}"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--track)" stroke-width="16"/><g transform="rotate(-90 70 70)">${arcs}</g></svg><div class="donut-c"><b class="num">${centre}</b><span>${esc(sub)}</span></div></div>`;
}
/* a single rate as a ring, with the comparison underneath */
function ring(pct, label, foot = "") {
  const R = 40, C = 2 * Math.PI * R; const v = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return `<div class="ring"><div class="ring-g"><svg viewBox="0 0 100 100"><circle r="${R}" cx="50" cy="50" fill="none" stroke="var(--track)" stroke-width="9"/><circle r="${R}" cx="50" cy="50" fill="none" stroke="url(#rk-gold)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(v / 100) * C} ${C}" transform="rotate(-90 50 50)"/></svg><b class="num">${v}%</b></div><div class="ring-t"><b>${esc(label)}</b>${foot}</div></div>`;
}
/* horizontal comparison bars: rows [{name, value, sub?, act?}] — one measure, one hue */
function hbars(rows, { fmt = (n) => String(n), cls = "s1" } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<div class="hbars">${rows.map((r) => `<div class="hb"${r.act || ""}><span class="hb-n">${esc(r.name)}${r.sub ? `<small>${r.sub}</small>` : ""}</span><div class="hb-t"><i class="${cls}" style="width:${(r.value / max) * 100}%" data-tip="${esc(r.name)}: ${fmt(r.value)}"></i></div><b class="num">${fmt(r.value)}</b></div>`).join("")}</div>`;
}
/* actual against a target in one row (e.g. collected against invoiced) */
function bullet(rows, fmt = money) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.target, r.value)));
  return `<div class="hbars">${rows.map((r) => `<div class="hb"${r.act || ""}><span class="hb-n">${esc(r.name)}<small>${r.target ? Math.round((r.value / r.target) * 100) + "% محصّل" : ""}</small></span><div class="hb-t"><i class="s2 ghost" style="width:${(r.target / max) * 100}%" data-tip="المفوتر: ${fmt(r.target)}"></i><i class="s1 over" style="width:${(r.value / max) * 100}%" data-tip="المحصّل: ${fmt(r.value)}"></i></div><b class="num">${fmt(r.value)}</b></div>`).join("")}</div>`;
}
const GRAD_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="rk-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C8AC8E"/><stop offset="1" stop-color="#8C6D56"/></linearGradient></defs></svg>`;
const sectionHead = (t, s = "") => `<div class="sec-h"><h2>${esc(t)}</h2>${s ? `<span>${s}</span>` : ""}</div>`;

/* ================= professional dashboard ================= */
function proInsights() {
  const keys = monthKeys(6); const m = thisM(), p = prevM();
  const opened = (k) => S.data.cases.filter((c) => inM(caseOpened(c), k)).length;
  const closed = (k) => S.data.cases.filter((c) => inM(caseClosed(c), k)).length;
  const doneIn = (k) => S.data.tasks.filter((t) => t.status === "done" && inM(t.doneAt, k)).length;
  const sessIn = (k) => S.data.tasks.filter((t) => t.kind === "session" && inM(t.due, k)).length;
  const consIn = (k) => S.data.consults.filter((x) => inM((x.createdAt || "").slice(0, 10), k)).length;
  const onTime = (k) => { const d = S.data.tasks.filter((t) => t.status === "done" && inM(t.doneAt, k) && t.due); return d.length ? (d.filter((t) => t.doneAt.slice(0, 10) <= t.due).length / d.length) * 100 : null; };
  const otNow = onTime(m), otPrev = onTime(p);

  const stats = [
    ["قضايا جديدة", opened(m), opened(p), "up", "cases"],
    ["قضايا منتهية", closed(m), closed(p), "up", "cases"],
    ["مهام منجزة", doneIn(m), doneIn(p), "up", "tasks"],
    ["جلسات الشهر", sessIn(m), sessIn(p), "up", "tasks"],
    ["استشارات جديدة", consIn(m), consIn(p), "up", "consults"],
  ];
  const colorFor = { intake: "var(--c-info)", active: "var(--c-1)", judgment: "var(--c-warn)", appeal: "var(--c-bad)", cassation: "#8A3A6B", review: "#B07A2A", execution: "var(--c-2)", closed: "var(--c-ok)" };
  const parts = Object.keys(STATUSES).map((k) => ({ name: STATUSES[k].t, value: S.data.cases.filter((c) => (c.status || "intake") === k).length, color: colorFor[k] }));
  const types = CASE_TYPES.map((t) => ({ name: t, value: activeCases().filter((c) => c.type === t).length })).filter((r) => r.value).sort((a, b) => b.value - a.value).slice(0, 7);
  const team = S.data.lawyers.filter((l) => l.active !== false).map((l) => {
    const mine = (t) => (t.assignee || caseById(t.caseId)?.lawyerId) === l.id;
    return { l, act: activeCases().filter((c) => c.lawyerId === l.id).length,
      sess: openTasks().filter((t) => mine(t) && t.kind === "session" && daysLeft(t.due) !== null && daysLeft(t.due) >= 0 && daysLeft(t.due) <= 14).length,
      late: openTasks().filter((t) => mine(t) && daysLeft(t.due) !== null && daysLeft(t.due) < 0).length,
      done: S.data.tasks.filter((t) => mine(t) && t.status === "done" && inM(t.doneAt, m)).length,
      prev: S.data.tasks.filter((t) => mine(t) && t.status === "done" && inM(t.doneAt, p)).length };
  }).sort((a, b) => b.act - a.act);
  const maxAct = Math.max(1, ...team.map((r) => r.act));

  return `${GRAD_DEFS}${sectionHead("المؤشرات والمقارنات", `${mLabel(m, true)} مقارنةً بـ${mLabel(p)}`)}
  <div class="stat-strip">${stats.map(([t, a, b, g, r]) => `<button class="stat" data-act="go" data-r="${r}"><span class="lbl">${t}</span><span class="val num">${a}</span><span class="cmp">${delta(a, b, g)}<small>${mLabel(p)}: <b class="num">${b}</b></small></span></button>`).join("")}</div>
  <div class="dash-grid">
    <div class="card span2"><div class="card-h"><h3>القضايا الجديدة مقابل المنتهية</h3><span class="sub">آخر 6 أشهر</span></div>
      ${colChart(keys, [{ name: "جديدة", cls: "s1", values: keys.map(opened) }, { name: "منتهية", cls: "s2", values: keys.map(closed) }], { fmt: (n) => `${n} قضية` })}</div>
    <div class="card"><div class="card-h"><h3>القضايا حسب الحالة</h3><span class="sub num">${S.data.cases.length} قضية</span></div>
      <div class="donut-wrap">${donut(parts, S.data.cases.length, "قضية")}<div class="legend col">${parts.filter((x) => x.value).map((x) => `<span><i style="background:${x.color}"></i>${x.name}<b class="num">${x.value}</b></span>`).join("") || `<span class="muted">لا قضايا بعد</span>`}</div></div></div>
    <div class="card"><div class="card-h"><h3>الإنجاز في الموعد</h3><span class="sub">المهام المنجزة قبل موعدها</span></div>
      <div class="rings">${ring(otNow, mLabel(m), otNow === null ? `<small class="muted">لا مهام منجزة بموعد</small>` : otPrev === null ? "" : delta(otNow, otPrev, "up", " عن " + mLabel(p)))}${ring(otPrev, mLabel(p), `<small class="muted">${doneIn(p)} مهمة منجزة</small>`)}</div></div>
    <div class="card"><div class="card-h"><h3>القضايا المنظورة حسب النوع</h3><span class="sub">${activeCases().length} منظورة</span></div>
      ${types.length ? hbars(types, { fmt: (n) => `${n}` }) : emptyBox("cases", "لا قضايا منظورة", "")}</div>
    <div class="card"><div class="card-h"><h3>الجلسات شهريًا</h3><span class="sub">آخر 6 أشهر</span></div>
      ${colChart(keys, [{ name: "الجلسات", cls: "s1", values: keys.map(sessIn) }], { fmt: (n) => `${n} جلسة`, height: 140 })}</div>
    <div class="card span3"><div class="card-h"><h3>مقارنة أداء الفريق</h3><span class="sub">الإنجاز: ${mLabel(m)} مقابل ${mLabel(p)}</span></div>
      ${team.length ? `<div class="tbl-wrap flat"><table class="tbl resp cmp-tbl"><thead><tr><th>العضو</th><th>القضايا المنظورة</th><th>جلسات 14 يومًا</th><th>مهام متأخرة</th><th>منجزة ${mLabel(m)}</th><th>التغير</th></tr></thead><tbody>
        ${team.map((r) => `<tr><td class="primary-cell"><div class="t">${esc(r.l.name)}</div><div class="ref">${esc(ROLES[r.l.role] || "")}</div></td>
          <td data-label="المنظورة"><div class="inbar"><i style="width:${(r.act / maxAct) * 100}%"></i><b class="num">${r.act}</b></div></td>
          <td data-label="جلسات 14 يومًا" class="num">${r.sess}</td><td data-label="متأخرة" class="num">${r.late ? `<span class="pill bad">${r.late}</span>` : "0"}</td>
          <td data-label="منجزة" class="num">${r.done} <small class="muted">/ ${r.prev}</small></td><td data-label="التغير">${delta(r.done, r.prev)}</td></tr>`).join("")}</tbody></table></div>` : emptyBox("team", "لم يُضف أحد إلى الفريق بعد", "")}</div>
  </div>`;
}

/* ================= administrative dashboard ================= */
function adminInsights() {
  const keys = monthKeys(12); const m = thisM(), p = prevM(), ly = sameMLastYear();
  const cur = finPeriod((d) => inM(d, m)), prv = finPeriod((d) => inM(d, p)), lyM = finPeriod((d) => inM(d, ly));
  const yt = finPeriod(ytd), ytl = finPeriod(ytdLast);
  const per = keys.map((k) => finPeriod((d) => inM(d, k)));
  const all = finTotals(); const rate = all.invoiced ? (all.collected / all.invoiced) * 100 : null;
  const rateY = yt.invoiced ? (yt.collected / yt.invoiced) * 100 : null, rateYL = ytl.invoiced ? (ytl.collected / ytl.invoiced) * 100 : null;
  const y = todayStr().slice(0, 4);

  /* receivables by age past due */
  const buckets = [["غير مستحقة بعد", 0], ["1–30 يومًا", 0], ["31–60 يومًا", 0], ["61–90 يومًا", 0], ["أكثر من 90", 0]];
  for (const x of fin("invoice").filter((i) => i.status !== "void")) {
    const rest = Math.max(0, num(x.total) - invPaid(x)); if (!rest) continue;
    const late = x.due ? -daysLeft(x.due) : 0;
    buckets[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4][1] += rest;
  }
  const clients = S.data.clients.map((cl) => ({ cl, t: finTotals((x) => x.clientId === cl.id) })).filter((r) => r.t.invoiced).sort((a, b) => b.t.invoiced - a.t.invoiced).slice(0, 6);
  const byLawyer = S.data.lawyers.map((l) => { const ids = new Set(S.data.cases.filter((c) => c.lawyerId === l.id).map((c) => c.id)); return { name: l.name, value: sumIf(fin("payment"), "amount", (x) => ids.has(x.caseId) && ytd(x.date)) }; }).filter((r) => r.value).sort((a, b) => b.value - a.value).slice(0, 6);
  const byType = CASE_TYPES.map((t) => { const ids = new Set(S.data.cases.filter((c) => c.type === t).map((c) => c.id)); return { name: t, value: sumIf(fin("payment"), "amount", (x) => ids.has(x.caseId)) }; }).filter((r) => r.value).sort((a, b) => b.value - a.value).slice(0, 6);

  const rowsCmp = [["المفوتر", "invoiced", "up"], ["المحصّل", "collected", "up"], ["المصروفات", "expenses", "down"], ["صافي التدفق", "net", "up"]];
  return `${GRAD_DEFS}${sectionHead("المؤشرات المالية والمقارنات", `${mLabel(m, true)} · منذ بداية ${y}`)}
  <div class="stat-strip">${rowsCmp.map(([t, k, g]) => `<div class="stat"><span class="lbl">${t} — ${mLabel(m)}</span><span class="val num">${short(cur[k])}<small> ر.س</small></span><span class="cmp">${delta(cur[k], prv[k], g)}<small>${mLabel(p)}: <b class="num">${money(prv[k])}</b></small></span></div>`).join("")}
    <div class="stat"><span class="lbl">نسبة التحصيل ${y}</span><span class="val num">${rateY === null ? "—" : Math.round(rateY) + "%"}</span><span class="cmp">${rateY !== null && rateYL !== null ? delta(rateY, rateYL, "up") : ""}<small>${+y - 1}: <b class="num">${rateYL === null ? "—" : Math.round(rateYL) + "%"}</b></small></span></div></div>
  <div class="dash-grid">
    <div class="card span2"><div class="card-h"><h3>المفوتر والمحصّل والمصروفات</h3><span class="sub">آخر 12 شهرًا · ر.س</span></div>
      ${colChart(keys, [{ name: "المفوتر", cls: "s2", values: per.map((x) => Math.max(0, x.invoiced)) }, { name: "المحصّل", cls: "s1", values: per.map((x) => x.collected) }, { name: "المصروفات", cls: "s3", values: per.map((x) => x.expenses) }], { fmt: (n) => money(n) + " ر.س", height: 200 })}</div>
    <div class="card"><div class="card-h"><h3>نسبة التحصيل</h3><span class="sub">المحصّل من المفوتر</span></div>
      <div class="rings">${ring(rateY, `منذ بداية ${y}`, rateYL === null ? "" : delta(rateY || 0, rateYL, "up", ` عن ${+y - 1}`))}${ring(rate, "منذ البداية", `<small class="muted">${money(all.collected)} من ${money(all.invoiced)}</small>`)}</div></div>
    <div class="card span3"><div class="card-h"><h3>جدول المقارنة</h3><span class="sub">ر.س</span></div>
      <div class="tbl-wrap flat"><table class="tbl resp cmp-tbl"><thead><tr><th>البند</th><th>${mLabel(m)}</th><th>${mLabel(p)}</th><th>التغير الشهري</th><th>${mLabel(ly, true)}</th><th>منذ بداية ${y}</th><th>نفس الفترة ${+y - 1}</th><th>التغير السنوي</th></tr></thead><tbody>
      ${rowsCmp.map(([t, k, g]) => `<tr><td class="primary-cell"><div class="t">${t}</div></td><td data-label="${mLabel(m)}" class="num"><b>${money(cur[k])}</b></td><td data-label="${mLabel(p)}" class="num">${money(prv[k])}</td><td data-label="التغير الشهري">${delta(cur[k], prv[k], g)}</td><td data-label="${mLabel(ly, true)}" class="num">${money(lyM[k])}</td><td data-label="منذ بداية ${y}" class="num"><b>${money(yt[k])}</b></td><td data-label="نفس الفترة ${+y - 1}" class="num">${money(ytl[k])}</td><td data-label="التغير السنوي">${delta(yt[k], ytl[k], g)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="card"><div class="card-h"><h3>أعمار المستحقات</h3><span class="sub">حسب التأخر عن الاستحقاق</span></div>
      ${buckets.some((b) => b[1]) ? `<div class="hbars aging">${buckets.map(([n, v], i) => `<div class="hb"><span class="hb-n">${n}</span><div class="hb-t"><i class="a${i}" style="width:${(v / Math.max(...buckets.map((b) => b[1]))) * 100}%" data-tip="${n}: ${money(v)} ر.س"></i></div><b class="num">${money(v)}</b></div>`).join("")}</div>` : emptyBox("check", "لا مستحقات قائمة", "")}</div>
    <div class="card"><div class="card-h"><h3>أكبر العملاء</h3><span class="sub">المحصّل مقابل المفوتر</span></div>
      ${clients.length ? bullet(clients.map((r) => ({ name: r.cl.name, value: r.t.collected, target: r.t.invoiced, act: ` data-act="editClient" data-id="${r.cl.id}" style="cursor:pointer"` }))) + legend([{ name: "المحصّل", cls: "s1" }, { name: "المفوتر", cls: "s2" }]) : emptyBox("clients", "لا مطالبات بعد", "")}</div>
    <div class="card"><div class="card-h"><h3>التحصيل حسب المحامي</h3><span class="sub">منذ بداية ${y}</span></div>
      ${byLawyer.length ? hbars(byLawyer, { fmt: money }) : emptyBox("team", "لا تحصيل مرتبط بقضايا هذا العام", "")}</div>
    <div class="card span3"><div class="card-h"><h3>الإيراد حسب نوع القضية</h3><span class="sub">إجمالي المحصّل · ر.س</span></div>
      ${byType.length ? hbars(byType, { fmt: money, cls: "s2" }) : emptyBox("cases", "لا تحصيل مرتبط بقضايا بعد", "")}</div>
  </div>`;
}
