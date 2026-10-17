/* ============ Rakz — Contracts studio: drafting, review («تحكيم») and translation of client contracts ============
   Arabic, English or bilingual (side by side). Every draft and review is grounded in the law library (the Civil
   Transactions Law, Labour, Companies, Commercial Courts, Arbitration, Personal Data Protection, VAT …) through
   lawContext(), and checked against the points a sound contract needs under Saudi law. Contracts are «agreement»
   documents and reviews are «creview» documents, so both open in the editor and export to PDF / Word. */

const CONTRACT_TYPES = [
  { k: "sale", ar: "عقد بيع", en: "Sale Agreement", q: "عقد البيع المبيع الثمن التسليم ضمان العيوب الخفية نقل الملكية", checks: ["تعيين المبيع تعيينًا نافيًا للجهالة", "الثمن وطريقة سداده", "التسليم ومكانه وزمانه وانتقال تبعة الهلاك", "ضمان العيوب الخفية والاستحقاق"] },
  { k: "lease", ar: "عقد إيجار", en: "Lease Agreement", q: "عقد الإيجار المؤجر المستأجر الأجرة الصيانة الإخلاء تجديد الإيجار", checks: ["وصف العين المؤجرة والغرض من استعمالها", "الأجرة ومواعيد سدادها وزياداتها", "الصيانة الضرورية والتحسينات", "التجديد والإخلاء والتأجير من الباطن", "التسجيل في منصة «إيجار» ليكون العقد سندًا تنفيذيًا"] },
  { k: "employment", ar: "عقد عمل", en: "Employment Contract", q: "نظام العمل عقد العمل فترة التجربة الأجر ساعات العمل الإجازة مكافأة نهاية الخدمة إنهاء العقد عدم المنافسة", checks: ["كتابة العقد ووجود نسخة عربية معتمدة", "مدة العقد وفترة التجربة في حدودها النظامية", "الأجر وملحقاته ومكان العمل وساعاته", "الإجازات ومكافأة نهاية الخدمة", "حالات الإنهاء والإشعار", "شرط عدم المنافسة (المدة والمكان ونوع العمل)", "التوثيق في منصة «قوى»"] },
  { k: "services", ar: "عقد تقديم خدمات", en: "Services Agreement", q: "عقد تقديم الخدمات الأتعاب التزامات مقدم الخدمة معايير الأداء المسؤولية", checks: ["نطاق الخدمات ومخرجاتها ومعايير القبول", "المقابل والدفعات وربطها بالإنجاز", "مستوى الخدمة والجزاءات", "حدود المسؤولية والتعويض"] },
  { k: "supply", ar: "عقد توريد", en: "Supply Agreement", q: "عقد التوريد البيع التسليم المواصفات الفحص والقبول التأخير الشرط الجزائي", checks: ["المواصفات والكميات وجدول التوريد", "الفحص والاستلام ورفض المعيب", "التأخير والشرط الجزائي", "الضمان وخدمة ما بعد البيع"] },
  { k: "construction", ar: "عقد مقاولة", en: "Construction Contract", q: "عقد المقاولة المقاول رب العمل الضمان العشري المخططات التعديلات المستخلصات", checks: ["المخططات والمواصفات والبرنامج الزمني", "المستخلصات والدفعات المحتجزة", "الأوامر التغييرية", "الضمان العشري للمقاول والمهندس", "التأمين والسلامة"] },
  { k: "partnership", ar: "اتفاقية شركاء / مساهمين", en: "Shareholders' Agreement", q: "نظام الشركات الشريك الحصص نقل الحصص الإدارة الأرباح حق الأولوية التصفية", checks: ["الحصص ورأس المال وتعديلها", "الإدارة والتصويت والمسائل المحجوزة", "نقل الحصص وحق الأولوية والاستحواذ", "توزيع الأرباح", "حل الخلاف والجمود والتخارج", "التوافق مع عقد التأسيس ونظام الشركات"] },
  { k: "nda", ar: "اتفاقية عدم إفصاح وسرية", en: "Non-Disclosure Agreement", q: "السرية المعلومات السرية حماية البيانات الشخصية الإفصاح", checks: ["تعريف المعلومات السرية والاستثناءات", "مدة الالتزام بعد الانتهاء", "الإفصاح النظامي", "إعادة المعلومات وإتلافها", "حماية البيانات الشخصية"] },
  { k: "agency", ar: "عقد وكالة تجارية / توزيع", en: "Commercial Agency / Distribution", q: "نظام الوكالات التجارية الوكيل الموكل التوزيع الحصرية القيد في السجل", checks: ["قيد الوكالة في سجل الوكالات التجارية", "النطاق الجغرافي والحصرية", "الحد الأدنى للمبيعات", "الإنهاء والتعويض"] },
  { k: "franchise", ar: "عقد امتياز تجاري", en: "Franchise Agreement", q: "نظام الامتياز التجاري مانح الامتياز صاحب الامتياز وثيقة الإفصاح الرسوم", checks: ["وثيقة الإفصاح ومهلتها قبل التوقيع", "الرسوم والإتاوات", "حقوق الملكية الفكرية", "التدريب والدعم", "التسجيل لدى الجهة المختصة"] },
  { k: "software", ar: "عقد تقني / ترخيص برمجيات", en: "Software / SaaS Agreement", q: "حماية البيانات الشخصية التعاملات الإلكترونية حقوق المؤلف الترخيص الاستضافة", checks: ["نطاق الترخيص وملكية الشفرة والمخرجات", "مستوى الخدمة والتوافر", "حماية البيانات الشخصية ونقلها خارج المملكة", "الأمن السيبراني والإبلاغ عن الحوادث"] },
  { k: "settlement", ar: "اتفاقية تسوية / صلح", en: "Settlement Agreement", q: "الصلح التنازل المخالصة إنهاء النزاع إثبات الصلح", checks: ["تحديد النزاع محل الصلح", "المقابل وطريقة سداده", "المخالصة والتنازل عن الدعاوى", "إثبات الصلح أمام المحكمة أو مركز المصالحة"] },
  { k: "other", ar: "عقد آخر", en: "Other Agreement", q: "العقد أركان العقد التزامات الطرفين الإخلال الفسخ", checks: [] },
];
const ctypeOf = (k) => CONTRACT_TYPES.find((t) => t.k === k) || CONTRACT_TYPES[CONTRACT_TYPES.length - 1];

/* Points every contract under Saudi law is checked against. */
const SA_CHECKS = [
  "أهلية الأطراف وصفة الموقعين وتفويضهم (السجل التجاري، الوكالة، قرار الشركاء)",
  "تحديد محل العقد والمقابل تحديدًا نافيًا للجهالة والغرر",
  "خلو العقد من الفوائد الربوية وغرامات التأخير المحسوبة كفائدة (غير قابلة للتنفيذ)",
  "الشرط الجزائي: تقدير معقول، مع العلم بجواز تخفيضه قضاءً إذا كان مبالغًا فيه",
  "ضريبة القيمة المضافة: هل المبالغ شاملة أم غير شاملة، والفوترة الإلكترونية",
  "المدة والتجديد والإنهاء والآثار المترتبة عليه",
  "القوة القاهرة والظروف الطارئة",
  "السرية وحماية البيانات الشخصية متى عولجت بيانات أفراد",
  "الإشعارات وعناوينها ووسائلها الإلكترونية",
  "التنازل عن العقد والتعاقد من الباطن",
  "حدود المسؤولية والتعويض",
  "النظام الواجب التطبيق: أنظمة المملكة العربية السعودية",
  "تسوية النزاعات: المحكمة المختصة أو التحكيم وفق نظام التحكيم (المقر، العدد، اللغة، المركز)",
  "لغة العقد وأسبقية النص العربي عند الاختلاف",
  "التوقيع والتاريخ وعدد النسخ والملاحق",
];

/* Bilingual clause library: wording that holds up under Saudi law, ready to copy into a draft. */
const CLAUSES = [
  { t: "النظام الواجب التطبيق", en: "Governing Law", ar: "يخضع هذا العقد ويُفسَّر وفقًا للأنظمة المعمول بها في المملكة العربية السعودية.", e: "This Agreement shall be governed by and construed in accordance with the laws and regulations in force in the Kingdom of Saudi Arabia." },
  { t: "الاختصاص القضائي", en: "Jurisdiction", ar: "تختص محاكم المملكة العربية السعودية بنظر أي نزاع ينشأ عن هذا العقد أو يتعلق به، وذلك بعد استنفاد محاولات التسوية الودية خلال (ثلاثين) يومًا من تاريخ الإشعار بالنزاع.", e: "The courts of the Kingdom of Saudi Arabia shall have jurisdiction over any dispute arising out of or in connection with this Agreement, after the Parties have failed to settle it amicably within thirty (30) days of notice of the dispute." },
  { t: "التحكيم (المركز السعودي للتحكيم التجاري)", en: "Arbitration (SCCA)", ar: "أي نزاع ينشأ عن هذا العقد أو يتعلق به، بما في ذلك وجوده أو صحته أو تفسيره أو تنفيذه أو إنهاؤه، يُحال إلى التحكيم ويُفصل فيه نهائيًا وفقًا لقواعد التحكيم لدى المركز السعودي للتحكيم التجاري. ويكون عدد المحكمين [واحدًا/ثلاثة]، ومقر التحكيم مدينة [الرياض]، ولغته [العربية]. ويكون حكم التحكيم نهائيًا وملزمًا للطرفين.", e: "Any dispute arising out of or in connection with this Agreement, including any question regarding its existence, validity, interpretation, performance or termination, shall be referred to and finally resolved by arbitration under the Arbitration Rules of the Saudi Center for Commercial Arbitration. The number of arbitrators shall be [one/three], the seat of arbitration shall be [Riyadh], and the language of the arbitration shall be [Arabic]. The award shall be final and binding on the Parties." },
  { t: "أسبقية اللغة العربية", en: "Language", ar: "حُرِّر هذا العقد باللغتين العربية والإنجليزية، وفي حال وجود أي تعارض بين النصين يُعتد بالنص العربي.", e: "This Agreement is executed in Arabic and English. In the event of any inconsistency between the two texts, the Arabic text shall prevail." },
  { t: "القوة القاهرة", en: "Force Majeure", ar: "لا يُعد أي من الطرفين مخلًا بالتزاماته إذا كان التأخير أو عدم التنفيذ ناتجًا عن قوة قاهرة خارجة عن إرادته لا يمكن توقعها ولا دفعها، على أن يُشعر الطرف المتأثر الطرف الآخر كتابيًا خلال (سبعة) أيام من وقوعها، وإذا استمرت أكثر من (تسعين) يومًا جاز لأي من الطرفين إنهاء العقد بإشعار كتابي دون تعويض.", e: "Neither Party shall be in breach of this Agreement to the extent that any delay or failure to perform results from a force majeure event beyond its reasonable control that could not have been foreseen or avoided, provided that the affected Party notifies the other Party in writing within seven (7) days of its occurrence. If the event continues for more than ninety (90) days, either Party may terminate this Agreement by written notice without compensation." },
  { t: "السرية", en: "Confidentiality", ar: "يلتزم كل طرف بالمحافظة على سرية المعلومات التي يطّلع عليها بسبب هذا العقد، وعدم استخدامها لغير أغراضه، وعدم الإفصاح عنها للغير إلا بموافقة كتابية مسبقة أو بموجب التزام نظامي أو أمر من جهة مختصة، ويستمر هذا الالتزام مدة (ثلاث) سنوات بعد انتهاء العقد.", e: "Each Party shall keep confidential all information obtained in connection with this Agreement, shall not use it for any purpose other than this Agreement, and shall not disclose it to any third party without prior written consent, save as required by law or by order of a competent authority. This obligation shall survive for three (3) years after the termination of this Agreement." },
  { t: "حماية البيانات الشخصية", en: "Personal Data Protection", ar: "يلتزم الطرفان عند معالجة أي بيانات شخصية بموجب هذا العقد بأحكام نظام حماية البيانات الشخصية ولوائحه، وبعدم معالجتها إلا للغرض المحدد، واتخاذ التدابير التنظيمية والتقنية اللازمة لحمايتها، وعدم نقلها خارج المملكة إلا وفق الضوابط النظامية، وإشعار الطرف الآخر دون تأخير بأي تسرب أو اختراق.", e: "When processing any personal data under this Agreement, the Parties shall comply with the Personal Data Protection Law and its implementing regulations, process such data only for the specified purpose, take the necessary organisational and technical measures to protect it, not transfer it outside the Kingdom except in accordance with the applicable rules, and notify the other Party without delay of any breach." },
  { t: "ضريبة القيمة المضافة", en: "VAT", ar: "المبالغ الواردة في هذا العقد لا تشمل ضريبة القيمة المضافة، وتُضاف إليها الضريبة بالنسبة النظامية السارية وقت استحقاقها، ويلتزم الطرف المستفيد بسدادها مقابل فاتورة ضريبية مستوفية للمتطلبات النظامية.", e: "All amounts stated in this Agreement are exclusive of Value Added Tax, which shall be added at the applicable statutory rate at the time it becomes due and paid by the recipient against a valid tax invoice." },
  { t: "الشرط الجزائي", en: "Liquidated Damages", ar: "إذا تأخر [الطرف الثاني] في تنفيذ التزامه في الموعد المحدد التزم بدفع غرامة تأخير قدرها [....]٪ من قيمة [الجزء المتأخر] عن كل أسبوع تأخير، بحد أقصى [10]٪ من قيمة العقد، وذلك تقديرًا متفقًا عليه للضرر، دون إخلال بحق الطرف الأول في فسخ العقد إذا تجاوز التأخير [....] يومًا.", e: "If [the Second Party] fails to perform its obligation on the due date, it shall pay liquidated damages of [....]% of the value of [the delayed portion] for each week of delay, up to a maximum of [10]% of the Contract Value, as a genuine pre-estimate of loss, without prejudice to the First Party's right to terminate this Agreement if the delay exceeds [....] days." },
  { t: "الإشعارات", en: "Notices", ar: "تُوجَّه جميع الإشعارات كتابةً إلى العناوين الوطنية والبريد الإلكتروني المبيّنة في صدر هذا العقد، ويُعد الإشعار مُبلّغًا من تاريخ تسلمه أو من تاريخ إرساله بالبريد الإلكتروني ما لم يُشعر المرسل بعدم وصوله، وعلى كل طرف إشعار الآخر بأي تغيير في عنوانه.", e: "All notices shall be in writing and sent to the national addresses and email addresses set out at the beginning of this Agreement. A notice shall be deemed received on delivery or, if sent by email, on the date of sending unless the sender receives a delivery failure notification. Each Party shall notify the other of any change of address." },
  { t: "التنازل", en: "Assignment", ar: "لا يجوز لأي من الطرفين التنازل عن هذا العقد أو عن أي من حقوقه أو التزاماته بموجبه، كليًا أو جزئيًا، أو التعاقد من الباطن، دون موافقة كتابية مسبقة من الطرف الآخر.", e: "Neither Party may assign or transfer this Agreement or any of its rights or obligations hereunder, in whole or in part, or subcontract its obligations, without the prior written consent of the other Party." },
  { t: "كامل الاتفاق", en: "Entire Agreement", ar: "يمثل هذا العقد وملاحقه كامل الاتفاق بين الطرفين بشأن موضوعه، ويحل محل أي تفاهمات أو مراسلات سابقة، ولا يُعتد بأي تعديل عليه ما لم يكن مكتوبًا وموقعًا من الطرفين.", e: "This Agreement and its schedules constitute the entire agreement between the Parties regarding its subject matter and supersede all prior understandings and correspondence. No amendment shall be effective unless made in writing and signed by both Parties." },
  { t: "مكافحة الرشوة", en: "Anti-Bribery", ar: "يلتزم كل طرف بأحكام نظام مكافحة الرشوة، ويقر بأنه لم يقدم ولن يقدم أي مبلغ أو منفعة لأي موظف عام أو خاص بقصد الحصول على هذا العقد أو تنفيذه، ويحق للطرف الآخر فسخ العقد فورًا عند الإخلال بذلك.", e: "Each Party shall comply with the Anti-Bribery Law and represents that it has not offered and will not offer any payment or benefit to any public or private official in order to obtain or perform this Agreement. The other Party may terminate this Agreement immediately upon any breach of this clause." },
];

const LANGS = { ar: "العربية", en: "English", bi: "ثنائي اللغة (عربي / إنجليزي)" };
const SEV = { high: { t: "مرتفعة", c: "bad", n: 3 }, medium: { t: "متوسطة", c: "warn", n: 2 }, low: { t: "منخفضة", c: "info", n: 1 } };

VIEWS.contracts = () => {
  const tab = S.route.tab || "home";
  const agr = S.data.docs.filter((d) => d.kind === "agreement").sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const revs = S.data.docs.filter((d) => d.kind === "creview").sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const head = `<div class="page-head"><div><h1>العقود</h1><p>صياغة العقود ومراجعتها وتحكيمها بالعربية والإنجليزية، وفق أنظمة المملكة العربية السعودية ولوائحها في المكتبة النظامية.</p></div>
    <div class="row"><button class="btn" data-act="tab" data-tab="review">${icon("scale")}مراجعة عقد</button><button class="btn gold" data-act="tab" data-tab="draft">${icon("plus")}صياغة عقد</button></div></div>
  <div class="tabs">${[["home", "العقود والتقارير", agr.length + revs.length], ["draft", "صياغة عقد جديد"], ["review", "مراجعة وتحكيم عقد"], ["clauses", "مكتبة البنود"]].map(([k, t, n]) => `<a class="${tab === k ? "on" : ""}" data-act="tab" data-tab="${k}">${t}${n ? `<span class="n num">${n}</span>` : ""}</a>`).join("")}</div>`;
  if (tab === "draft") return head + contractDraftForm();
  if (tab === "review") return head + contractReviewForm();
  if (tab === "clauses") return head + clauseLibrary();
  const highs = revs.reduce((s, d) => s + (d.review?.issues || []).filter((i) => i.severity === "high").length, 0);
  return head + `<div class="kpis">
      <button class="kpi" data-act="tab" data-tab="draft"><span class="lbl">العقود المصاغة</span><span class="val">${agr.length}</span><span class="foot">${agr.filter((d) => d.status === "final").length} معتمد نهائيًا</span></button>
      <button class="kpi" data-act="tab" data-tab="review"><span class="lbl">تقارير المراجعة</span><span class="val">${revs.length}</span><span class="foot">عقود عملاء وأطراف أخرى</span></button>
      <div class="kpi ${highs ? "alert" : ""}"><span class="lbl">ملاحظات عالية الخطورة</span><span class="val">${highs}</span><span class="foot">في كل التقارير</span></div>
      <button class="kpi" data-act="tab" data-tab="clauses"><span class="lbl">بنود جاهزة</span><span class="val">${CLAUSES.length}</span><span class="foot">عربي وإنجليزي</span></button></div>
    <div class="cols"><div class="card"><div class="card-h"><h3>العقود</h3></div>${agr.length ? `<div class="list">${agr.map((d) => contractRow(d)).join("")}</div>` : emptyBox("contract", "لم تُصغ عقود بعد", "صغ عقدًا جديدًا بالعربية أو الإنجليزية أو باللغتين، مستندًا إلى الأنظمة السعودية.", `<button class="btn sm gold" data-act="tab" data-tab="draft">${icon("plus")}صياغة عقد</button>`)}</div>
      <div class="card"><div class="card-h"><h3>تقارير المراجعة</h3></div>${revs.length ? `<div class="list">${revs.map((d) => contractRow(d)).join("")}</div>` : emptyBox("scale", "لا تقارير بعد", "ارفع عقدًا ليكشف المساعد ثغراته ومخاطره ومخالفاته النظامية.", `<button class="btn sm" data-act="tab" data-tab="review">${icon("upload")}مراجعة عقد</button>`)}</div></div>`;
};
function contractRow(d) {
  const r = d.review; const hi = r ? (r.issues || []).filter((i) => i.severity === "high").length : 0;
  return `<div class="li clickable" data-act="${d.kind === "creview" ? "openReview" : "openDoc"}" data-id="${d.id}"><span class="ic" style="color:var(--accent-ink)">${icon(d.kind === "creview" ? "scale" : "contract")}</span>
    <div class="body"><div class="ttl" dir="auto">${esc(d.title)}</div><div class="meta">${d.ctype ? `<span>${esc(ctypeOf(d.ctype).ar)}</span>` : ""}${d.lang ? `<span>${esc(LANGS[d.lang] || d.lang)}</span>` : ""}${d.clientId ? `<span>${esc(clientName(d.clientId))}</span>` : ""}<span>${ago(d.updatedAt || d.createdAt)}</span></div></div>
    ${r ? `${riskPill(r)}${hi ? pill(hi + " عالية", "bad") : ""}` : d.status === "final" ? pill("نهائي", "ok") : pill("مسودة", "plain")}</div>`;
}
const riskPill = (r) => { const s = Number(r.riskScore) || 0; return pill(`الخطورة ${s}/100`, s >= 60 ? "bad" : s >= 35 ? "warn" : "ok"); };

/* ---------- drafting ---------- */
function contractDraftForm() {
  const g = (k, d = "") => S.drafts["cd." + k] ?? d;
  return `<form class="card" data-form="draftContract" style="display:flex;flex-direction:column;gap:14px">
    <div class="grid3"><div class="field"><label for="cd-type" class="req">نوع العقد</label><select id="cd-type" class="inp" name="ctype" data-draft="cd.ctype">${CONTRACT_TYPES.map((t) => opt(t.k, `${t.ar} — ${t.en}`, g("ctype", "services"))).join("")}</select></div>
      <div class="field"><label for="cd-lang" class="req">لغة العقد</label><select id="cd-lang" class="inp" name="lang" data-draft="cd.lang">${Object.entries(LANGS).map(([k, v]) => opt(k, v, g("lang", "ar"))).join("")}</select></div>
      <div class="field"><label for="cd-side">الصياغة لصالح</label><select id="cd-side" class="inp" name="side" data-draft="cd.side">${opt("client", "عميلنا (حماية مصالحه)", g("side", "client"))}${opt("balanced", "متوازنة بين الطرفين", g("side"))}</select></div></div>
    <div class="grid2"><div class="field"><label for="cd-client">عميلنا</label><select id="cd-client" class="inp" name="clientId" data-draft="cd.client">${opt("", "— اختر العميل —", g("client"))}${S.data.clients.map((c) => opt(c.id, c.name, g("client"))).join("")}</select><span class="hint">تُؤخذ بياناته (الهوية أو السجل، العنوان، الممثل) تلقائيًا.</span></div>
      <div class="field"><label for="cd-role">صفة عميلنا في العقد</label><input id="cd-role" class="inp" name="role" data-draft="cd.role" value="${esc(g("role"))}" placeholder="البائع، المستأجر، صاحب العمل، المورد…"></div></div>
    <div class="field"><label for="cd-other">بيانات الطرف الآخر</label><textarea id="cd-other" class="inp" name="other" rows="3" data-draft="cd.other" placeholder="الاسم، رقم الهوية أو السجل التجاري، العنوان الوطني، الممثل وصفته">${esc(g("other"))}</textarea></div>
    <div class="field"><label for="cd-subj" class="req">موضوع العقد ومحله</label><textarea id="cd-subj" class="inp" name="subject" rows="3" required data-draft="cd.subject" placeholder="ما الذي يُباع أو يُؤجر أو يُقدَّم؟ المواصفات، الموقع، النطاق…">${esc(g("subject"))}</textarea></div>
    <div class="grid3"><div class="field"><label for="cd-val">القيمة وطريقة الدفع</label><input id="cd-val" class="inp" name="value" data-draft="cd.value" value="${esc(g("value"))}" placeholder="500,000 ريال على ثلاث دفعات…"></div>
      <div class="field"><label for="cd-dur">المدة والبداية</label><input id="cd-dur" class="inp" name="duration" data-draft="cd.duration" value="${esc(g("duration"))}" placeholder="سنة من تاريخ التوقيع، قابلة للتجديد…"></div>
      <div class="field"><label for="cd-city">مدينة التعاقد</label><input id="cd-city" class="inp" name="city" data-draft="cd.city" value="${esc(g("city", S.firm.city || "الرياض"))}"></div></div>
    <div class="grid3"><div class="field"><label for="cd-disp">تسوية النزاعات</label><select id="cd-disp" class="inp" name="dispute" data-draft="cd.dispute">${[["courts", "المحاكم السعودية المختصة"], ["scca", "التحكيم لدى المركز السعودي للتحكيم التجاري"], ["adhoc", "تحكيم حر وفق نظام التحكيم"]].map(([k, v]) => opt(k, v, g("dispute", "courts"))).join("")}</select></div>
      <div class="field"><label for="cd-arb">عدد المحكمين ومقر التحكيم</label><input id="cd-arb" class="inp" name="arb" data-draft="cd.arb" value="${esc(g("arb", "محكم واحد — الرياض"))}"></div>
      <div class="field"><label for="cd-case">ربط بقضية أو استشارة</label><select id="cd-case" class="inp" name="caseId" data-draft="cd.case">${opt("", "— بلا ربط —", g("case"))}${S.data.cases.map((c) => opt(c.id, c.title, g("case"))).join("")}</select></div></div>
    <div class="field"><label for="cd-terms">شروط خاصة وتوجيهات</label><textarea id="cd-terms" class="inp" name="terms" rows="4" data-draft="cd.terms" placeholder="مثل: حصرية في منطقة الرياض، شرط عدم منافسة سنتين، غرامة تأخير، ضمان سنة، تسليم على مراحل…">${esc(g("terms"))}</textarea></div>
    <div class="row">${S.caps.sample ? `<button class="btn gold" type="submit">${icon("spark")}صياغة العقد</button>` : `<button class="btn gold" type="submit">${icon("docs")}إنشاء هيكل العقد</button>`}<span class="small muted">يستند المساعد إلى نظام المعاملات المدنية والأنظمة الخاصة بنوع العقد في المكتبة، ويضع [........] لكل معلومة ناقصة.</span></div></form>`;
}
function partyBlock(c, lang) {
  if (!c) return "";
  const en = lang === "en";
  return [c.name, c.idNo && `${en ? (c.kind === "company" ? "CR No." : "ID No.") : c.kind === "company" ? "سجل تجاري رقم" : "هوية رقم"} ${c.idNo}`, c.address && `${en ? "Address" : "العنوان"}: ${c.address}`, c.rep && `${en ? "Represented by" : "ويمثله"}: ${c.rep}`, c.email && `${en ? "Email" : "البريد"}: ${c.email}`].filter(Boolean).join("، ");
}
function langRules(lang) {
  if (lang === "en") return `اكتب العقد كاملًا بالإنجليزية القانونية (Legal English) بأسلوب العقود الدولية المعمول بها في المملكة.
- العناوين: "# " لعنوان العقد، و"## Article 1: Definitions" لكل بند، والفقرات الفرعية مرقمة "1. " أو بنقاط "- ".`;
  if (lang === "bi") return `اكتب العقد ثنائي اللغة جنبًا إلى جنب في جدول من عمودين، العمود الأول عربي والثاني إنجليزي يطابقه حرفيًا في المعنى:
- السطر الأول: | العربية | English |
- ثم كل فقرة في صف مستقل: | النص العربي للفقرة | The English text of the paragraph |
- عناوين البنود صفوف أيضًا: | **البند الأول: التعريفات** | **Article 1: Definitions** |
- لا تضع علامة | داخل نص الفقرة، ولا تقسم الجدول.
- قبل الجدول سطر: # عنوان العقد بالعربية — English Title
- بعد الجدول كتلة التوقيع بصيغة !| … | … |.
- أدرج بند أسبقية النص العربي عند التعارض.`;
  return `اكتب العقد بالعربية القانونية الفصحى بأسلوب العقود المعتمد في المملكة.
- العناوين: "# " لعنوان العقد، و"## البند الأول: …" لكل بند، والفقرات الفرعية مرقمة "1. " أو بنقاط "- ".`;
}
F.draftContract = async (d) => {
  const T = ctypeOf(d.ctype); const client = byId(S.data.clients, d.clientId); const lang = d.lang || "ar";
  const title = lang === "en" ? `${T.en}${client ? " — " + client.name : ""}` : lang === "bi" ? `${T.ar} — ${T.en}` : `${T.ar}${client ? " — " + client.name : ""}`;
  const base = { kind: "agreement", ctype: T.k, lang, title, clientId: d.clientId || "", caseId: d.caseId || "", status: "draft", updatedAt: nowIso() };
  if (!S.caps.sample) {
    const id = await add("docs", { ...base, body: contractSkeleton(T, d, client) });
    ["subject", "other", "terms", "value", "duration"].forEach((k) => delete S.drafts["cd." + k]); go("doc", id); return;
  }
  const laws = await lawContext([T.q, "العقد الشرط الجزائي القوة القاهرة التحكيم", d.subject, d.terms].join(" "), 14);
  const disp = d.dispute === "scca" ? `التحكيم لدى المركز السعودي للتحكيم التجاري وفق قواعده، ${d.arb || ""}` : d.dispute === "adhoc" ? `تحكيم حر وفق نظام التحكيم السعودي، ${d.arb || ""}` : "اختصاص المحاكم السعودية المختصة بعد محاولة التسوية الودية";
  const prompt = `أنت محامٍ سعودي أول متخصص في صياغة العقود في «${S.firm.nameAr}». صغ «${T.ar} / ${T.en}» كاملًا، محكمًا، جاهزًا للتوقيع، متوافقًا مع أنظمة المملكة العربية السعودية وأحكام الشريعة الإسلامية.
تاريخ اليوم: ${todayStr()} الموافق ${fmtHijri(todayStr())}. مدينة التعاقد: ${d.city || "[........]"}.
${laws}
البيانات:
- عميلنا (${d.role || "طرف"}): ${partyBlock(client, lang) || "[........]"}
- الطرف الآخر: ${d.other || "[........]"}
- موضوع العقد ومحله: ${d.subject}
- القيمة وطريقة الدفع: ${d.value || "[........]"}
- المدة: ${d.duration || "[........]"}
- تسوية النزاعات: ${disp}
- الصياغة: ${d.side === "balanced" ? "متوازنة بين الطرفين" : `تحمي مصالح عميلنا (${d.role || "طرفنا"}) دون إخلال بالتوازن الذي يقبله القضاء`}
${d.terms ? `- شروط خاصة وتوجيهات المحامي: ${d.terms}` : ""}

${langRules(lang)}
- لا تستخدم ### ولا رموزًا أخرى غير المذكورة. **غامق** مسموح لعناوين البنود داخل الجدول فقط.

البنية اللازمة (بما يناسب نوع العقد): الديباجة وبيانات الأطراف، التمهيد، التعريفات، محل العقد، التزامات كل طرف، المقابل وطريقة السداد وضريبة القيمة المضافة، المدة والتجديد، التسليم/التنفيذ والقبول، الضمانات، الإخلال والشرط الجزائي، حدود المسؤولية، الإنهاء والفسخ وآثاره، القوة القاهرة، السرية${["nda", "software", "services", "employment"].includes(T.k) ? "، حماية البيانات الشخصية" : ""}، الإشعارات، التنازل، النظام الواجب التطبيق، تسوية النزاعات، كامل الاتفاق والتعديل، اللغة، النسخ، التوقيعات.
متطلبات يجب أن يستوفيها هذا النوع:
${[...T.checks, ...SA_CHECKS].map((c) => "- " + c).join("\n")}
قيود:
- لا تُدرج فوائد ربوية أو غرامات تأخير محسوبة كنسبة فائدة؛ استخدم شرطًا جزائيًا مقدرًا بحد أقصى.
- لا تخترع بيانات؛ ضع [........] لكل معلومة ناقصة.
- لا تذكر أرقام مواد نظامية داخل العقد إلا إن وردت في المواد المرفقة أعلاه.
- اختم بكتلة توقيع للطرفين (الاسم، الصفة، التوقيع، التاريخ) بصيغة: !| الطرف الأول | الطرف الثاني |`;
  const id = await add("docs", { ...base, body: "" });
  ["subject", "other", "terms", "value", "duration"].forEach((k) => delete S.drafts["cd." + k]);
  if (d.caseId) await logCase(d.caseId, "doc", `بدأت صياغة ${T.ar}`);
  await streamToDoc(id, prompt, "complex", (t) => `صاغ المساعد مسودة ${T.ar}`, d.caseId);
};
function contractSkeleton(T, d, client) {
  const B0 = "[........]";
  return `# ${T.ar}
> إنه في يوم ${B0} الموافق ${fmtDate(todayStr())} بمدينة ${d.city || B0}، تم الاتفاق بين كل من:
1. ${partyBlock(client, "ar") || B0} (${d.role || "الطرف الأول"}).
2. ${d.other || B0} (الطرف الثاني).
## البند الأول: التمهيد
يعد التمهيد السابق جزءًا لا يتجزأ من هذا العقد.
## البند الثاني: محل العقد
${d.subject || B0}
## البند الثالث: المقابل وطريقة السداد
${d.value || B0}، ولا تشمل المبالغ ضريبة القيمة المضافة.
## البند الرابع: المدة
${d.duration || B0}
${CLAUSES.filter((c) => ["القوة القاهرة", "السرية", "الإشعارات", "التنازل", "النظام الواجب التطبيق"].includes(c.t)).map((c, i) => `## البند ${["الخامس", "السادس", "السابع", "الثامن", "التاسع"][i]}: ${c.t}\n${c.ar}`).join("\n")}
## البند العاشر: تسوية النزاعات
${(d.dispute === "courts" ? CLAUSES[1] : CLAUSES[2]).ar}
## البند الحادي عشر: النسخ
حُرِّر هذا العقد من نسختين أصليتين، بيد كل طرف نسخة للعمل بموجبها.
!| الطرف الأول | الطرف الثاني |
!| الاسم: ${B0} | الاسم: ${B0} |
!| التوقيع: ........ | التوقيع: ........ |`;
}
/* Stream an assistant draft into a document, live in the editor. */
async function streamToDoc(id, prompt, tier, logText, caseId) {
  go("doc", id);
  const ctl = new AbortController(); S.gen = { kind: "doc", docId: id, text: "", ctl }; render();
  try {
    const { text } = await S.caps.sample(prompt, { signal: ctl.signal, cache: false, modelTier: tier, onText: ({ text }) => { S.gen.text = text; const t = $("#doc-body"); if (t) { t.value = text; livePreview(); } } });
    await upd(`docs/${id}`, { body: text.trim() });
    if (caseId) await logCase(caseId, "doc", logText(text));
    toast("اكتملت المسودة. راجعها قبل الاعتماد.");
  } catch (e) { aiErr(e); if (S.gen?.text) await upd(`docs/${id}`, { body: S.gen.text }); }
  finally { S.gen = null; render(); }
}

/* ---------- review («تحكيم العقد») ---------- */
function contractReviewForm() {
  const g = (k, d = "") => S.drafts["cr." + k] ?? d;
  const busy = S.crBusy;
  return `<div class="card" style="display:flex;flex-direction:column;gap:14px">
    <div class="drop" data-act="crPick">${icon("upload")}<div><b>${S.crFile ? esc(S.crFile.name) : "ارفع العقد"}</b></div><div class="small">PDF أو Word أو صورة، بالعربية أو الإنجليزية</div></div>
    <input type="file" id="cr-file" hidden accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" data-ch="crFile">
    <div class="field"><label for="cr-text">أو الصق نص العقد</label><textarea id="cr-text" class="inp" rows="7" dir="auto" data-draft="cr.text" placeholder="Paste the contract text here… / الصق نص العقد هنا…">${esc(g("text"))}</textarea></div>
    <div class="grid3"><div class="field"><label for="cr-side">نمثّل في العقد</label><input id="cr-side" class="inp" data-draft="cr.side" value="${esc(g("side"))}" placeholder="المستأجر، The Supplier، صاحب العمل…"></div>
      <div class="field"><label for="cr-type">نوع العقد</label><select id="cr-type" class="inp" data-draft="cr.type">${opt("", "يحدده المساعد", g("type"))}${CONTRACT_TYPES.map((t) => opt(t.k, t.ar, g("type"))).join("")}</select></div>
      <div class="field"><label for="cr-lang">لغة التقرير</label><select id="cr-lang" class="inp" data-draft="cr.lang">${opt("ar", "العربية", g("lang", "ar"))}${opt("en", "English", g("lang"))}</select></div></div>
    <div class="grid2"><div class="field"><label for="cr-client">العميل</label><select id="cr-client" class="inp" data-draft="cr.client">${opt("", "—", g("client"))}${S.data.clients.map((c) => opt(c.id, c.name, g("client"))).join("")}</select></div>
      <div class="field"><label for="cr-focus">تركيز خاص (اختياري)</label><input id="cr-focus" class="inp" data-draft="cr.focus" value="${esc(g("focus"))}" placeholder="الضمانات، الإنهاء، المسؤولية، حماية البيانات…"></div></div>
    <div class="row">${busy ? `<span class="thinking">${esc(busy)}</span>` : `<button class="btn gold" data-act="reviewContract" ${S.caps.sample ? "" : "disabled"}>${icon("spark")}مراجعة وتحكيم العقد</button>`}
      <span class="small muted">يكشف الثغرات والمخاطر والبنود الناقصة والمخالفات النظامية، ويقترح صياغات بديلة بلغة العقد.</span></div>
    ${S.caps.sample ? "" : `<div class="banner warn"><div class="grow">المراجعة تحتاج المساعد الذكي.</div></div>`}</div>`;
}
A.crPick = () => $("#cr-file")?.click();
CH.crFile = (el) => { S.crFile = el.files[0] || null; el.value = ""; render(); };
A.reviewContract = async (el) => {
  if (!needSample()) return;
  const g = (k) => ($("#cr-" + k)?.value ?? S.drafts["cr." + k] ?? "").trim();
  let text = g("text"); let images = [];
  const src = el?.dataset?.doc ? byId(S.data.docs, el.dataset.doc) : null;
  if (src) { text = $("#doc-body")?.value || src.body; toast("يراجع المساعد العقد ويكشف ثغراته… قد يستغرق دقيقة أو اثنتين"); }
  S.crBusy = "يقرأ العقد…"; render();
  try {
    if (!src && S.crFile) {
      const f = S.crFile;
      if (f.type.startsWith("image/")) images = [f];
      else { const r = await extractText(f); if ((r.text || "").length > 200) text = r.text; else if (r.doc) images = await pdfToImages(r.doc, 6); }
    }
    if (!text && !images.length) { toast("ارفع العقد أو الصق نصه أولًا.", true); return; }
    const side = src ? (S.drafts["cr.side"] || "") : g("side"); const typeK = src?.ctype || g("type"); const T = typeK ? ctypeOf(typeK) : null;
    const rlang = src ? "ar" : g("lang") || "ar"; const focus = src ? "" : g("focus");
    S.crBusy = "يبحث في الأنظمة واللوائح…"; render();
    const laws = await lawContext([T?.q || "العقد التزامات الطرفين الشرط الجزائي الفسخ", (text || "").slice(0, 2500)].join(" "), 16);
    S.crBusy = "يراجع البنود ويكشف الثغرات…"; render();
    const en = rlang === "en";
    const prompt = `You are a senior Saudi contracts lawyer at «${S.firm.nameAr}». Review the contract below thoroughly — a full legal audit («تحكيم العقد») under the laws of the Kingdom of Saudi Arabia and Islamic Sharia.
أنت محامٍ سعودي أول متخصص في العقود. راجع العقد مراجعة تحكيمية كاملة.
تاريخ اليوم: ${todayStr()}.
${side ? `نمثّل: ${side} — قيّم كل بند من زاوية مصلحته.` : "لم يُحدد الطرف الذي نمثله: قيّم التوازن والمخاطر على الطرفين."}
${T ? `نوع العقد: ${T.ar}. متطلبات هذا النوع:\n${T.checks.map((c) => "- " + c).join("\n")}` : "حدّد نوع العقد بنفسك."}
${focus ? `ركّز خاصة على: ${focus}` : ""}
${laws}
نقاط الفحص اللازمة لكل عقد في المملكة:
${SA_CHECKS.map((c) => "- " + c).join("\n")}
${text ? `نص العقد:\n"""\n${text.slice(0, 70000)}\n"""` : "العقد مرفق كصور لصفحاته؛ اقرأه بعناية."}

التعليمات:
1) اكتب التقرير ${en ? "بالإنجليزية" : "بالعربية"}، واقتبس من العقد بلغته الأصلية، واكتب الصياغات البديلة (wording) بلغة العقد نفسه (وإن كان ثنائي اللغة فبالعربية ثم الإنجليزية مفصولتين بـ " / ").
2) لكل ملاحظة: البند المعني، اقتباس قصير، المشكلة بدقة، السند النظامي من المواد المرفقة (اذكر النظام والمادة كما وردت، أو «قاعدة عامة» إن لم تجد نصًا، ولا تخترع أرقام مواد)، الأثر على من نمثّله، التوصية، والصياغة البديلة.
3) severity: high لما قد يبطل البند أو يعرّض لخسارة جوهرية أو يخالف نظامًا آمرًا، medium لما يضعف المركز أو يثير نزاعًا، low للتحسين والصياغة.
4) افحص الغموض والتعارض بين البنود، والتعارض بين النصين إن كان العقد ثنائي اللغة.
5) riskScore من 0 (آمن) إلى 100 (شديد الخطورة) لمن نمثّله.
6) compliance: قيّم كل نقطة من نقاط الفحص أعلاه ونقاط النوع: ok أو warn أو fail أو na.

أعد JSON فقط:
{"title":"عنوان العقد","language":"ar|en|bi","type":"${CONTRACT_TYPES.map((t) => t.k).join("|")}","parties":[{"name":"","role":""}],"summary":"خلاصة العقد في 4-6 أسطر","governingLaw":"","disputeResolution":"","keyTerms":[{"label":"المدة/القيمة/…","value":"","clause":""}],"riskScore":0,"verdict":"حكم عام موجز: يوقّع / يوقّع بعد التعديلات / لا يوقّع","issues":[{"severity":"high|medium|low","clause":"","quote":"","title":"","problem":"","basis":"","impact":"","fix":"","wording":""}],"missing":[{"clause":"","why":"","wording":""}],"compliance":[{"item":"","status":"ok|warn|fail|na","note":""}],"ambiguities":[""],"negotiation":["نقاط تفاوض مرتبة بالأولوية"]}`;
    const opts = { modelTier: "complex" }; if (images.length) opts.images = images;
    const r = await S.caps.sample.json(prompt, opts);
    if (!r || typeof r !== "object") throw { code: "invalid_json" };
    r.issues = (Array.isArray(r.issues) ? r.issues : []).filter((i) => i && i.title).map((i) => ({ ...i, severity: SEV[i.severity] ? i.severity : "medium" })).sort((a, b) => SEV[b.severity].n - SEV[a.severity].n);
    r.missing = Array.isArray(r.missing) ? r.missing.filter((m) => m && m.clause) : [];
    r.compliance = Array.isArray(r.compliance) ? r.compliance.filter((c) => c && c.item) : [];
    r.reportLang = rlang; r.side = side;
    const title = `${en ? "Contract review" : "مراجعة"}: ${r.title || src?.title || S.crFile?.name || "عقد"}`;
    const id = await add("docs", clean({ kind: "creview", title, ctype: CONTRACT_TYPES.some((t) => t.k === r.type) ? r.type : typeK || "", lang: r.language || "", review: r, srcText: (text || "").slice(0, 70000), srcName: S.crFile?.name || src?.title || "", srcDoc: src?.id || "",
      clientId: src?.clientId || g("client") || "", caseId: src?.caseId || "", body: reviewMarkup(r, title), status: "draft", updatedAt: nowIso() }));
    if (src?.caseId) await logCase(src.caseId, "ai", `راجع المساعد «${src.title}»: ${r.issues.length} ملاحظة، الخطورة ${r.riskScore}/100`);
    S.crFile = null; delete S.drafts["cr.text"]; S.crSel = null;
    go("creview", id);
  } catch (e) { aiErr(e); }
  finally { S.crBusy = null; render(); }
};
A.openReview = (el) => go("creview", el.dataset.id);
A.openReport = (el) => go("doc", el.dataset.id);

function reviewMarkup(r, title) {
  const en = r.reportLang === "en"; const L = (a, e) => (en ? e : a);
  const sev = (s) => (en ? { high: "High", medium: "Medium", low: "Low" }[s] : SEV[s].t);
  const st = (s) => (en ? { ok: "Compliant", warn: "Needs attention", fail: "Non-compliant", na: "N/A" } : { ok: "مستوفى", warn: "يحتاج انتباهًا", fail: "غير مستوفى", na: "لا ينطبق" })[s] || s;
  return [`# ${title}`,
    `| ${L("البيان", "Item")} | ${L("التفاصيل", "Details")} |`,
    `| ${L("الأطراف", "Parties")} | ${(r.parties || []).map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join("، ") || "—"} |`,
    `| ${L("نمثّل", "Our side")} | ${r.side || "—"} |`,
    `| ${L("درجة الخطورة", "Risk score")} | ${r.riskScore ?? "—"}/100 |`,
    `| ${L("الرأي العام", "Verdict")} | ${r.verdict || "—"} |`,
    `## ${L("أولًا: خلاصة العقد", "1. Summary")}`, r.summary || "",
    ...(r.keyTerms || []).length ? [`## ${L("ثانيًا: الشروط الأساسية", "2. Key terms")}`, `| ${L("الشرط", "Term")} | ${L("المضمون", "Content")} | ${L("البند", "Clause")} |`, ...r.keyTerms.map((k) => `| ${k.label} | ${String(k.value || "").replace(/\|/g, "/")} | ${k.clause || ""} |`)] : [],
    `## ${L("ثالثًا: الملاحظات والثغرات", "3. Issues")}`,
    ...r.issues.flatMap((i, n) => [`### ${n + 1}. ${i.title} — ${sev(i.severity)}`, i.clause && `- ${L("البند", "Clause")}: ${i.clause}`, i.quote && `- ${L("النص", "Text")}: «${i.quote}»`, i.problem && `- ${L("المشكلة", "Problem")}: ${i.problem}`, i.basis && `- ${L("السند", "Basis")}: ${i.basis}`, i.impact && `- ${L("الأثر", "Impact")}: ${i.impact}`, i.fix && `- ${L("التوصية", "Recommendation")}: ${i.fix}`, i.wording && `- ${L("الصياغة المقترحة", "Proposed wording")}: ${i.wording}`].filter(Boolean)),
    ...r.missing.length ? [`## ${L("رابعًا: بنود ناقصة", "4. Missing clauses")}`, ...r.missing.flatMap((m) => [`### ${m.clause}`, m.why, m.wording && `- ${L("الصياغة المقترحة", "Proposed wording")}: ${m.wording}`].filter(Boolean))] : [],
    ...r.compliance.length ? [`## ${L("خامسًا: فحص الامتثال", "5. Compliance check")}`, `| ${L("البند", "Item")} | ${L("النتيجة", "Result")} | ${L("ملاحظة", "Note")} |`, ...r.compliance.map((c) => `| ${c.item} | ${st(c.status)} | ${String(c.note || "").replace(/\|/g, "/")} |`)] : [],
    ...(r.ambiguities || []).length ? [`## ${L("سادسًا: مواضع الغموض", "6. Ambiguities")}`, ...r.ambiguities.map((a) => `- ${a}`)] : [],
    ...(r.negotiation || []).length ? [`## ${L("سابعًا: نقاط التفاوض", "7. Negotiation points")}`, ...r.negotiation.map((a, n) => `${n + 1}. ${a}`)] : [],
    `> ${L("هذا التقرير مسودة يراجعها المحامي المختص قبل الاعتماد.", "This report is a draft for review by the responsible lawyer.")}`,
  ].filter((x) => x !== undefined && x !== null && x !== false).join("\n");
}

VIEWS.creview = () => {
  const d = byId(S.data.docs, S.route.id);
  if (!d) return S.loaded.docs ? `<div class="card">${emptyBox("scale", "لم نجد التقرير", "", `<button class="btn" data-act="go" data-r="contracts">العودة</button>`)}</div>` : `<div class="thinking">جارٍ التحميل…</div>`;
  if (S.crFor !== d.id) { S.crFor = d.id; S.crSel = null; S.crMiss = null; S.crFilter = "all"; }
  const r = { issues: [], missing: [], compliance: [], ...(d.review || {}) }; const s = Number(r.riskScore) || 0; const sel = S.crSel || (S.crSel = new Set(r.issues.map((_, i) => i).filter((i) => r.issues[i].severity !== "low")));
  const f = S.crFilter || "all"; const issues = r.issues.map((x, i) => ({ ...x, i })).filter((x) => f === "all" || x.severity === f);
  const cnt = (k) => r.issues.filter((x) => x.severity === k).length;
  const stc = { ok: "ok", warn: "warn", fail: "bad", na: "plain" }; const stt = { ok: "مستوفى", warn: "يحتاج انتباهًا", fail: "غير مستوفى", na: "لا ينطبق" };
  return `<div class="crumbs"><a data-act="go" data-r="contracts">العقود</a><span>/</span><span>تقرير مراجعة</span></div>
  <div class="case-head"><div class="row" style="align-items:flex-start"><div class="grow"><h1 dir="auto">${esc(r.title || d.title)}</h1>
      <div class="row small muted" style="margin-top:4px">${r.type ? `<span>${esc(ctypeOf(r.type).ar)}</span>` : ""}${r.language ? `<span>${esc(LANGS[r.language] || r.language)}</span>` : ""}${r.side ? `<span>نمثّل: ${esc(r.side)}</span>` : ""}<span>${ago(d.createdAt)}</span></div></div>
    <div class="row"><button class="btn gold" data-act="reviseContract" data-id="${d.id}">${icon("spark")}صياغة نسخة معدلة</button><button class="btn" data-act="translateFrom" data-id="${d.id}">${icon("chat")}ترجمة العقد</button><button class="btn" data-act="openReport" data-id="${d.id}">${icon("docs")}التقرير (PDF / Word)</button></div></div>
    <div class="facts"><div class="fact"><div class="k">درجة الخطورة</div><div class="v"><div class="row" style="gap:8px"><b class="num" style="font-size:20px;color:var(--${s >= 60 ? "bad" : s >= 35 ? "warn" : "ok"})">${s}/100</b><div class="track" style="flex:1;min-width:80px;height:8px;border-radius:99px;background:var(--surface-2);overflow:hidden"><div style="height:100%;width:${s}%;background:var(--${s >= 60 ? "bad" : s >= 35 ? "warn" : "ok"})"></div></div></div></div></div>
      <div class="fact"><div class="k">الرأي</div><div class="v">${esc(r.verdict || "—")}</div></div>
      <div class="fact"><div class="k">الملاحظات</div><div class="v">${pill(cnt("high") + " مرتفعة", "bad")} ${pill(cnt("medium") + " متوسطة", "warn")} ${pill(cnt("low") + " منخفضة", "info")}</div></div>
      <div class="fact"><div class="k">النظام والنزاعات</div><div class="v small">${esc([r.governingLaw, r.disputeResolution].filter(Boolean).join(" · ") || "—")}</div></div></div></div>
  <div class="cols"><div class="stack">
    <div class="card"><div class="card-h"><h3>الملاحظات والثغرات</h3><div class="chips">${[["all", "الكل"], ["high", "مرتفعة"], ["medium", "متوسطة"], ["low", "منخفضة"]].map(([k, t]) => `<span class="chip ${f === k ? "on" : ""}" data-act="crFilter" data-f="${k}">${t}</span>`).join("")}</div></div>
      ${issues.length ? `<div class="stack" style="gap:12px">${issues.map((x) => `<div class="file" style="padding:14px 16px">
        <div class="row" style="align-items:flex-start"><label class="chk" title="تضمين في النسخة المعدلة"><input type="checkbox" data-ch="crSel" data-i="${x.i}" ${sel.has(x.i) ? "checked" : ""}></label>
          <div class="grow"><div class="row" style="gap:8px">${pill(SEV[x.severity].t, SEV[x.severity].c)}<b dir="auto">${esc(x.title)}</b>${x.clause ? `<span class="small muted" dir="auto">${esc(x.clause)}</span>` : ""}</div>
          ${x.quote ? `<div class="small" dir="auto" style="margin-top:6px;padding:6px 10px;border-inline-start:3px solid var(--line-2);color:var(--ink-2)">«${esc(x.quote)}»</div>` : ""}
          <div class="prose small" style="margin-top:6px" dir="auto">${esc(x.problem || "")}</div>
          ${x.basis ? `<div class="small" style="margin-top:4px"><b>السند:</b> <span dir="auto">${esc(x.basis)}</span></div>` : ""}
          ${x.impact ? `<div class="small" style="margin-top:2px"><b>الأثر:</b> <span dir="auto">${esc(x.impact)}</span></div>` : ""}
          ${x.fix ? `<div class="small" style="margin-top:2px"><b>التوصية:</b> <span dir="auto">${esc(x.fix)}</span></div>` : ""}
          ${x.wording ? `<div class="ai-box" style="margin-top:8px;border-radius:10px"><div class="row" style="justify-content:space-between"><h4>الصياغة المقترحة</h4><button class="btn sm ghost" data-act="crCopy" data-i="${x.i}">${icon("copy")}نسخ</button></div><div class="prose small" dir="auto">${esc(x.wording)}</div></div>` : ""}</div></div></div>`).join("")}</div>` : emptyBox("check", "لا ملاحظات في هذا التصنيف", "")}</div>
    ${r.missing.length ? `<div class="card"><div class="card-h"><h3>بنود ناقصة</h3><span class="sub">${r.missing.length}</span></div><div class="list">${r.missing.map((m, i) => `<div class="li" style="align-items:flex-start"><label class="chk"><input type="checkbox" data-ch="crMiss" data-i="${i}" ${(S.crMiss || new Set(r.missing.map((_, k) => k))).has(i) ? "checked" : ""}></label><div class="body"><div class="ttl" dir="auto">${esc(m.clause)}</div><div class="small muted" dir="auto">${esc(m.why || "")}</div>${m.wording ? `<div class="prose small" dir="auto" style="margin-top:4px">${esc(m.wording)}</div>` : ""}</div></div>`).join("")}</div></div>` : ""}
  </div><div class="stack">
    <div class="card"><div class="card-h"><h3>خلاصة العقد</h3></div><div class="prose" dir="auto">${esc(r.summary || "")}</div>
      ${(r.parties || []).length ? `<div class="small muted" style="margin-top:8px">${r.parties.map((p) => `${esc(p.name)}${p.role ? ` (${esc(p.role)})` : ""}`).join(" · ")}</div>` : ""}</div>
    ${(r.keyTerms || []).length ? `<div class="card"><div class="card-h"><h3>الشروط الأساسية</h3></div><div class="list">${r.keyTerms.map((k) => `<div class="li"><div class="body"><div class="ttl small">${esc(k.label)}${k.clause ? ` <span class="muted">· ${esc(k.clause)}</span>` : ""}</div><div class="small" dir="auto">${esc(k.value || "")}</div></div></div>`).join("")}</div></div>` : ""}
    ${r.compliance.length ? `<div class="card"><div class="card-h"><h3>فحص الامتثال</h3><span class="sub">${r.compliance.filter((c) => c.status === "ok").length}/${r.compliance.filter((c) => c.status !== "na").length} مستوفى</span></div><div class="list">${r.compliance.map((c) => `<div class="li" style="align-items:flex-start"><div class="body"><div class="ttl small" dir="auto">${esc(c.item)}</div>${c.note ? `<div class="small muted" dir="auto">${esc(c.note)}</div>` : ""}</div>${pill(stt[c.status] || c.status, stc[c.status] || "plain")}</div>`).join("")}</div></div>` : ""}
    ${(r.negotiation || []).length ? `<div class="card"><div class="card-h"><h3>نقاط التفاوض</h3></div><ol style="margin:0;padding-inline-start:20px">${r.negotiation.map((n) => `<li dir="auto" style="margin-bottom:4px">${esc(n)}</li>`).join("")}</ol></div>` : ""}
    ${(r.ambiguities || []).length ? `<div class="card"><div class="card-h"><h3>مواضع الغموض</h3></div><ul style="margin:0;padding-inline-start:20px">${r.ambiguities.map((n) => `<li dir="auto">${esc(n)}</li>`).join("")}</ul></div>` : ""}
  </div></div>`;
};
A.crFilter = (el) => { S.crFilter = el.dataset.f; render(); };
CH.crSel = (el) => { const i = +el.dataset.i; el.checked ? S.crSel.add(i) : S.crSel.delete(i); };
CH.crMiss = (el) => { const r = byId(S.data.docs, S.route.id).review; S.crMiss = S.crMiss || new Set(r.missing.map((_, k) => k)); const i = +el.dataset.i; el.checked ? S.crMiss.add(i) : S.crMiss.delete(i); };
A.crCopy = async (el) => { const r = byId(S.data.docs, S.route.id).review; const t = r.issues[+el.dataset.i]?.wording || ""; try { await navigator.clipboard.writeText(t); toast("نُسخت الصياغة"); } catch { toast("تعذّر النسخ", true); } };

/* A revised contract applying the selected recommendations, in the contract's own language. */
A.reviseContract = async (el) => {
  if (!needSample()) return;
  const d = byId(S.data.docs, el.dataset.id); const r = d.review; const src = d.srcText || byId(S.data.docs, d.srcDoc)?.body || "";
  if (!src) return toast("نص العقد الأصلي غير محفوظ (رُفع كصور). ارفعه بصيغة نصية لإنشاء نسخة معدلة.", true);
  const sel = [...(S.crSel || [])].map((i) => r.issues[i]).filter(Boolean); const miss = [...(S.crMiss || new Set(r.missing.map((_, k) => k)))].map((i) => r.missing[i]).filter(Boolean);
  if (!sel.length && !miss.length) return toast("حدّد ملاحظة أو بندًا ناقصًا واحدًا على الأقل.", true);
  const prompt = `أنت محامٍ سعودي أول متخصص في العقود في «${S.firm.nameAr}». أعد صياغة العقد التالي كاملًا بلغته الأصلية (${LANGS[r.language] || "كما ورد"})، مطبّقًا التعديلات المعتمدة أدناه فقط، ومحافظًا على بقية النص وترتيبه وترقيمه قدر الإمكان.
${r.side ? `نمثّل: ${r.side}.` : ""}
التعديلات المعتمدة:
${sel.map((i, n) => `${n + 1}. [${i.clause || "—"}] ${i.title}: ${i.fix || ""}${i.wording ? `\n   الصياغة المقترحة: ${i.wording}` : ""}`).join("\n")}
${miss.length ? `بنود تُضاف في موضعها المناسب:\n${miss.map((m) => `- ${m.clause}: ${m.wording || m.why}`).join("\n")}` : ""}
${langRules(r.language === "en" ? "en" : r.language === "bi" ? "bi" : "ar")}
- لا تُضف تعليقات أو شروحًا خارج نص العقد. ضع [........] لما ينقص.
نص العقد الأصلي:
"""
${src.slice(0, 70000)}
"""`;
  const id = await add("docs", { kind: "agreement", ctype: d.ctype || "", lang: r.language === "en" ? "en" : r.language === "bi" ? "bi" : "ar", title: `${r.title || "عقد"} — ${r.language === "en" ? "Revised" : "معدّل"}`, clientId: d.clientId || "", caseId: d.caseId || "", fromReview: d.id, body: "", status: "draft", updatedAt: nowIso() });
  await streamToDoc(id, prompt, "complex", () => `صاغ المساعد نسخة معدلة من «${r.title || "العقد"}»`, d.caseId);
};

/* Translation of a contract: Arabic ↔ English, or a side-by-side bilingual version. */
A.translateFrom = (el) => {
  const d = byId(S.data.docs, el.dataset.id); if (!d) return;
  modal("ترجمة العقد", `<div class="pick">${[["en", "إلى الإنجليزية", "ترجمة قانونية كاملة بأسلوب العقود الدولية"], ["ar", "إلى العربية", "ترجمة قانونية بالعربية الفصحى المعتمدة في العقود السعودية"], ["bi", "نسخة ثنائية اللغة", "العربي والإنجليزي جنبًا إلى جنب، مع أسبقية النص العربي"]].map(([k, t, s], i) => `<label><input type="radio" name="tr" value="${k}" ${i === 0 ? "checked" : ""}><div><b>${t}</b><div class="small muted">${s}</div></div></label>`).join("")}</div>`,
    `<button class="btn gold" data-act="translateGo" data-id="${d.id}">${icon("spark")}ترجمة</button><button class="btn ghost" data-act="closeModal">إلغاء</button>`);
};
A.translateGo = async (el) => {
  if (!needSample()) return;
  const to = document.querySelector('input[name="tr"]:checked')?.value || "en"; closeModal();
  const d = byId(S.data.docs, el.dataset.id); const src = d.kind === "creview" ? d.srcText || byId(S.data.docs, d.srcDoc)?.body || "" : ($("#doc-body")?.value ?? d.body);
  if (!src) return toast("لا يوجد نص للترجمة.", true);
  const base = d.kind === "creview" ? d.review?.title || "عقد" : d.title;
  const prompt = `أنت مترجم قانوني معتمد ومحامٍ سعودي متخصص في العقود. ${to === "bi" ? "حوّل العقد التالي إلى نسخة ثنائية اللغة (عربي / إنجليزي) جنبًا إلى جنب" : `ترجم العقد التالي ترجمة قانونية دقيقة كاملة ${to === "en" ? "إلى الإنجليزية القانونية" : "إلى العربية القانونية الفصحى"}`}، محافظًا على البنية والترقيم والمعنى القانوني الدقيق، ومستخدمًا المصطلحات المعتمدة في المملكة (مثل: Commercial Registration = السجل التجاري، Liquidated damages = الشرط الجزائي، Saudi Center for Commercial Arbitration = المركز السعودي للتحكيم التجاري).
${langRules(to)}
- لا تُضف شروحًا. أبقِ [........] كما هي. ترجم الأسماء والأرقام بدقة.
النص:
"""
${src.slice(0, 70000)}
"""`;
  const id = await add("docs", { kind: "agreement", ctype: d.ctype || "", lang: to, title: `${base} — ${to === "en" ? "English" : to === "ar" ? "النص العربي" : "عربي / English"}`, clientId: d.clientId || "", caseId: d.caseId || "", body: "", status: "draft", updatedAt: nowIso() });
  await streamToDoc(id, prompt, "default", () => `تُرجم «${base}»`, d.caseId);
};

/* ---------- clause library ---------- */
function clauseLibrary() {
  return `<div class="card"><div class="card-h"><h3>مكتبة البنود</h3><span class="sub">صياغات معيارية متوافقة مع الأنظمة السعودية؛ عدّل ما بين المعقوفين</span></div>
    <div class="stack" style="gap:12px">${CLAUSES.map((c, i) => `<div class="file" style="padding:14px 16px"><div class="row" style="justify-content:space-between"><b>${esc(c.t)} <span class="muted" style="font-weight:400">· ${esc(c.en)}</span></b>
      <div class="row" style="gap:4px"><button class="btn sm ghost" data-act="clauseCopy" data-i="${i}" data-l="ar">${icon("copy")}عربي</button><button class="btn sm ghost" data-act="clauseCopy" data-i="${i}" data-l="en">${icon("copy")}English</button><button class="btn sm ghost" data-act="clauseCopy" data-i="${i}" data-l="bi">${icon("copy")}ثنائي</button></div></div>
      <div class="grid2" style="margin-top:8px"><div class="prose small" dir="rtl">${esc(c.ar)}</div><div class="prose small" dir="ltr" style="text-align:left">${esc(c.e)}</div></div></div>`).join("")}</div></div>`;
}
A.clauseCopy = async (el) => {
  const c = CLAUSES[+el.dataset.i]; const l = el.dataset.l;
  const t = l === "ar" ? `## ${c.t}\n${c.ar}` : l === "en" ? `## ${c.en}\n${c.e}` : `| **${c.t}** | **${c.en}** |\n| ${c.ar} | ${c.e} |`;
  try { await navigator.clipboard.writeText(t); toast("نُسخ البند؛ الصقه في محرر العقد"); } catch { toast("تعذّر النسخ", true); }
};
