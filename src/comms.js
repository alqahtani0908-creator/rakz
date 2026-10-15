/* ============ Rakz — sending to clients (WhatsApp / email / share), payment receipts, consultation documents ============ */

/* ---------- files kept outside a case (receipts, consultation documents) ---------- */
// Same storage shape as case attachments: formats the runtime cannot hold natively (e.g. .docx) ride inside a JSON wrapper.
async function storeFile(file, folder) {
  let blob = file, type = file.type, wrapped = false;
  if (!ASSET_TYPES.includes(type)) {
    const b64 = await blobToB64(file);
    blob = new Blob([JSON.stringify({ name: file.name, type: file.type || "application/octet-stream", b64 })], { type: "application/json" }); type = "application/json"; wrapped = true;
  }
  const res = await S.caps.assets.upload(blob, { type, folder });
  return { assetId: res.id, name: file.name, mime: file.type, size: file.size, wrapped };
}
const fileErr = (e, name) => { const m = { too_large: "الملف أكبر من المسموح", unsupported_type: "نوع الملف غير مدعوم", quota_or_state: "امتلأت مساحة التخزين", not_granted: "لا تملك صلاحية رفع الملفات" }; toast(`${name}: ${m[e?.code] || "تعذّر الرفع"}`, true); console.error(e); };
/* Any stored file by id: a case attachment, a consultation document, or a payment's receipt (looked up by payment id). */
function anyFile(id) {
  const p = byId(S.data.finance, id);
  return byId(S.caseFiles, id) || byId(S.csFiles || [], id) || (p?.receipt ? { id: p.id, ...p.receipt } : null);
}
const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " م.ب" : Math.max(1, Math.round(n / 1024)) + " ك.ب");

/* ---------- payment receipts (stored under finance/, readable by managers only) ---------- */
CH.pmReceipt = (el) => { const f = el.files[0]; if (f && f.size > 20 * 1024 * 1024) { el.value = ""; return toast("الحد الأقصى 20 ميجابايت", true); } S.pmReceipt = f || null; };
async function attachReceipt(data, old) {
  const f = S.pmReceipt; S.pmReceipt = null; if (!f || !S.caps.assets) return;
  data.receipt = clean({ ...(await storeFile(f, "finance")), at: nowIso() });
  if (old?.receipt?.assetId) { try { await S.caps.assets.delete(old.receipt.assetId); } catch (e) { console.warn(e); } }
}
const receiptBtn = (x) => x.receipt ? `<button class="btn sm ghost" data-act="viewFile" data-id="${x.id}" title="الإيصال: ${esc(x.receipt.name)}">${icon("eye")}الإيصال</button>` : "";

/* ---------- consultation documents ---------- */
function subscribeConsult(id) {
  if (S.csFor === id || !S.caps.db) return;
  S.csUnsub?.(); S.csFiles = []; S.csFor = id;
  S.csUnsub = S.caps.db.collection(`consults/${id}/files`).onSnapshot((s) => { S.csFiles = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || "").localeCompare(a.at || "")); scheduleRender(); }, () => {});
}
function consultFilesCard(x) {
  const ups = (S.uploads || []).filter((u) => u.consultId === x.id);
  return `<div class="card"><div class="card-h"><h3>المستندات</h3><button class="btn sm" data-act="csPick">${icon("upload")}رفع مستند</button></div>
    <input type="file" id="cs-file-in" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt" data-ch="csFilesPicked" data-id="${x.id}">
    ${ups.map((u) => `<div class="li"><div class="body"><div class="ttl">${esc(u.name)}</div><div class="thinking small">${esc(u.stage)}</div></div></div>`).join("")}
    ${(S.csFiles || []).length ? `<div class="list">${S.csFiles.map((f) => `<div class="li"><div class="body"><div class="ttl" style="overflow-wrap:anywhere">${esc(f.name)}</div><div class="small muted">${kb(f.size || 0)} · ${fmtWhen(f.at)}${f.text ? " · يقرؤه المساعد" : ""}</div></div>
      <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm ghost" data-act="viewFile" data-id="${f.id}" title="عرض">${icon("eye")}</button><button class="btn sm ghost" data-act="downloadFile" data-id="${f.id}" title="تنزيل">${icon("download")}</button><button class="btn sm ghost danger" data-act="csDelFile" data-id="${f.id}" title="حذف">${icon("trash")}</button></div></div>`).join("")}</div>`
      : ups.length ? "" : `<p class="small muted">أرفق العقد أو المراسلات أو الصكوك محل الاستشارة؛ يقرؤها المساعد عند صياغة الرأي.</p>`}</div>`;
}
A.csPick = () => { if (!guardWrite()) return; if (!S.caps.assets) return toast("رفع الملفات يحتاج صلاحية «محرر» على المنصة.", true); $("#cs-file-in")?.click(); };
CH.csFilesPicked = async (el) => {
  const id = el.dataset.id; const files = [...el.files]; el.value = ""; S.uploads = S.uploads || [];
  for (const file of files) {
    if (file.size > 20 * 1024 * 1024) { toast(`${file.name}: الحد الأقصى 20 ميجابايت`, true); continue; }
    const u = { consultId: id, name: file.name, stage: "جارٍ الرفع…" }; S.uploads.push(u); render();
    try {
      const stored = await storeFile(file, "consults");
      u.stage = "قراءة النص…"; render();
      let text = ""; try { text = (await extractText(file)).text; } catch (e) { console.warn("extract", e); }
      await S.caps.db.collection(`consults/${id}/files`).doc().set(clean({ ...stored, text: text.slice(0, 60000), at: nowIso(), by: myLid() || S.me.id }));
      toast(`أُرفق ${file.name}`);
    } catch (e) { fileErr(e, file.name); }
    finally { S.uploads = S.uploads.filter((x) => x !== u); render(); }
  }
};
A.csDelFile = (el) => confirmBox("حذف المستند", "سيُحذف المستند من ملف الاستشارة نهائيًا.", "حذف", async () => {
  const f = byId(S.csFiles, el.dataset.id); if (!f) return;
  await del(`consults/${S.csFor}/files/${f.id}`);
  try { if (S.caps.assets) await S.caps.assets.delete(f.assetId); } catch (e) { console.warn(e); }
  toast("حُذف المستند");
}, true);
/* Extracted text of the consultation's documents, for the opinion prompt. */
function consultDocsText(x, max = 40000) {
  const fs = S.csFor === x.id ? (S.csFiles || []).filter((f) => f.text) : [];
  if (!fs.length) return "";
  return `\nالمستندات المرفقة بالاستشارة (نصها المستخرج؛ استند إليها في الوقائع وأحِل إليها باسمها):\n"""\n${fs.map((f) => `--- ${f.name} ---\n${f.text.slice(0, 15000)}`).join("\n\n").slice(0, max)}\n"""\n`;
}

/* ---------- sending to the client: WhatsApp, email, or the phone's share sheet ---------- */
const mdPlain = (t) => String(t || "").split("\n").map((l) => l.replace(/^#{1,3}\s+|^>\s?|^!?\|\s?|\s?\|$/g, "").replace(/\s\|\s/g, " — ").replace(/\*\*/g, "").replace(/^---$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
const MAIL_MAX = 1800; // mailto: links get cut off by mail apps beyond roughly 2000 characters
function sendModal(ctx) {
  // ctx: { title, subject, text, phone, email, caseId, record: "docs/id" | "finance/id" | "consults/id", docTitle, docBody, label }
  S.send = ctx; S.sendFile = null;
  if (ctx.docBody) {
    buildDocx(ctx.docTitle, ctx.docBody).then((blob) => { if (S.send === ctx) S.sendFile = new File([blob], safeName(ctx.docTitle) + ".docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }); }).catch((e) => console.warn(e));
  }
  const canShare = !!(navigator.canShare && ctx.docBody);
  modal(ctx.title || "إرسال للعميل", `<div class="stack" style="gap:12px">
    <div class="grid2"><div class="field"><label for="snd-phone">جوال العميل (واتساب)</label><input id="snd-phone" class="inp num" dir="ltr" value="${esc(ctx.phone || "")}" placeholder="05xxxxxxxx"></div>
      <div class="field"><label for="snd-email">البريد الإلكتروني</label><input id="snd-email" class="inp" type="email" dir="ltr" value="${esc(ctx.email || "")}" placeholder="client@example.com"></div></div>
    <div class="field"><label for="snd-subj">الموضوع (للبريد)</label><input id="snd-subj" class="inp" value="${esc(ctx.subject || "")}"></div>
    <div class="field"><label for="snd-text">نص الرسالة</label><textarea id="snd-text" class="inp" rows="11">${esc(ctx.text || "")}</textarea>
      <span class="hint">${ctx.docBody ? `لإرسال المستند نفسه: ${canShare ? "«مشاركة ملف Word» تفتح قائمة المشاركة في الجوال (واتساب، البريد…) والملف مرفق، أو " : ""}نزّل ملف Word وأرفقه في المحادثة أو البريد.` : "يُفتح واتساب أو تطبيق البريد والرسالة جاهزة، ويُسجَّل الإرسال في ملف القضية."}</span></div></div>`,
    `<button class="btn primary" data-act="sendVia" data-ch="wa" style="background:#1F8F55;border-color:#1F8F55">${icon("wa")}واتساب</button>
     <button class="btn" data-act="sendVia" data-ch="mail">${icon("mail")}بريد إلكتروني</button>
     ${canShare ? `<button class="btn gold" data-act="sendVia" data-ch="share">${icon("send")}مشاركة ملف Word</button>` : ""}
     ${ctx.docBody ? `<button class="btn ghost" data-act="sendVia" data-ch="file">${icon("download")}تنزيل Word</button>` : ""}
     <button class="btn ghost" data-act="closeModal">إغلاق</button>`, true);
}
const safeName = (t) => String(t || "مستند").replace(/[\\/:*?"<>|]/g, "-").slice(0, 90);
const CH_NAMES = { wa: "واتساب", mail: "البريد الإلكتروني", share: "مشاركة الملف", file: "ملف Word" };
A.sendVia = async (el) => {
  const ctx = S.send; if (!ctx) return; const ch = el.dataset.ch;
  const phone = $("#snd-phone").value.trim(), email = $("#snd-email").value.trim(), subject = $("#snd-subj").value.trim(), text = $("#snd-text").value;
  // Open the target synchronously, while the click still counts as a user gesture.
  if (ch === "wa") {
    if (!waNumber(phone)) return toast("أدخل رقم جوال صحيحًا", true);
    window.open(waHref(phone, text), "_blank", "noopener");
  } else if (ch === "mail") {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("أدخل بريدًا إلكترونيًا صحيحًا", true);
    const body = text.length > MAIL_MAX ? text.slice(0, MAIL_MAX) + "\n…\n(النص كاملًا في الملف المرفق)" : text;
    location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  } else if (ch === "share") {
    if (!S.sendFile) return toast("يُجهَّز الملف… أعد المحاولة بعد لحظة");
    const data = { files: [S.sendFile], title: ctx.docTitle, text: text.slice(0, 1000) };
    if (!navigator.canShare(data)) return toast("المتصفح لا يدعم مشاركة الملفات؛ استخدم «تنزيل Word».", true);
    try { await navigator.share(data); } catch (e) { if (e?.name === "AbortError") return; console.warn(e); return toast("تعذّرت المشاركة", true); }
  } else if (ch === "file") {
    try { const blob = S.sendFile || (await buildDocx(ctx.docTitle, ctx.docBody)); await S.caps.downloads.save({ filename: safeName(ctx.docTitle) + ".docx", data: blob }); toast("جاهز للتنزيل"); }
    catch (e) { if (e?.code !== "declined") toast("تعذّر إنشاء ملف Word.", true); }
    return;
  }
  const to = ch === "wa" ? waNumber(phone) : ch === "mail" ? email : "";
  try {
    if (ctx.record) await upd(ctx.record, { sentAt: nowIso(), sentVia: CH_NAMES[ch], sentTo: to });
    if (ctx.caseId) await logCase(ctx.caseId, "note", `أُرسل ${ctx.label || "مستند"} إلى العميل عبر ${CH_NAMES[ch]}${to ? ` (${to})` : ""}`);
  } catch (e) { console.warn(e); }
  toast(`سُجّل الإرسال عبر ${CH_NAMES[ch]}`);
};
const clientOf = (x) => byId(S.data.clients, x.clientId || caseById(x.caseId)?.clientId) || {};
const signoff = () => `\n\nمع التحية،\n${S.firm.nameAr}${S.firm.phone ? `\n${S.firm.phone}` : ""}`;

/* A financial claim straight from the finance table. */
function invoiceMessage(x) {
  const cl = clientOf(x); const f = S.firm; const paid = invPaid(x); const left = num(x.total) - paid;
  return `السلام عليكم ${cl.name || ""}،
نفيدكم بالمطالبة المالية رقم ${x.no} بتاريخ ${fmtDate(x.date)}:
البيان: ${x.desc}
المبلغ: ${money(x.amount)} ر.س${num(x.vatAmount) ? `\nضريبة القيمة المضافة (${x.vat}%): ${money(x.vatAmount)} ر.س` : ""}
الإجمالي: ${money(x.total)} ر.س${paid ? `\nالمسدد: ${money(paid)} ر.س\nالمتبقي: ${money(left)} ر.س` : ""}${x.due ? `\nتاريخ الاستحقاق: ${fmtDate(x.due)}` : ""}
${f.iban ? `\nطريقة السداد: تحويل إلى حساب ${f.nameAr}${f.bank ? ` لدى ${f.bank}` : ""}\nالآيبان: ${f.iban}` : ""}${f.vat ? `\nالرقم الضريبي: ${f.vat}` : ""}${signoff()}`;
}
A.sendInvoice = (el) => {
  const x = byId(S.data.finance, el.dataset.id); if (!x) return; const cl = clientOf(x);
  const doc = S.data.docs.filter((d) => d.kind === "invoice" && d.finId === x.id).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0];
  sendModal({ title: `إرسال المطالبة ${x.no}`, subject: `مطالبة مالية ${x.no} — ${S.firm.nameAr}`, text: invoiceMessage(x), phone: cl.phone, email: cl.email, caseId: x.caseId,
    record: `finance/${x.id}`, label: `المطالبة المالية ${x.no}`, ...(doc ? { docTitle: doc.title, docBody: doc.body } : {}) });
};
/* Any drafted document (claim, letter, contract, pleading…) from the editor. */
A.sendDoc = (el) => {
  const d = byId(S.data.docs, el.dataset.id); if (!d) return;
  const title = $("#doc-title")?.value.trim() || d.title; const body = $("#doc-body")?.value ?? d.body;
  const cl = clientOf(d); const plain = mdPlain(body);
  const inv = d.finId ? byId(S.data.finance, d.finId) : null;
  const text = inv ? invoiceMessage(inv) : `السلام عليكم ${cl.name || ""}،\nنرفق لكم: ${title}.${plain.length <= 1500 ? `\n\n${plain}` : "\n(المستند في الملف المرفق)"}${signoff()}`;
  sendModal({ title: "إرسال المستند", subject: `${title} — ${S.firm.nameAr}`, text, phone: cl.phone, email: cl.email, caseId: d.caseId, record: `docs/${d.id}`, label: `«${title}»`, docTitle: title, docBody: body });
};
/* A consultation's opinion. */
A.sendConsult = (el) => {
  const x = byId(S.data.consults, el.dataset.id); if (!x) return; const cl = clientOf(x);
  const ans = $("#cs-answer")?.value ?? x.answer ?? "";
  sendModal({ title: "إرسال الرأي القانوني", subject: `رأي قانوني: ${x.subject} — ${S.firm.nameAr}`, text: `السلام عليكم ${cl.name || x.prospect || ""}،\nبخصوص استشارتكم «${x.subject}»:\n\n${mdPlain(ans)}${signoff()}`,
    phone: x.phone || cl.phone, email: x.email || cl.email, caseId: x.caseId, record: `consults/${x.id}`, label: "الرأي القانوني", docTitle: `رأي قانوني — ${x.subject}`, docBody: ans });
};
