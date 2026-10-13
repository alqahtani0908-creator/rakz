/* ============ Rakz — boot ============ */
after.push(() => {});
const _render = render;
render = function () { _render(); bindDrop(); };

async function boot() {
  setTheme(lsGet("theme", "light"));
  const h = (location.hash || "").replace("#", "");
  if (VIEWS[h] && !["case", "doc"].includes(h)) S.route.name = h;
  render();
  const use = (n) => (window.claude?.use ? window.claude.use(n).catch(() => null) : Promise.resolve(null));
  const [db, user, sample, assets, downloads] = await Promise.all(["db", "user", "sample", "assets", "downloads"].map(use));
  S.caps = { db, user, sample, assets, downloads };
  if (user) {
    const me = await user.me();
    S.me = { id: me.id, name: me.name || "", email: me.email || "", avatar: me.avatarUrl, isOwner: me.isOwner, canEdit: me.canEdit, canWrite: await user.can("data.write") };
  }
  S.booted = true;
  if (db) subscribeAll(); else COLL.forEach((c) => (S.loaded[c] = true));
  render();
}
boot();
