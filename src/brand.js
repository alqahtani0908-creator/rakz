/* ============ Rakz — brand: the firm's typeface and official stationery ============
   Typeface: Thmanyah Serif Text. Its licence forbids hosting the font files on any public site or server, so the
   files are uploaded once by a manager into the platform's private storage («brand/», members only) and loaded
   into the browser with the FontFace API after sign-in; documents carry the font inside their PDF.
   Stationery: the official and internal letterheads (docs/paper/*.jpg, rendered from the firm's PDFs) are laid
   behind every page of the PDF and Word output, exactly as designed. */

const BRAND_FAMILY = "Thmanyah Serif"; // CSS family registered from the uploaded files
const BRAND_WORD_FONT = "thmanyah serif text"; // the family name inside the font files, used by Word
const PAPERS = {
  official: { label: "الورق الرسمي", img: "paper/official.jpg", top: 40, bottom: 36, side: 18 },
  internal: { label: "ورق الاستخدام الداخلي", img: "paper/internal.jpg", top: 46, bottom: 30, side: 18 },
  plain: { label: "ترويسة مبسطة", img: null },
};
const paperOf = (k) => PAPERS[k] || PAPERS.official;
/* The paper image as a data URL (cached). Null when unavailable (e.g. inside the Claude artifact). */
const PAPER_CACHE = {};
async function paperData(k) {
  const p = paperOf(k); if (!p.img) return null;
  if (PAPER_CACHE[k] !== undefined) return PAPER_CACHE[k];
  try {
    const r = await fetch(p.img, { cache: "force-cache" }); if (!r.ok) throw new Error(r.status);
    const b = await r.blob(); PAPER_CACHE[k] = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
  } catch { PAPER_CACHE[k] = null; }
  return PAPER_CACHE[k];
}

/* ---------- fonts ---------- */
const WEIGHTS = [["thin", 100], ["extralight", 200], ["light", 300], ["regular", 400], ["book", 400], ["medium", 500], ["semibold", 600], ["bold", 700], ["extrabold", 800], ["black", 900], ["heavy", 900]];
const weightOf = (name) => { const n = name.toLowerCase().replace(/[^a-z]/g, ""); for (const [k, w] of [...WEIGHTS].sort((a, b) => b[0].length - a[0].length)) if (n.includes(k)) return w; return 400; };
let FONT_FACE_CSS = ""; // @font-face rules with blob: URLs, reused inside the PDF frame
let fontsLoadedFor = "";
async function loadBrandFonts() {
  const fonts = S.brand?.fonts || []; const key = fonts.map((f) => f.assetId).join(",");
  if (!fonts.length || key === fontsLoadedFor || !S.caps.assets?.signedUrl) return;
  fontsLoadedFor = key; let css = "";
  let cache = null; try { cache = await caches.open("rakz-brand"); } catch {}
  for (const f of fonts) {
    try {
      const ck = "/brand-font/" + f.assetId; let buf = null;
      if (cache) { const hit = await cache.match(ck); if (hit) buf = await hit.arrayBuffer(); }
      if (!buf) { const r = await fetch(await S.caps.assets.signedUrl(f.assetId)); if (!r.ok) throw new Error(r.status); buf = await r.arrayBuffer(); if (cache) try { await cache.put(ck, new Response(buf.slice(0))); } catch {} }
      const face = new FontFace(BRAND_FAMILY, buf, { weight: String(f.weight || 400), style: "normal", display: "swap" });
      await face.load(); document.fonts.add(face);
      css += `@font-face{font-family:"${BRAND_FAMILY}";src:url(${URL.createObjectURL(new Blob([buf], { type: "font/otf" }))}) format("opentype");font-weight:${f.weight || 400};font-style:normal}`;
    } catch (e) { console.warn("brand font", f.name, e); }
  }
  FONT_FACE_CSS = css; document.documentElement.classList.toggle("brand-font", !!css);
}

function brandCard() {
  const ro = !isManager(); const fonts = S.brand?.fonts || [];
  return `<div class="card"><div class="card-h"><h3>الهوية: الخط والورق</h3>${fonts.length ? pill(`${fonts.length} أوزان مفعّلة`, "ok") : pill("الخط غير مرفوع", "warn")}</div>
    <div class="grid2" style="gap:18px">
      <div class="stack" style="gap:10px"><b>خط الهوية (ثمانية Serif Text)</b>
        <p class="small muted" style="margin:0">يُطبَّق على المنصة كلها وعلى المستندات. ارفع ملفات الخط (OTF) مرة واحدة؛ تُحفظ في التخزين الخاص بالمنصة ولا يصل إليها إلا أعضاء الفريق، التزامًا بترخيص الخط الذي يمنع نشره على موقع عام.</p>
        ${fonts.length ? `<div class="chips">${fonts.sort((a, b) => a.weight - b.weight).map((f) => `<span class="chip" style="font-family:'${BRAND_FAMILY}';font-weight:${f.weight}">${esc(f.name.replace(/\.(otf|ttf|woff2?)$/i, ""))}</span>`).join("")}</div>` : ""}
        ${ro ? "" : `<div class="row"><button class="btn" data-act="brandFontPick">${icon("upload")}${fonts.length ? "استبدال ملفات الخط" : "رفع ملفات الخط"}</button>${S.brandBusy ? `<span class="thinking small">${esc(S.brandBusy)}</span>` : ""}</div>
        <input type="file" id="brand-font-in" multiple hidden accept=".otf,.ttf,.woff,.woff2" data-ch="brandFonts">`}</div>
      <div class="stack" style="gap:10px"><b>الورق</b>
        <p class="small muted" style="margin:0">يُطبع كل مستند على ورق المكتب كما صُمم: الترويسة والعلامة المائية والتذييل في كل صفحة، في PDF وWord. يُختار الورق لكل مستند من المحرر.</p>
        <div class="row" style="gap:10px">${["official", "internal"].map((k) => `<div style="text-align:center"><img src="${PAPERS[k].img}" alt="${PAPERS[k].label}" style="width:110px;border:1px solid var(--line);border-radius:6px;box-shadow:var(--shadow)"><div class="small">${PAPERS[k].label}</div></div>`).join("")}</div></div></div></div>`;
}
A.brandFontPick = () => $("#brand-font-in")?.click();
CH.brandFonts = async (el) => {
  const files = [...el.files].filter((f) => /\.(otf|ttf|woff2?)$/i.test(f.name)); el.value = "";
  if (!files.length) return toast("اختر ملفات خط بصيغة OTF أو TTF.", true);
  if (!S.caps.assets) return toast("رفع الملفات غير متاح.", true);
  try {
    const out = [];
    for (const [i, f] of files.entries()) {
      S.brandBusy = `يرفع ${i + 1}/${files.length}…`; render();
      const r = await S.caps.assets.upload(f, { type: "application/octet-stream", folder: "brand" });
      out.push({ assetId: r.id, name: f.name, weight: weightOf(f.name) });
    }
    const old = S.brand?.fonts || [];
    await put("settings/brand", { ...(S.brand || {}), fonts: out, updatedAt: nowIso() });
    for (const f of old) { try { await S.caps.assets.delete(f.assetId); } catch {} }
    toast(`فُعّل خط الهوية (${out.length} أوزان)`);
  } catch (e) { console.error(e); toast("تعذّر رفع الخط: " + (e.message || e.code || ""), true); }
  finally { S.brandBusy = null; render(); }
};
