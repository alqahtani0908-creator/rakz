/* ============ Rakz — drafting: contracts, fee proposals, pleadings, Word export ============ */

const PLACEHOLDERS = [
  ["contract_no", "رقم العقد"], ["date", "التاريخ الميلادي"], ["date_hijri", "التاريخ الهجري"], ["city", "المدينة"],
  ["firm_name", "اسم المكتب"], ["firm_cr", "سجل المكتب"], ["firm_license", "ترخيص المكتب"], ["firm_address", "عنوان المكتب"], ["firm_rep", "ممثل المكتب"],
  ["client_name", "اسم العميل"], ["client_id", "هوية/سجل العميل"], ["client_rep", "ممثل العميل"], ["client_address", "عنوان العميل"], ["client_phone", "جوال العميل"], ["client_email", "بريد العميل"],
  ["subject", "موضوع التكليف"], ["court", "المحكمة"], ["opponent", "الخصم"], ["scope", "نطاق العمل"], ["fee", "الأتعاب"], ["vat_note", "بيان الضريبة"], ["payment_terms", "طريقة السداد"], ["duration", "مدة العقد"],
];

const CONTRACT_TEMPLATES = {
  litigation: { name: "عقد تقديم خدمات قانونية (ترافع)", body: `> بسم الله الرحمن الرحيم
# عقد تقديم خدمات قانونية

رقم العقد: {{contract_no}}
إنه في يوم {{date}} الموافق {{date_hijri}}، بمدينة {{city}}، تم الاتفاق بين كل من:

## الطرف الأول
{{firm_name}}، سجل تجاري رقم ({{firm_cr}})، ترخيص رقم ({{firm_license}})، وعنوانه: {{firm_address}}، ويمثله في هذا العقد: {{firm_rep}}. ويُشار إليه فيما بعد بـ«المكتب».

## الطرف الثاني
{{client_name}}، هوية/سجل رقم ({{client_id}})، ويمثله: {{client_rep}}، وعنوانه: {{client_address}}، جوال: {{client_phone}}، بريد إلكتروني: {{client_email}}. ويُشار إليه فيما بعد بـ«العميل».

## تمهيد
لما كان العميل يرغب في الاستعانة بخدمات المكتب القانونية في {{subject}}، وحيث إن المكتب مرخص له بمزاولة مهنة المحاماة وفق نظام المحاماة في المملكة العربية السعودية، فقد اتفق الطرفان وهما بكامل أهليتهما المعتبرة شرعًا ونظامًا على ما يلي:

## البند الأول: التمهيد
يعد التمهيد السابق وأي ملاحق موقعة جزءًا لا يتجزأ من هذا العقد ومكملًا له.

## البند الثاني: موضوع العقد
يلتزم المكتب بتمثيل العميل والترافع عنه أمام {{court}} في الدعوى المقامة منه أو ضده مع {{opponent}}، ويشمل نطاق العمل ما يلي:
{{scope}}

## البند الثالث: التزامات المكتب
- بذل العناية المهنية اللازمة وفق أصول المهنة وأخلاقياتها، وهو التزام ببذل عناية لا بتحقيق نتيجة.
- إعداد اللوائح والمذكرات وحضور الجلسات في مواعيدها.
- إحاطة العميل بمستجدات القضية وما يصدر فيها من قرارات وأحكام.
- المحافظة على سرية المعلومات والمستندات التي يطلع عليها بحكم هذا العقد.

## البند الرابع: التزامات العميل
- تزويد المكتب بالمستندات والمعلومات الصحيحة اللازمة في الوقت المناسب.
- إصدار وكالة شرعية سارية تخول المكتب القيام بالأعمال محل العقد.
- سداد الأتعاب والمصروفات في مواعيدها المتفق عليها.
- عدم التواصل مع الخصم أو الجهة القضائية بشأن موضوع العقد دون علم المكتب.

## البند الخامس: الأتعاب وطريقة السداد
اتفق الطرفان على أن تكون أتعاب المكتب مبلغًا وقدره ({{fee}}) ريال سعودي، {{vat_note}}، وتُسدد على النحو التالي:
{{payment_terms}}

## البند السادس: المصروفات
لا تشمل الأتعاب الرسوم القضائية أو رسوم التوثيق أو الترجمة أو الخبرة أو التنقل خارج مدينة {{city}}، ويتحملها العميل بعد موافقته عليها.

## البند السابع: مدة العقد
يسري هذا العقد من تاريخ توقيعه وحتى {{duration}}.

## البند الثامن: إنهاء العقد
يحق لأي من الطرفين إنهاء العقد بإشعار كتابي قبل خمسة عشر يومًا، وفي حال إنهائه من العميل دون سبب مشروع تستحق الأتعاب كاملة عن المرحلة القائمة وما سبقها.

## البند التاسع: الإشعارات
تعد المراسلات على العناوين والبريد الإلكتروني الموضحة في صدر هذا العقد منتجة لآثارها النظامية.

## البند العاشر: النظام الواجب التطبيق وتسوية النزاعات
يخضع هذا العقد لأنظمة المملكة العربية السعودية، ويُسعى لحل أي خلاف وديًا، فإن تعذر فتختص بنظره المحكمة المختصة في مدينة {{city}}.

## البند الحادي عشر: نسخ العقد
حُرر هذا العقد من نسختين أصليتين، تسلم كل طرف نسخة منه للعمل بموجبها.

---
!| الطرف الأول (المكتب) | الطرف الثاني (العميل) |
!| {{firm_name}} | {{client_name}} |
!| الاسم: {{firm_rep}} | الاسم: {{client_rep}} |
!| التوقيع: ........................ | التوقيع: ........................ |
!| الختم: | |` },
  retainer: { name: "عقد استشارات قانونية سنوي", body: `> بسم الله الرحمن الرحيم
# عقد استشارات قانونية سنوي

رقم العقد: {{contract_no}}
إنه في يوم {{date}} الموافق {{date_hijri}}، بمدينة {{city}}، تم الاتفاق بين:

## الطرف الأول
{{firm_name}}، سجل تجاري رقم ({{firm_cr}})، وعنوانه: {{firm_address}}، ويمثله: {{firm_rep}}.

## الطرف الثاني
{{client_name}}، سجل/هوية رقم ({{client_id}})، ويمثله: {{client_rep}}، وعنوانه: {{client_address}}.

## البند الأول: موضوع العقد
يقدم الطرف الأول للطرف الثاني خدمات الاستشارات القانونية المستمرة، وتشمل:
{{scope}}

## البند الثاني: آلية تقديم الخدمة
تُقدَّم الاستشارات كتابيًا أو شفهيًا خلال أيام العمل الرسمية، ويلتزم المكتب بالرد على الطلبات العاجلة خلال يومي عمل.

## البند الثالث: ما لا يشمله العقد
لا يشمل هذا العقد الترافع أمام المحاكم أو اللجان أو التحكيم، ويُتفق على ذلك بعقد مستقل.

## البند الرابع: الأتعاب
أتعاب هذا العقد ({{fee}}) ريال سعودي سنويًا، {{vat_note}}، وتسدد كالتالي:
{{payment_terms}}

## البند الخامس: المدة
مدة العقد {{duration}} تبدأ من تاريخ توقيعه، وتتجدد تلقائيًا لمدة مماثلة ما لم يخطر أحد الطرفين الآخر برغبته في عدم التجديد قبل انتهائه بثلاثين يومًا.

## البند السادس: السرية
يلتزم الطرف الأول بالمحافظة على سرية جميع المعلومات والوثائق التي يطلع عليها، ويستمر هذا الالتزام بعد انتهاء العقد.

## البند السابع: النظام الواجب التطبيق
يخضع هذا العقد لأنظمة المملكة العربية السعودية، وتختص المحكمة المختصة بمدينة {{city}} بنظر أي نزاع ينشأ عنه.

---
!| الطرف الأول | الطرف الثاني |
!| {{firm_name}} | {{client_name}} |
!| الاسم: {{firm_rep}} | الاسم: {{client_rep}} |
!| التوقيع: ........................ | التوقيع: ........................ |` },
};

const PLEADING_TYPES = {
  claim: { t: "صحيفة دعوى", hint: "بيانات الأطراف، الوقائع، الأسانيد، الطلبات" },
  reply: { t: "مذكرة جوابية / رد", hint: "الرد على دفوع الخصم بندًا بندًا" },
  defense: { t: "مذكرة دفاع", hint: "الدفوع الشكلية ثم الموضوعية" },
  appeal: { t: "لائحة اعتراضية بطلب الاستئناف", hint: "أمام محكمة الاستئناف — 30 يومًا من تسلّم الحكم" },
  cassation: { t: "لائحة اعتراضية بطلب النقض", hint: "أمام المحكمة العليا — أسباب محددة نظامًا" },
  review: { t: "التماس إعادة النظر", hint: "في الأحكام النهائية — حالات محصورة" },
  closing: { t: "مذكرة ختامية", hint: "تلخيص الدعوى والطلبات النهائية" },
  execution: { t: "طلب تنفيذ", hint: "بيانات السند التنفيذي والمطلوب تنفيذه" },
};
const DOC_KINDS = { contract: "عقد", proposal: "عرض أتعاب", pleading: "لائحة / مذكرة", opinion: "رأي قانوني", invoice: "مطالبة مالية" };
const OBJ_GUIDE = {
  appeal: `لائحة الاعتراض بطلب الاستئناف (نظام المرافعات الشرعية): تُقدَّم خلال ثلاثين يومًا من تسلّم صورة الحكم (عشرة أيام في المستعجلة)، وتشتمل على: بيان الحكم المعترض عليه (رقمه وتاريخه والمحكمة والدائرة)، وتاريخ التسلّم، وبيانات المعترض والمعترض ضده، والأسباب التي بُني عليها الاعتراض (خطأ في الوقائع أو في تطبيق النظام أو إغفال دفوع أو بينات…)، والطلبات (نقض الحكم أو تعديله والحكم بـ…). يجوز طلب نظرها مرافعةً وتقديم ما لم يُقدَّم من بينات.`,
  cassation: `لائحة الاعتراض بطلب النقض أمام المحكمة العليا: تُقدَّم خلال ثلاثين يومًا من تسلّم صورة حكم محكمة الاستئناف، ولا تُقبل إلا على أحد الأسباب المحددة نظامًا (مع التحقق من المادة): مخالفة أحكام الشريعة الإسلامية أو ما يصدره ولي الأمر من أنظمة لا تتعارض معها؛ صدور الحكم من محكمة غير مشكّلة تشكيلًا سليمًا؛ صدوره من محكمة أو دائرة غير مختصة؛ الخطأ في تكييف الواقعة أو وصفها وصفًا غير سليم. المحكمة العليا لا تنظر الوقائع، فاجعل كل سبب مرتبطًا بأحد هذه الأسباب صراحة، واختم بطلب نقض الحكم وإعادته.`,
  review: `التماس إعادة النظر في الأحكام النهائية (نظام المرافعات الشرعية، مع التحقق من المادة): يُقبل في حالات محصورة، منها: إذا بُني الحكم على أوراق ظهر بعد الحكم تزويرها أو على شهادة قُضي بأنها مزوّرة؛ إذا حصل الملتمس بعد الحكم على أوراق قاطعة في الدعوى لم يكن ممكنًا تقديمها قبله؛ إذا وقع من الخصم غش كان من شأنه التأثير في الحكم؛ إذا قضى الحكم بشيء لم يطلبه الخصوم أو بأكثر مما طلبوه؛ إذا كان منطوق الحكم يناقض بعضه بعضًا؛ إذا كان الحكم غيابيًا؛ إذا صدر الحكم على من لم يكن ممثلًا تمثيلًا صحيحًا. المهلة ثلاثون يومًا تبدأ بحسب الحالة (من ظهور التزوير أو الورقة أو الغش، أو من العلم بالحكم). حدّد الحالة المنطبقة بوضوح وتاريخ العلم بها، ثم الطلبات.`,
};

/* ---------- Pleading templates (used when the assistant is off) ---------- */
const B = "[........]";
function pleadingTemplate(c, type, notes) {
  const T = PLEADING_TYPES[type]; const j = c.judgment || {}; const law = byId(S.data.lawyers, c.lawyerId);
  const role = c.clientRole || "الموكل";
  const court = [c.court, c.circuit, c.city].filter(Boolean).join(" — ") || B;
  const head = `> بسم الله الرحمن الرحيم
# ${T.t}

| البيان | التفاصيل |
| ${role} | ${clientName(c.clientId)} |
| الخصم | ${c.opponent || B} |
| المحكمة / الدائرة | ${court} |
| رقم القضية | ${c.najiz || B} |${["appeal", "cassation", "review"].includes(type) ? `
| الحكم محل الاعتراض | رقم ${j.no || B} وتاريخ ${j.date ? fmtDate(j.date) : B} |
| تاريخ التسلّم / العلم | ${j.receivedAt ? fmtDate(j.receivedAt) : B} |` : ""}
`;
  const addr = type === "appeal" ? "> أصحاب الفضيلة رئيس وأعضاء محكمة الاستئناف وفقهم الله"
    : type === "cassation" ? "> أصحاب الفضيلة رئيس وأعضاء المحكمة العليا وفقهم الله"
    : `> فضيلة رئيس ${c.circuit || "الدائرة"}${c.court ? " في " + c.court : ""}${c.city ? " بمدينة " + c.city : ""} سلمه الله`;
  const facts = (c.description || "").trim() || B;
  const sections = {
    claim: `## أولًا: الوقائع
${facts}

## ثانيًا: الأسانيد النظامية
1. ${B}
2. ${B}

## ثالثًا: الطلبات
بناءً على ما تقدم نطلب من فضيلتكم:
1. ${B}
2. إلزام المدعى عليه بالمصروفات وأتعاب المحاماة.`,
    reply: `## أولًا: ملخص دعوى الخصم
${B}

## ثانيًا: الدفوع الشكلية
1. ${B}

## ثالثًا: الرد على الدفوع الموضوعية
1. ما ذكره الخصم من ${B}: والرد عليه ${B}.
2. ما ذكره الخصم من ${B}: والرد عليه ${B}.

## رابعًا: الطلبات
1. ${B}`,
    defense: `## أولًا: الوقائع
${facts}

## ثانيًا: الدفوع الشكلية
1. الدفع بعدم الاختصاص ${B}

## ثالثًا: الدفوع الموضوعية
1. ${B}
2. ${B}

## رابعًا: الطلبات
1. رد دعوى المدعي.`,
    appeal: `نتقدم بلائحتنا الاعتراضية بطلب الاستئناف على الحكم المشار إليه، خلال المدة النظامية، للأسباب الآتية:

## أولًا: ملخص الوقائع والحكم
${facts}

## ثانيًا: أسباب الاعتراض
1. الخطأ في فهم الوقائع: ${B}
2. الخطأ في تطبيق النظام: ${B}
3. إغفال دفوع أو بينات جوهرية: ${B}

## ثالثًا: الطلبات
1. قبول الاعتراض شكلًا لتقديمه في المدة النظامية.
2. نقض الحكم والحكم بـ ${B}.
3. نظر الاعتراض مرافعةً (عند الحاجة).`,
    cassation: `نتقدم بلائحتنا الاعتراضية بطلب النقض على حكم محكمة الاستئناف المشار إليه، خلال المدة النظامية، استنادًا إلى أسباب النقض المحددة نظامًا (يُتحقق من رقم المادة):

## أولًا: ملخص الحكم
${B}

## ثانيًا: أسباب النقض
1. مخالفة أحكام الشريعة الإسلامية أو الأنظمة: ${B}
2. صدور الحكم من محكمة غير مشكّلة تشكيلًا سليمًا: ${B}
3. صدور الحكم من محكمة أو دائرة غير مختصة: ${B}
4. الخطأ في تكييف الواقعة أو وصفها: ${B}

## ثالثًا: الطلبات
1. قبول الاعتراض شكلًا.
2. نقض الحكم وإعادته إلى المحكمة التي أصدرته للحكم فيه من جديد.`,
    review: `نتقدم بالتماس إعادة النظر في الحكم النهائي المشار إليه، خلال المدة النظامية من تاريخ العلم بسبب الالتماس (يُتحقق من رقم المادة):

## أولًا: الحالة المنطبقة
${B}
(مثل: ظهور تزوير الأوراق، أو الحصول على أوراق قاطعة لم يمكن تقديمها، أو غش الخصم، أو الحكم بما لم يُطلب، أو تناقض المنطوق، أو الحكم الغيابي، أو عدم صحة التمثيل)

## ثانيًا: الوقائع وتاريخ العلم
${B}

## ثالثًا: الأدلة
1. ${B}

## رابعًا: الطلبات
1. قبول الالتماس شكلًا.
2. إلغاء الحكم والحكم بـ ${B}.`,
    closing: `## أولًا: ملخص الدعوى
${facts}

## ثانيًا: ما ثبت أثناء نظر الدعوى
1. ${B}

## ثالثًا: الطلبات الختامية
1. ${B}`,
    execution: `## أولًا: بيانات السند التنفيذي
| نوع السند | ${B} |
| رقمه وتاريخه | ${B} |
| المبلغ / المطلوب تنفيذه | ${B} |

## ثانيًا: الطلبات
1. تنفيذ السند التنفيذي المرفق بحق المنفذ ضده.
2. ${B}`,
  };
  return `${head}
${addr}
السلام عليكم ورحمة الله وبركاته، وبعد:

${sections[type] || sections.claim}${notes ? `

## ملاحظات المحامي (تُحذف قبل التقديم)
${notes}` : ""}

> والله يحفظكم ويرعاكم،،

!| وكيل ${role} |
!| ${law?.name || B} — ${S.firm.nameAr} |
!| ترخيص رقم: ${law?.license || B} |
!| التوقيع: ........................ |`;
}

/* ---------- Drafting page ---------- */
function docRow(d) {
  const c = caseById(d.caseId);
  return `<div class="li clickable doc-card" data-act="openDoc" data-id="${d.id}"><span class="ic">${icon({ contract: "contract", proposal: "coin", invoice: "receipt", opinion: "chat" }[d.kind] || "scale")}</span><div class="body"><div class="ttl">${esc(d.title)}</div><div class="meta"><span>${esc(DOC_KINDS[d.kind] || "")}</span>${c ? `<span>${esc(c.title)}</span>` : d.clientId ? `<span>${esc(clientName(d.clientId))}</span>` : ""}<span>${esc(lawyerName(d.createdBy) === "غير مسند" ? "" : lawyerName(d.createdBy))}</span><span>${ago(d.updatedAt || d.createdAt)}</span></div></div>${d.status === "final" ? pill("نهائي", "ok") : pill("مسودة")}</div>`;
}
VIEWS.drafting = () => {
  const tab = S.route.tab || "home";
  const docs = [...S.data.docs].sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
  const head = `<div class="page-head"><div><h1>الصياغة</h1><p>عقود من النموذج الأساسي، عروض أتعاب، ولوائح وردود ${S.caps.sample ? "يكتبها المساعد من ملف القضية" : "بهياكلها النظامية"}.</p></div></div>
    <div class="tabs">${[["home", "إنشاء"], ["pleading", "اللوائح والردود"], ...(isManager() ? [["contract", "العقود"], ["proposal", "عروض الأتعاب"]] : []), ["all", "كل المستندات", docs.length]].map(([k, t, n]) => `<a class="${tab === k ? "on" : ""}" data-act="tab" data-tab="${k}">${t}${n ? `<span class="n num">${n}</span>` : ""}</a>`).join("")}</div>`;
  if (tab === "home") return head + `<div class="gen-grid">
      <button class="card gen" data-act="tab" data-tab="pleading"><span class="ic">${icon("scale")}</span><b>لائحة أو رد</b><span>صحيفة دعوى، مذكرة جوابية، استئناف، نقض، التماس… ${S.caps.sample ? "يكتبها المساعد من وقائع القضية ومرفقاتها." : "بهيكلها النظامي وبيانات القضية جاهزة للتعبئة."}</span></button>
      ${isManager() ? `<button class="card gen" data-act="tab" data-tab="contract"><span class="ic">${icon("contract")}</span><b>عقد خدمات قانونية</b><span>من النموذج الأساسي للمكتب، تُملأ بياناته تلقائيًا من العميل والقضية.</span></button>` : ""}
      ${isManager() ? `<button class="card gen" data-act="tab" data-tab="proposal"><span class="ic">${icon("coin")}</span><b>عرض أتعاب</b><span>بنود الخدمات والمبالغ والضريبة وشروط السداد بترويسة المكتب.</span></button>` : ""}</div>
    <div class="card"><div class="card-h"><h3>آخر المستندات</h3></div>${docs.length ? `<div class="list">${docs.slice(0, 8).map(docRow).join("")}</div>` : emptyBox("docs", "لم تُنشأ مستندات بعد", "")}</div>`;
  if (tab === "all") return head + `<div class="card">${docs.length ? `<div class="list">${docs.map(docRow).join("")}</div>` : emptyBox("docs", "لا مستندات", "")}</div>`;
  if ((tab === "contract" || tab === "proposal") && !isManager()) return head + `<div class="card">${emptyBox("coin", "العقود وعروض الأتعاب من صلاحية المدير", "")}</div>`;
  return head + GEN_FORMS[tab]();
};
const dv = (k, d = "") => S.drafts[k] ?? d;
const GEN_FORMS = {};
GEN_FORMS.pleading = () => {
  const cid = dv("pl.case"); const c = caseById(cid);
  const files = c && S.caseLoadedFor === cid ? S.caseFiles : [];
  return `<form data-form="genPleading" class="card stack" style="gap:14px"><div class="card-h"><h3>${S.caps.sample ? "صياغة لائحة أو رد بالمساعد" : "لائحة أو رد من النموذج"}</h3>${S.caps.sample ? `<span class="ai-tag">${icon("spark")}يستخدم وقائع القضية وتحليل مرفقاتها</span>` : ""}</div>
    <div class="grid2">
      <div class="field"><label for="pl-case">القضية</label><select id="pl-case" class="inp" name="caseId" required data-ch="plCase">${caseOpts(cid, "— اختر القضية —")}</select></div>
      <div class="field"><label for="pl-type">نوع المستند</label><select id="pl-type" class="inp" name="type">${Object.entries(PLEADING_TYPES).map(([k, v]) => opt(k, `${v.t} — ${v.hint}`, dv("pl.type", "claim"))).join("")}</select></div>
      <div class="field span2"><label for="pl-file">مستند يُرد عليه (اختياري)</label><select id="pl-file" class="inp" name="fileId">${opt("", c ? (files.length ? "— بدون —" : "لا توجد مرفقات في هذه القضية") : "اختر القضية أولًا")}${files.map((f) => opt(f.id, `${f.name} · ${f.category || ""}`)).join("")}</select><span class="hint">مثل مذكرة الخصم أو الحكم المعترض عليه؛ يقرأ المساعد نصه ويرد عليه.</span></div>
      <div class="field span2"><label for="pl-ins">توجيهات المحامي</label><textarea id="pl-ins" class="inp" name="instructions" rows="5" data-draft="pl.ins" placeholder="أهم الدفوع، الطلبات، المستندات التي نستند إليها، أي نقطة يجب التركيز عليها أو تجنبها…">${esc(dv("pl.ins"))}</textarea></div>
    </div>
    <div class="row"><button class="btn gold" type="submit">${S.caps.sample ? icon("spark") + "اكتب المسودة" : icon("scale") + "أنشئ اللائحة"}</button><span class="muted small">${S.caps.sample ? "تُفتح المسودة في المحرر لتعديلها ثم تنزيلها بصيغة Word." : "تُفتح بهيكلها وبيانات القضية، والفراغات مظللة لتعبئتها ثم تنزيلها بصيغة Word."}</span></div></form>`;
};
CH.plCase = (el) => { S.drafts["pl.case"] = el.value; if (el.value) subscribeCase(el.value); render(); };
GEN_FORMS.contract = () => `<form data-form="genContract" class="card stack" style="gap:14px"><div class="card-h"><h3>عقد من النموذج الأساسي</h3><a class="sub" data-act="go" data-r="settings" style="cursor:pointer">تعديل النماذج ←</a></div>
  <div class="grid2">
    <div class="field"><label for="ct-tpl">النموذج</label><select id="ct-tpl" class="inp" name="tpl">${Object.entries(CONTRACT_TEMPLATES).map(([k, t]) => opt(k, t.name, dv("ct.tpl"))).join("")}</select></div>
    <div class="field"><label for="ct-case">القضية (اختياري)</label><select id="ct-case" class="inp" name="caseId" data-ch="ctCase">${caseOpts(dv("ct.case"))}</select></div>
    <div class="field"><label for="ct-client">العميل</label><select id="ct-client" class="inp" name="clientId" required>${clientOpts(dv("ct.client") || caseById(dv("ct.case"))?.clientId)}</select></div>
    <div class="field"><label for="ct-subject">موضوع التكليف</label><input id="ct-subject" class="inp" name="subject" required data-draft="ct.subject" value="${esc(dv("ct.subject", caseById(dv("ct.case"))?.title || ""))}"></div>
    <div class="field"><label for="ct-fee">الأتعاب (ر.س)</label><input id="ct-fee" class="inp num" name="fee" inputmode="decimal" required data-draft="ct.fee" value="${esc(dv("ct.fee", caseById(dv("ct.case"))?.fee || ""))}"></div>
    <div class="field"><label for="ct-vat">الضريبة</label><select id="ct-vat" class="inp" name="vat">${opt("excl", "غير شاملة ضريبة القيمة المضافة 15%")}${opt("incl", "شاملة ضريبة القيمة المضافة")}${opt("none", "بدون ذكر الضريبة")}</select></div>
    <div class="field"><label for="ct-rep">ممثل المكتب في التوقيع</label><input id="ct-rep" class="inp" name="firmRep" data-draft="ct.rep" value="${esc(dv("ct.rep", myLawyer()?.name || ""))}"></div>
    <div class="field"><label for="ct-dur">مدة العقد</label><input id="ct-dur" class="inp" name="duration" data-draft="ct.dur" value="${esc(dv("ct.dur", "صدور حكم نهائي في الدعوى"))}"></div>
    <div class="field span2"><label for="ct-pay">طريقة السداد</label><input id="ct-pay" class="inp" name="payment" data-draft="ct.pay" value="${esc(dv("ct.pay", S.firm.paymentTerms))}"></div>
    <div class="field span2"><label for="ct-scope">نطاق العمل</label><textarea id="ct-scope" class="inp" name="scope" rows="4" data-draft="ct.scope" placeholder="سطر لكل بند. اتركه فارغًا ليقترحه المساعد.">${esc(dv("ct.scope"))}</textarea></div>
    <label class="chk span2"><input type="checkbox" name="ai" value="1" ${S.caps.sample ? "" : "disabled"}> اطلب من المساعد مراجعة البنود وتكييفها مع طبيعة القضية</label>
  </div><div class="row"><button class="btn gold" type="submit">${icon("contract")}إنشاء العقد</button></div></form>`;
CH.ctCase = (el) => { S.drafts["ct.case"] = el.value; const c = caseById(el.value); if (c) { S.drafts["ct.client"] = c.clientId; S.drafts["ct.subject"] = c.title; if (c.fee) S.drafts["ct.fee"] = c.fee; } render(); };
GEN_FORMS.proposal = () => {
  const rows = S.drafts["pr.rows"] || (S.drafts["pr.rows"] = [{ d: "دراسة القضية والمستندات وإبداء الرأي القانوني", a: "" }, { d: "إعداد صحيفة الدعوى والمذكرات والترافع أمام المحكمة الابتدائية", a: "" }]);
  const sub = rows.reduce((s, r) => s + (Number(r.a) || 0), 0); const vat = dv("pr.vat", "1") === "1" ? sub * 0.15 : 0;
  return `<form data-form="genProposal" class="card stack" style="gap:14px"><div class="card-h"><h3>عرض أتعاب</h3></div>
  <div class="grid2">
    <div class="field"><label for="pr-client">العميل</label><select id="pr-client" class="inp" name="clientId" data-ch="prField" data-k="pr.client">${clientOpts(dv("pr.client"))}</select><span class="hint">أو اكتب اسم عميل محتمل:</span><input id="pr-prospect" class="inp" name="prospect" data-draft="pr.prospect" value="${esc(dv("pr.prospect"))}" placeholder="اسم العميل المحتمل"></div>
    <div class="field"><label for="pr-case">القضية (اختياري)</label><select id="pr-case" class="inp" name="caseId" data-ch="prField" data-k="pr.case">${caseOpts(dv("pr.case"))}</select></div>
    <div class="field span2"><label for="pr-subject">الموضوع</label><input id="pr-subject" class="inp" name="subject" required data-draft="pr.subject" value="${esc(dv("pr.subject", caseById(dv("pr.case"))?.title || ""))}" placeholder="مثال: الترافع في دعوى مطالبة مالية أمام المحكمة التجارية"></div>
    <div class="field span2"><label>بنود الخدمات والأتعاب</label>
      <div class="stack" style="gap:8px">${rows.map((r, i) => `<div class="svc-row"><input class="inp" aria-label="الخدمة" data-ch="prRow" data-i="${i}" data-k="d" value="${esc(r.d)}"><input class="inp num" aria-label="المبلغ" inputmode="decimal" placeholder="المبلغ" data-ch="prRow" data-i="${i}" data-k="a" value="${esc(r.a)}"><button type="button" class="icon-btn" data-act="prDel" data-i="${i}" aria-label="حذف">${icon("x")}</button></div>`).join("")}</div>
      <div class="row" style="margin-top:6px"><button type="button" class="btn sm" data-act="prAdd">${icon("plus")}بند</button><span class="grow"></span><span class="num">المجموع ${money(sub)} · الضريبة ${money(vat)} · الإجمالي <b>${money(sub + vat)}</b> ر.س</span></div></div>
    <div class="field"><label for="pr-vat">ضريبة القيمة المضافة 15%</label><select id="pr-vat" class="inp" name="vat" data-ch="prField" data-k="pr.vat">${opt("1", "تُضاف إلى المبالغ", dv("pr.vat", "1"))}${opt("0", "لا تُضاف", dv("pr.vat", "1"))}</select></div>
    <div class="field"><label for="pr-valid">صلاحية العرض (يوم)</label><input id="pr-valid" class="inp num" name="validity" data-draft="pr.valid" value="${esc(dv("pr.valid", S.firm.proposalValidity))}"></div>
    <div class="field span2"><label for="pr-pay">شروط السداد</label><input id="pr-pay" class="inp" name="payment" data-draft="pr.pay" value="${esc(dv("pr.pay", S.firm.paymentTerms))}"></div>
    <div class="field span2"><label for="pr-scope">نطاق العمل ومنهجيته</label><textarea id="pr-scope" class="inp" name="scope" rows="5" data-draft="pr.scope" placeholder="اتركه فارغًا واضغط «اقترح» ليكتبه المساعد من الموضوع.">${esc(dv("pr.scope"))}</textarea>
      <div><button type="button" class="btn sm" data-act="prSuggest" ${S.caps.sample ? "" : "disabled"}>${icon("spark")}اقترح نطاق العمل</button></div></div>
  </div><div class="row"><button class="btn gold" type="submit">${icon("coin")}إنشاء العرض</button></div></form>`;
};
CH.prField = (el) => { S.drafts[el.dataset.k] = el.value; if (el.dataset.k === "pr.case") { const c = caseById(el.value); if (c) { S.drafts["pr.client"] = c.clientId; S.drafts["pr.subject"] = c.title; } } render(); };
CH.prRow = (el) => { S.drafts["pr.rows"][Number(el.dataset.i)][el.dataset.k] = el.value; if (el.dataset.k === "a") render(); };
A.prAdd = () => { S.drafts["pr.rows"].push({ d: "", a: "" }); render(); };
A.prDel = (el) => { S.drafts["pr.rows"].splice(Number(el.dataset.i), 1); render(); };
A.prSuggest = async (el) => {
  if (!needSample()) return; const subj = $("#pr-subject")?.value?.trim(); if (!subj) return toast("اكتب الموضوع أولًا", true);
  el.disabled = true; el.innerHTML = '<span class="thinking">يكتب…</span>';
  try {
    const c = caseById(dv("pr.case"));
    const { text } = await S.caps.sample(`اكتب فقرة «نطاق العمل ومنهجيته» لعرض أتعاب من مكتب محاماة سعودي، بالعربية الرسمية، في 5-8 بنود قصيرة يبدأ كل منها بـ "- " دون مقدمة أو خاتمة.\nالموضوع: ${subj}\n${c ? caseContext(c) : ""}\nالخدمات المسعّرة: ${S.drafts["pr.rows"].map((r) => r.d).filter(Boolean).join("؛ ")}`, { modelTier: "quick", cache: false });
    S.drafts["pr.scope"] = text.trim(); render();
  } catch (e) { aiErr(e); render(); }
};

/* ---------- generators ---------- */
function fillTemplate(tpl, v) { return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (v[k] !== undefined && v[k] !== "" ? v[k] : "[........]")); }
function contractNo() { const y = new Date().getFullYear(); return `RK-C-${y}-${String(S.data.docs.filter((d) => d.kind === "contract").length + 1).padStart(3, "0")}`; }
F.genContract = async (d) => {
  if (!guardWrite()) return;
  const cl = byId(S.data.clients, d.clientId) || {}; const c = caseById(d.caseId) || {}; const f = S.firm;
  const fee = Number(String(d.fee).replace(/,/g, "")) || 0;
  const vals = { contract_no: contractNo(), date: fmtDate(todayStr()), date_hijri: fmtHijri(todayStr()), city: f.city, firm_name: f.nameAr, firm_cr: f.cr, firm_license: f.license, firm_address: f.address, firm_rep: d.firmRep,
    client_name: cl.name, client_id: cl.idNo, client_rep: cl.rep || cl.name, client_address: cl.address, client_phone: cl.phone, client_email: cl.email,
    subject: d.subject, court: c.court ? `${c.court}${c.city ? " بمدينة " + c.city : ""}` : "", opponent: c.opponent, fee: money(fee),
    vat_note: d.vat === "excl" ? `غير شامل ضريبة القيمة المضافة (15%) البالغة ${money(fee * 0.15)} ريال` : d.vat === "incl" ? "شاملًا ضريبة القيمة المضافة" : "", payment_terms: d.payment, duration: d.duration,
    scope: (d.scope || "").split("\n").filter((x) => x.trim()).map((x) => (x.trim().startsWith("-") ? x.trim() : "- " + x.trim())).join("\n") };
  const tpl = S.templates[d.tpl] || CONTRACT_TEMPLATES[d.tpl].body;
  let body = fillTemplate(tpl, vals);
  const title = `${CONTRACT_TEMPLATES[d.tpl].name} — ${cl.name || ""}`;
  const id = await add("docs", { kind: "contract", subtype: d.tpl, title, caseId: d.caseId || "", clientId: d.clientId, body, status: "draft", updatedAt: nowIso() });
  if (d.caseId) await logCase(d.caseId, "doc", `أُنشئ عقد: ${title}`);
  S.drafts = Object.fromEntries(Object.entries(S.drafts).filter(([k]) => !k.startsWith("ct.")));
  go("doc", id);
  if (d.ai === "1" || !vals.scope) {
    const ins = `راجع هذا العقد المعد من نموذج مكتب محاماة سعودي وكيّف بنوده مع موضوع التكليف «${d.subject}»${c.type ? ` (قضية ${c.type})` : ""}. ${vals.scope ? "" : "اكتب بند نطاق العمل المناسب مكان [........] في البند الثاني. "}حافظ على البنية والعناوين والجدول الأخير والحقول الفارغة [........] كما هي، ولا تغيّر الأرقام. أعد نص العقد كاملًا فقط.`;
    aiRewrite(id, ins, body);
  }
};
F.genProposal = async (d) => {
  if (!guardWrite()) return;
  const cl = byId(S.data.clients, d.clientId); const name = cl?.name || d.prospect; if (!name) return toast("اختر العميل أو اكتب اسم العميل المحتمل", true);
  const rows = S.drafts["pr.rows"].filter((r) => r.d.trim()); const sub = rows.reduce((s, r) => s + (Number(String(r.a).replace(/,/g, "")) || 0), 0);
  const vat = d.vat === "1" ? sub * 0.15 : 0; const f = S.firm;
  const valid = new Date(); valid.setDate(valid.getDate() + (Number(d.validity) || 30));
  const no = `RK-P-${new Date().getFullYear()}-${String(S.data.docs.filter((x) => x.kind === "proposal").length + 1).padStart(3, "0")}`;
  const body = `# عرض أتعاب مهنية

رقم العرض: ${no}
التاريخ: ${fmtDate(todayStr())} الموافق ${fmtHijri(todayStr())}

السادة / ${name}${cl?.rep ? `\nعناية / ${cl.rep}` : ""}
السلام عليكم ورحمة الله وبركاته، وبعد:

يسرّ ${f.nameAr} أن تتقدم إليكم بعرضها المهني بشأن: ${d.subject}، وذلك وفق ما يلي:

## أولًا: نطاق العمل ومنهجيته
${(d.scope || "- يُحدد نطاق العمل بعد دراسة المستندات.").trim()}

## ثانيًا: الأتعاب المهنية
| البند | الخدمة | المبلغ (ر.س) |
${rows.map((r, i) => `| ${i + 1} | ${r.d} | ${money(Number(String(r.a).replace(/,/g, "")) || 0)} |`).join("\n")}
| | المجموع | ${money(sub)} |
${d.vat === "1" ? `| | ضريبة القيمة المضافة (15%) | ${money(vat)} |\n` : ""}| | الإجمالي | ${money(sub + vat)} |

## ثالثًا: شروط السداد
- ${d.payment}
${f.iban ? `- يُسدد بالتحويل إلى حساب المكتب لدى ${f.bank || "البنك"}، رقم الآيبان: ${f.iban}` : ""}

## رابعًا: أحكام عامة
- لا تشمل الأتعاب الرسوم القضائية ورسوم التوثيق والترجمة والخبرة والسفر، ويتحملها العميل بعد موافقته.
- التزام المكتب التزام ببذل عناية وفق أصول مهنة المحاماة، ولا يضمن نتيجة بعينها.
- يسري هذا العرض حتى ${fmtDate(ymd(valid))}، ويصبح ملزمًا بعد توقيع عقد الخدمات وسداد الدفعة الأولى.

> وتفضلوا بقبول فائق التحية والتقدير،،

!| ${f.nameAr} | الموافقة على العرض |
!| ${myLawyer()?.name || "[........]"} | الاسم: [........] |
!| التوقيع: ........................ | التوقيع: ........................ |`;
  const title = `عرض أتعاب — ${name}`;
  const id = await add("docs", { kind: "proposal", title, caseId: d.caseId || "", clientId: d.clientId || "", body, status: "draft", total: sub + vat, updatedAt: nowIso() });
  if (d.caseId) await logCase(d.caseId, "doc", `أُنشئ عرض أتعاب: ${money(sub + vat)} ر.س`);
  S.drafts = Object.fromEntries(Object.entries(S.drafts).filter(([k]) => !k.startsWith("pr.")));
  go("doc", id);
};
F.genPleading = async (d) => {
  if (!guardWrite()) return;
  const c = caseById(d.caseId); if (!c) return toast("اختر القضية", true);
  if (!S.caps.sample) {
    const T0 = PLEADING_TYPES[d.type]; const title0 = `${T0.t} — ${c.title}`;
    const id0 = await add("docs", { kind: "pleading", subtype: d.type, title: title0, caseId: c.id, clientId: c.clientId, body: pleadingTemplate(c, d.type, d.instructions), status: "draft", updatedAt: nowIso() });
    await logCase(c.id, "doc", `أُنشئت لائحة من النموذج: ${T0.t}`); S.drafts["pl.ins"] = ""; go("doc", id0); return;
  }
  const T = PLEADING_TYPES[d.type];
  const target = d.fileId ? byId(S.caseFiles, d.fileId) : null;
  const files = S.caseFiles.filter((f) => f.analysis).map((f) => `• ${f.name}: ${f.analysis.summary}`).join("\n");
  const laws = await lawContext([T.t, c.type, c.court, c.title, c.description, d.instructions, (target?.text || "").slice(0, 1500)].join(" "), 10);
  const prompt = `أنت محامٍ سعودي متمرس في «${S.firm.nameAr}». اكتب «${T.t}» كاملة وجاهزة للتقديم، وفق نظام المرافعات الشرعية ولوائحه وأعراف الصياغة القضائية في المملكة العربية السعودية.
تاريخ اليوم: ${todayStr()} الموافق ${fmtHijri(todayStr())}.
${caseContext(c)}
${laws}
${files ? `\nخلاصة مرفقات القضية:\n${files}` : ""}
${target ? `\nالمستند المطلوب الرد عليه/الاعتراض عليه («${target.name}»):\n"""\n${(target.text || target.analysis?.summary || "").slice(0, 40000)}\n"""` : ""}
${d.instructions ? `\nتوجيهات المحامي:\n${d.instructions}` : ""}

صيغة الكتابة (مهمة لإخراج المستند بترويسة المكتب):
- السطر الأول: > بسم الله الرحمن الرحيم
- ثم: # ${T.t}
- ثم جدول بيانات بهذه الصيغة تمامًا (عمودان، كل سطر يبدأ بـ |):
| البيان | التفاصيل |
| ${c.clientRole || "الموكل"} | ${clientName(c.clientId)} |
| الخصم | ${c.opponent || "[........]"} |
| المحكمة / الدائرة | ${[c.court, c.circuit, c.city].filter(Boolean).join(" — ") || "[........]"} |
| رقم القضية | ${c.najiz || "[........]"} |
- العناوين الرئيسية بـ "## " مرقمة بالترتيب: ## أولًا: … ، ## ثانيًا: …
- الأسباب والدفوع والطلبات قوائم مرقمة "1. " "2. "، والنقاط الفرعية بـ "- ".
- لا تستخدم ** ولا ### ولا رموزًا أخرى.
متطلبات الصياغة:
- ثم الديباجة: ${d.type === "cassation" ? "«أصحاب الفضيلة رئيس وأعضاء المحكمة العليا وفقهم الله» (تُقدّم عبر المحكمة مصدرة الحكم)" : d.type === "appeal" ? "«أصحاب الفضيلة رئيس وأعضاء محكمة الاستئناف وفقهم الله» (تُقدّم عبر المحكمة مصدرة الحكم)" : `«فضيلة رئيس ${c.circuit || "الدائرة"} ${c.court ? "في " + c.court : ""} ${c.city ? "بمدينة " + c.city : ""} سلمه الله»`} والسلام.
- بيانات الأطراف والقضية (رقمها ${c.najiz || "[........]"}).
- استخدم عناوين فرعية تبدأ بـ "## " (مثل: الوقائع، الدفوع الشكلية، الدفوع الموضوعية، الأسانيد النظامية، الطلبات)، ونقاطًا تبدأ بـ "- ".
- ${d.type === "reply" || d.type === "defense" ? "رد على كل دفع للخصم بندًا بندًا مع السند." : OBJ_GUIDE[d.type] ? OBJ_GUIDE[d.type] + (c.judgment ? `\nبيانات الحكم المسجلة: رقم ${c.judgment.no || "[........]"}، تاريخه ${c.judgment.date || "[........]"}، المحكمة ${c.judgment.court || c.court || "[........]"}، تاريخ التسلّم/العلم ${c.judgment.receivedAt || "[........]"}، آخر موعد ${c.judgment.deadline || "—"}.` : "") : "رتب الطلبات بوضوح في آخر المذكرة."}
- لا تخترع وقائع أو أرقام مواد غير متيقن منها؛ ضع [........] لكل معلومة ناقصة، واكتب (يُتحقق من رقم المادة) بجانب أي مادة نظامية تذكرها دون يقين.
- اختم بسطر: > والله يحفظكم ويرعاكم،،
- ثم كتلة التوقيع بهذه الصيغة تمامًا:
!| وكيل ${c.clientRole || "الموكل"} |
!| ${lawyerName(c.lawyerId) === "غير مسند" ? "[........]" : lawyerName(c.lawyerId)} — ${S.firm.nameAr} |
!| ترخيص رقم: ${byId(S.data.lawyers, c.lawyerId)?.license || "[........]"} |
!| التوقيع: ........................ |`;
  const title = `${T.t} — ${c.title}`;
  const id = await add("docs", { kind: "pleading", subtype: d.type, title, caseId: c.id, clientId: c.clientId, body: "", status: "draft", updatedAt: nowIso() });
  S.drafts["pl.ins"] = "";
  go("doc", id);
  const ctl = new AbortController(); S.gen = { kind: "doc", docId: id, text: "", ctl }; render();
  try {
    const { text } = await S.caps.sample(prompt, { signal: ctl.signal, cache: false, onText: ({ text }) => { S.gen.text = text; const t = $("#doc-body"); if (t) { t.value = text; livePreview(); } } });
    await upd(`docs/${id}`, { body: text.trim() });
    await logCase(c.id, "doc", `صاغ المساعد مسودة: ${T.t}`);
    toast("اكتملت المسودة. راجعها قبل التقديم.");
  } catch (e) { aiErr(e); if (S.gen?.text) await upd(`docs/${id}`, { body: S.gen.text }); }
  finally { S.gen = null; render(); }
};
A.draftFor = (el) => { const c = caseById(el.dataset.id); const k = el.dataset.kind;
  if (k === "pleading") S.drafts["pl.case"] = c.id; if (k === "contract") { S.drafts["ct.case"] = c.id; S.drafts["ct.client"] = c.clientId; S.drafts["ct.subject"] = c.title; if (c.fee) S.drafts["ct.fee"] = c.fee; }
  if (k === "proposal") { S.drafts["pr.case"] = c.id; S.drafts["pr.client"] = c.clientId; S.drafts["pr.subject"] = c.title; }
  go("drafting", null, k); };

/* ---------- Document editor ---------- */
A.openDoc = (el) => go("doc", el.dataset.id);
VIEWS.doc = () => {
  const d = byId(S.data.docs, S.route.id);
  if (!d) return S.loaded.docs ? `<div class="card">${emptyBox("docs", "لم نجد المستند", "", `<button class="btn" data-act="go" data-r="drafting">العودة</button>`)}</div>` : `<div class="thinking">جارٍ التحميل…</div>`;
  const generating = S.gen && S.gen.docId === d.id;
  const body = generating ? S.gen.text : (S.drafts["doc." + d.id] ?? d.body);
  const c = caseById(d.caseId);
  after.push(livePreview);
  return `<div class="crumbs"><a data-act="go" data-r="drafting">الصياغة</a><span>/</span><span>${esc(DOC_KINDS[d.kind])}</span>${c ? `<span>/</span><a data-act="openCase" data-id="${c.id}">${esc(c.title)}</a>` : ""}</div>
  <div class="page-head"><div class="grow"><input id="doc-title" class="inp" style="font-family:var(--f-doc);font-size:21px;font-weight:700;border-color:transparent;padding-inline:0;background:transparent" value="${esc(d.title)}" data-draft="doct.${d.id}" aria-label="عنوان المستند"></div>
    <div class="row">${generating ? `<span class="thinking">يكتب المساعد…</span><button class="btn" data-act="stopGen">إيقاف</button>` : `
      <button class="btn primary" data-act="saveDoc" data-id="${d.id}">${icon("check")}حفظ</button>
      <button class="btn gold" data-act="exportDocx" data-id="${d.id}">${icon("download")}تنزيل Word</button>
      <button class="btn" data-act="sendDoc" data-id="${d.id}">${icon("send")}إرسال للعميل</button>
      <button class="btn" data-act="copyDoc">${icon("copy")}نسخ النص</button>
      <button class="btn" data-act="aiEdit" data-id="${d.id}" ${S.caps.sample ? "" : "disabled"}>${icon("spark")}تعديل بالمساعد</button>
      <button class="btn ghost" data-act="toggleFinal" data-id="${d.id}">${d.status === "final" ? "إرجاع لمسودة" : "اعتماد كنهائي"}</button>
      <button class="btn ghost danger" data-act="deleteDoc" data-id="${d.id}" aria-label="حذف">${icon("trash")}</button>`}</div></div>
  <div class="editor"><div class="field"><label for="doc-body">النص <span class="muted">— # عنوان · ## قسم · 1. بند مرقم · - نقطة · | جدول | · !| توقيع | · > سطر في الوسط · **غامق**</span></label>
      <textarea id="doc-body" class="inp" data-draft="doc.${d.id}" data-live="preview" ${generating ? "readonly" : ""}>${esc(body)}</textarea></div>
    <div class="field"><label>المعاينة بترويسة المكتب</label><div id="doc-checks"></div><div id="preview"></div></div></div>`;
};
function livePreview() {
  const t = $("#doc-body"), p = $("#preview"); if (!t || !p) return; p.innerHTML = paperHtml(t.value);
  const k = docChecks(t.value), box = $("#doc-checks"); if (!box) return;
  box.innerHTML = `<div class="doc-checks">${k.blanks ? `<span class="pill warn">${k.blanks} فراغ يحتاج تعبئة</span><button class="btn sm" data-act="fillBlanks">${icon("edit")}عبّئ الفراغات</button>` : '<span class="pill ok">لا فراغات</span>'}${k.verify ? `<span class="pill bad">${k.verify} موضع يحتاج تحققًا من مادة نظامية</span>` : ""}${k.hasTitle ? "" : '<span class="pill">بلا عنوان رئيسي (#)</span>'}</div>`;
}
const BLANK_RE = /\[[^\]\n]{0,40}\.{3,}[^\]\n]{0,40}\]/g;
A.fillBlanks = () => {
  const body = $("#doc-body").value; const hits = [...body.matchAll(BLANK_RE)];
  if (!hits.length) return;
  modal("تعبئة الفراغات", `<form id="fb-form" data-form="fillBlanks" class="stack" style="gap:12px">${hits.map((m, i) => { const before = body.slice(Math.max(0, m.index - 60), m.index).split("\n").pop(); const after = body.slice(m.index + m[0].length, m.index + m[0].length + 30).split("\n")[0];
    return `<div class="field"><label for="fb-${i}" style="font-weight:400">…${esc(before)}<mark>${esc(m[0])}</mark>${esc(after)}…</label><input id="fb-${i}" class="inp" name="b${i}" placeholder="اتركه فارغًا لإبقائه"></div>`; }).join("")}</form>`,
    `<button class="btn primary" type="submit" form="fb-form">تطبيق</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`, true);
};
F.fillBlanks = (d) => {
  const t = $("#doc-body"); let i = 0;
  t.value = t.value.replace(BLANK_RE, (m) => { const v = (d["b" + i++] || "").trim(); return v || m; });
  S.drafts["doc." + S.route.id] = t.value; closeModal(); livePreview(); toast("عُبّئت الفراغات. اضغط «حفظ» لاعتمادها.");
};
CH.preview = debounce(livePreview, 150);
A.saveDoc = async (el) => { const id = el.dataset.id; const body = $("#doc-body").value; const title = $("#doc-title").value.trim() || "مستند"; await upd(`docs/${id}`, { body, title }); delete S.drafts["doc." + id]; delete S.drafts["doct." + id]; toast("حُفظ المستند"); };
A.toggleFinal = async (el) => { const d = byId(S.data.docs, el.dataset.id); const fin = d.status !== "final"; await upd(`docs/${d.id}`, { status: fin ? "final" : "draft", body: $("#doc-body").value }); if (fin && d.caseId) await logCase(d.caseId, "doc", `اعتُمد المستند كنسخة نهائية: ${d.title}`); toast(fin ? "اعتُمد المستند" : "أُعيد مسودة"); };
A.deleteDoc = (el) => confirmBox("حذف المستند", "سيُحذف المستند نهائيًا.", "حذف", async () => { await del(`docs/${el.dataset.id}`); go("drafting", null, "all"); toast("حُذف"); }, true);
A.copyDoc = async () => { const t = $("#doc-body"); try { await navigator.clipboard.writeText(t.value); toast("نُسخ النص"); } catch { t.select(); toast("حدّد النص وانسخه يدويًا"); } };
A.exportDocx = async (el) => {
  if (!S.caps.downloads) return toast("التنزيل غير متاح في هذا العرض.", true);
  const title = $("#doc-title").value.trim() || "مستند"; const body = $("#doc-body").value;
  el.disabled = true;
  try { const blob = await buildDocx(title, body); await S.caps.downloads.save({ filename: title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 90) + ".docx", data: blob }); toast("جاهز للتنزيل"); }
  catch (e) { if (e?.code !== "declined") { console.error(e); toast("تعذّر إنشاء ملف Word.", true); } }
  finally { el.disabled = false; }
};
A.aiEdit = (el) => {
  modal("تعديل بالمساعد", `<form id="ai-form" data-form="aiEdit"><input type="hidden" name="id" value="${el.dataset.id}"><div class="field"><label for="ai-ins">ما المطلوب؟</label><textarea id="ai-ins" class="inp" name="ins" required rows="4" placeholder="مثال: اختصر الوقائع، وأضف دفعًا بعدم الاختصاص المكاني، واجعل الطلبات أكثر تحديدًا."></textarea></div></form>`,
    `<button class="btn gold" type="submit" form="ai-form">${icon("spark")}نفّذ</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
};
F.aiEdit = async (d) => { closeModal(); const cur = $("#doc-body")?.value; if (cur) await upd(`docs/${d.id}`, { body: cur, prevBody: cur }); aiRewrite(d.id, d.ins); };
async function aiRewrite(id, ins, baseOverride) {
  if (!needSample()) return;
  const doc = byId(S.data.docs, id); const base = baseOverride || $("#doc-body")?.value || doc?.body || "";
  const ctl = new AbortController(); S.gen = { kind: "doc", docId: id, text: "", ctl }; render();
  try {
    const { text } = await S.caps.sample(`أنت محامٍ سعودي في «${S.firm.nameAr}». عدّل المستند التالي وفق التوجيه، وأعد النص الكامل المعدل فقط محافظًا على صيغة الأسطر كما هي: (> للأسطر المتوسطة، # للعنوان، ## للعناوين، 1. للقوائم المرقمة، - للنقاط، | للجداول، !| لكتل التوقيع، [........] للفراغات)، دون أي تعليق.\nالتوجيه: ${ins}\n\nالمستند:\n"""\n${base}\n"""`,
      { signal: ctl.signal, cache: false, onText: ({ text }) => { S.gen.text = text; const t = $("#doc-body"); if (t) { t.value = text; livePreview(); } } });
    await upd(`docs/${id}`, { body: text.trim(), prevBody: base }); delete S.drafts["doc." + id]; toast("طُبّق التعديل. النسخة السابقة محفوظة.");
  } catch (e) { aiErr(e); }
  finally { S.gen = null; render(); }
}
