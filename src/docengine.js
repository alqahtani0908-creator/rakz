/* ============ Rakz — document engine: one markup → on-screen paper and Word (.docx) ============
   Markup (one block per line):
   > سطر        centered line (البسملة، الختام)          # عنوان       document title
   ## عنوان     section heading                           ### عنوان    sub-heading
   - نص / • نص  bullet                                    1. نص        numbered item (also ١- / 1) )
   | أ | ب |    bordered table (header row shaded)        !| أ | ب |   borderless table (signatures, parties)
   ---          rule                                      **نص**       bold inline
   «المفتاح: القيمة» lines bold the key; [........] is highlighted as a blank to fill.
   Lines such as «أولًا: …» or «البند الثالث: …» are promoted to section headings automatically. */
const JSZIP = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
const ORD = "أولًا|أولاً|ثانيًا|ثانياً|ثالثًا|ثالثاً|رابعًا|رابعاً|خامسًا|خامساً|سادسًا|سادساً|سابعًا|سابعاً|ثامنًا|ثامناً|تاسعًا|تاسعاً|عاشرًا|عاشراً|الحادي عشر|الثاني عشر|الثالث عشر|الرابع عشر|الخامس عشر";
const RE_AUTO_H = new RegExp(`^((${ORD})\\s*[:：\\-–]|البند\\s+[^\\s:]+(\\s+[^\\s:]+)?\\s*[:：]|المادة\\s+[^\\s:]+\\s*[:：])`);
const RE_NUM = /^(\d{1,2}|[١-٩][٠-٩]?)\s*[.)\-–]\s+/;
const BLANK = "[........]";
/* Direction: English contracts are laid out left-to-right, bilingual ones keep Arabic first. Each paragraph or cell
   also follows its own script, so an English clause inside an Arabic document reads correctly. */
const scriptCounts = (t) => { const s = String(t || "").replace(/\[[^\]]*\]|\*\*/g, ""); return { ar: (s.match(/[\u0600-\u06FF]/g) || []).length, la: (s.match(/[A-Za-z]/g) || []).length }; };
const isLatin = (t) => { const c = scriptCounts(t); return c.la > c.ar; };
const docDir = (body) => { const c = scriptCounts(body); return c.la > c.ar * 1.5 ? "ltr" : "rtl"; };
let DOC_DIR = "rtl"; // set while building a .docx

function parseBlocks(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n"); const out = []; let cur = null;
  const close = () => { if (cur) { out.push(cur); cur = null; } };
  const open = (t, extra) => { if (!cur || cur.t !== t || (extra && cur.plain !== extra.plain)) { close(); cur = { t, ...(t === "table" ? { rows: [] } : { items: [] }), ...(extra || {}) }; } return cur; };
  for (const raw of lines) {
    let l = raw.trim().replace(/^#{4,}\s*/, "### ");
    if (/^!?\|/.test(l)) { const plain = l.startsWith("!"); const cells = l.replace(/^!?\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim()); if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; open("table", { plain }).rows.push(cells); continue; }
    if (/^[-•▪]\s+/.test(l)) { open("ul").items.push(l.replace(/^[-•▪]\s+/, "")); continue; }
    if (RE_NUM.test(l) && !RE_AUTO_H.test(l)) { open("ol").items.push(l.replace(RE_NUM, "")); continue; }
    close();
    if (!l) continue;
    if (/^-{3,}$|^_{3,}$/.test(l)) out.push({ t: "hr" });
    else if (l.startsWith("### ")) out.push({ t: "h3", text: l.slice(4) });
    else if (l.startsWith("## ")) out.push({ t: "h2", text: l.slice(3) });
    else if (l.startsWith("# ")) out.push({ t: "h1", text: l.slice(2) });
    else if (l.startsWith("■ ")) out.push({ t: "h2", text: l.slice(2) });
    else if (l.startsWith("> ")) out.push({ t: "center", text: l.slice(2) });
    else if (/^بسم الله الرحمن الرحيم$/.test(l)) out.push({ t: "center", text: l });
    else if (/^\*\*[^*]+\*\*:?$/.test(l)) out.push({ t: "h2", text: l.replace(/\*\*/g, "").replace(/:$/, "") });
    else if (RE_AUTO_H.test(l) && l.length < 70) out.push({ t: "h2", text: l });
    else if (/^(Article|Clause|Section|Schedule|Annex|Part)\s+[\w.]+\s*[:.\-–]/i.test(l) && l.length < 80) out.push({ t: "h2", text: l });
    else out.push({ t: "p", text: l });
  }
  close(); return out;
}
/* inline: **bold**, [........] blanks, and «key:» lead-ins → [{text, bold, blank}] */
function inlineRuns(text, keyBold = true) {
  const runs = []; let s = String(text);
  const km = keyBold && !s.includes("**") ? s.match(/^([^:：]{2,28})([:：])\s+(?=\S)/) : null;
  if (km && !/[.،]/.test(km[1])) { runs.push({ text: km[1] + km[2] + " ", bold: true }); s = s.slice(km[0].length); }
  const re = /(\*\*[^*]+\*\*|\[\.{3,}\]|\[[^\]\n]{0,40}\.{3,}[^\]\n]{0,40}\])/g; let i = 0, m;
  while ((m = re.exec(s))) { if (m.index > i) runs.push({ text: s.slice(i, m.index) }); const t = m[0]; runs.push(t.startsWith("**") ? { text: t.slice(2, -2), bold: true } : { text: t, blank: true }); i = m.index + t.length; }
  if (i < s.length) runs.push({ text: s.slice(i) });
  return runs;
}
const inlineHtml = (text, keyBold) => inlineRuns(text, keyBold).map((r) => r.blank ? `<mark>${esc(r.text)}</mark>` : r.bold ? `<b>${esc(r.text)}</b>` : esc(r.text)).join("");
function colWidths(rows, total) {
  const cols = Math.max(...rows.map((r) => r.length));
  const w = Array.from({ length: cols }, (_, j) => Math.min(40, Math.max(5, ...rows.map((r) => String(r[j] || "").length))));
  const sum = w.reduce((a, b) => a + b, 0); return w.map((x) => Math.round((total * x) / sum));
}
function blocksHtml(blocks) {
  return blocks.map((b) => {
    if (b.t === "h1") return `<h1 dir="auto">${inlineHtml(b.text, false)}</h1>`;
    if (b.t === "h2") return `<h2 dir="auto">${inlineHtml(b.text, false)}</h2>`;
    if (b.t === "h3") return `<h3 dir="auto">${inlineHtml(b.text, false)}</h3>`;
    if (b.t === "center") return `<p class="c" dir="auto">${inlineHtml(b.text, false)}</p>`;
    if (b.t === "hr") return "<hr>";
    if (b.t === "ul") return `<ul>${b.items.map((i) => `<li dir="auto">${inlineHtml(i)}</li>`).join("")}</ul>`;
    if (b.t === "ol") return `<ol>${b.items.map((i) => `<li dir="auto">${inlineHtml(i)}</li>`).join("")}</ol>`;
    if (b.t === "table") { const head = !b.plain && b.rows.length > 2; const ws = colWidths(b.rows, 100);
      return `<table class="${b.plain ? "plain" : ""}"><colgroup>${ws.map((w) => `<col style="width:${w}%">`).join("")}</colgroup>${b.rows.map((r, i) => `<tr>${ws.map((_, j) => head && i === 0 ? `<th dir="auto">${inlineHtml(r[j] || "", false)}</th>` : `<td dir="auto">${inlineHtml(r[j] || "", false)}</td>`).join("")}</tr>`).join("")}</table>`; }
    return `<p dir="auto">${inlineHtml(b.text)}</p>`;
  }).join("");
}
function paperHtml(body, paperKey = "official") {
  const f = S.firm; const pp = paperOf(paperKey);
  // On stationery: the page image repeats every A4 height; padding in % of the width keeps the margins true at any size.
  if (pp.img) return `<div class="paper on-paper" id="paper" dir="${docDir(body)}" style="background-image:url('${pp.img}');padding:${(pp.top / 2.1).toFixed(2)}% ${(pp.side / 2.1).toFixed(2)}% ${(pp.bottom / 2.1).toFixed(2)}%">${blocksHtml(parseBlocks(body))}</div>`;
  return `<div class="paper" id="paper" dir="${docDir(body)}"><div class="lh"><img class="w" src="${LOGO.textLight}" alt="${esc(f.nameAr)}"><img class="m" src="${LOGO.iconLight}" alt=""></div>${blocksHtml(parseBlocks(body))}
    <div class="ft"><span>${esc([f.address || f.city, f.email, f.website, f.phone].filter(Boolean).join("  |  "))}</span><span>صفحة 1</span></div></div>`;
}
/* review checklist shown above the preview */
function docChecks(body) {
  const blanks = (String(body).match(/\[[^\]\n]{0,40}\.{3,}[^\]\n]{0,40}\]/g) || []).length;
  const verify = (String(body).match(/يُ?تحقق من/g) || []).length;
  const hasTitle = /^#\s/m.test(body);
  return { blanks, verify, hasTitle };
}

/* ---------- DOCX ---------- */
const X = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NAVY = "152335", BRONZE = "A3836B", RULE = "CFC6BD", SHADE = "F1EBE5";
function wRuns(text, o = {}) {
  const rtl = o.ltr ? '<w:rtl w:val="0"/>' : "<w:rtl/>";
  return inlineRuns(text, o.keyBold !== false && !o.bold).map((r) => {
    const b = o.bold || r.bold;
    return `<w:r><w:rPr>${o.rStyle ? `<w:rStyle w:val="${o.rStyle}"/>` : ""}${b ? "<w:b/><w:bCs/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}${o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : ""}${r.blank ? '<w:highlight w:val="yellow"/>' : ""}${rtl}</w:rPr><w:t xml:space="preserve">${X(r.text)}</w:t></w:r>`;
  }).join("");
}
function wP(text, o = {}) {
  o = { ...o, ltr: text ? isLatin(text) : DOC_DIR === "ltr" };
  const ppr = `${o.style ? `<w:pStyle w:val="${o.style}"/>` : ""}${o.keepNext ? "<w:keepNext/>" : ""}${o.num ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${o.num}"/></w:numPr>` : ""}${o.border ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="${BRONZE}"/></w:pBdr>` : ""}${o.ltr ? '<w:bidi w:val="0"/>' : "<w:bidi/>"}${o.spacing || ""}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ""}`;
  return `<w:p><w:pPr>${ppr}</w:pPr>${text ? wRuns(text, o) : ""}</w:p>`;
}
function wTbl(b) {
  const head = !b.plain && b.rows.length > 2; const ws = colWidths(b.rows, 9300);
  const bd = b.plain ? "nil" : "single";
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"].map((k) => `<w:${k} w:val="${bd}" w:sz="4" w:space="0" w:color="${RULE}"/>`).join("");
  return `<w:tbl><w:tblPr>${DOC_DIR === "rtl" ? "<w:bidiVisual/>" : ""}<w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr>
    <w:tblGrid>${ws.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>
    ${b.rows.map((r, i) => `<w:tr><w:trPr><w:cantSplit/>${head && i === 0 ? "<w:tblHeader/>" : ""}</w:trPr>${ws.map((w, j) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head && i === 0 ? `<w:shd w:val="clear" w:color="auto" w:fill="${SHADE}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>${wP(r[j] || "", { style: "TableText", bold: (head && i === 0) || (b.plain && i === 0), keyBold: false, jc: b.plain ? "center" : undefined })}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>${wP("", { style: "Gap" })}`;
}
function docxParts(title, body, paperKey = "plain", paperImg = null) {
  const f = S.firm; let numId = 1; const nums = []; DOC_DIR = docDir(body);
  const pp = paperImg ? paperOf(paperKey) : null; const tw = (mm) => Math.round(mm * 56.693);
  const FONT = S.brand?.fonts?.length ? BRAND_WORD_FONT : null;
  const content = parseBlocks(body).map((b) => {
    if (b.t === "h1") return wP(b.text, { style: "Title" });
    if (b.t === "h2") return wP(b.text, { style: "Heading1" });
    if (b.t === "h3") return wP(b.text, { style: "Heading2" });
    if (b.t === "center") return wP(b.text, { style: "Centered" });
    if (b.t === "hr") return wP("", { border: true, spacing: '<w:spacing w:before="0" w:after="200"/>' });
    if (b.t === "ul") return b.items.map((i) => wP(i, { style: "ListParagraph", num: 1 })).join("");
    if (b.t === "ol") { const id = ++numId; nums.push(id); return b.items.map((i) => wP(i, { style: "ListParagraph", num: id })).join(""); }
    if (b.t === "table") return wTbl(b);
    return wP(b.text);
  }).join("");
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const emu = (px) => Math.round(px * 9525);
  const img = (rid, id, w, h) => `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emu(w)}" cy="${emu(h)}"/><wp:docPr id="${id}" name="logo${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="logo${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  const cell = (w, inner, jc) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0"/>${jc ? `<w:jc w:val="${jc}"/>` : ""}</w:pPr>${inner}</w:p></w:tc>`;
  // Stationery: the whole page image, anchored to the page behind the text, in the header so it repeats on every page.
  const A4 = { cx: 7560000, cy: 10692000 };
  const paperHeader = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${A4.cx}" cy="${A4.cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="9" name="paper"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="9" name="paper.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdP"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${A4.cx}" cy="${A4.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p></w:hdr>`;
  const header = pp ? paperHeader : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>
    <w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="${BRONZE}"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>
    <w:tblGrid><w:gridCol w:w="7300"/><w:gridCol w:w="2000"/></w:tblGrid><w:tr>${cell(7300, img("rIdT", 1, 226, 62))}${cell(2000, img("rIdI", 2, 36, 62), "center")}</w:tr></w:tbl>
    <w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0"/></w:pPr></w:p></w:hdr>`;
  const fld = (code) => `<w:r><w:rPr><w:rtl/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:rtl/></w:rPr><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r><w:rPr><w:rtl/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:rtl/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:rtl/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>`;
  const pageNo = `<w:p><w:pPr><w:pStyle w:val="Footer"/><w:bidi/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">صفحة </w:t></w:r>${fld("PAGE")}<w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve"> من </w:t></w:r>${fld("NUMPAGES")}</w:p>`;
  const footer = pp ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${pageNo}</w:ftr>` : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>
    <w:p><w:pPr><w:pStyle w:val="Footer"/><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="${RULE}"/></w:pBdr><w:bidi/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">${X([f.address || f.city, f.email, f.website, f.phone].filter(Boolean).join("   |   "))}</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Footer"/><w:bidi/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">صفحة </w:t></w:r>${fld("PAGE")}<w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve"> من </w:t></w:r>${fld("NUMPAGES")}</w:p></w:ftr>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${content}
    <w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:footerReference w:type="default" r:id="rIdF"/><w:pgSz w:w="11906" w:h="16838"/>${pp ? `<w:pgMar w:top="${tw(pp.top)}" w:right="${tw(pp.side)}" w:bottom="${tw(pp.bottom)}" w:left="${tw(pp.side)}" w:header="0" w:footer="${tw(3)}" w:gutter="0"/>` : '<w:pgMar w:top="2000" w:right="1300" w:bottom="1500" w:left="1300" w:header="600" w:footer="500" w:gutter="0"/>'}${DOC_DIR === "rtl" ? "<w:bidi/>" : ""}</w:sectPr></w:body></w:document>`;
  const rpr = (o) => `<w:rPr><w:rFonts w:ascii="${FONT || "Arial"}" w:hAnsi="${FONT || "Arial"}" w:cs="${o.font || FONT || "Simplified Arabic"}"/>${o.b ? "<w:b/><w:bCs/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/><w:rtl/></w:rPr>`;
  const st = (id, name, ppr, r, extra = "") => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>${extra}<w:pPr><w:bidi/>${ppr}</w:pPr>${rpr(r)}</w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:docDefaults><w:rPrDefault>${rpr({ sz: 28 }).replace("<w:rtl/>", '<w:lang w:val="en-US" w:bidi="ar-SA"/>')}</w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:widowControl/><w:bidi/><w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>${rpr({ sz: 28 })}</w:style>
    ${st("Title", "Title", `<w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="6" w:color="${BRONZE}"/></w:pBdr><w:spacing w:before="120" w:after="320"/><w:jc w:val="center"/>`, { sz: 40, b: true, color: NAVY })}
    ${st("Heading1", "heading 1", `<w:keepNext/><w:keepLines/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="0"/>`, { sz: 31, b: true, color: NAVY })}
    ${st("Heading2", "heading 2", `<w:keepNext/><w:spacing w:before="180" w:after="60"/><w:outlineLvl w:val="1"/>`, { sz: 29, b: true, color: "7A5F4B" })}
    ${st("Centered", "Centered", `<w:spacing w:before="200" w:after="160"/><w:jc w:val="center"/>`, { sz: 30, b: true, color: NAVY })}
    ${st("ListParagraph", "List Paragraph", `<w:spacing w:after="80"/><w:ind w:left="720" w:hanging="360"/><w:contextualSpacing/>`, { sz: 28 })}
    ${st("TableText", "Table Text", `<w:spacing w:before="20" w:after="20" w:line="300" w:lineRule="auto"/><w:jc w:val="left"/>`, { sz: 25 })}
    ${st("Gap", "Gap", `<w:spacing w:before="0" w:after="120"/>`, { sz: 12 })}
    ${st("Footer", "footer", `<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>`, { sz: 17, color: "6B7280" })}
  </w:styles>`;
  const lvl = (fmt, text, font) => `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:bidi/><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr>${font ? `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` : ""}<w:color w:val="${BRONZE}"/><w:rtl/></w:rPr></w:lvl>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>${lvl("bullet", "•", "Arial")}</w:abstractNum>
    <w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/>${lvl("decimal", "%1.")}</w:abstractNum>
    <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
    ${nums.map((id) => `<w:num w:numId="${id}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`).join("")}</w:numbering>`;
  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:defaultTabStop w:val="720"/><w:themeFontLang w:val="en-US" w:bidi="ar-SA"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
  const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  return {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(title)}</dc:title><dc:creator>${X(f.nameAr)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`,
    "word/document.xml": doc, "word/styles.xml": styles, "word/numbering.xml": numbering, "word/settings.xml": settings, "word/header1.xml": header, "word/footer1.xml": footer,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rIdN" Type="${REL}/numbering" Target="numbering.xml"/><Relationship Id="rIdG" Type="${REL}/settings" Target="settings.xml"/><Relationship Id="rIdH" Type="${REL}/header" Target="header1.xml"/><Relationship Id="rIdF" Type="${REL}/footer" Target="footer1.xml"/></Relationships>`,
    "word/_rels/header1.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdT" Type="${REL}/image" Target="media/text.png"/><Relationship Id="rIdI" Type="${REL}/image" Target="media/icon.png"/>${pp ? `<Relationship Id="rIdP" Type="${REL}/image" Target="media/paper.jpg"/>` : ""}</Relationships>`,
  };
}
async function buildDocx(title, body, paperKey = "official") {
  await loadScript(JSZIP);
  const img = await paperData(paperKey);
  const zip = new JSZip(); const parts = docxParts(title, body, paperKey, img);
  if (img) zip.file("word/media/paper.jpg", img.split(",")[1], { base64: true });
  for (const [k, v] of Object.entries(parts)) zip.file(k, v);
  zip.file("word/media/text.png", LOGO.textLight.split(",")[1], { base64: true });
  zip.file("word/media/icon.png", LOGO.iconLight.split(",")[1], { base64: true });
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

/* ---------- PDF: the browser's own print engine renders Arabic perfectly, so a document is laid out
   on A4 in a hidden frame and handed to «Print → Save as PDF» (on iPhone: Share → Save to Files).
   The letterhead and the contact footer sit in a table's thead/tfoot, which print engines repeat on every page. ---------- */
const PRINT_CSS = `@page { size: A4; margin: 10mm 18mm 12mm; @bottom-center { content: "صفحة " counter(page) " من " counter(pages); font: 9pt "IBM Plex Sans Arabic", sans-serif; color: #8a8f99; } }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; background: #fff; }
body { font-family: "Noto Naskh Arabic", "Traditional Arabic", serif; font-size: 13pt; line-height: 1.95; color: #1b2433; direction: rtl; }
table.page { width: 100%; border-collapse: collapse; table-layout: auto; margin: 0; }
table.page > thead { display: table-header-group; } table.page > tfoot { display: table-footer-group; }
table.page > * > tr > td { border: 0; padding: 0; } table.page > tbody > tr { break-inside: auto; }
.lh { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #A3836B; padding-bottom: 8px; margin-bottom: 18px; }
.lh img.w { height: 44px; } .lh img.m { height: 56px; }
h1 { text-align: center; font-size: 18pt; color: #152335; border-bottom: 1.5px solid #A3836B; padding-bottom: 6px; margin: 6px auto 18px; width: fit-content; max-width: 100%; }
h2 { font-size: 14pt; color: #152335; margin: 16px 0 4px; break-after: avoid; }
h3 { font-size: 13pt; color: #7A5F4B; margin: 12px 0 4px; break-after: avoid; }
p { margin: 0 0 7px; text-align: justify; orphans: 3; widows: 3; } p.c { text-align: center; font-weight: 700; color: #152335; }
ul, ol { padding-inline-start: 24px; margin: 0 0 8px; } li { margin-bottom: 3px; } li::marker { color: #A3836B; font-weight: 700; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 12pt; table-layout: fixed; break-inside: auto; } tr { break-inside: avoid; }
td, th { border: 1px solid #cfc6bd; padding: 3px 9px; text-align: start; } th { background: #F1EBE5; }
table.plain td { border: 0; text-align: center; padding: 2px 8px; } table.plain tr:first-child td { font-weight: 700; color: #152335; }
table.plain { break-inside: avoid; margin-top: 18px; }
hr { border: 0; border-top: 1px solid #d8cfc6; margin: 12px 0; }
mark { background: none; color: inherit; }
.ft { border-top: 1px solid #e5ddd5; margin-top: 14px; padding-top: 6px; font: 8.5pt "IBM Plex Sans Arabic", sans-serif; color: #6b7280; text-align: center; }`;
function printHtml(title, body, paperKey = "plain", paperImg = null) {
  const f = S.firm; const pp = paperImg ? paperOf(paperKey) : null;
  const dir = docDir(body);
  const brandCss = FONT_FACE_CSS ? `${FONT_FACE_CSS}body,.ft{font-family:"${BRAND_FAMILY}","Noto Naskh Arabic",serif!important}` : "";
  // On stationery the page has no printed margin except a thin strip at the bottom for the page number; the image is
  // fixed to each page and repeating table header/footer rows keep the text clear of the letterhead.
  if (pp) return `<!doctype html><html lang="${dir === "ltr" ? "en" : "ar"}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=block">
<style>${PRINT_CSS}${dir === "ltr" ? 'body{direction:ltr;font-family:Georgia,"Times New Roman",serif;font-size:12pt}' : ""}${brandCss}
@page { size: A4; margin: 0 0 8mm 0; @bottom-center { content: "صفحة " counter(page) " من " counter(pages); font: 8pt sans-serif; color: #9aa0a8; vertical-align: top; } }
.bg { position: fixed; top: 0; left: 0; width: 210mm; height: 289mm; overflow: hidden; z-index: -1; } .bg img { width: 210mm; height: 297mm; display: block; }
table.page > * > tr > td { padding: 0 ${pp.side}mm; } table.page > thead td { height: ${pp.top}mm; } table.page > tfoot td { height: ${Math.max(0, pp.bottom - 8)}mm; }</style></head>
<body><div class="bg"><img src="${paperImg}" alt=""></div><table class="page"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot>
<tbody><tr><td>${blocksHtml(parseBlocks(body))}</td></tr></tbody></table></body></html>`;
  return `<!doctype html><html lang="${dir === "ltr" ? "en" : "ar"}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&family=Noto+Naskh+Arabic:wght@400;600;700&display=block">
<style>${PRINT_CSS}${dir === "ltr" ? 'body{direction:ltr;font-family:Georgia,"Times New Roman",serif;font-size:12pt}' : ""}${brandCss}</style></head><body><table class="page">
<thead><tr><td><div class="lh"><img class="w" src="${LOGO.textLight}" alt=""><img class="m" src="${LOGO.iconLight}" alt=""></div></td></tr></thead>
<tfoot><tr><td><div class="ft">${esc([f.nameAr, f.cr ? "س.ت " + f.cr : "", f.address || f.city, f.phone, f.email, f.website].filter(Boolean).join("  |  "))}</div></td></tr></tfoot>
<tbody><tr><td>${blocksHtml(parseBlocks(body))}</td></tr></tbody></table></body></html>`;
}
async function exportPdf(title, body, paperKey = "official") {
  const img = await paperData(paperKey);
  document.getElementById("pdf-frame")?.remove();
  const fr = document.createElement("iframe");
  fr.id = "pdf-frame"; fr.title = "PDF"; fr.setAttribute("aria-hidden", "true");
  fr.style.cssText = "position:fixed;width:0;height:0;border:0;inset-inline-start:-9999px;bottom:0";
  document.body.appendChild(fr);
  const doc = fr.contentDocument; doc.open(); doc.write(printHtml(title, body, paperKey, img)); doc.close();
  // Wait for the fonts and letterhead images, otherwise the first print falls back to system fonts.
  await new Promise((r) => (doc.readyState === "complete" ? r() : fr.contentWindow.addEventListener("load", r, { once: true })));
  try { await Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 3500))]); } catch {}
  const prev = document.title; document.title = title; // Safari names the PDF after the top page
  fr.contentWindow.focus(); fr.contentWindow.print();
  setTimeout(() => { document.title = prev; }, 1500);
}
A.exportPdf = async (el) => {
  const d = byId(S.data.docs, el.dataset.id);
  const title = ($("#doc-title")?.value || d?.title || "مستند").trim(); const body = $("#doc-body")?.value ?? d?.body ?? "";
  el.disabled = true; toast("يُجهَّز الملف… اختر «حفظ بصيغة PDF» من نافذة الطباعة");
  try { await exportPdf(title, body, $("#doc-paper")?.value || d?.paper || "official"); } catch (e) { console.error(e); toast("تعذّر تجهيز PDF.", true); } finally { el.disabled = false; }
};
