/* ============ Rakz — standalone runtime ============
   Provides the same window.claude.use(name) surface the app uses inside Claude
   (db, user, sample, assets, downloads), backed by Supabase:
   - db        → table public.documents (path, collection, id, data jsonb) + Realtime
   - assets    → private Storage bucket "files" (signed URLs)
   - sample    → Edge Function "claude" (Anthropic API key stays on the server)
   - user      → Supabase Auth (invited members only)
   - downloads → browser download                                                    */
(function () {
  const CFG = window.RAKZ_CONFIG || {};
  const configured = CFG.supabaseUrl && CFG.supabaseAnonKey && !/YOUR-/.test(CFG.supabaseUrl + CFG.supabaseAnonKey);
  const sb = configured ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;
  const err = (code, message) => ({ code, message: message || code });
  const newId = () => { const a = "abcdefghijklmnopqrstuvwxyz0123456789"; let s = ""; const r = crypto.getRandomValues(new Uint8Array(20)); for (const x of r) s += a[x % 36]; return s; };
  const split = (path) => { const p = path.split("/"); return { collection: p.slice(0, -1).join("/"), id: p[p.length - 1] }; };
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const merge = (a, b) => { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b)) o[k] = isObj(v) && isObj(o[k]) ? merge(o[k], v) : v; return o; };
  const snapDoc = (row, path) => ({ id: row ? row.id : split(path).id, exists: !!row, data: () => (row ? row.data : undefined), metadata: { fromCache: false, hasPendingWrites: false } });

  /* ---------- auth gate ----------
     Members create their own account (email + password, no email needed). The database only opens to
     an email that the manager has put on an active lawyer record in «فريق العمل» (SQL: public.is_member). */
  let session = null;
  const isMember = async () => { const { data, error } = await sb.rpc("is_member"); return !error && data === true; };
  const ready = new Promise((resolve) => {
    if (!sb) return resolve(null);
    const enter = async (s) => { session = s; if (await isMember()) { document.getElementById("auth-gate")?.remove(); resolve(s); } else showNotMember(resolve); };
    sb.auth.getSession().then(({ data }) => (data.session ? enter(data.session) : showLogin(enter)));
    sb.auth.onAuthStateChange((event, s) => { session = s; if (event === "SIGNED_OUT") location.reload(); });
    window.RAKZ_SIGNOUT = () => sb.auth.signOut();
    window.RAKZ_PASSWORD = async (pw) => { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; };
  });
  function shell(inner) {
    document.getElementById("auth-gate")?.remove();
    const el = document.createElement("div"); el.id = "auth-gate"; el.dir = "rtl";
    el.className = "auth";
    const L = typeof LOGO !== "undefined" ? LOGO : {};
    el.innerHTML = `<aside class="auth-art"><img class="m" src="${L.iconDark || ""}" alt=""><img class="w" src="${L.textDark || ""}" alt="ركز النظامية للمحاماة والاستشارات القانونية"><span class="rule"></span>
      <p class="tag">منصة إدارة القضايا والاستشارات</p><p class="sub">القضايا والمواعيد والصياغة والمالية في مكان واحد، بمساعد قانوني يستند إلى الأنظمة السعودية ولوائحها.</p></aside>
      <div class="auth-side"><div class="auth-card"><div class="logo-sm"><img src="${L.textLight || ""}" alt="ركز" style="height:52px"></div>${inner}</div></div>`;
    document.body.appendChild(el); return el;
  }
  function showLogin(enter, mode = "in") {
    const up = mode === "up";
    const el = shell(`<h2>${up ? "إنشاء حساب في منصة ركز" : "الدخول إلى منصة ركز"}</h2>
      <div class="chips" style="justify-content:center"><span class="chip ${up ? "" : "on"}" data-m="in">دخول</span><span class="chip ${up ? "on" : ""}" data-m="up">إنشاء حساب</span></div>
      <form id="lg" style="display:flex;flex-direction:column;gap:12px">
        <div class="field"><label for="lg-e">البريد الإلكتروني</label><input id="lg-e" class="inp" type="email" required autocomplete="email" dir="ltr"></div>
        <div class="field"><label for="lg-p">كلمة المرور</label><input id="lg-p" class="inp" type="password" required minlength="${up ? 8 : 1}" autocomplete="${up ? "new-password" : "current-password"}" dir="ltr">${up ? '<span class="hint">8 أحرف على الأقل.</span>' : ""}</div>
        ${up ? '<div class="field"><label for="lg-p2">تأكيد كلمة المرور</label><input id="lg-p2" class="inp" type="password" required autocomplete="new-password" dir="ltr"></div>' : ""}
        <button class="btn primary" type="submit" style="justify-content:center">${up ? "إنشاء الحساب" : "دخول"}</button>
        <div id="lg-msg" class="small" role="status"></div></form>
      <p class="small muted" style="margin:0;text-align:center">${up ? "استخدم البريد الذي أضافه المدير لك في «فريق العمل»." : "أول مرة؟ اختر «إنشاء حساب» بالبريد الذي أضافه المدير لك في «فريق العمل»."}</p>`);
    el.querySelectorAll("[data-m]").forEach((c) => c.addEventListener("click", () => showLogin(enter, c.dataset.m)));
    el.querySelector("#lg").addEventListener("submit", async (e) => {
      e.preventDefault(); const email = el.querySelector("#lg-e").value.trim().toLowerCase(); const password = el.querySelector("#lg-p").value; const msg = el.querySelector("#lg-msg");
      const fail = (t) => { msg.style.color = "var(--bad)"; msg.textContent = t; };
      msg.style.color = ""; msg.textContent = "…";
      if (up) {
        if (password.length < 8) return fail("كلمة المرور 8 أحرف على الأقل.");
        if (password !== el.querySelector("#lg-p2").value) return fail("كلمتا المرور غير متطابقتين.");
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) return fail(/registered|exists/i.test(error.message) ? "لهذا البريد حساب سابق. اختر «دخول»." : "تعذّر إنشاء الحساب: " + error.message);
        if (!data.session) return fail("أُنشئ الحساب لكنه يحتاج تفعيلًا من مدير المنصة.");
        return enter(data.session);
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return fail("البريد أو كلمة المرور غير صحيحة. إن لم يكن لك حساب بعد فاختر «إنشاء حساب».");
      enter(data.session);
    });
  }
  function showNotMember(resolve) {
    const el = shell(`<h2>حسابك بانتظار الإضافة</h2>
      <p style="margin:0">بريدك <b dir="ltr">${(session?.user?.email || "").replace(/[<>&"]/g, "")}</b> غير مضاف إلى «فريق العمل». اطلب من مدير المنصة إضافته في ملفك داخل المنصة، ثم اضغط «تحقق مرة أخرى».</p>
      <div class="row" style="justify-content:center"><button class="btn primary" id="nm-retry">تحقق مرة أخرى</button><button class="btn ghost" id="nm-out">تسجيل الخروج</button></div>`);
    el.querySelector("#nm-out").addEventListener("click", () => sb.auth.signOut());
    el.querySelector("#nm-retry").addEventListener("click", async () => { if (await isMember()) { el.remove(); resolve(session); } });
  }
  function showSetup() {
    shell(`<h2>المنصة بحاجة إلى ربط قاعدة البيانات</h2>
      <p style="margin:0">عدّل الملف <code>docs/config.js</code> في المستودع وضع فيه رابط مشروع Supabase والمفتاح العام (anon key)، ثم حدّث الصفحة. الخطوات كاملة في ملف README.</p>`);
  }
  if (!configured) document.addEventListener("DOMContentLoaded", showSetup);

  /* ---------- db ---------- */
  const T = () => sb.from("documents");
  async function getDoc(path) { const { data, error } = await T().select("id,data").eq("path", path).maybeSingle(); if (error) throw err("unavailable", error.message); return data; }
  async function listColl(coll) { const { data, error } = await T().select("id,data").eq("collection", coll).limit(5000); if (error) throw err("unavailable", error.message); return data || []; }
  function watch(filter, refresh) {
    const ch = sb.channel("rt-" + newId()).on("postgres_changes", { event: "*", schema: "public", table: "documents", filter }, () => refresh()).subscribe();
    return () => sb.removeChannel(ch);
  }
  function docRef(path) {
    const { collection, id } = split(path);
    const ref = {
      id, path,
      async get() { return snapDoc(await getDoc(path), path); },
      async set(data) { const { error } = await T().upsert({ path, collection, id, data, updated_at: new Date().toISOString() }); if (error) throw err(/requires_manager|journal_/.test(error.message) ? "forbidden" : /row-level|permission/i.test(error.message) ? "invalid_argument" : "unavailable", error.message); },
      async update(patch) { const cur = await getDoc(path); if (!cur) throw err("invalid_argument", "document does not exist"); return ref.set(merge(cur.data, patch)); },
      async delete() { const { error } = await T().delete().eq("path", path); if (error) throw err("unavailable", error.message); },
      onSnapshot(next, onErr) {
        let alive = true; const refresh = () => getDoc(path).then((r) => alive && next(snapDoc(r, path))).catch((e) => onErr && onErr(e));
        refresh(); const stop = watch(`path=eq.${path}`, refresh); return () => { alive = false; stop(); };
      },
      collection: (sub) => collRef(path + "/" + sub),
      async acquire() { return { acquired: true }; },
    };
    return ref;
  }
  function collRef(coll) {
    const q = {
      path: coll,
      doc: (id) => docRef(coll + "/" + (id || newId())),
      async add(data) { const r = docRef(coll + "/" + newId()); await r.set(data); return r; },
      async get() { const rows = await listColl(coll); const docs = rows.map((r) => snapDoc(r)); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} }; },
      onSnapshot(next, onErr) {
        let alive = true, timer = null;
        const refresh = () => { clearTimeout(timer); timer = setTimeout(() => q.get().then((s) => alive && next(s)).catch((e) => onErr && onErr(e)), 120); };
        refresh(); const stop = watch(`collection=eq.${coll}`, refresh); return () => { alive = false; stop(); };
      },
      where: () => q, orderBy: () => q, limit: () => q,
    };
    return q;
  }
  const db = { doc: docRef, collection: collRef };

  /* ---------- user ---------- */
  const user = {
    async me() { const u = session?.user; const name = u?.user_metadata?.name || u?.user_metadata?.full_name || (u?.email || "").split("@")[0];
      return { id: u?.id || null, name, avatarUrl: "", color: "#A3836B", email: u?.email || null, isOwner: !!(CFG.ownerEmail && u?.email && u.email.toLowerCase() === CFG.ownerEmail.toLowerCase()), canEdit: true }; },
    async id() { return session?.user?.id || null; }, async isOwner() { return (await user.me()).isOwner; }, async canEdit() { return true; }, async can() { return true; },
    async profiles(ids) { const o = {}; for (const id of [].concat(ids)) o[id] = { id, name: "", avatarUrl: "", color: "#A3836B", email: null, isMe: id === session?.user?.id, guest: false }; return o; },
    async search() { return []; }, async name() { return (await user.me()).name; }, async email() { return session?.user?.email || null; },
  };

  /* ---------- assets ---------- */
  const assets = {
    async upload(blob, opts = {}) {
      const id = (opts.folder ? opts.folder.replace(/[^a-z0-9_-]/gi, "") + "/" : "") + newId() + newId().slice(0, 12); const type = opts.type || blob.type || "application/octet-stream";
      const { error } = await sb.storage.from("files").upload(id, blob, { contentType: type, upsert: false });
      if (error) throw err(/size|large/i.test(error.message) ? "too_large" : "upstream_error", error.message);
      return { id, url: await assets.signedUrl(id), sizeBytes: blob.size, contentType: type };
    },
    async signedUrl(id) { const { data, error } = await sb.storage.from("files").createSignedUrl(id, 3600); if (error) throw err("upstream_error", error.message); return data.signedUrl; },
    async delete(id) { const { error } = await sb.storage.from("files").remove([id]); if (error) throw err("upstream_error", error.message); return { deleted: true }; },
    async list() { return { assets: [], usage: {} }; },
  };

  /* ---------- law library (tables law_sources / law_articles, RPC search_laws) ---------- */
  if (sb) window.RAKZ_LAWS = {
    async list() { const { data, error } = await sb.from("law_sources").select("*").order("ord", { nullsFirst: false }).order("name"); if (error) throw error; return data || []; },
    async articles(slug) { const { data, error } = await sb.from("law_articles").select("article,num,body").eq("law_slug", slug).order("num").limit(3000); if (error) throw error; return data || []; },
    async search(q, k = 8, law = null) { const { data, error } = await sb.rpc("search_laws", { p_q: q, p_k: k, p_law: law }); if (error) throw error; return data || []; },
    async save(src, articles) {
      const { error: e1 } = await sb.from("law_sources").upsert({ ...src, articles: articles.length, added_at: new Date().toISOString() }); if (e1) throw e1;
      const { error: e2 } = await sb.from("law_articles").delete().eq("law_slug", src.slug); if (e2) throw e2;
      for (let i = 0; i < articles.length; i += 200) {
        const { error } = await sb.from("law_articles").insert(articles.slice(i, i + 200).map((a) => ({ law_slug: src.slug, law: src.name, article: a.article, num: a.num, body: a.body })));
        if (error) throw error;
      }
    },
    async remove(slug) { const { error } = await sb.from("law_sources").delete().eq("slug", slug); if (error) throw error; },
  };

  /* ---------- downloads ---------- */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000); return { status: "saved" };
    },
  };

  /* ---------- sample (Claude via Edge Function) ---------- */
  const IMG_MAX = 1568;
  async function toImagePart(blob) {
    const bmp = await createImageBitmap(blob); const s = Math.min(1, IMG_MAX / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s); cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    const out = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85));
    const b64 = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.readAsDataURL(out); });
    return { media_type: "image/jpeg", data: b64 };
  }
  /* One call to the function. Returns what streamed and why it stopped; «time_limit» means the platform's
     wall-clock budget ran out (or the stream was cut) and the rest must be asked for in a follow-up call. */
  async function sampleOnce(messages, images, opts, onDelta) {
    let res;
    try {
      res = await fetch(CFG.supabaseUrl + "/functions/v1/claude", {
        method: "POST", signal: opts.signal,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session?.access_token, apikey: CFG.supabaseAnonKey },
        body: JSON.stringify({ messages, images, tier: opts.modelTier || "default" }),
      });
    } catch (e) { throw e?.name === "AbortError" ? err("cancelled") : err("upstream_error", String(e)); }
    if (res.status === 401) throw err("session_expired"); if (res.status === 429) throw err("rate_limited"); if (!res.ok || !res.body) throw err("upstream_error", "HTTP " + res.status);
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "", text = "", stop = null, failure = null;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue; let ev; try { ev = JSON.parse(line); } catch { continue; }
          if (ev.t) { text += ev.t; onDelta(ev.t); }
          if (ev.done) stop = ev.stop; if (ev.error) failure = ev.error;
        }
      }
    } catch (e) { if (e?.name === "AbortError") throw { ...err("cancelled"), text }; if (!text) throw err("upstream_error", String(e)); }
    if (!stop && !failure) stop = "time_limit"; // the connection closed mid-answer
    return { text, stop, failure };
  }
  const CONTINUE = "انقطع ردك السابق بسبب حد زمني. أكمل من آخر حرف كتبته تمامًا، دون تكرار أي جزء مما كتبت ودون مقدمة أو تعليق، وبالصيغة نفسها.";
  // A continuation sometimes repeats the tail it was given; drop the overlap.
  const joinParts = (a, b) => { for (let k = Math.min(400, a.length, b.length); k >= 12; k--) if (a.endsWith(b.slice(0, k))) return a + b.slice(k); return a + b; };
  async function sample(input, opts = {}) {
    const base = typeof input === "string" ? [{ role: "user", content: input }] : input;
    const images = opts.images ? await Promise.all([...(opts.images instanceof Blob ? [opts.images] : opts.images)].map(toImagePart)) : [];
    let text = "", stop = null;
    for (let round = 0; round < 8; round++) {
      const messages = round === 0 ? base : [...base, { role: "assistant", content: text }, { role: "user", content: CONTINUE }];
      const before = text; let part = "";
      const r = await sampleOnce(messages, images, opts, (d) => { part += d; if (opts.onText) { const cur = round ? joinParts(before, part) : part; opts.onText({ text: cur, delta: d, round }); } });
      if (r.failure) throw { ...err(r.failure), text: r.failure === "refused" ? undefined : joinParts(before, r.text) };
      text = round ? joinParts(before, r.text) : r.text; stop = r.stop;
      if (stop !== "time_limit") break;
      if (!r.text.trim()) throw { ...err("timeout"), text }; // nothing came back within the budget
    }
    if (!text.trim()) throw err("empty_completion");
    return { text, truncated: stop === "max_tokens" || stop === "time_limit", modelTierApplied: opts.modelTier || "default" };
  }
  sample.json = async (input, opts = {}) => {
    const ask = typeof input === "string" ? input + "\n\nأعد JSON صالحًا فقط دون أي نص قبله أو بعده." : input;
    const { text } = await sample(ask, opts);
    const tryParse = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
    let v = tryParse(text.trim());
    if (v === undefined) { const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) v = tryParse(m[1]); }
    if (v === undefined) { const a = text.search(/[\[{]/), b = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]")); if (a >= 0 && b > a) v = tryParse(text.slice(a, b + 1)); }
    if (v === undefined) throw { ...err("invalid_json"), text };
    return v;
  };
  sample.limits = async () => ({ maxPromptBytes: 900000, images: { maxCount: 8, maxInputBytes: 20e6, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] }, tools: { maxCount: 0 } });

  // aiEnabled: false in config.js runs the platform without the paid AI connection.
  const caps = { db, user, sample: CFG.aiEnabled === false ? null : sample, assets, downloads };
  window.claude = { use: (name) => (sb ? ready.then(() => caps[name] || null) : Promise.resolve(null)) };
})();
