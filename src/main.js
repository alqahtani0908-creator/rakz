/* ============ Rakz — boot ============ */
after.push(() => {});
const _render = render;
render = function () {
  _render(); bindDrop();
  // Floating «اسأل المكتبة» button on every page except the chat itself.
  let fab = document.getElementById("chat-fab"); const show = S.booted && window.RAKZ_LAWS && S.caps.sample && S.route.name !== "chat";
  if (show && !fab) { fab = document.createElement("button"); fab.id = "chat-fab"; fab.className = "chat-fab"; fab.title = "اسأل المكتبة"; fab.setAttribute("aria-label", "اسأل المكتبة"); fab.dataset.act = "go"; fab.dataset.r = "chat"; fab.innerHTML = icon("bot"); document.body.appendChild(fab); }
  if (fab) fab.hidden = !show;
};

async function boot() {
  setTheme(lsGet("theme", "light"));
  const h = (location.hash || "").replace("#", "");
  if (VIEWS[h] && !["case", "doc", "creview", "consult"].includes(h)) S.route.name = h;
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
