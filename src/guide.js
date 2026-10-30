/* ============ Rakz — guide: first-visit tour, usage guide («؟»), phone notifications ============ */

/* ---------- phone notifications ---------- */
async function refreshPush() { const st = window.RAKZ_PUSH ? await window.RAKZ_PUSH.state().catch(() => "unsupported") : "unsupported"; if (st !== S.push) { S.push = st; scheduleRender(); } }
const PUSH_TXT = {
  on: ["مفعّلة على هذا الجهاز", "ok"], off: ["غير مفعّلة على هذا الجهاز", "warn"], denied: ["محظورة من إعدادات الجهاز", "bad"],
  install: ["تحتاج إضافة المنصة إلى الشاشة الرئيسية", "warn"], unsupported: ["غير مدعومة في هذا المتصفح", "plain"],
};
function pushRow() {
  if (!window.RAKZ_PUSH) return "";
  const st = S.push || "off"; const [t, c] = PUSH_TXT[st] || PUSH_TXT.off;
  return `<div class="push-row">${icon("bell")}<div class="grow"><b>تنبيهات الجوال</b><span class="pill ${c}">${t}</span></div>
    ${st === "on" ? `<button class="btn sm" data-act="pushTest">تجربة</button><button class="btn sm ghost" data-act="pushOff">إيقاف</button>` : st === "off" ? `<button class="btn sm gold" data-act="pushOn">تفعيل</button>` : st === "install" || st === "denied" ? `<button class="btn sm" data-act="pushHow">الطريقة</button>` : ""}</div>`;
}
A.pushOn = async () => {
  try { await window.RAKZ_PUSH.enable(); S.push = "on"; toast("فُعّلت التنبيهات على هذا الجهاز"); if (S.tour) drawTour(); }
  catch (e) { S.push = await window.RAKZ_PUSH.state().catch(() => "off"); toast(e.code === "denied" ? "لم يُسمح بالتنبيهات. فعّلها من إعدادات الجهاز ثم أعد المحاولة." : "تعذّر التفعيل: " + (e.message || e.code || ""), true); }
  render();
};
A.pushOff = async () => { await window.RAKZ_PUSH.disable().catch(() => {}); S.push = "off"; toast("أُوقفت التنبيهات على هذا الجهاز"); render(); };
A.pushTest = async () => {
  try { const n = await window.RAKZ_PUSH.test(); toast(n ? "أُرسل تنبيه تجريبي، سيصلك خلال ثوانٍ" : "لم يُعثر على جهاز مفعّل. أعد التفعيل.", !n); }
  catch (e) { toast(e.code === "not_configured" ? "خدمة التنبيهات لم تُفعّل في الخادم بعد." : "تعذّر الإرسال: " + (e.message || e.code), true); }
};
A.pushHow = () => modal("تفعيل التنبيهات على الجوال", `<div class="stack" style="gap:14px">
  <p class="muted" style="margin:0">تصلك تنبيهات طلبات الإسناد والمهام الجديدة والطلبات المالية، وملخص كل صباح بجلسات اليوم والغد والمتأخر.</p>
  <div class="how"><b>آيفون (iOS 16.4 فأحدث)</b><ol>
    <li>افتح <span class="num">sys.rakzlaw.sa</span> في متصفح <b>Safari</b>.</li>
    <li>اضغط زر المشاركة ${icon("share")} أسفل الشاشة، ثم «<b>إضافة إلى الشاشة الرئيسية</b>».</li>
    <li>افتح «ركز» من أيقونتها في الشاشة الرئيسية، وسجّل الدخول.</li>
    <li>اضغط الجرس ${icon("bell")} أعلى الصفحة ثم «<b>تفعيل</b>»، ووافق على السماح بالتنبيهات.</li></ol></div>
  <div class="how"><b>أندرويد</b><ol>
    <li>افتح المنصة في <b>Chrome</b>، ثم من القائمة ⋮ اختر «<b>تثبيت التطبيق</b>» أو «إضافة إلى الشاشة الرئيسية».</li>
    <li>اضغط الجرس ثم «تفعيل» ووافق على السماح.</li></ol></div>
  ${S.push === "denied" ? `<div class="banner warn"><div class="grow">التنبيهات محظورة لهذا الموقع. افتح إعدادات الجهاز ← الإشعارات ← ركز، واسمح بها، ثم ارجع واضغط «تفعيل».</div></div>` : ""}</div>`,
  `<button class="btn primary" data-act="closeModal">تم</button>`);

/* ---------- usage guide: what do you want to do, and where ---------- */
const HOWTO = [
  { t: "فتح قضية جديدة", w: "زر «قضية جديدة» أعلى الصفحة", act: "newCase", ic: "plus" },
  { t: "إضافة جلسة أو موعد مذكرة", w: "المهام والتذكيرات ← «مهمة أو موعد»", act: "newTask", ic: "cal" },
  { t: "رفع مستندات قضية ليقرأها المساعد", w: "القضايا ← افتح القضية ← «رفع مرفق»", r: "cases", ic: "upload" },
  { t: "تحديث قضية من ناجز", w: "ناجز ← الصق النص أو ارفع الملف", r: "najiz", ic: "link" },
  { t: "كتابة لائحة اعتراضية أو مذكرة", w: "اللوائح وعروض الأتعاب ← اختر النوع والقضية", r: "drafting", ic: "docs" },
  { t: "صياغة عقد أو مراجعته", w: "العقود ← «صياغة» أو «مراجعة عقد»", r: "contracts", ic: "contract" },
  { t: "البحث عن مادة نظامية", w: "المكتبة النظامية ← ابحث أو افتح النظام", r: "laws", ic: "book", need: "laws" },
  { t: "سؤال قانوني بإجابة موثقة", w: "اسأل المكتبة، أو زر المساعد العائم", r: "chat", ic: "bot", need: "laws" },
  { t: "إرسال تقرير مستجدات للعميل", w: "القضية ← تبويب «التقارير» ← واتساب أو بريد", r: "cases", ic: "wa" },
  { t: "تسجيل مصروف أو دفعة استلمتها", w: "القضية ← بطاقة «الطلبات المالية» ← طلب جديد (يعتمده المدير)", r: "cases", ic: "coin" },
  { t: "قبول قضية أُسندت إليك", w: "طلبات الإسناد", r: "assign", ic: "inbox" },
  { t: "اعتماد طلب مالي", w: "النظام الإداري ← الطلبات المالية", r: "finreqs", ic: "check", mgr: true },
  { t: "إصدار مطالبة أو فاتورة ضريبية", w: "النظام الإداري ← المطالبات والفواتير", r: "finance", ic: "receipt", mgr: true },
  { t: "إقفال الملف المالي لقضية", w: "النظام الإداري ← الملفات المالية ← القضية", r: "finfiles", ic: "cases", mgr: true },
  { t: "إضافة عضو إلى الفريق", w: "النظام الإداري ← فريق العمل", r: "team", ic: "team", mgr: true },
];
A.help = () => {
  const list = HOWTO.filter((h) => (!h.mgr || isManager()) && (h.need !== "laws" || window.RAKZ_LAWS));
  modal("دليل الاستخدام", `<div class="stack" style="gap:16px">
    <div class="banner gold"><div class="grow"><b>جولة تعريفية</b>دقيقة واحدة تعرّفك على مكان كل قسم في ${S.portal === "admin" ? "النظام الإداري" : "النظام المهني"}.</div><button class="btn gold" data-act="tourStart">${icon("play")}ابدأ الجولة</button></div>
    <div><b>ماذا تريد أن تفعل؟</b><div class="howto">${list.map((h) => `<button class="howto-i" data-act="howGo" ${h.act ? `data-do="${h.act}"` : `data-r="${h.r}"`}><span class="law-ic">${icon(h.ic)}</span><span><b>${h.t}</b><small>${h.w}</small></span></button>`).join("")}</div></div>
    ${window.RAKZ_PUSH ? `<div class="card" style="padding:4px 16px">${pushRow()}</div>` : ""}</div>`, "", true);
};
A.howGo = (el) => { closeModal(); if (el.dataset.do) return A[el.dataset.do](el); go(el.dataset.r); };

/* ---------- first-visit tour ---------- */
const mobile = () => matchMedia("(max-width: 860px)").matches;
function tourSteps(kind) {
  const m = mobile(); const nav = (r) => (m ? `.bnav [data-r="${r}"]` : `.side [data-r="${r}"]`); const more = `.bnav [data-act="menu"]`;
  const hello = { t: kind === "admin" ? "النظام الإداري" : `أهلًا بك في منصة ركز${myLawyer() ? "، " + myLawyer().name.split(" ")[0] : ""}`, d: kind === "admin" ? "هنا المالية كلها: كل حركة يرفعها المحامون تنتظر اعتمادك، وكل قضية لها ملف مالي يبقى مفتوحًا حتى تقفله." : "جولة قصيرة تعرّفك على مكان كل شيء. تستطيع إعادتها في أي وقت من زر «؟» أعلى الصفحة." };
  const end = { sel: '[data-act="help"]', t: "الدليل دائمًا هنا", d: "زر «؟» يفتح دليل «ماذا تريد أن تفعل؟» ويعيد هذه الجولة.", push: true };
  if (kind === "admin") return [hello,
    { sel: ".portal-switch", t: "التبديل بين النظامين", d: "«المهني» للقضايا والعمل القانوني، و«الإداري» للمالية والاعتمادات.", skipMobile: true },
    { sel: nav("admin"), t: "لوحة الإدارة", d: "المحصّل والمستحق ومقارنة هذا الشهر بالماضي وبالعام الماضي، وأعمار المستحقات وأكبر العملاء." },
    { sel: nav("finreqs"), t: "الطلبات المالية", d: "مصروفات المحامين والدفعات المستلمة واقتراحات الأتعاب. لا يُسجَّل أي مبلغ إلا بعد اعتمادك هنا." },
    { sel: nav("finfiles"), t: "الملفات المالية للقضايا", d: "لكل قضية أتعابها وما فوتر وحُصّل والمستحق. أقفل الملف بعد تسوية المستحقات." },
    { sel: nav("finance"), t: "المطالبات والفواتير", d: "إصدار المطالبات والفواتير الضريبية والإشعارات الدائنة، والقيود وكشوف العملاء." },
    m ? { sel: more, t: "المزيد", d: "العملاء وفريق العمل والإعدادات، والتبديل إلى النظام المهني." } : { sel: nav("team"), t: "فريق العمل والإعدادات", d: "أضف الأعضاء بأدوارهم، وبيانات المكتب والرقم الضريبي والخط والورق الرسمي." },
    end];
  return [hello,
    isManager() && !m ? { sel: ".portal-switch", t: "نظامان منفصلان", d: "أنت الآن في «المهني» للعمل القانوني اليومي. المالية والاعتمادات في «الإداري»." } : null,
    { sel: nav("dashboard"), t: "لوحة التحكم", d: "ملخص يومك: الجلسات القادمة، وما يتطلب انتباهك، ومقارنة هذا الشهر بالماضي." },
    { sel: nav("tasks"), t: "المهام والتذكيرات", d: "الجلسات ومواعيد المذكرات والمتطلبات. الرقم الأحمر على القسم يعني مهام متأخرة عليك." },
    { sel: nav("cases"), t: "القضايا", d: "كل قضية بملفها: الأطراف والجلسات والمرفقات والسجل وتقارير العميل والطلبات المالية." },
    { sel: nav("consults"), t: "الاستشارات", d: "طلبات الرأي القانوني: صياغة الرأي بالمساعد، وتحويل الاستشارة إلى قضية." },
    m ? { sel: more, t: "بقية الأقسام في «المزيد»", d: "اللوائح والعقود والمكتبة النظامية والعملاء وناجز وطلبات الإسناد." } : null,
    m ? null : { sel: nav("drafting"), t: "الصياغة والمراجعة", d: "اللوائح الاعتراضية والمذكرات وعروض الأتعاب، والعقود صياغةً ومراجعةً بالعربية والإنجليزية." },
    m || !window.RAKZ_LAWS ? null : { sel: nav("laws"), t: "البحث النظامي", d: "الأنظمة ولوائحها من المصادر الرسمية، و«اسأل المكتبة» لسؤال قانوني بإجابة موثقة بالمواد." },
    m ? null : { sel: nav("najiz"), t: "ناجز", d: "الصق صفحة القضية من ناجز أو ارفعها ليستخرج المساعد الجلسات والقرارات ويحدّث القضية." },
    { sel: "#gsearch", t: "البحث السريع", d: "ابحث عن أي قضية أو عميل أو رقم ناجز من أي صفحة.", skipMobile: true },
    { sel: ".new-case", t: "قضية جديدة", d: "افتح قضية من أي مكان، وأسندها لمحامٍ من الفريق." },
    { sel: "#chat-fab", t: "المساعد", d: "اسأل المكتبة النظامية من أي صفحة." },
    { sel: '[data-act="notif"]', t: "التنبيهات", d: "طلبات الإسناد والمواعيد القريبة والمتأخر. ومنها تفعّل تنبيهات الجوال." },
    end].filter(Boolean);
}
const tourKey = (kind) => `tour.${kind}.${(S.me?.email || "").toLowerCase()}`;
function maybeTour() {
  if (S.tour || !S.booted || !S.loaded.lawyers || $("#modal")) return;
  const kind = S.route.name === "admin" ? "admin" : S.route.name === "dashboard" ? "pro" : null;
  if (!kind || lsGet(tourKey(kind), false)) return;
  setTimeout(() => { if (!S.tour && !$("#modal") && (S.route.name === "admin" ? "admin" : S.route.name === "dashboard" ? "pro" : null) === kind) startTour(kind); }, 900);
}
A.tourStart = () => { closeModal(); startTour(S.portal === "admin" && isManager() ? "admin" : "pro"); };
function startTour(kind) {
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && getComputedStyle(el).visibility !== "hidden"; };
  const steps = tourSteps(kind).filter((s) => !(s.skipMobile && mobile())).filter((s) => !s.sel || visible($(s.sel)));
  S.tour = { kind, steps, i: 0 }; lsSet(tourKey(kind), true);
  let box = $("#tour"); if (!box) { box = document.createElement("div"); box.id = "tour"; box.className = "tour"; document.body.appendChild(box); }
  drawTour();
}
function drawTour() {
  const T = S.tour, box = $("#tour"); if (!T || !box) return;
  const s = T.steps[T.i]; const el = s.sel ? $(s.sel) : null;
  if (el && !el.closest(".side, .bnav, .topbar") && getComputedStyle(el).position !== "fixed") el.scrollIntoView({ block: "center", behavior: "instant" });
  const r = el ? el.getBoundingClientRect() : null; const pad = 6;
  const last = T.i === T.steps.length - 1;
  box.innerHTML = `<div class="tour-hole${r ? "" : " none"}" style="${r ? `top:${r.top - pad}px;left:${r.left - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px` : ""}"></div>
    <div class="tour-card" role="dialog" aria-live="polite"><div class="tour-n num">${T.i + 1} / ${T.steps.length}</div><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p>
      ${s.push && window.RAKZ_PUSH && S.push !== "on" && S.push !== "unsupported" ? `<div class="tour-push">${S.push === "off" ? `<button class="btn gold sm" data-act="pushOn">${icon("bell")}فعّل تنبيهات الجوال</button>` : `<button class="btn sm" data-act="pushHow">${icon("bell")}كيف أفعّل تنبيهات الجوال؟</button>`}</div>` : ""}
      <div class="tour-dots">${T.steps.map((_, k) => `<i class="${k === T.i ? "on" : ""}"></i>`).join("")}</div>
      <div class="row"><button class="btn primary sm" data-act="tourNext">${last ? "إنهاء" : "التالي"}</button>${T.i ? `<button class="btn sm" data-act="tourPrev">السابق</button>` : ""}<span class="grow"></span>${last ? "" : `<button class="btn ghost sm" data-act="tourEnd">تخطي الجولة</button>`}</div></div>`;
  const card = box.querySelector(".tour-card"); const cw = card.offsetWidth, ch = card.offsetHeight, vw = innerWidth, vh = innerHeight, g = 14;
  let top, left;
  if (!r) { top = (vh - ch) / 2; left = (vw - cw) / 2; }
  else if (el.closest(".side") && r.left - g - cw > 8) { top = Math.min(Math.max(8, r.top + r.height / 2 - ch / 2), vh - ch - 8); left = r.left - g - cw; }
  else if (r.bottom + g + ch < vh - 8) { top = r.bottom + g; left = r.left + r.width / 2 - cw / 2; }
  else if (r.top - g - ch > 8) { top = r.top - g - ch; left = r.left + r.width / 2 - cw / 2; }
  else { top = Math.min(Math.max(8, r.top + r.height / 2 - ch / 2), vh - ch - 8); left = r.left - g - cw > 8 ? r.left - g - cw : r.right + g; }
  card.style.top = Math.max(8, top) + "px"; card.style.left = Math.min(Math.max(8, left), vw - cw - 8) + "px";
}
A.tourNext = () => { const T = S.tour; if (!T) return; if (T.i >= T.steps.length - 1) return A.tourEnd(); T.i++; drawTour(); };
A.tourPrev = () => { const T = S.tour; if (!T || !T.i) return; T.i--; drawTour(); };
A.tourEnd = () => { const k = S.tour?.kind; S.tour = null; $("#tour")?.remove(); if (k === "pro" && S.push === "off" && mobile()) toast("تستطيع تفعيل تنبيهات الجوال من الجرس أعلى الصفحة"); };
document.addEventListener("keydown", (e) => {
  if (!S.tour) return;
  if (e.key === "Escape") A.tourEnd(); else if (e.key === "ArrowLeft" || e.key === "Enter") A.tourNext(); else if (e.key === "ArrowRight") A.tourPrev();
});
addEventListener("resize", () => { if (S.tour) drawTour(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.booted) refreshPush(); });
