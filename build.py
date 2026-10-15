#!/usr/bin/env python3
"""Assemble src/ into:
  rakz.html        — the Claude artifact page (runtime provided by Claude)
  docs/index.html  — the standalone site for GitHub Pages (runtime: standalone/shim.js + Supabase)
"""
import base64, pathlib
root = pathlib.Path(__file__).parent
src = root / "src"
read = lambda p: p.read_text(encoding="utf-8")
def uri(name): return "data:image/png;base64," + base64.b64encode((root / "assets" / name).read_bytes()).decode()

js = "\n".join(read(src / f) for f in ["core.js", "views.js", "ai.js", "laws.js", "docengine.js", "docs.js", "extra.js", "accounting.js", "comms.js", "main.js"])
for k, f in {"__ICON_LIGHT__": "icon_light.png", "__ICON_DARK__": "icon_dark.png", "__TEXT_LIGHT__": "text_light.png", "__TEXT_DARK__": "text_dark.png"}.items():
    js = js.replace(k, uri(f))
fonts = """<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&display=swap">"""
body = f"""<style>
{read(src / "styles.css")}
</style>
<div id="app" dir="rtl" lang="ar">
  <aside class="side"></aside>
  <div class="main"><header class="topbar"></header><main class="view" id="view"></main></div>
  <nav class="bnav" aria-label="التنقل السريع"></nav>
</div>
<div class="toasts" id="toasts" dir="rtl" aria-live="polite"></div>"""
app_script = f"""<script>
document.documentElement.lang = "ar"; document.documentElement.dir = "rtl";
{js}
</script>"""

# 1) Claude artifact page (the publish step adds the document skeleton)
(root / "rakz.html").write_text(f"<title>منصة ركز</title>\n{fonts}\n{body}\n{app_script}\n", encoding="utf-8")

# 2) Standalone site
docs = root / "docs"; docs.mkdir(exist_ok=True)
(docs / "index.html").write_text(f"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<script>if (location.protocol === "http:" && !/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)) location.replace("https:" + location.href.slice(5));</script>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>منصة ركز</title>
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-title" content="ركز">
<meta name="application-name" content="ركز">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#152335">
{fonts}
<style>html,body{{margin:0}}[hidden]{{display:none!important}}img{{max-width:100%}}:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}</style>
<script>document.write('<script src="config.js?t=' + Date.now() + '"><\\/script>');</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script>
{read(root / "standalone" / "shim.js")}
</script>
</head>
<body>
{body}
{app_script}
</body>
</html>
""", encoding="utf-8")
if not (docs / "config.js").exists():
    (docs / "config.js").write_text("""// إعدادات الربط بقاعدة البيانات — عدّل القيمتين من: Supabase → Project Settings → API
// المفتاح العام (anon) آمن للنشر لأن صلاحيات القراءة والكتابة محمية بسياسات قاعدة البيانات.
window.RAKZ_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",
  aiEnabled: false, // المساعد الذكي (مدفوع عبر Anthropic API): اجعلها true بعد إضافة ANTHROPIC_API_KEY في Supabase
  ownerEmail: "", // بريد المدير الرئيسي (اختياري): يمنحه صلاحية الإسناد قبل إضافة الفريق
};
""", encoding="utf-8")
(docs / ".nojekyll").write_text("", encoding="utf-8")
print("built rakz.html", (root / "rakz.html").stat().st_size // 1024, "KB; docs/index.html", (docs / "index.html").stat().st_size // 1024, "KB")
