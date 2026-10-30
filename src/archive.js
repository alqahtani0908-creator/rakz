/* ============ Rakz — archive & renewal (administrative system) ============
   An archive is a full copy of every record at a moment. «Renewal» archives first, then clears the chosen groups
   so the platform starts a new period; any archive can be downloaded or restored. Team and settings are kept. */
const ARCH_GROUPS = {
  finance: { t: "البيانات المالية", d: "المطالبات والدفعات والمصروفات والقيود والطلبات المالية واقتراحات الأتعاب ومستندات المطالبات، وأتعاب القضايا وإقفالاتها المالية." },
  work: { t: "القضايا والأعمال", d: "القضايا بسجلاتها ومرفقاتها وتقاريرها، والمهام، والاستشارات، والمستندات واللوائح والعقود." },
  clients: { t: "العملاء", d: "بيانات العملاء." },
};
const ARCH_LABEL = { cases: "قضايا", clients: "عملاء", tasks: "مهام", consults: "استشارات", docs: "مستندات", finance: "حركات مالية", journal: "قيود", finreq: "طلبات مالية", fees: "اقتراحات أتعاب", lawyers: "أعضاء", settings: "إعدادات", "cases/log": "إجراءات", "cases/files": "مرفقات", "cases/reports": "تقارير", "consults/files": "مرفقات استشارات" };
const archCounts = (c) => Object.entries(c || {}).filter(([k]) => ARCH_LABEL[k] && !["lawyers", "settings"].includes(k)).map(([k, n]) => `${n} ${ARCH_LABEL[k]}`).join(" · ") || "لا سجلات";
async function loadArchives() { S.archBusy = "load"; try { S.archives = await window.RAKZ_ARCHIVE.list(); } catch (e) { S.archives = []; toast("تعذّر تحميل الأرشيف: " + (e.message || e.code), true); } S.archBusy = null; render(); }

VIEWS.archive = () => {
  if (!isManager()) return noAdmin();
  if (!window.RAKZ_ARCHIVE) return `<div class="card">${emptyBox("box", "الأرشيف متاح في نسخة المنصة على sys.rakzlaw.sa", "")}</div>`;
  if (S.archives === undefined && S.archBusy !== "load") setTimeout(loadArchives);
  const live = (g) => g === "finance" ? S.data.finance.length + S.data.journal.length + (S.data.finreq || []).length + S.data.fees.length + S.data.docs.filter((d) => d.kind === "invoice").length
    : g === "work" ? S.data.cases.length + S.data.tasks.length + S.data.consults.length + S.data.docs.filter((d) => d.kind !== "invoice").length : S.data.clients.length;
  const sel = S.archSel || (S.archSel = { finance: true, work: false, clients: false });
  return `<div class="page-head"><div><h1>الأرشيف وتجديد المنصة</h1><p>احفظ نسخة كاملة من بيانات المنصة في أي وقت، أو ابدأ فترة جديدة: تُؤرشف البيانات الحالية أولًا ثم تُفرَّغ الأقسام التي تختارها. فريق العمل والإعدادات لا تُمس.</p></div></div>
  <div class="cols"><div class="card"><div class="card-h"><h3>تجديد المنصة</h3><span class="sub">أرشفة ثم تفريغ</span></div>
    <form id="arch-form" data-form="archRenew" class="stack" style="gap:14px">
      <div class="field"><label for="arch-title">اسم الأرشيف</label><input id="arch-title" class="inp" name="title" placeholder="مثال: أرشيف ما قبل التشغيل الفعلي — ${fmtDate(todayStr())}"></div>
      <div class="pick">${Object.entries(ARCH_GROUPS).map(([k, g]) => `<label><input type="checkbox" name="g_${k}" data-ch="archSel" data-k="${k}" ${sel[k] ? "checked" : ""}><span class="grow"><b>${g.t}</b> <span class="pill plain num">${live(k)}</span><br><span class="small muted">${g.d}</span></span></label>`).join("")}</div>
      <div class="field"><label for="arch-note">ملاحظة (اختياري)</label><input id="arch-note" class="inp" name="note" placeholder="سبب التجديد"></div>
      <div class="row"><button class="btn gold" type="submit" ${Object.values(sel).some(Boolean) ? "" : "disabled"}>${icon("box")}أرشفة وتجديد</button><button class="btn" type="button" data-act="archOnly">${icon("download")}أرشفة فقط دون تفريغ</button>${S.archBusy && S.archBusy !== "load" ? `<span class="thinking small">${esc(S.archBusy)}</span>` : ""}</div>
    </form></div>
    <div class="card"><div class="card-h"><h3>الأرشيفات المحفوظة</h3><span class="sub num">${(S.archives || []).length}</span></div>
      ${S.archives === undefined || S.archBusy === "load" ? `<div class="thinking">يحمّل…</div>` : S.archives.length ? `<div class="list">${S.archives.map((a) => `<div class="li"><span class="ic" style="color:var(--accent-ink)">${icon("box")}</span><div class="body"><div class="ttl">${esc(a.title)}</div>
        <div class="meta"><span>${fmtWhen(a.created_at)}</span>${a.created_by ? `<span>${esc(lawyerName(S.data.lawyers.find((l) => (l.email || "").toLowerCase() === a.created_by)?.id) || a.created_by)}</span>` : ""}</div>
        <div class="meta"><span>${esc(archCounts(a.counts))}</span></div>
        <div class="meta">${a.cleared?.length ? a.cleared.map((g) => pill("فُرّغ: " + (ARCH_GROUPS[g]?.t || g), "warn")).join("") : pill("نسخة فقط", "plain")}${a.note ? `<span>${esc(a.note)}</span>` : ""}</div></div>
        <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-act="archDownload" data-id="${a.id}" title="تنزيل نسخة JSON">${icon("download")}</button><button class="btn sm ghost" data-act="archRestore" data-id="${a.id}">استعادة</button></div></div>`).join("")}</div>`
        : emptyBox("box", "لا أرشيفات بعد", "أول أرشيف يُنشأ عند التجديد أو عند «أرشفة فقط».")}</div></div>`;
};
CH.archSel = (el) => { S.archSel[el.dataset.k] = el.checked; render(); };
async function archRun(title, note, clear) {
  S.archBusy = clear.length ? "يؤرشف ثم يفرّغ…" : "يؤرشف…"; render();
  try {
    await window.RAKZ_ARCHIVE.create(title, note, clear);
    if (clear.length) { toast("حُفظ الأرشيف وجُدّدت المنصة"); setTimeout(() => location.reload(), 900); return; }
    toast("حُفظ الأرشيف"); S.archives = undefined;
  } catch (e) { toast("تعذّرت الأرشفة: " + (e.message || e.code), true); }
  S.archBusy = null; render();
}
F.archRenew = (d) => {
  const clear = Object.keys(ARCH_GROUPS).filter((k) => S.archSel[k]); if (!clear.length) return;
  S.archPending = { title: d.title.trim(), note: d.note.trim(), clear };
  modal("تأكيد تجديد المنصة", `<div class="stack" style="gap:12px"><p style="margin:0">ستُحفظ نسخة كاملة من بيانات المنصة في الأرشيف، ثم تُفرَّغ:</p>
    <ul style="margin:0">${clear.map((k) => `<li><b>${ARCH_GROUPS[k].t}</b> — <span class="small muted">${ARCH_GROUPS[k].d}</span></li>`).join("")}</ul>
    <div class="banner warn"><div class="grow">يبقى كل ما فُرّغ محفوظًا في الأرشيف ويمكن تنزيله أو استعادته. فريق العمل والإعدادات والمكتبة النظامية لا تتأثر.</div></div>
    <div class="field"><label for="arch-confirm">للتأكيد اكتب كلمة: تجديد</label><input id="arch-confirm" class="inp" autocomplete="off" data-ch="archConfirm"></div></div>`,
    `<button class="btn primary" id="arch-go" data-act="archGo" disabled>أرشفة وتجديد</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
};
CH.archConfirm = (el) => { const b = $("#arch-go"); if (b) b.disabled = el.value.trim() !== "تجديد"; };
document.addEventListener("input", (e) => { if (e.target.id === "arch-confirm") CH.archConfirm(e.target); });
A.archGo = () => { const p = S.archPending; if (!p) return; closeModal(); archRun(p.title, p.note, p.clear); };
A.archOnly = () => archRun($("#arch-title")?.value.trim() || "", $("#arch-note")?.value.trim() || "", []);
A.archRestore = (el) => {
  const a = (S.archives || []).find((x) => x.id === el.dataset.id); if (!a) return;
  modal("استعادة أرشيف", `<p style="margin-top:0">ستُعاد سجلات «<b>${esc(a.title)}</b>» إلى المنصة (${esc(archCounts(a.counts))}).</p><p class="small muted">قبل الاستعادة يُحفظ الوضع الحالي تلقائيًا في أرشيف جديد. السجلات الموجودة حاليًا تبقى، وما يحمل المعرّف نفسه يُستبدل بنسخة الأرشيف.</p>`,
    `<button class="btn primary" data-act="archRestoreGo" data-id="${a.id}">استعادة</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
};
A.archRestoreGo = async (el) => {
  closeModal(); S.archBusy = "يستعيد…"; render();
  try { const n = await window.RAKZ_ARCHIVE.restore(el.dataset.id); toast(`استُعيد ${n} سجلًا`); setTimeout(() => location.reload(), 900); }
  catch (e) { toast("تعذّرت الاستعادة: " + (e.message || e.code), true); S.archBusy = null; render(); }
};
A.archDownload = async (el) => {
  const a = (S.archives || []).find((x) => x.id === el.dataset.id);
  try {
    const snap = await window.RAKZ_ARCHIVE.snapshot(el.dataset.id);
    const blob = new Blob([JSON.stringify({ title: a?.title, created_at: a?.created_at, counts: a?.counts, records: snap }, null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const x = document.createElement("a"); x.href = url; x.download = `rakz-archive-${(a?.created_at || "").slice(0, 10)}.json`; x.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) { toast("تعذّر التنزيل: " + (e.message || e.code), true); }
};
