/* ============ Rakz — tax invoices and credit notes (ZATCA e-invoicing, generation phase) ============
   A claim (مطالبة) becomes a tax invoice once a manager issues it: it takes the next sequential number, the issue
   date and time, frozen seller/buyer data, and the QR code required by ZATCA (TLV: seller name, VAT number,
   timestamp, total with VAT, VAT amount — base64). Standard invoice when the client is a VAT-registered business,
   simplified otherwise. Issued invoices are immutable (database trigger guard_tax); corrections go through a
   credit note that reverses the amounts and its journal entry. Integration with the Fatoora platform (phase two:
   UBL XML, cryptographic stamp, reporting/clearance) needs the firm's onboarding with ZATCA and is not done here. */

const QRLIB = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
const VAT_RE = /^3\d{13}3$/;
const vatOk = (v) => VAT_RE.test(String(v || "").replace(/\s/g, ""));

/* ZATCA QR payload: tag–length–value, UTF-8, base64. */
function zatcaTlv({ seller, vat, time, total, tax }) {
  const enc = new TextEncoder(); const parts = [];
  [seller, vat, time, Number(total).toFixed(2), Number(tax).toFixed(2)].forEach((v, i) => { const b = enc.encode(String(v)); parts.push(i + 1, b.length, ...b); });
  let bin = ""; for (const x of parts) bin += String.fromCharCode(x); return btoa(bin);
}
/* QR image (PNG data URL) drawn on a canvas; "" until the QR library is loaded. */
const QR_CACHE = {};
function qrPng(data, size = 6) {
  if (QR_CACHE[data]) return QR_CACHE[data];
  if (!window.qrcode) { loadScript(QRLIB).then(() => { if (typeof livePreview === "function") livePreview(); }).catch(() => {}); return ""; }
  const qr = window.qrcode(0, "M"); qr.addData(data); qr.make();
  const n = qr.getModuleCount(), q = 4, cv = document.createElement("canvas"); cv.width = cv.height = (n + q * 2) * size;
  const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + q) * size, (r + q) * size, size, size);
  return (QR_CACHE[data] = cv.toDataURL("image/png"));
}
const ensureQr = () => (window.qrcode ? Promise.resolve() : loadScript(QRLIB));

function taxSeq(prefix) { const y = new Date().getFullYear(); const n = S.data.finance.filter((f) => (f.tax?.no || "").startsWith(`${prefix}-${y}-`)).length + 1; return `${prefix}-${y}-${String(n).padStart(5, "0")}`; }
const fmtTime = (iso) => new Date(iso).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: false });

function taxMarkup(rec, credit = false) {
  const t = rec.tax; const s = t.seller, b = t.buyer; const std = t.kind === "standard";
  const head = credit ? (std ? "إشعار دائن ضريبي" : "إشعار دائن ضريبي مبسط") : std ? "فاتورة ضريبية" : "فاتورة ضريبية مبسطة";
  const en = credit ? "Tax Credit Note" : std ? "Tax Invoice" : "Simplified Tax Invoice";
  const L = t.lines.map((l) => `| ${l.desc} | ${l.qty} | ${money(l.unit)} | ${money(l.net)} | ${l.rate}% | ${money(l.vat)} | ${money(l.total)} |`).join("\n");
  return `# ${head} — ${en}
| البيان | التفاصيل |
| رقم ${credit ? "الإشعار" : "الفاتورة"} | ${t.no} |
| تاريخ الإصدار | ${fmtDate(t.issuedAt.slice(0, 10))} الموافق ${fmtHijri(t.issuedAt.slice(0, 10))} — الساعة ${fmtTime(t.issuedAt)} |${credit ? `\n| الفاتورة الأصلية | ${t.ref} بتاريخ ${fmtDate(t.refDate)} |\n| سبب الإشعار | ${t.reason} |` : ""}${rec.caseId && caseById(rec.caseId) ? `\n| المرجع | ${caseById(rec.caseId).title} |` : ""}
## البائع
| البيان | التفاصيل |
| الاسم | ${s.name} |
| الرقم الضريبي | ${s.vat} |
| السجل التجاري | ${s.cr || "—"} |
| العنوان | ${s.address || "—"} |
## المشتري
| البيان | التفاصيل |
| الاسم | ${b.name} |${std ? `\n| الرقم الضريبي | ${b.vat} |` : ""}${b.idNo ? `\n| ${b.kind === "company" ? "السجل التجاري" : "رقم الهوية"} | ${b.idNo} |` : ""}${b.address ? `\n| العنوان | ${b.address} |` : ""}
## التفاصيل
| البيان | الكمية | سعر الوحدة | المبلغ الخاضع للضريبة | نسبة الضريبة | مبلغ الضريبة | الإجمالي شامل الضريبة |
${L}
## الإجمالي
| البيان | المبلغ (ر.س) |
| الإجمالي غير شامل ضريبة القيمة المضافة | ${money(t.net)} |
| مجموع ضريبة القيمة المضافة | ${money(t.vat)} |
| ${credit ? "إجمالي الإشعار" : "الإجمالي المستحق"} شامل الضريبة | ${money(t.total)} |
@qr ${t.qr}
> ${credit ? "يخفض هذا الإشعار المبلغ المستحق في الفاتورة الأصلية بقيمته." : s.iban ? `السداد بالتحويل إلى حساب ${s.name} — الآيبان: ${s.iban}` : "شكرًا لتعاملكم معنا."}`;
}
function sellerSnap() { const f = S.firm; return { name: f.nameAr, vat: String(f.vat || "").replace(/\s/g, ""), cr: f.cr || "", address: f.address || f.city || "", iban: f.iban || "" }; }
function buyerSnap(cl) { return { name: cl.name || "", vat: String(cl.vatNo || "").replace(/\s/g, ""), idNo: cl.idNo || "", kind: cl.kind || "individual", address: cl.address || "" }; }

/* ---------- issue a tax invoice from a claim ---------- */
A.issueTax = (el) => {
  if (!isManager()) return toast("إصدار الفواتير من صلاحية المدير.", true);
  const x = byId(S.data.finance, el.dataset.id); if (!x || x.tax) return;
  const cl = byId(S.data.clients, x.clientId) || {};
  if (!vatOk(S.firm.vat)) return confirmBox("الرقم الضريبي للمكتب مطلوب", "لا تُصدر فاتورة ضريبية دون رقم ضريبي صحيح للمكتب (15 رقمًا يبدأ وينتهي بالرقم 3). أضفه في الإعدادات ← بيانات المكتب.", "فتح الإعدادات", () => go("settings"));
  if (!S.firm.address) return toast("أضف عنوان المكتب في الإعدادات أولًا.", true);
  const std = cl.kind === "company" && vatOk(cl.vatNo);
  modal("إصدار فاتورة ضريبية", `<div class="stack" style="gap:12px">
    <div class="banner ${std ? "" : "gold"}"><div class="grow"><b>${std ? "فاتورة ضريبية (قياسية)" : "فاتورة ضريبية مبسطة"}</b><div class="small">${std ? "العميل منشأة مسجلة في ضريبة القيمة المضافة، فتصدر فاتورة قياسية بالرقم الضريبي للمشتري." : cl.kind === "company" ? "العميل منشأة دون رقم ضريبي مسجل لديه، فتصدر مبسطة. لإصدار قياسية أضف رقمه الضريبي في بيانات العميل." : "العميل فرد، فتصدر فاتورة مبسطة."}</div></div></div>
    <div class="facts"><div class="fact"><div class="k">الرقم</div><div class="v num">${taxSeq("RK-TI")}</div></div><div class="fact"><div class="k">المشتري</div><div class="v">${esc(cl.name || "—")}</div></div>
      <div class="fact"><div class="k">غير شامل الضريبة</div><div class="v num">${money(x.amount)}</div></div><div class="fact"><div class="k">الضريبة (${x.vat || 0}%)</div><div class="v num">${money(x.vatAmount || 0)}</div></div><div class="fact"><div class="k">الإجمالي</div><div class="v num"><b>${money(x.total)}</b></div></div></div>
    <p class="small muted" style="margin:0">بعد الإصدار لا تُعدَّل الفاتورة ولا تُحذف، والتصحيح يكون بإشعار دائن. يُسجَّل تاريخ الإصدار ووقته الآن ويُولَّد رمز الاستجابة السريعة المطلوب من هيئة الزكاة والضريبة والجمارك.</p></div>`,
    `<button class="btn gold" data-act="issueTaxGo" data-id="${x.id}">${icon("receipt")}إصدار الفاتورة</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
};
A.issueTaxGo = async (el) => {
  const x = byId(S.data.finance, el.dataset.id); if (!x || x.tax) return closeModal();
  el.disabled = true;
  try {
    await ensureQr();
    const cl = byId(S.data.clients, x.clientId) || {}; const std = cl.kind === "company" && vatOk(cl.vatNo);
    const net = r2(x.amount), vat = r2(x.vatAmount || 0), total = r2(x.total); const rate = Number(x.vat) || 0;
    const issuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const seller = sellerSnap(); const no = taxSeq("RK-TI");
    const tax = { no, kind: std ? "standard" : "simplified", issuedAt, uuid: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), seller, buyer: buyerSnap(cl), net, vat, total,
      lines: [{ desc: x.desc || "أتعاب خدمات قانونية", qty: 1, unit: net, net, rate, vat, total }], qr: zatcaTlv({ seller: seller.name, vat: seller.vat, time: issuedAt, total, tax: vat }) };
    await upd(`finance/${x.id}`, { tax });
    const rec = { ...x, tax };
    const id = await add("docs", { kind: "invoice", subtype: "tax", locked: true, finId: x.id, title: `${std ? "فاتورة ضريبية" : "فاتورة ضريبية مبسطة"} ${no} — ${cl.name || ""}`, caseId: x.caseId || "", clientId: x.clientId || "", body: taxMarkup(rec), status: "final", paper: "official", updatedAt: nowIso() });
    if (x.caseId) await logCase(x.caseId, "note", `صدرت فاتورة ضريبية ${no} بمبلغ ${money(total)} ر.س`);
    closeModal(); toast(`صدرت الفاتورة ${no}`); go("doc", id);
  } catch (e) { el.disabled = false; if (!/tax_invoice_immutable/.test(e?.message || "")) { console.error(e); toast("تعذّر إصدار الفاتورة: " + (e.message || ""), true); } }
};
A.openTax = (el) => { const d = S.data.docs.find((x) => x.finId === el.dataset.id && (x.subtype === "tax" || x.subtype === "credit")); if (d) go("doc", d.id); else toast("مستند الفاتورة غير موجود؛ أعد توليده من «إعادة إنشاء المستند».", true); };
A.regenTax = async (el) => {
  const x = byId(S.data.finance, el.dataset.id); if (!x?.tax) return;
  const credit = x.type === "credit"; const cl = byId(S.data.clients, x.clientId) || {};
  const id = await add("docs", { kind: "invoice", subtype: credit ? "credit" : "tax", locked: true, finId: x.id, title: `${credit ? "إشعار دائن" : "فاتورة ضريبية"} ${x.tax.no} — ${cl.name || ""}`, caseId: x.caseId || "", clientId: x.clientId || "", body: taxMarkup(x, credit), status: "final", paper: "official", updatedAt: nowIso() });
  go("doc", id);
};

/* ---------- credit note ---------- */
const credited = (inv) => r2(S.data.finance.filter((f) => f.type === "credit" && f.invoiceId === inv.id).reduce((s, f) => s + num(f.total), 0));
A.issueCredit = (el) => {
  const x = byId(S.data.finance, el.dataset.id); if (!x?.tax) return;
  const max = r2(num(x.total) - credited(x));
  if (max <= 0) return toast("رُدّت قيمة هذه الفاتورة كاملة بإشعارات سابقة.", true);
  modal(`إشعار دائن على الفاتورة ${x.tax.no}`, `<form id="cn-form" data-form="issueCredit" class="grid2"><input type="hidden" name="id" value="${x.id}">
    <div class="field"><label for="cn-amt" class="req">قيمة الإشعار شاملة الضريبة (ر.س)</label><input id="cn-amt" class="inp num" name="total" inputmode="decimal" required value="${max}"><span class="hint">الحد الأقصى ${money(max)}</span></div>
    <div class="field"><label for="cn-why" class="req">سبب الإشعار</label><select id="cn-why" class="inp" name="reason">${["إلغاء الخدمة أو جزء منها", "خصم لاحق متفق عليه", "تصحيح خطأ في الفاتورة", "إعادة مبلغ للعميل"].map((r) => opt(r, r, "")).join("")}</select></div>
    <p class="small muted span2" style="margin:0">يصدر إشعار دائن ضريبي برقم مستقل ورمز استجابة سريعة، ويُرحَّل قيد عكسي للإيراد والضريبة وذمة العميل. الفاتورة الأصلية لا تتغير.</p></form>`,
    `<button class="btn gold" type="submit" form="cn-form">${icon("receipt")}إصدار الإشعار</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
};
F.issueCredit = async (d) => {
  const x = byId(S.data.finance, d.id); if (!x?.tax) return;
  const max = r2(num(x.total) - credited(x)); const total = r2(Math.min(num(d.total), max)); if (total <= 0) return toast("أدخل مبلغًا صحيحًا.", true);
  try {
    await ensureQr();
    const rate = Number(x.vat) || 0; const net = r2(total / (1 + rate / 100)); const vat = r2(total - net);
    const issuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); const seller = sellerSnap(); const no = taxSeq("RK-CN");
    const tax = { no, kind: x.tax.kind, issuedAt, ref: x.tax.no, refDate: x.tax.issuedAt.slice(0, 10), reason: d.reason, seller, buyer: x.tax.buyer, net, vat, total,
      lines: [{ desc: `${d.reason} — الفاتورة ${x.tax.no}`, qty: 1, unit: net, net, rate, vat, total }], qr: zatcaTlv({ seller: seller.name, vat: seller.vat, time: issuedAt, total, tax: vat }) };
    const rec = { type: "credit", invoiceId: x.id, clientId: x.clientId, caseId: x.caseId || "", consultId: x.consultId || "", desc: d.reason, amount: net, vat: x.vat, vatAmount: vat, total, date: todayStr(), tax };
    const fid = await add("finance", rec);
    await syncJournal("credit", fid, rec, `إشعار دائن ${no} على الفاتورة ${x.tax.no} — ${clientName(x.clientId)}`);
    const id = await add("docs", { kind: "invoice", subtype: "credit", locked: true, finId: fid, title: `إشعار دائن ${no} — ${clientName(x.clientId)}`, caseId: x.caseId || "", clientId: x.clientId || "", body: taxMarkup(rec, true), status: "final", paper: "official", updatedAt: nowIso() });
    if (x.caseId) await logCase(x.caseId, "note", `صدر إشعار دائن ${no} بمبلغ ${money(total)} ر.س على الفاتورة ${x.tax.no}`);
    closeModal(); toast(`صدر الإشعار ${no}`); go("doc", id);
  } catch (e) { console.error(e); toast("تعذّر إصدار الإشعار: " + (e.message || ""), true); }
};
const creditTable = () => { const rows = S.data.finance.filter((f) => f.type === "credit").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return rows.length ? `<div class="card"><div class="card-h"><h3>الإشعارات الدائنة</h3><span class="sub num">${rows.length}</span></div><div class="tbl-wrap"><table class="tbl resp"><thead><tr><th>الإشعار</th><th>العميل</th><th>المبلغ</th><th>السبب</th><th></th></tr></thead><tbody>${rows.map((x) => `<tr><td class="primary-cell"><div class="t num">${esc(x.tax?.no || "")}</div><div class="ref">على ${esc(byId(S.data.finance, x.invoiceId)?.tax?.no || "")} · ${fmtDate(x.date)}</div></td><td data-label="العميل">${esc(clientName(x.clientId))}</td><td data-label="المبلغ" class="num">${money(x.total)}</td><td data-label="السبب">${esc(x.desc || "")}</td><td data-noact="1"><button class="btn sm ghost" data-act="openTax" data-id="${x.id}">${icon("docs")}</button></td></tr>`).join("")}</tbody></table></div></div>` : ""; };
