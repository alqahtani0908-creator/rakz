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

  /* ---------- auth gate ---------- */
  let session = null;
  const ready = new Promise((resolve) => {
    if (!sb) return resolve(null);
    sb.auth.getSession().then(({ data }) => { session = data.session; if (session) resolve(session); else showLogin(resolve); });
    sb.auth.onAuthStateChange((event, s) => { session = s; if (event === "SIGNED_OUT") location.reload(); });
    window.RAKZ_SIGNOUT = () => sb.auth.signOut();
  });
  function shell(inner) {
    const el = document.createElement("div"); el.id = "auth-gate"; el.dir = "rtl";
    el.style.cssText = "position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:16px;background:var(--bg);overflow:auto";
    el.innerHTML = `<div style="width:min(420px,100%);background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:28px 24px;display:flex;flex-direction:column;gap:14px;box-shadow:var(--shadow)">
      <div style="display:flex;justify-content:center"><img src="${typeof LOGO !== "undefined" ? LOGO.textLight : ""}" alt="ركز" style="height:52px"></div>${inner}</div>`;
    document.body.appendChild(el); return el;
  }
  function showLogin(resolve) {
    const el = shell(`<h2 style="margin:0;font-family:var(--f-doc);text-align:center">الدخول إلى منصة ركز</h2>
      <form id="lg" style="display:flex;flex-direction:column;gap:12px">
        <div class="field"><label for="lg-e">البريد الإلكتروني</label><input id="lg-e" class="inp" type="email" required autocomplete="email"></div>
        <div class="field"><label for="lg-p">كلمة المرور</label><input id="lg-p" class="inp" type="password" autocomplete="current-password"><span class="hint">اتركها فارغة لتصلك رسالة دخول على بريدك.</span></div>
        <button class="btn primary" type="submit" style="justify-content:center">دخول</button>
        <div id="lg-msg" class="small" role="status"></div></form>
      <p class="small muted" style="margin:0;text-align:center">الحسابات بدعوة من مدير المنصة فقط.</p>`);
    el.querySelector("#lg").addEventListener("submit", async (e) => {
      e.preventDefault(); const email = el.querySelector("#lg-e").value.trim(); const password = el.querySelector("#lg-p").value; const msg = el.querySelector("#lg-msg");
      msg.textContent = "…";
      if (password) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) { msg.style.color = "var(--bad)"; msg.textContent = "البريد أو كلمة المرور غير صحيحة."; return; }
        session = data.session; el.remove(); resolve(session);
      } else {
        const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
        msg.style.color = error ? "var(--bad)" : "var(--ok)";
        msg.textContent = error ? "هذا البريد غير مدعو إلى المنصة." : "أرسلنا رابط الدخول إلى بريدك.";
      }
    });
  }
  function showSetup() {
    shell(`<h2 style="margin:0;font-family:var(--f-doc);text-align:center">المنصة بحاجة إلى ربط قاعدة البيانات</h2>
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
      async set(data) { const { error } = await T().upsert({ path, collection, id, data, updated_at: new Date().toISOString() }); if (error) throw err(/row-level|permission/i.test(error.message) ? "invalid_argument" : "unavailable", error.message); },
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
      const id = newId() + newId().slice(0, 12); const type = opts.type || blob.type || "application/octet-stream";
      const { error } = await sb.storage.from("files").upload(id, blob, { contentType: type, upsert: false });
      if (error) throw err(/size|large/i.test(error.message) ? "too_large" : "upstream_error", error.message);
      return { id, url: await assets.signedUrl(id), sizeBytes: blob.size, contentType: type };
    },
    async signedUrl(id) { const { data, error } = await sb.storage.from("files").createSignedUrl(id, 3600); if (error) throw err("upstream_error", error.message); return data.signedUrl; },
    async delete(id) { const { error } = await sb.storage.from("files").remove([id]); if (error) throw err("upstream_error", error.message); return { deleted: true }; },
    async list() { return { assets: [], usage: {} }; },
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
  async function sample(input, opts = {}) {
    const messages = typeof input === "string" ? [{ role: "user", content: input }] : input;
    const images = opts.images ? await Promise.all([...(opts.images instanceof Blob ? [opts.images] : opts.images)].map(toImagePart)) : [];
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
          if (!line.trim()) continue; const ev = JSON.parse(line);
          if (ev.t) { text += ev.t; opts.onText && opts.onText({ text, delta: ev.t }); }
          if (ev.done) stop = ev.stop; if (ev.error) failure = ev.error;
        }
      }
    } catch (e) { throw e?.name === "AbortError" ? { ...err("cancelled"), text } : { ...err("upstream_error", String(e)), text }; }
    if (failure) throw { ...err(failure), text: failure === "refused" ? undefined : text };
    if (!text.trim()) throw err("empty_completion");
    return { text, truncated: stop === "max_tokens", modelTierApplied: opts.modelTier || "default" };
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
