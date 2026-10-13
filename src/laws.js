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
async function lawContext(query, k = 8) {
  const L = LAWS(); if (!L || !query) return "";
  try {
    const rows = await L.search(String(query).slice(0, 2500), k);
    if (!rows.length) return "";
    return `\nالمواد النظامية ذات الصلة من المكتبة النظامية للمكتب (نصوص رسمية بآخر تعديل مسجل فيها):
${rows.map((r) => `• ${r.law_name} — ${r.article}: ${String(r.body).slice(0, 1400)}`).join("\n")}
عند الإحالة استند إلى هذه النصوص واذكر اسم النظام ورقم المادة كما وردا فيها. لا تنسب إلى مادة نصًا لم يرد هنا؛ وما احتجت إليه من غيرها فاكتب بجانبه (يُتحقق من رقم المادة).\n`;
  } catch (e) { console.warn("law search", e); return ""; }
}

VIEWS.laws = () => {
  const L = LAWS();
  if (!L) return `<div class="page-head"><div><h1>المكتبة النظامية</h1></div></div><div class="card">${emptyBox("scale", "المكتبة متاحة في نسخة المنصة المستقلة", "افتحها من رابط GitHub Pages الخاص بالمكتب.")}</div>`;
  if (!S.lawList && !S.lawLoading) { S.lawLoading = true; L.list().then((x) => { S.lawList = x; }).catch(() => { S.lawList = []; toast("تعذّر تحميل المكتبة", true); }).finally(() => { S.lawLoading = false; render(); }); }
  const list = S.lawList || []; const total = list.reduce((s, l) => s + (l.articles || 0), 0);
  const res = S.lawResults;
  return `<div class="page-head"><div><h1>المكتبة النظامية</h1><p>${list.length} نظامًا · ${total} مادة. يقرأ المساعد منها المواد ذات الصلة قبل أن يحلل أو يصوغ.</p></div>
    <button class="btn gold" data-act="addLaw">${icon("plus")}إضافة نظام أو تحديثه</button></div>
  <form class="row" data-form="lawSearch"><input id="law-q" class="inp grow" name="q" value="${esc(S.lawQ || "")}" placeholder="ابحث في المواد: مهلة الاعتراض، الاختصاص المكاني، مكافأة نهاية الخدمة…" style="min-width:220px"><button class="btn primary" type="submit">${icon("search")}بحث</button>${res ? `<button class="btn ghost" type="button" data-act="lawClear">مسح</button>` : ""}</form>
  ${res ? `<div class="card"><div class="card-h"><h3>نتائج «${esc(S.lawQ)}»</h3><span class="sub num">${res.length}</span></div>${res.length ? `<div class="list">${res.map((r) => `<div class="li" style="align-items:flex-start"><div class="body"><div class="ttl">${esc(r.law_name)} — ${esc(r.article)}</div><div class="prose small" style="margin-top:4px">${esc(r.body)}</div></div></div>`).join("")}</div>` : emptyBox("search", "لا توجد مواد مطابقة", "جرّب كلمات أخرى أو أضف النظام المعني إلى المكتبة.")}</div>` : ""}
  ${S.lawView ? lawArticlesCard() : ""}
  ${S.lawLoading && !S.lawList ? `<div class="thinking">جارٍ التحميل…</div>` : list.length ? `<div class="tbl-wrap"><table class="tbl resp"><thead><tr><th>النظام</th><th>المواد</th><th>الإصدار</th><th>آخر تعديل مسجل</th><th></th></tr></thead><tbody>
    ${list.map((l) => `<tr data-act="lawOpen" data-id="${esc(l.slug)}"><td class="primary-cell"><div class="t">${esc(l.name)}</div>${l.source_url ? `<div class="ref"><a href="${esc(l.source_url)}" target="_blank" rel="noopener" data-noact="1">المصدر الرسمي</a></div>` : ""}</td><td data-label="المواد" class="num">${l.articles}</td><td data-label="الإصدار">${esc(l.issued || "—")}</td><td data-label="آخر تعديل">${esc(l.updated || "—")}</td>
      <td data-noact="1"><div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm ghost" data-act="addLaw" data-id="${esc(l.slug)}" title="تحديث النص">${icon("edit")}</button><button class="btn sm ghost danger" data-act="lawRemove" data-id="${esc(l.slug)}" title="حذف">${icon("trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`
    : `<div class="card">${emptyBox("scale", "المكتبة فارغة", "أضف الأنظمة التي يعمل بها المكتب من مصدرها الرسمي (هيئة الخبراء بمجلس الوزراء: laws.boe.gov.sa)، ملف PDF أو Word أو نصًا ملصوقًا.", `<button class="btn gold" data-act="addLaw">${icon("plus")}إضافة نظام</button>`)}</div>`}`;
};
function lawArticlesCard() {
  const v = S.lawView;
  return `<div class="card"><div class="card-h"><h3>${esc(v.name)}</h3><button class="btn sm ghost" data-act="lawClose">${icon("x")}إغلاق</button></div>
    ${v.rows ? `<div class="list">${v.rows.map((a) => `<div class="li" style="align-items:flex-start"><div class="body"><div class="ttl">${esc(a.article)}</div><div class="prose small">${esc(a.body)}</div></div></div>`).join("")}</div>` : `<div class="thinking">جارٍ التحميل…</div>`}</div>`;
}
F.lawSearch = async (d) => { S.lawQ = d.q.trim(); if (!S.lawQ) return; S.lawResults = null; try { S.lawResults = await LAWS().search(S.lawQ, 20); } catch { toast("تعذّر البحث", true); } render(); };
A.lawClear = () => { S.lawQ = ""; S.lawResults = null; render(); };
A.lawOpen = async (el) => { const l = (S.lawList || []).find((x) => x.slug === el.dataset.id); if (!l) return; S.lawView = { name: l.name, rows: null }; render(); try { S.lawView.rows = await LAWS().articles(l.slug); } catch { toast("تعذّر تحميل المواد", true); } render(); };
A.lawClose = () => { S.lawView = null; render(); };
A.lawRemove = (el) => confirmBox("حذف النظام من المكتبة", "ستُحذف مواده من المكتبة، ولن يستند إليها المساعد بعد الآن.", "حذف", async () => { await LAWS().remove(el.dataset.id); S.lawList = null; S.lawView = null; toast("حُذف"); render(); }, true);

A.addLaw = (el) => {
  const l = (S.lawList || []).find((x) => x.slug === el.dataset.id) || {};
  S.lawDraft = { text: "" };
  modal(l.slug ? "تحديث نص النظام" : "إضافة نظام إلى المكتبة", `<form id="law-form" data-form="saveLaw" class="stack" style="gap:12px"><input type="hidden" name="slug" value="${esc(l.slug || "")}">
    <div class="field"><label for="lw-name" class="req">اسم النظام</label><input id="lw-name" class="inp" name="name" required value="${esc(l.name || "")}" placeholder="مثال: نظام المرافعات الشرعية"></div>
    <div class="grid2"><div class="field"><label for="lw-iss">تاريخ الإصدار / المرسوم</label><input id="lw-iss" class="inp" name="issued" value="${esc(l.issued || "")}" placeholder="م/1 بتاريخ 22/1/1435هـ"></div>
      <div class="field"><label for="lw-upd">آخر تعديل مضمّن</label><input id="lw-upd" class="inp" name="updated" value="${esc(l.updated || "")}" placeholder="تاريخ آخر تعديل في النص"></div></div>
    <div class="field"><label for="lw-src">رابط المصدر الرسمي</label><input id="lw-src" class="inp" name="source_url" dir="ltr" value="${esc(l.source_url || "")}" placeholder="https://laws.boe.gov.sa/..."></div>
    <div class="field"><label for="lw-file">ملف النص (PDF أو Word أو نص)</label><input id="lw-file" class="inp" type="file" accept=".pdf,.docx,.txt" data-ch="lawFile"></div>
    <div class="field"><label for="lw-text">أو الصق النص كاملًا</label><textarea id="lw-text" class="inp" name="text" rows="8" data-ch="lawText" placeholder="المادة الأولى: …&#10;المادة الثانية: …"></textarea></div>
    <div id="lw-preview" class="small muted">${l.slug ? "النص الجديد يستبدل مواد هذا النظام كلها." : "تُقسَّم المواد تلقائيًا عند كل سطر يبدأ بـ «المادة»."}</div></form>`,
    `<button class="btn primary" type="submit" form="law-form">حفظ في المكتبة</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`, true);
};
function lawPreview() {
  const t = $("#lw-text")?.value || S.lawDraft?.text || ""; const arts = splitArticles(t); const box = $("#lw-preview"); if (!box) return arts;
  box.innerHTML = arts.length ? `<span class="pill ok">${arts.length} مادة</span> أولها: <b>${esc(arts[0].article)}</b> — آخرها: <b>${esc(arts[arts.length - 1].article)}</b>` : t ? `<span class="pill warn">لم أجد مواد</span> تأكد أن كل مادة تبدأ بسطر «المادة …».` : "";
  return arts;
}
CH.lawText = () => { S.lawDraft = { text: $("#lw-text").value }; lawPreview(); };
CH.lawFile = async (el) => {
  const f = el.files[0]; if (!f) return; const box = $("#lw-preview"); if (box) box.innerHTML = '<span class="thinking">يقرأ الملف…</span>';
  try { const { text } = await extractText(f); $("#lw-text").value = text; S.lawDraft = { text }; lawPreview(); }
  catch (e) { console.warn(e); if (box) box.textContent = "تعذّرت قراءة الملف. الصق النص بدلًا منه."; }
};
F.saveLaw = async (d) => {
  const arts = splitArticles(d.text || "");
  if (!arts.length) return toast("لم أجد مواد في النص. تأكد أن كل مادة تبدأ بسطر «المادة …».", true);
  const name = d.name.trim(); const slug = d.slug || slugify(name);
  try { await LAWS().save({ slug, name, source_url: d.source_url.trim(), issued: d.issued.trim(), updated: d.updated.trim() }, arts); }
  catch (e) { console.error(e); return toast("تعذّر الحفظ: " + (e.message || ""), true); }
  closeModal(); S.lawList = null; toast(`حُفظ «${name}»: ${arts.length} مادة`); render();
};
