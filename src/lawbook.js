/* ============ Rakz — law book: every law laid out as a book of scenes ============
   Cover with a map of every article (coloured by its باب, click a number to jump to it), a table of contents
   by باب / فصل with article ranges, then each article: number, title, numbered paragraphs and a «مثال عملي».
   Structure (path) and source titles come from the official texts (tools/law_library.py). Titles the source
   lacks and the practical examples are written by the assistant on request and kept in law_scenes,
   tied to the exact article text (body_hash) so an amended article never shows a stale example. */

const LB = {}; // slug → { rows, scenes: { num: {title, example, body_hash} }, busy, done, total }
const bodyHash = (s) => { let h = 5381; for (const ch of String(s || "")) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h.toString(36); };
function lbLoad(slug) {
  if (LB[slug]) return LB[slug];
  const st = (LB[slug] = { rows: null, scenes: {} }); const L = LAWS();
  Promise.all([L.articles(slug), L.scenes ? L.scenes(slug).catch(() => []) : []]).then(([rows, sc]) => {
    st.rows = rows; for (const s of sc) st.scenes[s.num] = s; render();
  }).catch(() => { delete LB[slug]; toast("تعذّر تحميل المواد", true); });
  return st;
}
const scene = (st, a) => { const s = st.scenes[a.num]; return s && s.body_hash === bodyHash(a.body) ? s : null; };

/* «الباب الأول: أحكام عامة» → label «الباب الأول», name «أحكام عامة» */
const headParts = (t) => { const i = String(t).indexOf(":"); return i > 0 ? { lbl: t.slice(0, i).trim(), name: t.slice(i + 1).trim() } : { lbl: "", name: String(t).trim() }; };
/* the number shown for an article: digits when the label has them, else the running count (مكرر keeps the previous number) */
function displayNos(rows) {
  let n = 0;
  return rows.map((a) => { const d = String(a.article).match(/[0-9٠-٩]+/); const rep = /مكرر/.test(a.article);
    if (d) { n = +d[0].replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)); return rep ? `${n} مكرر` : String(n); }
    if (!rep) n++; return rep ? `${n} مكرر` : String(n); });
}
/* sections: top level (باب) with their sub-sections (فصل, then فرع), each with its article range */
function lbOutline(rows, nos) {
  const out = [];
  rows.forEach((a, i) => {
    const p = a.path?.length ? a.path : [""];
    let lvl = out;
    p.forEach((t, d) => {
      let node = lvl[lvl.length - 1];
      if (!node || node.t !== t) { node = { t, d, from: nos[i], to: nos[i], first: a.num, kids: [] }; lvl.push(node); }
      node.to = nos[i]; lvl = node.kids;
    });
  });
  return out;
}
/* paragraphs: numbered items («1-», «أ-», «(2)») become a numbered list, the rest plain paragraphs */
function lbBody(body) {
  const parts = String(body || "").split(/\n\[تعديلات المادة المسجلة\]:\s*/);
  const lines = parts[0].split("\n").map((l) => l.trim()).filter(Boolean); const num = /^\(?([0-9٠-٩]{1,3}|[أ-ي])\s*[-–.)]\s+/;
  const html = lines.map((l) => { const m = l.match(num); return m ? `<div class="lb-p"><b class="num">${esc(m[1])}</b><span>${esc(l.replace(num, ""))}</span></div>` : `<p>${esc(l)}</p>`; }).join("");
  return html + (parts[1] ? `<div class="lb-amend">${icon("flag")}<span><b>تعديلات مسجلة:</b> ${esc(parts[1])}</span></div>` : "");
}

function lawBook(l) {
  const st = lbLoad(l.slug); if (!st.rows) return `<div class="card"><div class="thinking">جارٍ تحميل نص ${esc(l.name)}…</div></div>`;
  const rows = st.rows; const nos = displayNos(rows); const out = lbOutline(rows, nos);
  const tops = out.filter((x) => x.t); const top = (a) => (a.path?.[0] ? tops.findIndex((x) => x.t === a.path[0]) : -1);
  const q = (S.lawFilter || "").trim(); const ai = !!S.caps.sample && !!LAWS().saveScenes;
  const have = rows.filter((a) => scene(st, a)?.example).length; const missing = rows.length - have;
  const cover = `<section class="lb-cover"><div class="lb-cover-h"><span class="eyebrow">${esc(l.kind || "نظام")}${l.status ? ` · ${esc(l.status)}` : ""}</span><h2>${esc(l.name)}</h2>
      <p>${rows.length.toLocaleString("en")} مادة${tops.length ? ` · ${tops.length} ${tops.length > 10 ? "بابًا" : tops.length > 2 ? "أبواب" : "باب"}` : ""}${have ? ` · ${have.toLocaleString("en")} مثالًا عمليًا` : ""}. اضغط رقم أي مادة للانتقال إليها.</p></div>
    <div class="lb-map">${rows.map((a, i) => `<button class="lb-tile b${top(a) < 0 ? "x" : top(a) % 10}${/^مادة ملغاة/.test(a.body) ? " gone" : ""}" data-act="lbGo" data-n="${a.num}" title="${esc(a.article)}${a.path?.length ? " — " + esc(a.path.join(" › ")) : ""}">${esc(nos[i].replace(" مكرر", "م"))}</button>`).join("")}</div>
    <div class="lb-legend">${tops.map((x, k) => `<span><i class="lb-tile b${k % 10}"></i>${esc(headParts(x.t).name || x.t)}</span>`).join("")}${rows.some((a) => /^مادة ملغاة/.test(a.body)) ? `<span><i class="lb-tile b0 gone"></i>مادة ملغاة</span>` : ""}</div>
    <div class="lb-meta">${l.issued ? `<div><small>الإصدار</small><b>${esc(l.issued)}</b></div>` : ""}<div><small>البنية</small><b>${rows.length} مادة${tops.length ? ` · ${tops.length} أبواب` : ""}</b></div>${l.source_url ? `<div><small>المصدر الرسمي</small><a href="${esc(l.source_url)}" target="_blank" rel="noopener">${esc(new URL(l.source_url).hostname)}</a></div>` : ""}</div></section>`;
  const toc = tops.length ? `<section class="card lb-toc"><div class="card-h"><h3>محتويات النظام</h3><span class="sub">الفهرس</span></div>
    ${out.map((b) => tocRow(b)).join("")}</section>` : "";
  const tools = `<div class="lb-tools"><input class="inp" style="max-width:280px" placeholder="تصفية المواد بكلمة…" value="${esc(q)}" data-draft="lawFilterQ" data-live="lawFilter">
    <span class="grow"></span>${ai ? st.busy ? `<span class="thinking small">${esc(st.busy)}</span><button class="btn sm" data-act="lbStop" data-id="${esc(l.slug)}">إيقاف</button>`
      : missing ? `<button class="btn sm gold" data-act="lbGen" data-id="${esc(l.slug)}" title="عنوان قصير ومثال عملي افتراضي لكل مادة، يكتبهما المساعد ويُحفظان للفريق">${icon("spark")}${have ? `أكمل الأمثلة العملية (${missing} مادة)` : "أنشئ العناوين والأمثلة العملية"}</button>` : `<span class="pill ok">كل المواد لها أمثلة عملية</span>` : ""}</div>`;
  let lastTop = null, lastSub = null;
  const arts = rows.map((a, i) => {
    if (q && !(a.article + " " + a.body + " " + (a.title || "") + " " + (scene(st, a)?.title || "")).includes(q)) return "";
    let h = "";
    const p0 = a.path?.[0] || "", p1 = a.path?.slice(1).join(" › ") || "";
    if (p0 !== lastTop) { lastTop = p0; lastSub = null; if (p0) { const hp = headParts(p0); h += `<div class="lb-sec"><span class="lb-tile b${top(a) % 10}"></span><div><small>${esc(hp.lbl)}</small><h2>${esc(hp.name)}</h2></div></div>`; } }
    if (p1 !== lastSub) { lastSub = p1; if (p1) h += `<div class="lb-sub">${esc(p1)}</div>`; }
    const s = scene(st, a); const title = a.title || s?.title;
    const gone = /^مادة ملغاة/.test(a.body);
    return h + `<article class="lb-art${gone ? " gone" : ""}" id="art-${a.num}"><div class="lb-no"><small>${esc(a.article.replace(/^(المادة|القاعدة|البند).*/, "$1") || "المادة")}</small><b class="num">${esc(nos[i])}</b></div>
      <div class="lb-main">${title ? `<h3>${esc(title)}</h3>` : `<h3 class="muted-t">${esc(a.article)}</h3>`}${gone ? `<span class="pill bad">مادة ملغاة</span>` : ""}<div class="lb-body">${lbBody(gone ? a.body.replace(/^مادة ملغاة\.\s*/, "") : a.body)}</div>
      ${s?.example ? `<div class="lb-ex"><div class="lb-ex-h">${icon("bulb")}مثال عملي <span title="مثال افتراضي أعدّه المساعد لتوضيح تطبيق المادة، وليس تفسيرًا رسميًا لها">· افتراضي</span></div><p>${esc(s.example)}</p></div>`
        : ai && !st.busy && !/^مادة ملغاة/.test(a.body) ? `<button class="btn sm ghost lb-ex-btn" data-act="lbOne" data-id="${esc(l.slug)}" data-n="${a.num}">${icon("bulb")}مثال عملي</button>` : ""}</div></article>`;
  }).join("");
  return `${cover}${toc}<div class="card lb-arts">${tools}${arts || emptyBox("search", "لا توجد مواد مطابقة", "")}</div>`;
}
function tocRow(n) {
  const hp = headParts(n.t || "بلا تبويب"); const range = n.from === n.to ? `المادة ${n.from}` : `المواد ${n.from}–${n.to}`;
  return `<div class="lb-toc-r d${n.d}" data-act="lbGo" data-n="${n.first}"><span class="lbl">${esc(hp.lbl)}</span><span class="nm">${esc(hp.name)}</span><span class="rg num">${range}</span></div>${n.kids.filter((k) => k.t).map(tocRow).join("")}`;
}
A.lbGo = (el) => { const t = document.getElementById("art-" + el.dataset.n); if (!t) { S.lawFilter = ""; render(); } (document.getElementById("art-" + el.dataset.n) || t)?.scrollIntoView({ behavior: "smooth", block: "start" }); };

/* titles + examples, ten articles per call, one JSON object per line so a cut costs at most one article */
async function lbWrite(slug, arts, onProgress) {
  const lawName = (S.lawList || []).find((x) => x.slug === slug)?.name || "";
  const prompt = `أنت محامٍ سعودي خبير تُعدّ «مشاهد تطبيقية» لمواد ${lawName}، على طريقة الكتب التي تشرح كل مادة بمشهد من الواقع العملي.
لكل مادة أدناه اكتب:
- t: عنوانًا قصيرًا للمادة (من 2 إلى 6 كلمات) يلخص حكمها، مثل: «شكل التظهير ووقته» أو «تقديم تاريخ التظهير».
- e: مثالًا عمليًا افتراضيًا في جملتين أو ثلاث: أشخاص بأسماء عربية بسيطة (خالد، سارة، شركة النخبة…) في واقعة سعودية من الحياة العملية، ثم بيان كيف تنطبق المادة عليها ونتيجتها، بصيغة مباشرة كالتالي: «باع خالد… . هنا … لأن …». التزم بحكم النص حرفيًا، ولا تضف شروطًا أو مهلًا أو أرقامًا ليست في المادة. المادة التعريفية: مثال يبيّن أثر التعريف. المادة الملغاة: e فارغ.
الصيغة: سطر JSON مستقل لكل مادة بالترتيب، بلا مصفوفة ولا أي نص خارج الأسطر:
{"n":رقم_الحقل,"t":"العنوان","e":"المثال"}

${arts.map((a) => `[n=${a.num}] ${a.article}${a.path?.length ? ` (${a.path.join(" › ")})` : ""}:\n${String(a.body).split("\n[تعديلات")[0].slice(0, 2500)}`).join("\n\n")}`;
  const { text } = await S.caps.sample(prompt, { modelTier: "default", cache: false, onText: onProgress });
  const got = [];
  for (const raw of String(text).split("\n")) {
    const line = raw.trim().replace(/^```\w*|```$/g, "").replace(/,$/, ""); if (!line.startsWith("{")) continue;
    try { const o = JSON.parse(line); const a = arts.find((x) => x.num === +o.n); if (a && (o.t || o.e)) got.push({ num: a.num, body_hash: bodyHash(a.body), title: String(o.t || "").slice(0, 120), example: String(o.e || "").slice(0, 1500) }); } catch {}
  }
  if (got.length) { await LAWS().saveScenes(slug, got); const st = LB[slug]; for (const g of got) st.scenes[g.num] = g; }
  return got.length;
}
A.lbGen = async (el) => {
  const slug = el.dataset.id; const st = LB[slug]; if (!st?.rows || st.busy) return;
  const todo = st.rows.filter((a) => !scene(st, a)?.example && !/^مادة ملغاة/.test(a.body)); let done = 0; st.stop = false;
  try {
    for (let i = 0; i < todo.length && !st.stop; i += 10) {
      st.busy = `يكتب المساعد الأمثلة… ${done}/${todo.length}`; render();
      done += await lbWrite(slug, todo.slice(i, i + 10), () => {});
    }
    toast(st.stop ? `توقف بعد ${done} مادة` : `أُضيفت العناوين والأمثلة لـ ${done} مادة`);
  } catch (e) { aiErr(e); }
  finally { st.busy = null; render(); }
};
A.lbStop = (el) => { const st = LB[el.dataset.id]; if (st) { st.stop = true; st.busy = "يتوقف بعد الدفعة الحالية…"; render(); } };
A.lbOne = async (el) => {
  const slug = el.dataset.id; const st = LB[slug]; const a = st?.rows.find((x) => x.num === +el.dataset.n); if (!a || st.busy) return;
  st.busy = "يكتب المساعد المثال…"; render();
  try { if (!(await lbWrite(slug, [a], () => {}))) toast("لم يُكتب مثال لهذه المادة، أعد المحاولة.", true); }
  catch (e) { aiErr(e); }
  finally { st.busy = null; render(); }
};
