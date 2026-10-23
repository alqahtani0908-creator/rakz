/* ============ Rakz — المكتبة النظامية: official law texts that ground the assistant ============ */
const LAWS = () => window.RAKZ_LAWS || null;

/* Split an official text into articles. A heading is a line that starts with «المادة …»
   and either ends there or continues after a colon/dash within the first ~45 characters. */
function splitArticles(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const out = []; let cur = null;
  for (const raw of lines) {
    const line = raw.trim(); if (!line) { if (cur) cur.body += "\n"; continue; }
    const m = line.match(/^المادة\s+([^:：\-–]{1,45}?)\s*(?:[:：\-–]\s*(.*))?$/);
    if (m && (m[2] !== undefined || line.length <= 45)) {
      if (cur) out.push(cur);
      cur = { article: ("المادة " + m[1]).replace(/\s+/g, " ").trim(), body: (m[2] || "").trim() };
      continue;
    }
    if (cur) cur.body += (cur.body && !cur.body.endsWith("\n") ? " " : "") + line;
  }
  if (cur) out.push(cur);
  return out.map((a, i) => ({ ...a, num: i + 1, body: a.body.replace(/\n{2,}/g, "\n").trim() })).filter((a) => a.body);
}
const slugify = (name) => "law-" + Array.from(new TextEncoder().encode(name)).reduce((h, b) => (h * 31 + b) >>> 0, 7).toString(36);

/* Relevant articles for a prompt. Empty string when the library is unavailable or empty. */
const lawLabel = (r) => r.parent_name ? `${r.law_name} (${r.kind || "لائحة"} تابعة لـ${r.parent_name})` : r.law_name;
async function lawContext(query, k = 10) {
  const L = LAWS(); if (!L || !query) return "";
  try {
    const rows = await L.search(String(query).slice(0, 2500), k);
    if (!rows.length) return "";
    return `\nالمواد النظامية ذات الصلة من المكتبة النظامية للمكتب (أنظمة ولوائحها التنفيذية وقواعدها، نصوص رسمية بآخر تعديل مسجل فيها):
${rows.map((r) => `• ${lawLabel(r)}${r.status ? ` [${r.status}]` : ""} — ${r.article}: ${String(r.body).slice(0, 1400)}`).join("\n")}
عند الإحالة استند إلى هذه النصوص واذكر اسم النظام أو اللائحة ورقم المادة كما وردا فيها، وقدّم نص النظام ثم ما تفصّله لائحته (مثل: المادة 3 من النظام والمادة 3/1 من لائحته التنفيذية). راعِ حالة النفاذ المذكورة بين المعقوفين. لا تنسب إلى مادة نصًا لم يرد هنا؛ وما احتجت إليه من غيرها فاكتب بجانبه (يُتحقق من رقم المادة).\n`;
  } catch (e) { console.warn("law search", e); return ""; }
}

/* Families of law in the icon view; anything else lands in «أنظمة أخرى». Slugs are those of tools/law_library.py. */
const LAW_GROUPS = [
  { t: "القضاء والمرافعات", ic: "gavel", s: ["muraf", "ithbat", "mazalim", "diwan", "qadaa", "takaleef", "tahkeem"] },
  { t: "التجارة والشركات", ic: "brief", s: ["tijari", "sharikat", "awraq", "iflas", "munafasa", "tijara-e", "tasattur", "wakalat", "imtiyaz", "sijil", "asmaa", "vat", "alamat"] },
  { t: "المعاملات المدنية والعقار", ic: "home", s: ["madani", "tasjeel", "wahdat", "rahn", "tamweel", "naza", "tamaluk", "baladiya", "khaleeji", "ijara-tamweeli"] },
  { t: "العمل", ic: "team", s: ["amal"] },
  { t: "الأحوال الشخصية والأحداث", ic: "family", s: ["ahwal", "ahdath"] },
  { t: "الجزائي والنزاهة", ic: "shield", s: ["jazai", "irhab", "ghasl", "himaya", "rashwa"] },
  { t: "التنفيذ", ic: "coin", s: ["tanfeeth", "tanfeeth47", "tanfeeth-mazalim"] },
  { t: "المهنة والتوثيق", ic: "user", s: ["muhamah", "tawtheeq"] },
  { t: "التقنية والبيانات والملكية الفكرية", ic: "cpu", s: ["pdpl", "e-trans", "muallif"] },
];
/* What hangs under a law, by tab. Principles, precedents, circulars and policies must cite an official Saudi source. */
const LAW_TABS = [
  { k: "text", t: "النظام", ic: "book" },
  { k: "regs", t: "اللوائح والقواعد", ic: "docs", kinds: ["لائحة تنفيذية", "لائحة", "قواعد", "ضوابط", "أدلة إجرائية", "آلية", "تنظيم", "ترتيبات", "دليل"] },
  { k: "principles", t: "المبادئ القضائية", ic: "scale", kinds: ["مبادئ قضائية"], official: true },
  { k: "precedents", t: "السوابق القضائية", ic: "gavel", kinds: ["سوابق قضائية"], official: true },
  { k: "circulars", t: "التعاميم", ic: "mail", kinds: ["تعاميم"], official: true },
  { k: "policies", t: "السياسات والقرارات", ic: "flag", kinds: ["سياسات وقرارات"], official: true },
];
const OFFICIAL_KINDS = LAW_TABS.filter((t) => t.official).flatMap((t) => t.kinds);
const ITEM_WORD = { "مبادئ قضائية": "مبدأ", "سوابق قضائية": "حكم", "تعاميم": "تعميم", "سياسات وقرارات": "قرار" };
const isOfficialUrl = (u) => { try { const h = new URL(u).hostname.toLowerCase(); return h === "gov.sa" || h.endsWith(".gov.sa"); } catch { return false; } };
const bareSlug = (slug) => String(slug || "").replace(/^boe-/, "");
const groupOf = (l) => LAW_GROUPS.find((g) => g.s.includes(bareSlug(l.slug))) || { t: "أنظمة أخرى", ic: "scale" };

VIEWS.laws = () => {
  const L = LAWS();
  if (!L) return `<div class="page-head"><div><h1>المكتبة النظامية</h1></div></div><div class="card">${emptyBox("scale", "المكتبة متاحة في نسخة المنصة المستقلة", "افتحها من رابط GitHub Pages الخاص بالمكتب.")}</div>`;
  if (!S.lawList && !S.lawLoading) { S.lawLoading = true; L.list().then((x) => { S.lawList = x; }).catch(() => { S.lawList = []; toast("تعذّر تحميل المكتبة", true); }).finally(() => { S.lawLoading = false; render(); }); }
  const list = S.lawList || []; const total = list.reduce((s, l) => s + (l.articles || 0), 0);
  const mains = list.filter((l) => !l.parent || !list.some((x) => x.slug === l.parent));
  if (S.lawFam && list.some((l) => l.slug === S.lawFam)) return lawDetail(list.find((l) => l.slug === S.lawFam), list);
  const res = S.lawResults;
  const kidsOf = (slug) => list.filter((l) => l.parent === slug);
  const groups = [...LAW_GROUPS, { t: "أنظمة أخرى", ic: "scale", s: [] }].map((g) => ({ ...g, items: mains.filter((l) => groupOf(l).t === g.t) })).filter((g) => g.items.length);
  return `<div class="page-head"><div><h1>المكتبة النظامية</h1><p>${mains.length} نظامًا و${list.length - mains.length} من اللوائح والمبادئ والتعاميم التابعة · ${total.toLocaleString("en")} مادة. يستند إليها المساعد في كل تحليل وصياغة وإجابة.</p></div>
    <div class="row"><button class="btn gold" data-act="go" data-r="chat">${icon("bot")}اسأل المكتبة</button><button class="btn" data-act="importCore" ${S.lawImport ? "disabled" : ""}>${icon("download")}${S.lawImport ? esc(S.lawImport) : "استيراد المكتبة الرسمية"}</button><button class="btn" data-act="addLaw">${icon("plus")}إضافة نظام</button></div></div>
  <form class="row" data-form="lawSearch"><input id="law-q" class="inp grow" name="q" value="${esc(S.lawQ || "")}" placeholder="ابحث في المواد والمبادئ: مهلة الاعتراض، الاختصاص المكاني، مكافأة نهاية الخدمة…" style="min-width:220px"><button class="btn primary" type="submit">${icon("search")}بحث</button>${res ? `<button class="btn ghost" type="button" data-act="lawClear">مسح</button>` : ""}</form>
  ${res ? lawResultsCard(res) : ""}
  ${S.lawView && !S.lawFam ? lawArticlesCard() : ""}
  ${S.lawLoading && !S.lawList ? `<div class="thinking">جارٍ التحميل…</div>` : list.length ? groups.map((g) => `<section class="law-group"><h2 class="law-group-h">${icon(g.ic)}<span>${esc(g.t)}</span><small>${g.items.length}</small></h2>
      <div class="law-grid">${g.items.map((l) => lawCard(l, kidsOf(l.slug), g.ic)).join("")}</div></section>`).join("")
    : `<div class="card">${emptyBox("scale", "المكتبة فارغة", "ابدأ باستيراد المكتبة الرسمية (الأنظمة ولوائحها التنفيذية وقواعدها من هيئة الخبراء بمجلس الوزراء والبوابة القانونية لوزارة العدل).", `<button class="btn gold" data-act="importCore">${icon("download")}استيراد المكتبة الرسمية</button>`)}</div>`}`;
};
function lawCard(l, kids, ic) {
  const count = (tab) => kids.filter((k) => tab.kinds.includes(k.kind || "لائحة")).length;
  const chips = LAW_TABS.slice(1).map((t) => [t, count(t)]).filter(([, n]) => n);
  return `<button class="law-card" data-act="lawFamOpen" data-id="${esc(l.slug)}"><span class="law-ic">${icon(ic)}</span>
    <span class="law-name">${esc(l.name)}</span>
    <span class="law-meta"><span class="num">${(l.articles || 0).toLocaleString("en")} مادة</span>${chips.map(([t, n]) => `<span>${n} ${esc(t.t.replace("ال", "").split(" ")[0])}</span>`).join("")}</span>
    ${l.status ? `<span class="pill warn">${esc(l.status)}</span>` : ""}</button>`;
}
function lawResultsCard(res) {
  return `<div class="card"><div class="card-h"><h3>نتائج «${esc(S.lawQ)}»</h3><span class="sub num">${res.length}</span></div>${res.length ? `<div class="list">${res.map((r) => `<div class="li" style="align-items:flex-start"><div class="body"><div class="ttl">${esc(lawLabel(r))} — ${esc(r.article)}</div><div class="prose small" style="margin-top:4px">${esc(r.body)}</div></div></div>`).join("")}</div>` : emptyBox("search", "لا توجد مواد مطابقة", "جرّب كلمات أخرى أو أضف النظام المعني إلى المكتبة.")}</div>`;
}
A.lawFamOpen = (el) => { S.lawFam = el.dataset.id; S.lawTab = "text"; S.lawView = null; S.lawText = null; render(); window.scrollTo(0, 0); };
A.lawBack = () => { S.lawFam = null; S.lawView = null; S.lawText = null; render(); };
A.lawTab = (el) => { S.lawTab = el.dataset.tab; S.lawView = null; render(); };
function lawDetail(l, list) {
  const kids = list.filter((x) => x.parent === l.slug); const g = groupOf(l); const tab = LAW_TABS.find((t) => t.k === S.lawTab) || LAW_TABS[0];
  if (tab.k === "text" && (!S.lawText || S.lawText.slug !== l.slug)) { S.lawText = { slug: l.slug, rows: null }; LAWS().articles(l.slug).then((r) => { if (S.lawText?.slug === l.slug) { S.lawText.rows = r; render(); } }).catch(() => toast("تعذّر تحميل المواد", true)); }
  const n = (t) => (t.kinds ? kids.filter((k) => t.kinds.includes(k.kind || "لائحة")).length : l.articles || 0);
  const items = tab.kinds ? kids.filter((k) => tab.kinds.includes(k.kind || "لائحة")) : [];
  const q = (S.lawFilter || "").trim();
  return `<div class="crumbs"><a data-act="lawBack">المكتبة النظامية</a><span>/</span><span>${esc(g.t)}</span></div>
  <div class="case-head law-head"><div class="row" style="align-items:flex-start;gap:16px"><span class="law-ic lg">${icon(g.ic)}</span><div class="grow"><h1>${esc(l.name)}</h1>
      <div class="row small muted" style="margin-top:4px">${l.issued ? `<span>صدر ${esc(l.issued)}</span>` : ""}${l.status ? pill(l.status, "warn") : pill("ساري", "ok")}${l.source_url ? `<a href="${esc(l.source_url)}" target="_blank" rel="noopener">${icon("link")} المصدر الرسمي</a>` : ""}${l.updated ? `<span>${esc(l.updated)}</span>` : ""}</div></div>
    <div class="row"><button class="btn gold" data-act="chatAbout" data-id="${esc(l.slug)}">${icon("bot")}اسأل عن هذا النظام</button></div></div>
    <div class="tabs">${LAW_TABS.map((t) => `<a class="${tab.k === t.k ? "on" : ""}" data-act="lawTab" data-tab="${t.k}">${t.t}<span class="n num">${n(t).toLocaleString("en")}</span></a>`).join("")}</div></div>
  ${tab.k === "text" ? `<div class="card"><div class="card-h"><h3>مواد ${esc(l.name)}</h3><input class="inp" style="max-width:260px" placeholder="تصفية المواد…" value="${esc(q)}" data-draft="lawFilterQ" data-live="lawFilter"></div>
      ${S.lawText?.rows ? `<div class="list">${S.lawText.rows.filter((a) => !q || (a.article + " " + a.body).includes(q)).map((a) => `<div class="li" style="align-items:flex-start"><div class="body"><div class="ttl">${esc(a.article)}</div><div class="prose small">${esc(a.body)}</div></div></div>`).join("")}</div>` : `<div class="thinking">جارٍ التحميل…</div>`}</div>`
  : `<div class="card"><div class="card-h"><h3>${tab.t}</h3><button class="btn sm ${items.length ? "" : "gold"}" data-act="addLaw" data-parent="${esc(l.slug)}" data-kind="${esc(tab.kinds[0])}">${icon("plus")}إضافة ${tab.official ? "من مصدر رسمي" : ""}</button></div>
      ${tab.official ? `<p class="small muted" style="margin:0 0 10px">لا يُقبل إلا ما له رابط من جهة حكومية سعودية (نطاق ‎.gov.sa)، مثل وزارة العدل أو ديوان المظالم أو هيئة الخبراء أو المحكمة العليا، ويُذكر تاريخه ليُعرف سريانه.</p>` : ""}
      ${items.length ? `<div class="list">${items.map((c) => `<div class="li clickable" data-act="lawOpen" data-id="${esc(c.slug)}"><span class="ic" style="color:var(--accent-ink)">${icon(tab.ic)}</span><div class="body"><div class="ttl">${esc(c.name)}</div><div class="meta"><span>${esc(c.kind || "")}</span><span class="num">${c.articles} ${esc(ITEM_WORD[c.kind] || "مادة")}</span>${c.issued ? `<span>${esc(c.issued)}</span>` : ""}${c.source_url ? `<a href="${esc(c.source_url)}" target="_blank" rel="noopener" data-noact="1">المصدر</a>` : ""}</div></div>${c.status ? pill(c.status, "warn") : ""}
          <div class="row" data-noact="1" style="gap:4px;flex-wrap:nowrap"><button class="btn sm ghost" data-act="addLaw" data-id="${esc(c.slug)}" title="تحديث">${icon("edit")}</button><button class="btn sm ghost danger" data-act="lawRemove" data-id="${esc(c.slug)}" title="حذف">${icon("trash")}</button></div></div>`).join("")}</div>`
        : emptyBox(tab.ic, `لا توجد ${tab.t} مضافة بعد`, tab.official ? "أضفها من نشرة رسمية (PDF أو Word أو نص) مع رابطها، فتُقسَّم إلى بنود يستند إليها المساعد." : "")}</div>
    ${S.lawView ? lawArticlesCard() : ""}`}`;
}
CH.lawFilter = debounce((el) => { S.lawFilter = el.value; const pos = el.selectionStart; render(); const i = document.querySelector('[data-live="lawFilter"]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch {} } }, 250);
function lawArticlesCard() {
  const v = S.lawView;
  return `<div class="card"><div class="card-h"><h3>${esc(v.name)}</h3><button class="btn sm ghost" data-act="lawClose">${icon("x")}إغلاق</button></div>
    ${v.rows ? `<div class="list">${v.rows.map((a) => `<div class="li" style="align-items:flex-start"><div class="body"><div class="ttl">${esc(a.article)}</div><div class="prose small">${esc(a.body)}</div></div></div>`).join("")}</div>` : `<div class="thinking">جارٍ التحميل…</div>`}</div>`;
}
/* The official library built by tools/law_library.py (laws.boe.gov.sa + laws.moj.gov.sa), published as docs/laws/core.json.
   Entries come in family order: each main law followed by its regulations (`parent` = the main law's slug). */
A.importCore = async () => {
  const L = LAWS(); if (!L || S.lawImport) return;
  S.lawImport = "جارٍ التحميل…"; render();
  try {
    const pack = await (await fetch("laws/core.json?t=" + Date.now())).json();
    const entries = Object.entries(pack.laws || {}); let n = 0, arts = 0;
    for (const [slug, law] of entries) {
      S.lawImport = `${++n}/${entries.length}: ${law.name}`; render();
      await L.save({ slug: "boe-" + slug, name: law.name, source_url: law.url, issued: law.issued, updated: `${law.source || "البوابة الرسمية"} ${pack.extracted}`,
        kind: law.kind || "نظام", parent: law.parent ? "boe-" + law.parent : null, ord: n, status: law.status || null }, law.articles);
      arts += law.articles.length;
    }
    toast(`استُورد ${entries.length} نظامًا ولائحة (${arts} مادة) من المصادر الرسمية`);
  } catch (e) { console.error(e); toast("تعذّر الاستيراد: " + (e.message || ""), true); }
  finally { S.lawImport = null; S.lawList = null; render(); }
};
F.lawSearch = async (d) => { S.lawQ = d.q.trim(); if (!S.lawQ) return; S.lawResults = null; try { S.lawResults = await LAWS().search(S.lawQ, 20); } catch { toast("تعذّر البحث", true); } render(); };
A.lawClear = () => { S.lawQ = ""; S.lawResults = null; render(); };
A.lawOpen = async (el) => { const l = (S.lawList || []).find((x) => x.slug === el.dataset.id); if (!l) return; S.lawView = { name: l.name, rows: null }; render(); try { S.lawView.rows = await LAWS().articles(l.slug); } catch { toast("تعذّر تحميل المواد", true); } render(); };
A.lawClose = () => { S.lawView = null; render(); };
A.lawRemove = (el) => confirmBox("حذف النظام من المكتبة", "ستُحذف مواده من المكتبة، ولن يستند إليها المساعد بعد الآن.", "حذف", async () => { await LAWS().remove(el.dataset.id); S.lawList = null; S.lawView = null; toast("حُذف"); render(); }, true);

A.addLaw = (el) => {
  const l = (S.lawList || []).find((x) => x.slug === el.dataset.id) || { kind: el.dataset.kind || "نظام", parent: el.dataset.parent || "" };
  S.lawDraft = { text: "", kind: l.kind };
  modal(l.slug ? "تحديث نص النظام" : "إضافة نظام إلى المكتبة", `<form id="law-form" data-form="saveLaw" class="stack" style="gap:12px"><input type="hidden" name="slug" value="${esc(l.slug || "")}">
    <div class="field"><label for="lw-name" class="req">الاسم</label><input id="lw-name" class="inp" name="name" required value="${esc(l.name || "")}" placeholder="مثال: نظام المرافعات الشرعية، أو: المبادئ القضائية للمحكمة العليا في المرافعات"></div>
    <div class="grid2"><div class="field"><label for="lw-kind">النوع</label><select id="lw-kind" class="inp" name="kind" data-ch="lawKind">${["نظام", ...LAW_TABS[1].kinds, ...OFFICIAL_KINDS].map((k) => `<option${(l.kind || "نظام") === k ? " selected" : ""}>${k}</option>`).join("")}</select></div>
      <div class="field"><label for="lw-parent">يتبع النظام (للوائح)</label><select id="lw-parent" class="inp" name="parent"><option value="">— نظام رئيسي —</option>${(S.lawList || []).filter((x) => !x.parent && x.slug !== l.slug).map((x) => `<option value="${esc(x.slug)}"${l.parent === x.slug ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div></div>
    <div class="grid2"><div class="field"><label for="lw-iss">تاريخ الإصدار / المرسوم</label><input id="lw-iss" class="inp" name="issued" value="${esc(l.issued || "")}" placeholder="م/1 بتاريخ 22/1/1435هـ"></div>
      <div class="field"><label for="lw-upd">آخر تعديل مضمّن</label><input id="lw-upd" class="inp" name="updated" value="${esc(l.updated || "")}" placeholder="تاريخ آخر تعديل في النص"></div></div>
    <div class="field"><label for="lw-src">رابط المصدر الرسمي <span class="muted">(إلزامي للمبادئ والسوابق والتعاميم والسياسات: نطاق ‎.gov.sa)</span></label><input id="lw-src" class="inp" name="source_url" dir="ltr" value="${esc(l.source_url || "")}" placeholder="https://laws.boe.gov.sa/..."></div>
    <div class="field"><label for="lw-file">ملف النص (PDF أو Word أو نص)</label><input id="lw-file" class="inp" type="file" accept=".pdf,.docx,.txt" data-ch="lawFile"></div>
    <div class="field"><label for="lw-text">أو الصق النص كاملًا</label><textarea id="lw-text" class="inp" name="text" rows="8" data-ch="lawText" placeholder="المادة الأولى: …&#10;المادة الثانية: …"></textarea></div>
    <div id="lw-preview" class="small muted">${l.slug ? "النص الجديد يستبدل مواد هذا النظام كلها." : "تُقسَّم المواد تلقائيًا عند كل سطر يبدأ بـ «المادة»."}</div></form>`,
    `<button class="btn primary" type="submit" form="law-form">حفظ في المكتبة</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`, true);
};
/* Principles, precedents and circulars are not split by «المادة»: try their own headings, then numbered items, then paragraphs. */
function splitItems(text, kind) {
  const word = ITEM_WORD[kind]; if (!word) return splitArticles(text);
  const lines = String(text || "").replace(/\r/g, "").split("\n"); const out = []; let cur = null;
  const head = /^(المبدأ|مبدأ|القرار|قرار|التعميم|تعميم|الحكم|حكم|السابقة|رقم)\s*(رقم)?\s*[(\[]?\s*[0-9٠-٩]+/;
  const num = /^([0-9٠-٩]{1,4})\s*[-.)–]\s+/;
  const useHead = lines.filter((l) => head.test(l.trim())).length >= 2; const useNum = !useHead && lines.filter((l) => num.test(l.trim())).length >= 2;
  for (const raw of lines) {
    const l = raw.trim(); if (!l) { if (cur && !useHead && !useNum) { out.push(cur); cur = null; } continue; }
    if ((useHead && head.test(l)) || (useNum && num.test(l))) { if (cur) out.push(cur); cur = { article: useHead ? l.slice(0, 60) : `${word} ${l.match(num)[1]}`, body: useHead ? "" : l.replace(num, "") }; continue; }
    if (!cur) cur = { article: `${word} ${out.length + 1}`, body: "" };
    cur.body += (cur.body ? " " : "") + l;
  }
  if (cur) out.push(cur);
  return out.filter((a) => (a.body || "").trim().length > 15 || a.article.length > 20).map((a, i) => ({ article: a.article, num: i + 1, body: (a.body || a.article).trim() }));
}
CH.lawKind = () => { S.lawDraft = { ...(S.lawDraft || {}), kind: $("#lw-kind").value }; lawPreview(); };
function lawPreview() {
  const t = $("#lw-text")?.value || S.lawDraft?.text || ""; const kind = $("#lw-kind")?.value || S.lawDraft?.kind; const arts = splitItems(t, kind); const box = $("#lw-preview"); if (!box) return arts;
  box.innerHTML = arts.length ? `<span class="pill ok">${arts.length} ${ITEM_WORD[kind] ? "بندًا" : "مادة"}</span> أولها: <b>${esc(arts[0].article)}</b> — آخرها: <b>${esc(arts[arts.length - 1].article)}</b>` : t ? `<span class="pill warn">لم أجد مواد</span> تأكد أن كل مادة تبدأ بسطر «المادة …».` : "";
  return arts;
}
CH.lawText = () => { S.lawDraft = { ...(S.lawDraft || {}), text: $("#lw-text").value }; lawPreview(); };
CH.lawFile = async (el) => {
  const f = el.files[0]; if (!f) return; const box = $("#lw-preview"); if (box) box.innerHTML = '<span class="thinking">يقرأ الملف…</span>';
  try { const { text } = await extractText(f); $("#lw-text").value = text; S.lawDraft = { ...(S.lawDraft || {}), text }; lawPreview(); }
  catch (e) { console.warn(e); if (box) box.textContent = "تعذّرت قراءة الملف. الصق النص بدلًا منه."; }
};
F.saveLaw = async (d) => {
  const arts = splitItems(d.text || "", d.kind);
  if (!arts.length) return toast(ITEM_WORD[d.kind] ? "لم أجد بنودًا في النص." : "لم أجد مواد في النص. تأكد أن كل مادة تبدأ بسطر «المادة …».", true);
  if (OFFICIAL_KINDS.includes(d.kind) && !isOfficialUrl(d.source_url.trim())) return toast("أدخل رابط المصدر الرسمي من جهة حكومية سعودية (ينتهي بـ ‎.gov.sa).", true);
  if (OFFICIAL_KINDS.includes(d.kind) && !d.parent) return toast("حدّد النظام الذي يتبعه.", true);
  const name = d.name.trim(); const slug = d.slug || slugify(name);
  try { await LAWS().save({ slug, name, source_url: d.source_url.trim(), issued: d.issued.trim(), updated: d.updated.trim(), kind: d.kind || "نظام", parent: d.parent || null }, arts); }
  catch (e) { console.error(e); return toast("تعذّر الحفظ: " + (e.message || ""), true); }
  closeModal(); S.lawList = null; toast(`حُفظ «${name}»: ${arts.length} ${ITEM_WORD[d.kind] ? "بندًا" : "مادة"}`); render();
};
