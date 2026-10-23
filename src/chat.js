/* ============ Rakz — «اسأل المكتبة»: a chat assistant that answers from the law library ============
   Every question retrieves the most relevant articles, regulations, principles and circulars (search_laws), and the
   assistant answers from them with citations. Conversations are kept per member under chats/{uid}/threads. */

const CHAT_SUGGEST = ["ما مهلة الاعتراض على الحكم الابتدائي؟", "متى تستحق مكافأة نهاية الخدمة كاملة؟", "ما شروط صحة الشرط الجزائي؟", "ما الاختصاص المكاني في الدعاوى التجارية؟", "هل يجوز فسخ عقد الإيجار قبل انتهاء مدته؟"];
const chatPath = () => `chats/${S.me.id || "anon"}/threads`;
function subscribeChats() {
  if (S.chatSub || !S.caps.db || !S.me.id) return;
  S.chatSub = true; // set first: a snapshot may arrive synchronously and render again
  S.chatSub = S.caps.db.collection(chatPath()).onSnapshot((s) => { S.chatThreads = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")); scheduleRender(); }, () => {});
}
VIEWS.chat = () => {
  subscribeChats();
  const threads = S.chatThreads || []; const t = threads.find((x) => x.id === S.chatId);
  const msgs = t?.messages || []; const busy = S.chatBusy;
  const scope = S.chatScope;
  return `<div class="page-head"><div><h1>اسأل المكتبة</h1><p>اسأل عن أي مسألة نظامية؛ يجيب المساعد من نصوص الأنظمة واللوائح والمبادئ في المكتبة النظامية، ويذكر مصدر كل حكم.</p></div>
    <div class="row"><button class="btn gold" data-act="chatNew">${icon("plus")}محادثة جديدة</button></div></div>
  <div class="chat-wrap"><div class="chat-side card" style="padding:12px">
      <div class="small muted" style="padding:2px 6px">المحادثات</div>
      ${threads.length ? threads.map((x) => `<div class="li clickable ${x.id === S.chatId ? "on" : ""}" data-act="chatOpen" data-id="${x.id}"><div class="body"><div class="ttl small">${esc(x.title || "محادثة")}</div><div class="meta"><span>${ago(x.updatedAt)}</span></div></div><button class="btn sm ghost danger" data-act="chatDel" data-id="${x.id}" data-stop="1" aria-label="حذف">${icon("trash")}</button></div>`).join("") : `<p class="small muted" style="padding:6px">لا محادثات بعد.</p>`}</div>
    <div class="chat-main">
      ${scope ? `<div class="banner gold" style="border-radius:0;border-width:0 0 1px"><div class="grow">${icon("book")} الأسئلة في نطاق: <b>${esc(scope.name)}</b> ولوائحه وما يتبعه</div><button class="btn sm ghost" data-act="chatScopeClear">كل المكتبة</button></div>` : ""}
      <div class="chat-log" id="chat-log">
        ${msgs.length ? msgs.map(chatMsg).join("") : `<div class="chat-hello"><span class="law-ic">${icon("bot")}</span><h2>كيف أستطيع مساعدتك؟</h2><p class="muted" style="margin:0">أجيب من ${S.lawList ? S.lawList.length + " نظامًا ولائحة" : "المكتبة النظامية"} بنصوصها الرسمية، وأذكر النظام والمادة لكل جواب.</p>
          <div class="chat-sugg">${CHAT_SUGGEST.map((q) => `<button class="chip" data-act="chatSuggest" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>`}
        ${busy ? `<div class="msg me"><div class="bubble">${esc(busy.q)}</div></div><div class="msg ai"><div class="bubble" id="chat-stream">${busy.text ? esc(busy.text) : `<span class="thinking">${esc(busy.stage || "يحلل السؤال…")}</span>`}</div></div>` : ""}
      </div>
      <form class="chat-input" data-form="chatAsk"><textarea class="inp" name="q" id="chat-q" rows="1" placeholder="اكتب سؤالك… (Enter للإرسال، Shift+Enter لسطر جديد)" ${busy ? "disabled" : ""}></textarea>
        ${busy ? `<button class="btn" type="button" data-act="chatStop">إيقاف</button>` : `<button class="btn primary" type="submit" ${S.caps.sample ? "" : "disabled"}>${icon("send")}إرسال</button>`}</form>
    </div></div>`;
};
function chatMsg(m, i) {
  if (m.role === "user") return `<div class="msg me"><div class="bubble">${esc(m.text)}</div></div>`;
  const refs = m.refs || [];
  // [n] in the answer becomes a clickable citation that opens the exact text it rests on.
  const body = esc(m.text).replace(/\[(\d{1,2})\]/g, (all, n) => { const j = refs.findIndex((r) => r.n === +n); return j < 0 ? "" : `<button class="cite" data-act="chatRef" data-m="${i}" data-r="${j}" title="${esc(refs[j].law)} — ${esc(refs[j].article)}">${n}</button>`; });
  const cited = refs.filter((r) => r.cited !== false);
  return `<div class="msg ai">${m.plan?.intent ? `<div class="plan small muted">${icon("search")} فهمتُ السؤال: ${esc(m.plan.intent)}${m.plan.laws?.length ? ` · بحثتُ في: ${esc(m.plan.laws.join("، "))}` : ""}</div>` : ""}
    <div class="bubble">${body}</div>
    ${(m.options || []).length ? `<div class="chat-sugg" style="justify-content:flex-end">${m.options.map((o) => `<button class="chip" data-act="chatSuggest" data-q="${esc(o)}">${esc(o)}</button>`).join("")}</div>` : ""}
    ${cited.length ? `<div class="refs">${cited.map((r) => `<button class="chip" data-act="chatRef" data-m="${i}" data-r="${refs.indexOf(r)}">${r.n ? `<b class="num">${r.n}</b> ` : ""}${esc(r.law)} — ${esc(r.article)}</button>`).join("")}</div>` : ""}
    ${m.unverified ? `<div class="small" style="color:var(--warn)">${icon("flag")} وردت في الجواب إحالة لم أجدها في نصوص المكتبة؛ تحقّق منها قبل الاعتماد.</div>` : ""}</div>`;
}
after.push(() => { const log = $("#chat-log"); if (log && S.route.name === "chat") log.scrollTop = log.scrollHeight; });
document.addEventListener("keydown", (e) => { if (e.target?.id === "chat-q" && e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.form?.requestSubmit(); } });
A.chatNew = () => { S.chatId = null; render(); setTimeout(() => $("#chat-q")?.focus(), 50); };
A.chatOpen = (el) => { S.chatId = el.dataset.id; render(); };
A.chatDel = (el) => confirmBox("حذف المحادثة", "ستُحذف المحادثة نهائيًا.", "حذف", async () => { await del(`${chatPath()}/${el.dataset.id}`); if (S.chatId === el.dataset.id) S.chatId = null; render(); }, true);
A.chatSuggest = (el) => { const q = $("#chat-q"); if (q) { q.value = el.dataset.q; q.form.requestSubmit(); } };
A.chatScopeClear = () => { S.chatScope = null; render(); };
A.chatAbout = (el) => { const l = (S.lawList || []).find((x) => x.slug === el.dataset.id); S.chatScope = l ? { slug: l.slug, name: l.name } : null; S.chatId = null; go("chat"); };
A.chatStop = () => { S.chatBusy?.ctl?.abort(); };
A.chatRef = (el) => {
  const t = (S.chatThreads || []).find((x) => x.id === S.chatId); const r = t?.messages?.[+el.dataset.m]?.refs?.[+el.dataset.r]; if (!r) return;
  modal(`${esc(r.law)} — ${esc(r.article)}`, `<div class="prose">${esc(r.body || "")}</div>${r.parent ? `<p class="small muted" style="margin:0">تابع لـ ${esc(r.parent)}</p>` : ""}`,
    `<button class="btn" data-act="chatOpenLaw" data-id="${esc(r.slug)}">${icon("book")}فتح في المكتبة</button><button class="btn ghost" data-act="closeModal">إغلاق</button>`);
};
A.chatOpenLaw = (el) => { closeModal(); const l = (S.lawList || []).find((x) => x.slug === el.dataset.id); S.lawFam = l?.parent || el.dataset.id; S.lawTab = l?.parent ? "regs" : "text"; S.lawText = null; go("laws"); };

/* Stage 1 — understand the question: restate it precisely, pick the laws it falls under, and write search phrases
   in the statutes' own vocabulary. Asks back only when the answer would differ materially and cannot cover both. */
async function chatPlan(q, history, signal) {
  const list = S.lawList || []; const mains = list.filter((l) => !l.parent);
  const catalogue = mains.map((l) => `${l.slug} | ${l.name}`).join("\n");
  const prev = history.slice(-4).map((m) => `${m.role === "user" ? "المحامي" : "المساعد"}: ${String(m.text).slice(0, 600)}`).join("\n");
  const prompt = `أنت محلل أسئلة نظامية في مكتب محاماة سعودي. مهمتك فهم السؤال بدقة قبل البحث في المكتبة النظامية، لا الإجابة عنه.
${prev ? `سياق المحادثة السابقة:\n${prev}\n` : ""}السؤال الحالي: ${q}
${S.chatScope ? `نطاق السؤال محصور في: ${S.chatScope.name}` : ""}
الأنظمة المتاحة في المكتبة (المعرّف | الاسم):
${catalogue}

أعد JSON فقط:
{"intent":"إعادة صياغة السؤال بدقة في جملة واحدة، متضمنة المسألة النظامية والوقائع المؤثرة (مع إكمال الضمائر من السياق)","laws":["معرّفات 1-4 أنظمة من القائمة ينطبق عليها السؤال، الأقرب أولًا"],"queries":["3-6 عبارات بحث قصيرة بالمصطلحات النظامية كما ترد في نصوص الأنظمة (مثل: «مدة الاعتراض بطلب الاستئناف»، «مكافأة نهاية الخدمة»، «الشرط الجزائي التعويض»)، مع المرادفات"],"clarify":"سؤال توضيحي واحد قصير فقط إذا كان الجواب يختلف جوهريًا باختلاف معلومة ناقصة ولا يمكن تغطية الاحتمالين بإيجاز، وإلا فاتركه فارغًا","options":["2-4 خيارات قصيرة للسؤال التوضيحي إن وُجد"]}`;
  try {
    const r = await S.caps.sample.json(prompt, { signal, modelTier: "quick" });
    const valid = new Set(list.map((l) => l.slug));
    return { intent: String(r.intent || q).slice(0, 300), laws: (r.laws || []).filter((x) => valid.has(x)).slice(0, 4), queries: (r.queries || []).map(String).filter(Boolean).slice(0, 6), clarify: String(r.clarify || "").trim(), options: (r.options || []).map(String).filter(Boolean).slice(0, 4) };
  } catch (e) { if (e?.code === "cancelled") throw e; return { intent: q, laws: [], queries: [q], clarify: "", options: [] }; }
}
/* Stage 2 — retrieve: every phrase across the library, plus inside each identified law (and its regulations);
   texts found by several searches and inside the identified laws rank first. */
async function chatRetrieve(q, plan) {
  const L = LAWS(); const scope = S.chatScope?.slug || null; const hits = new Map();
  const add = (rows, w) => rows.forEach((r, i) => { const k = r.law_slug + "|" + r.num; const h = hits.get(k) || { r, score: 0 }; h.score += w / (i + 1) + (r.rank || 0) * 0.2; hits.set(k, h); });
  const qs = [...new Set([q, ...plan.queries])].slice(0, 6);
  const jobs = qs.map((x) => L.search(x, 10, scope).then((rows) => add(rows, 1)).catch(() => {}));
  if (!scope) for (const slug of plan.laws) jobs.push(L.search([q, ...plan.queries].join(" ").slice(0, 1500), 8, slug).then((rows) => add(rows, 1.6)).catch(() => {}));
  await Promise.all(jobs);
  const inLaw = (r) => plan.laws.includes(r.law_slug) || plan.laws.some((s) => (S.lawList || []).find((l) => l.slug === r.law_slug)?.parent === s);
  return [...hits.values()].map((h) => ({ ...h, score: h.score + (inLaw(h.r) ? 0.8 : 0) })).sort((a, b) => b.score - a.score).slice(0, 18).map((h) => h.r);
}
F.chatAsk = async (d) => {
  const q = (d.q || "").trim(); if (!q || S.chatBusy) return;
  if (!needSample()) return; const L = LAWS(); if (!L) return toast("المكتبة غير متاحة في هذا العرض.", true);
  if (!S.lawList) { try { S.lawList = await L.list(); } catch {} }
  const threads = S.chatThreads || []; let t = threads.find((x) => x.id === S.chatId);
  const history = (t?.messages || []).slice(-8);
  const ctl = new AbortController(); S.chatBusy = { q, text: "", ctl, stage: "يحلل السؤال ويحدد الأنظمة ذات الصلة…" }; render();
  const stage = (txt) => { S.chatBusy.stage = txt; const b = $("#chat-stream .thinking"); if (b) b.textContent = txt; };
  const save = async (ai) => {
    const now = nowIso(); const msgs = [...(t?.messages || []), { role: "user", text: q, at: now }, { ...ai, role: "ai", at: now }];
    if (t) await upd(`${chatPath()}/${t.id}`, { messages: clean(msgs) });
    else { const ref = S.caps.db.collection(chatPath()).doc(); await ref.set(clean({ title: q.slice(0, 70), messages: msgs, scope: S.chatScope || null, by: S.me.id, createdAt: now, updatedAt: now })); S.chatId = ref.id; }
  };
  try {
    const plan = await chatPlan(q, history, ctl.signal);
    if (plan.clarify && plan.options.length) { await save({ text: plan.clarify, options: plan.options, plan: { intent: plan.intent, laws: [] } }); return; }
    const lawNames = plan.laws.map((s) => (S.lawList || []).find((l) => l.slug === s)?.name).filter(Boolean);
    stage(`يبحث في ${lawNames.length ? lawNames.join("، ") : "المكتبة النظامية"}…`);
    const rows = await chatRetrieve(q, plan);
    stage(`وجد ${rows.length} نصًا ذا صلة، يصوغ الجواب…`);
    const ctx = rows.map((r, i) => `[${i + 1}] ${lawLabel(r)}${r.status ? ` [${r.status}]` : ""} — ${r.article}:\n${String(r.body).slice(0, 1800)}`).join("\n\n");
    const en = /[A-Za-z]{4,}/.test(q) && !/[؀-ۿ]/.test(q);
    // Stage 3 — answer only from the retrieved texts, every statement tied to its source number.
    const instr = `أنت المستشار النظامي في «${S.firm.nameAr}». أجب عن سؤال المحامي إجابة دقيقة مستندة حصرًا إلى النصوص الرسمية المرقمة أدناه من المكتبة النظامية.
المطلوب كما فهمته: ${plan.intent}
قواعد ملزمة:
1. ابدأ بالجواب المباشر في سطر أو سطرين يجيب عن المطلوب تحديدًا (نعم/لا، المدة، الجهة، الحكم…).
2. ثم التفصيل في نقاط قصيرة تبدأ بـ «- »، وكل نقطة تنتهي برقم مصدرها بين معقوفين مثل [3]، وإن استندت إلى أكثر من نص فاذكرها [2][5].
3. لا تذكر حكمًا أو مدة أو رقم مادة لم يرد في النصوص المرقمة. وإن احتجت معلومة عامة غير موجودة فيها فقل صراحة: «لم أجد في المكتبة نصًا على …».
4. انقل العبارة الحاسمة من النص حرفيًا بين «» عند ذكر القاعدة الأساسية.
5. قدّم نص النظام، ثم ما تفصّله لائحته أو المبادئ والتعاميم التابعة له، وراعِ حالة النفاذ المذكورة بين المعقوفين (مثل نظام يُعمل به من تاريخ لاحق).
6. إن كان للمسألة استثناء أو شرط أو مهلة في النصوص فاذكره.
7. اختم إن لزم بسطر يبدأ بـ «عمليًا:» يذكر الخطوة أو المهلة أو الجهة المختصة.
8. ${en ? "Answer in English, quoting the Arabic text where decisive." : "اكتب بالعربية الفصحى الموجزة الواضحة"}، بلا عناوين Markdown ولا جداول ولا **.
تاريخ اليوم: ${todayStr()} الموافق ${fmtHijri(todayStr())}.${S.chatScope ? `\nنطاق السؤال: ${S.chatScope.name} وما يتبعه.` : ""}

النصوص المرقمة:
${ctx || "(لم يُعثر على نصوص مطابقة في المكتبة)"}

سؤال المحامي: ${q}`;
    const messages = [...history.filter((m) => !m.options?.length || m.role === "user").map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.text).replace(/\[\d{1,2}\]/g, "") })), { role: "user", content: instr }];
    const { text } = await S.caps.sample(messages, { signal: ctl.signal, modelTier: "default", onText: ({ text }) => { S.chatBusy.text = text; const b = $("#chat-stream"); if (b) { b.textContent = text; const log = $("#chat-log"); if (log) log.scrollTop = log.scrollHeight; } } });
    // Citation check: every [n] must point to a retrieved text; an article number named in prose must exist among them.
    const used = new Set([...text.matchAll(/\[(\d{1,2})\]/g)].map((m) => +m[1]));
    const bogus = [...used].some((n) => n < 1 || n > rows.length);
    const named = [...text.matchAll(/المادة\s+([^\s،.:)\]]+(?:\s+(?:بعد|عشرة|والعشرون|والثلاثون|والأربعون|والخمسون|والستون|والسبعون|والثمانون|والتسعون|المائة|المائتين)){0,4})/g)].map((m) => m[0]);
    const unknown = named.filter((a) => !/المادة\s+(المذكورة|السابقة|نفسها|ذاتها|أعلاه|التالية|الآتية|المشار)/.test(a)).filter((a) => !rows.some((r) => r.article.includes(a.replace(/^المادة\s+/, "").split(" ")[0])));
    const refs = rows.map((r, i) => ({ n: i + 1, cited: used.has(i + 1), slug: r.law_slug, law: r.law_name, parent: r.parent_name || "", article: r.article, body: String(r.body).slice(0, 2500) })).filter((r) => r.cited);
    await save({ text: text.trim(), refs, plan: { intent: plan.intent, laws: lawNames }, unverified: bogus || unknown.length > 0 });
  } catch (e) { aiErr(e); }
  finally { S.chatBusy = null; render(); setTimeout(() => $("#chat-q")?.focus(), 50); }
};
