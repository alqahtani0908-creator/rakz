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
        ${busy ? `<div class="msg me"><div class="bubble">${esc(busy.q)}</div></div><div class="msg ai"><div class="bubble" id="chat-stream">${busy.text ? esc(busy.text) : `<span class="thinking">يبحث في المكتبة…</span>`}</div></div>` : ""}
      </div>
      <form class="chat-input" data-form="chatAsk"><textarea class="inp" name="q" id="chat-q" rows="1" placeholder="اكتب سؤالك… (Enter للإرسال، Shift+Enter لسطر جديد)" ${busy ? "disabled" : ""}></textarea>
        ${busy ? `<button class="btn" type="button" data-act="chatStop">إيقاف</button>` : `<button class="btn primary" type="submit" ${S.caps.sample ? "" : "disabled"}>${icon("send")}إرسال</button>`}</form>
    </div></div>`;
};
function chatMsg(m, i) {
  if (m.role === "user") return `<div class="msg me"><div class="bubble">${esc(m.text)}</div></div>`;
  return `<div class="msg ai"><div class="bubble">${esc(m.text)}</div>${(m.refs || []).length ? `<div class="refs">${m.refs.map((r, j) => `<button class="chip" data-act="chatRef" data-m="${i}" data-r="${j}">${icon("book")} ${esc(r.law)} — ${esc(r.article)}</button>`).join("")}</div>` : ""}</div>`;
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

F.chatAsk = async (d) => {
  const q = (d.q || "").trim(); if (!q || S.chatBusy) return;
  if (!needSample()) return; const L = LAWS(); if (!L) return toast("المكتبة غير متاحة في هذا العرض.", true);
  if (!S.lawList) { try { S.lawList = await L.list(); } catch {} }
  const threads = S.chatThreads || []; let t = threads.find((x) => x.id === S.chatId);
  const history = (t?.messages || []).slice(-8);
  const ctl = new AbortController(); S.chatBusy = { q, text: "", ctl }; render();
  try {
    const lastQ = [...history].reverse().find((m) => m.role === "user")?.text || "";
    const rows = await L.search(`${q} ${lastQ}`.slice(0, 2000), 14, S.chatScope?.slug || null);
    const ctx = rows.map((r, i) => `[${i + 1}] ${lawLabel(r)}${r.status ? ` [${r.status}]` : ""} — ${r.article}:\n${String(r.body).slice(0, 1500)}`).join("\n\n");
    const en = /[A-Za-z]{4,}/.test(q) && !/[؀-ۿ]/.test(q);
    const instr = `أنت المستشار النظامي في «${S.firm.nameAr}». أجب عن سؤال المحامي من النصوص الرسمية المرفقة من المكتبة النظامية (أنظمة المملكة العربية السعودية ولوائحها والمبادئ والتعاميم).
قواعد الإجابة:
- ابدأ بالجواب المباشر في سطر أو سطرين، ثم التفصيل في نقاط قصيرة.
- بعد كل حكم اذكر مصدره بين قوسين: (اسم النظام أو اللائحة — رقم المادة) كما ورد في النصوص، ويمكنك الإحالة برقم المرجع [n].
- قدّم نص النظام ثم ما تفصّله لائحته، وراعِ حالة النفاذ المذكورة بين المعقوفين.
- إن لم تكفِ النصوص المرفقة للإجابة فقل ذلك صراحة، واذكر ما يلزم التحقق منه، ولا تخترع أرقام مواد.
- ${en ? "Answer in English." : "اكتب بالعربية الفصحى الموجزة"}، دون عناوين Markdown أو جداول.
- اختم بسطر قصير عند الحاجة: ما يلزم مراعاته عمليًا (مهلة، جهة مختصة، مستند).
تاريخ اليوم: ${todayStr()} الموافق ${fmtHijri(todayStr())}.${S.chatScope ? `\nنطاق السؤال: ${S.chatScope.name} وما يتبعه.` : ""}

النصوص المرفقة:
${ctx || "(لم يُعثر على نصوص مطابقة في المكتبة)"}

السؤال: ${q}`;
    const messages = [...history.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })), { role: "user", content: instr }];
    const { text } = await S.caps.sample(messages, { signal: ctl.signal, modelTier: "default", onText: ({ text }) => { S.chatBusy.text = text; const b = $("#chat-stream"); if (b) { b.textContent = text; const log = $("#chat-log"); if (log) log.scrollTop = log.scrollHeight; } } });
    const used = new Set([...text.matchAll(/\[(\d{1,2})\]/g)].map((m) => +m[1] - 1));
    const refs = rows.filter((r, i) => used.has(i) || text.includes(r.article)).slice(0, 8).map((r) => ({ slug: r.law_slug, law: r.law_name, parent: r.parent_name || "", article: r.article, body: String(r.body).slice(0, 2500) }));
    const now = nowIso(); const msgs = [...(t?.messages || []), { role: "user", text: q, at: now }, { role: "ai", text: text.trim(), refs, at: now }];
    if (t) { await upd(`${chatPath()}/${t.id}`, { messages: msgs }); }
    else { const ref = S.caps.db.collection(chatPath()).doc(); await ref.set(clean({ title: q.slice(0, 70), messages: msgs, scope: S.chatScope || null, by: S.me.id, createdAt: now, updatedAt: now })); S.chatId = ref.id; }
  } catch (e) { aiErr(e); }
  finally { S.chatBusy = null; render(); setTimeout(() => $("#chat-q")?.focus(), 50); }
};
