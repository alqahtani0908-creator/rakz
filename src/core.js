/* ============ Rakz — core: state, helpers, data layer, router ============ */
const LOGO = { iconLight: "__ICON_LIGHT__", iconDark: "__ICON_DARK__", textLight: "__TEXT_LIGHT__", textDark: "__TEXT_DARK__" };

const FIRM_DEFAULTS = {
  nameAr: "ركز النظامية للمحاماة والاستشارات القانونية",
  nameEn: "Rakz Alnizamiyah Law and Legal Consultancy",
  city: "الرياض", address: "الرياض – حي الملقا", email: "info@rakzlaw.com", website: "www.rakzlaw.com",
  phone: "", cr: "", license: "", vat: "", iban: "", bank: "",
  paymentTerms: "50% عند توقيع العقد، و50% عند صدور الحكم الابتدائي.",
  proposalValidity: 30,
};

const CASE_TYPES = ["تجاري", "عمالي", "أحوال شخصية", "جزائي", "إداري", "عام / مدني", "تنفيذ", "عقاري", "لجان شبه قضائية"];
const COURTS = ["المحكمة العامة", "المحكمة التجارية", "المحكمة العمالية", "محكمة الأحوال الشخصية", "المحكمة الجزائية", "المحكمة الإدارية (ديوان المظالم)", "محكمة التنفيذ", "محكمة الاستئناف", "المحكمة العليا", "لجنة شبه قضائية", "التحكيم"];
const STATUSES = {
  intake:   { t: "قيد الدراسة", c: "info" },
  active:   { t: "منظورة", c: "gold" },
  judgment: { t: "صدر حكم", c: "warn" },
  appeal:   { t: "استئناف", c: "bad" },
  cassation:{ t: "نقض", c: "bad" },
  review:   { t: "التماس إعادة نظر", c: "warn" },
  execution:{ t: "تنفيذ", c: "info" },
  closed:   { t: "منتهية", c: "ok" },
};
const TASK_KINDS = {
  session:     { t: "جلسة", c: "gold" },
  memo:        { t: "رفع لائحة / مذكرة", c: "bad" },
  requirement: { t: "متطلب", c: "info" },
  task:        { t: "مهمة", c: "plain" },
  event:       { t: "حدث / موعد", c: "plain" },
};
const PRIOS = { high: "عالية", normal: "متوسطة", low: "منخفضة" };
const FILE_CATS = ["صحيفة دعوى", "مذكرة / لائحة", "مذكرة الخصم", "حكم", "محضر جلسة", "وكالة", "عقد", "مستند / بينة", "مراسلة", "أخرى"];
const ROLES = { manager: "مدير", partner: "شريك", lawyer: "محامٍ", associate: "محامٍ متدرب", consultant: "مستشار", staff: "إداري" };

const S = {
  caps: {}, me: { id: null, name: "", avatar: "", isOwner: false, canEdit: false, canWrite: null },
  data: { lawyers: [], clients: [], cases: [], tasks: [], docs: [], consults: [], finance: [], fees: [], journal: [] }, loaded: {},
  firm: { ...FIRM_DEFAULTS }, templates: {},
  route: { name: "dashboard", id: null, tab: null },
  caseSub: null, caseLog: [], caseFiles: [], caseReports: [], caseLoadedFor: null,
  ui: { caseFilter: { q: "", status: "", type: "", lawyer: "", mine: false }, taskFilter: { mine: true, kind: "", done: false }, selected: new Set(), openFile: null, notifOpen: false },
  gen: null, // in-flight AI generation {docId, text, ctl}
  drafts: {}, // per-form values that survive re-render
};

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nowIso = () => new Date().toISOString();
const todayStr = () => { const d = new Date(); return ymd(d); };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = (s) => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); if (!y) return null; return new Date(y, m - 1, d); };
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
function fmtDate(s, withDay) { const d = parseDay(s); if (!d) return "—"; return `${withDay ? DAYS[d.getDay()] + " " : ""}${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function fmtHijri(s) { const d = s instanceof Date ? s : parseDay(s); if (!d) return ""; try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(d); } catch { return ""; } }
function fmtWhen(iso) { if (!iso) return ""; const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function ago(iso) { if (!iso) return ""; const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return "الآن"; if (m < 60) return `قبل ${m} د`; const h = Math.round(m / 60); if (h < 24) return `قبل ${h} س`; const d = Math.round(h / 24); return d < 30 ? `قبل ${d} يوم` : fmtDate(iso.slice(0, 10)); }
function daysLeft(s) { const d = parseDay(s); if (!d) return null; const t = parseDay(todayStr()); return Math.round((d - t) / 86400000); }
function countdown(s) {
  const n = daysLeft(s); if (n === null) return "";
  if (n < 0) return `<span class="countdown late">متأخر ${-n} يوم</span>`;
  if (n === 0) return `<span class="countdown soon">اليوم</span>`;
  if (n === 1) return `<span class="countdown soon">غدًا</span>`;
  return `<span class="countdown ${n <= 3 ? "soon" : ""}">بعد ${n} يوم</span>`;
}
const money = (n) => (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const initials = (name) => String(name || "؟").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
const byId = (arr, id) => arr.find((x) => x.id === id);
const lawyerName = (id) => byId(S.data.lawyers, id)?.name || "غير مسند";
const clientName = (id) => byId(S.data.clients, id)?.name || "—";
const caseById = (id) => byId(S.data.cases, id);
/* Identity is the signed-in account: its email (standalone) or the Claude user id it was linked to (Claude version).
   Nobody can act as another member. */
const myLawyer = () => {
  const em = (S.me.email || "").toLowerCase();
  return (em && S.data.lawyers.find((l) => l.active !== false && (l.email || "").toLowerCase() === em)) || (S.me.id && S.data.lawyers.find((l) => l.userId === S.me.id)) || null;
};
const myLid = () => myLawyer()?.id || null;
/* Assignment is reserved for managers (role مدير/شريك); the artifact owner counts as manager until a profile is chosen. */
/* Only role «مدير» assigns work, handles finance, manages the team and settings (enforced again by the database). */
const isManager = () => { const m = myLawyer(); return m ? m.role === "manager" : !!S.me.isOwner && !S.data.lawyers.some((l) => l.role === "manager"); };
const pill = (t, c) => `<span class="pill ${c || ""}">${esc(t)}</span>`;
const statusPill = (s) => pill(STATUSES[s]?.t || "—", STATUSES[s]?.c);
const kindPill = (k) => pill(TASK_KINDS[k]?.t || "مهمة", TASK_KINDS[k]?.c);
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function toast(msg, bad) { const el = document.createElement("div"); el.className = "toast" + (bad ? " bad" : ""); el.textContent = msg; $("#toasts").appendChild(el); setTimeout(() => el.remove(), bad ? 6000 : 3200); }
function loadScript(src) { return new Promise((res, rej) => { if ($$(`script[src="${src}"]`).length) return res(); const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("load " + src)); document.head.appendChild(s); }); }
const lsGet = (k, d) => { try { const v = localStorage.getItem("rakz:" + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem("rakz:" + k, JSON.stringify(v)); } catch {} };

/* ---------- icons ---------- */
const IC = {
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  dash: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  cases: '<path d="M4 7h16v13H4z"/><path d="M9 7V4h6v3"/><path d="M4 12h16"/>',
  tasks: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v7H2v-7z"/>',
  clients: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 11a3 3 0 1 0 0-6M22 21c0-3-2-5-5-5.5"/>',
  docs: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6M9 9h2"/>',
  team: '<path d="M12 3l8 4-8 4-8-4z"/><path d="M6 9v5c0 2 3 4 6 4s6-2 6-4V9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
  spark: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M19 3v4M17 5h4"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  contract: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M8 17c1.5-2 2.5-2 3 0s1.5 2 3 0 2 0 2 0"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  wa: '<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z"/>',
  report: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 17v-3M12 17v-6M15 17v-4"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  gavel: '<path d="M14 13l-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10"/><path d="M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>',
};
const icon = (n, cls) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ""} aria-hidden="true">${IC[n] || ""}</svg>`;

/* ---------- data layer ---------- */
const COLL = ["lawyers", "clients", "cases", "tasks", "docs", "consults", "finance", "fees", "journal"];
function canWrite() { return !!S.caps.db && S.me.canWrite !== false; }
function guardWrite() { if (!S.caps.db) { toast("قاعدة البيانات غير متاحة في هذا العرض. افتح المنصة من حسابك في Claude.", true); return false; } return true; }
function dbErr(e) { console.error(e); const c = e?.code;
  if (c === "forbidden") { const m = e.message || ""; toast(/journal_unbalanced/.test(m) ? "القيد غير متوازن: مجموع المدين يجب أن يساوي مجموع الدائن." : /journal_immutable/.test(m) ? "القيود المرحّلة لا تُعدَّل ولا تُحذف؛ صحّحها بقيد تسوية." : /finance/.test(m) ? "الشؤون المالية من صلاحية المدير." : "هذا الإجراء من صلاحية المدير.", true); throw e; } if (c === "invalid_argument") toast("رفضت المنصة الحفظ. تأكد أن الرابط مشارك معك بصلاحية تسمح بالتعديل.", true); else if (c === "quota_exceeded") toast("امتلأت سعة قاعدة البيانات. احذف سجلات قديمة أو انقل الأرشيف.", true); else toast("تعذّر الحفظ. حاول مرة أخرى بعد لحظات.", true); throw e; }
function clean(o) { return JSON.parse(JSON.stringify(o)); }
async function add(coll, data) { if (!guardWrite()) throw new Error("ro"); const ref = S.caps.db.collection(coll).doc(); try { await ref.set(clean({ ...data, createdAt: nowIso(), createdBy: myLid() || S.me.id })); } catch (e) { dbErr(e); } return ref.id; }
async function put(path, data) { if (!guardWrite()) throw new Error("ro"); try { await S.caps.db.doc(path).set(clean(data)); } catch (e) { dbErr(e); } }
async function upd(path, data) { if (!guardWrite()) throw new Error("ro"); try { await S.caps.db.doc(path).update(clean({ ...data, updatedAt: nowIso() })); } catch (e) { dbErr(e); } }
async function del(path) { if (!guardWrite()) throw new Error("ro"); try { await S.caps.db.doc(path).delete(); } catch (e) { dbErr(e); } }

async function logCase(caseId, kind, text, extra = {}) {
  if (!S.caps.db || !caseId) return;
  const entry = { kind, text, at: extra.at || nowIso(), by: myLid() || S.me.id || null, ...extra };
  try {
    await S.caps.db.collection(`cases/${caseId}/log`).doc().set(clean(entry));
    await S.caps.db.doc(`cases/${caseId}`).update({ lastAction: { text: text.slice(0, 160), at: nowIso(), by: entry.by }, updatedAt: nowIso() });
  } catch (e) { console.warn("log failed", e); }
}

function subscribeAll() {
  const db = S.caps.db;
  for (const c of COLL) {
    db.collection(c).onSnapshot((snap) => {
      S.data[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      S.loaded[c] = true; scheduleRender();
    }, (e) => { console.warn(c, e); S.loaded[c] = true; scheduleRender(); });
  }
  db.doc("settings/firm").onSnapshot((d) => { S.firm = { ...FIRM_DEFAULTS, ...(d.exists ? d.data() : {}) }; scheduleRender(); }, () => {});
  db.doc("settings/templates").onSnapshot((d) => { S.templates = d.exists ? d.data() : {}; scheduleRender(); }, () => {});
}
function subscribeCase(id) {
  if (S.caseLoadedFor === id) return;
  if (S.caseSub) S.caseSub.forEach((u) => u());
  S.caseLog = []; S.caseFiles = []; S.caseReports = []; S.caseLoadedFor = id; S.caseSub = [];
  if (!S.caps.db || !id) return;
  S.caseSub.push(S.caps.db.collection(`cases/${id}/log`).onSnapshot((s) => { S.caseLog = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || "").localeCompare(a.at || "")); scheduleRender(); }, () => {}));
  S.caseSub.push(S.caps.db.collection(`cases/${id}/reports`).onSnapshot((s) => { S.caseReports = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || "").localeCompare(a.at || "")); scheduleRender(); }, () => {}));
  S.caseSub.push(S.caps.db.collection(`cases/${id}/files`).onSnapshot((s) => { S.caseFiles = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || "").localeCompare(a.at || "")); scheduleRender(); }, () => {}));
}

/* ---------- derived ---------- */
const openTasks = () => S.data.tasks.filter((t) => t.status !== "done");
const isMine = (t) => { const l = myLid(); return l && (t.assignee === l || (!t.assignee && caseById(t.caseId)?.lawyerId === l)); };
const activeCases = () => S.data.cases.filter((c) => c.status !== "closed");
function effPriority(t) { const n = daysLeft(t.due); if (n !== null && n <= 1) return "high"; if (n !== null && n <= 3 && t.priority === "low") return "normal"; return t.priority || "normal"; }
function nextDateForCase(id) { const ts = openTasks().filter((t) => t.caseId === id && t.due).sort((a, b) => a.due.localeCompare(b.due)); return ts[0] || null; }
function pendingForMe() { const l = myLid(); return l ? S.data.cases.filter((c) => c.assignment?.status === "pending" && c.assignment.to === l) : []; }
function caseRef() { const y = new Date().getFullYear(); const n = S.data.cases.filter((c) => (c.ref || "").includes(`-${y}-`)).length + 1; return `R-${y}-${String(n).padStart(3, "0")}`; }

/* ---------- router & render ---------- */
function go(name, id = null, tab = null) {
  S.route = { name, id, tab }; S.ui.selected.clear(); S.ui.notifOpen = false;
  try { location.hash = name === "dashboard" ? "" : name; } catch {}
  $(".side")?.classList.remove("open");
  render(); window.scrollTo(0, 0);
  const v = $("#view"); if (v) { v.classList.remove("enter"); void v.offsetWidth; v.classList.add("enter"); }
}
let pendingRender = false;
function isEditing() { const a = document.activeElement; return a && $("#view")?.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== "checkbox"; }
function scheduleRender() { if (isEditing()) { pendingRender = true; return; } render(); }
document.addEventListener("focusout", () => setTimeout(() => { if (pendingRender && !isEditing()) { pendingRender = false; render(); } }, 120));

function render() {
  const r = S.route;
  const keep = r.name === "case" ? r.id : r.name === "drafting" ? S.drafts["pl.case"] : null;
  if (keep) subscribeCase(keep); else if (S.caseLoadedFor) { S.caseSub?.forEach((u) => u()); S.caseSub = null; S.caseLoadedFor = null; }
  if (r.name !== "consult" && S.csFor) { S.csUnsub?.(); S.csUnsub = null; S.csFor = null; S.csFiles = []; }
  renderSide();
  const v = VIEWS[r.name] || VIEWS.dashboard;
  const scrollY = window.scrollY;
  $("#view").innerHTML = (banners() + v()) || "";
  window.scrollTo(0, scrollY);
  renderTop(); renderBnav();
  afterRender();
}
const after = [];
function afterRender() { while (after.length) { try { after.shift()(); } catch (e) { console.error(e); } } }

function renderSide() {
  const pend = pendingForMe().length;
  const late = openTasks().filter((t) => isMine(t) && daysLeft(t.due) !== null && daysLeft(t.due) < 0).length;
  const n = (k, label, ic, badge) => `<a class="${S.route.name === k || (k === "cases" && S.route.name === "case") || (k === "drafting" && S.route.name === "doc" && !["agreement", "creview"].includes(byId(S.data.docs, S.route.id)?.kind)) || (k === "consults" && S.route.name === "consult") || (k === "contracts" && (S.route.name === "creview" || (S.route.name === "doc" && ["agreement", "creview"].includes(byId(S.data.docs, S.route.id)?.kind)))) ? "on" : ""}" data-act="go" data-r="${k}">${icon(ic)}<span>${label}</span>${badge ? `<span class="badge num">${badge}</span>` : ""}</a>`;
  const me = myLawyer();
  $(".side").innerHTML = `
    <div class="brand"><img class="mark" src="${LOGO.iconDark}" alt="ركز"><img class="word" src="${LOGO.textDark}" alt="ركز النظامية للمحاماة والاستشارات القانونية"></div>
    <nav class="nav">
      ${n("dashboard", "لوحة التحكم", "dash")}
      ${n("cases", "القضايا", "cases")}
      ${n("tasks", "المهام والتذكيرات", "tasks", late || "")}
      ${n("assign", "طلبات الإسناد", "inbox", pend || "")}
      ${n("najiz", "ناجز", "link")}
      ${n("consults", "الاستشارات", "chat", S.data.consults.filter((x) => x.status !== "done" && (!myLid() || x.lawyerId === myLid())).length || "")}
      <div class="nav-sec">الصياغة</div>
      ${n("contracts", "العقود", "contract")}
      ${n("drafting", "اللوائح وعروض الأتعاب", "docs")}
      ${window.RAKZ_LAWS ? n("laws", "المكتبة النظامية", "scale") : ""}
      <div class="nav-sec">الإدارة</div>
      ${isManager() ? n("finance", "المالية", "coin", S.data.fees.filter((f) => f.status === "pending").length || "") : ""}
      ${n("clients", "العملاء", "clients")}
      ${n("team", "فريق العمل", "team")}
      ${n("settings", "الإعدادات", "settings")}
    </nav>
    <div class="me">${S.me.avatar ? `<img src="${esc(S.me.avatar)}" alt="">` : `<span class="avatar">${esc(initials(me?.name || S.me.name))}</span>`}
      ${window.RAKZ_PASSWORD ? `<button class="icon-btn" data-act="changePw" title="تغيير كلمة المرور" aria-label="تغيير كلمة المرور" style="background:transparent;border-color:transparent;color:var(--nav-ink)">${icon("settings")}</button>` : ""}
      ${window.RAKZ_SIGNOUT ? `<button class="icon-btn" data-act="signOut" title="تسجيل الخروج" aria-label="تسجيل الخروج" style="background:transparent;border-color:transparent;color:var(--nav-ink)">${icon("x")}</button>` : ""}
      <div class="grow" style="min-width:0"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(me?.name || S.me.name || S.me.email || "")}</div><small>${me ? esc(ROLES[me.role] || "") : "غير مضاف إلى فريق العمل"}</small></div></div>`;
}

function renderBnav() {
  const b = $(".bnav"); if (!b) return;
  const r = S.route.name; const late = openTasks().filter((t) => isMine(t) && daysLeft(t.due) !== null && daysLeft(t.due) < 0).length;
  const it = (k, label, ic, on, badge) => `<a class="${on ? "on" : ""}" data-act="go" data-r="${k}">${icon(ic)}<span>${label}</span>${badge ? `<i class="num">${badge}</i>` : ""}</a>`;
  b.innerHTML = it("dashboard", "الرئيسية", "dash", r === "dashboard") + it("cases", "القضايا", "cases", r === "cases" || r === "case") + it("tasks", "المهام", "tasks", r === "tasks", late) + it("consults", "الاستشارات", "chat", r === "consults" || r === "consult")
    + `<a data-act="menu">${icon("menu")}<span>المزيد</span></a>`;
}
function setTheme(t) { document.documentElement.dataset.theme = t; lsSet("theme", t); }
function notifications() {
  const out = []; const l = myLid();
  pendingForMe().forEach((c) => out.push({ t: `طلب إسناد قضية: ${c.title}`, s: `من ${lawyerName(c.assignment.from)}`, act: "go", r: "assign", tone: "gold" }));
  S.data.cases.filter((c) => c.assignment && c.assignment.from === l && c.assignment.status !== "pending" && c.assignment.respondedAt && Date.now() - new Date(c.assignment.respondedAt) < 7 * 864e5)
    .forEach((c) => out.push({ t: `${lawyerName(c.assignment.to)} ${c.assignment.status === "accepted" ? "قبل" : "اعتذر عن"} إسناد: ${c.title}`, s: ago(c.assignment.respondedAt), act: "openCase", id: c.id, tone: c.assignment.status === "accepted" ? "ok" : "bad" }));
  openTasks().filter((t) => isMine(t) && t.due && daysLeft(t.due) <= 2).sort((a, b) => a.due.localeCompare(b.due))
    .forEach((t) => out.push({ t: `${TASK_KINDS[t.kind]?.t || "مهمة"}: ${t.title}`, s: `${fmtDate(t.due)} · ${daysLeft(t.due) < 0 ? "متأخر" : daysLeft(t.due) === 0 ? "اليوم" : "قريبًا"}`, act: "go", r: "tasks", tone: daysLeft(t.due) < 0 ? "bad" : "warn" }));
  return out;
}
function renderTop() {
  const ns = notifications();
  $(".topbar").innerHTML = `
    <button class="icon-btn menu-btn" data-act="menu" aria-label="القائمة">${icon("menu")}</button>
    <div class="search"><input id="gsearch" class="inp" placeholder="ابحث عن قضية، عميل، رقم ناجز…" autocomplete="off" value="${esc(S.ui.gq || "")}">${icon("search")}<div id="gsearch-pop"></div></div>
    <div class="spacer"></div>
    <button class="icon-btn" data-act="theme" aria-label="${document.documentElement.dataset.theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}" title="${document.documentElement.dataset.theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button>
    <button class="btn gold new-case" data-act="newCase">${icon("plus")}<span>قضية جديدة</span></button>
    <div style="position:relative"><button class="icon-btn" data-act="notif" aria-label="التنبيهات">${icon("bell")}${ns.length ? '<span class="dot"></span>' : ""}</button>
      ${S.ui.notifOpen ? `<div class="notif-pop"><div class="list">${ns.length ? ns.map((x) => `<div class="li clickable" data-act="${x.act}" data-r="${x.r || ""}" data-id="${x.id || ""}"><span class="prio ${x.tone === "bad" ? "high" : x.tone === "warn" ? "normal" : "low"}"></span><div class="body"><div class="ttl">${esc(x.t)}</div><div class="meta">${esc(x.s)}</div></div></div>`).join("") : `<div class="empty">${icon("bell")}<span>لا توجد تنبيهات الآن</span></div>`}</div></div>` : ""}
    </div>`;
}
function banners() {
  let h = "";
  if (!S.caps.db && S.booted) h += `<div class="banner warn"><div class="grow"><b>المنصة في وضع العرض فقط</b>افتح الرابط وأنت مسجّل الدخول في Claude حتى تُحفظ القضايا والمرفقات وتظهر لبقية الفريق.</div></div>`;
  return h;
}

/* ---------- global events ---------- */
const A = {}; // click actions
const F = {}; // form submits
const CH = {}; // change handlers
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) { if (S.ui.notifOpen && !e.target.closest(".notif-pop")) { S.ui.notifOpen = false; renderTop(); } if (!e.target.closest(".search")) { const p = $("#gsearch-pop"); if (p) p.innerHTML = ""; } return; }
  const na = e.target.closest("[data-noact]"); if (na && !na.contains(el)) return;
  const fn = A[el.dataset.act]; if (!fn) return;
  e.preventDefault(); if (el.dataset.stop) e.stopPropagation();
  Promise.resolve(fn(el, e)).catch((err) => { if (err?.message !== "ro") console.error(err); });
});
document.addEventListener("submit", (e) => {
  const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault();
  const fn = F[f.dataset.form]; if (!fn) return;
  const data = Object.fromEntries(new FormData(f).entries());
  const btn = f.querySelector("[type=submit]") || $(`[form="${f.id}"][type=submit]`); if (btn) btn.disabled = true;
  Promise.resolve(fn(data, f)).catch((err) => { if (err?.message !== "ro") console.error(err); }).finally(() => { if (btn) btn.disabled = false; });
});
document.addEventListener("change", (e) => { const el = e.target.closest("[data-ch]"); if (el && CH[el.dataset.ch]) CH[el.dataset.ch](el, e); });
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "gsearch") return globalSearch(el.value);
  if (el.dataset.draft) { S.drafts[el.dataset.draft] = el.value; if (el.dataset.live && CH[el.dataset.live]) CH[el.dataset.live](el); }
  if (el.dataset.filter) { S.ui.caseFilter.q = el.value; debouncedRender(); }
});
const debouncedRender = debounce(() => { const pos = $("#case-q")?.selectionStart; render(); const i = $("#case-q"); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch {} } }, 200);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

A.go = (el) => go(el.dataset.r);
A.signOut = () => window.RAKZ_SIGNOUT && window.RAKZ_SIGNOUT();
A.changePw = () => modal("تغيير كلمة المرور", `<form id="pw-form" data-form="changePw" class="stack" style="gap:12px"><div class="field"><label for="pw1">كلمة المرور الجديدة</label><input id="pw1" class="inp" type="password" name="p1" minlength="8" required autocomplete="new-password" dir="ltr"><span class="hint">8 أحرف على الأقل.</span></div><div class="field"><label for="pw2">تأكيدها</label><input id="pw2" class="inp" type="password" name="p2" required autocomplete="new-password" dir="ltr"></div></form>`, `<button class="btn primary" type="submit" form="pw-form">حفظ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
F.changePw = async (d) => { if (d.p1.length < 8) return toast("كلمة المرور 8 أحرف على الأقل.", true); if (d.p1 !== d.p2) return toast("كلمتا المرور غير متطابقتين.", true); try { await window.RAKZ_PASSWORD(d.p1); closeModal(); toast("تم تغيير كلمة المرور"); } catch (e) { toast("تعذّر التغيير: " + (e.message || ""), true); } };
A.theme = () => { setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); renderTop(); };
A.menu = () => $(".side").classList.toggle("open");
A.notif = () => { S.ui.notifOpen = !S.ui.notifOpen; renderTop(); };
A.openCase = (el) => go("case", el.dataset.id, el.dataset.tab || null);
A.tab = (el) => { S.route.tab = el.dataset.tab; render(); };

function globalSearch(q) {
  S.ui.gq = q; const pop = $("#gsearch-pop"); if (!pop) return;
  q = q.trim(); if (!q) { pop.innerHTML = ""; return; }
  const ql = q.toLowerCase();
  const cs = S.data.cases.filter((c) => [c.title, c.ref, c.najiz, c.opponent, clientName(c.clientId), c.court].join(" ").toLowerCase().includes(ql)).slice(0, 8);
  const cl = S.data.clients.filter((c) => [c.name, c.idNo, c.phone].join(" ").toLowerCase().includes(ql)).slice(0, 4);
  pop.innerHTML = `<div class="search-pop">${cs.map((c) => `<a data-act="openCase" data-id="${c.id}"><b>${esc(c.title)}</b><br><small>${esc(c.ref || "")} · ${esc(clientName(c.clientId))} · ${esc(c.court || "")}</small></a>`).join("")}
    ${cl.map((c) => `<a data-act="clientCases" data-id="${c.id}">${icon("user")} ${esc(c.name)} <small>عميل</small></a>`).join("")}
    ${!cs.length && !cl.length ? `<a><small>لا نتائج لـ «${esc(q)}»</small></a>` : ""}</div>`;
}

/* ---------- modal ---------- */
function modal(title, body, foot = "", wide = false) {
  closeModal();
  const bg = document.createElement("div"); bg.className = "modal-bg"; bg.id = "modal";
  bg.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" dir="rtl"><div class="modal-h"><h2>${title}</h2><button class="icon-btn" data-act="closeModal" aria-label="إغلاق">${icon("x")}</button></div><div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ""}</div>`;
  bg.addEventListener("mousedown", (e) => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
  setTimeout(() => bg.querySelector("input:not([type=hidden]):not([type=checkbox]),select,textarea")?.focus(), 30);
  return bg;
}
function closeModal() { $("#modal")?.remove(); }
A.closeModal = closeModal;
function confirmBox(title, text, okLabel, onOk, danger) {
  modal(title, `<p style="margin:0">${text}</p>`, `<button class="btn ${danger ? "danger" : "primary"}" data-act="confirmOk">${okLabel}</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
  A.confirmOk = async () => { closeModal(); await onOk(); };
}
const opt = (v, t, sel) => `<option value="${esc(v)}" ${String(sel ?? "") === String(v) ? "selected" : ""}>${esc(t)}</option>`;
const lawyerOpts = (sel, blank = "— بدون —") => opt("", blank, sel) + S.data.lawyers.filter((l) => l.active !== false).map((l) => opt(l.id, l.name, sel)).join("");
const clientOpts = (sel) => opt("", "— اختر العميل —", sel) + S.data.clients.map((c) => opt(c.id, c.name, sel)).join("");
const caseOpts = (sel, blank = "— بدون قضية —") => opt("", blank, sel) + S.data.cases.map((c) => opt(c.id, `${c.ref || ""} · ${c.title}`, sel)).join("");
