# -*- coding: utf-8 -*-
"""Refresh the core Saudi laws from the official portal (هيئة الخبراء بمجلس الوزراء — laws.boe.gov.sa).

    python3 -X utf8 tools/boe_laws.py

Writes docs/laws/core.json. After pushing it, open «المكتبة النظامية» in the platform and press
«استيراد الأنظمة الأساسية» to replace the library's copy. Amended articles keep the text shown on the
portal and append every recorded amendment (royal decree number and date) for the reader to weigh.
"""
import re, html, json, sys, os
LAWS = [
 ("muraf", "نظام المرافعات الشرعية", "f0eaae46-9f84-40ee-815e-a9a700f268b3"),
 ("ithbat", "نظام الإثبات", "2716057c-c097-4bad-8e1e-ae1400c678d5"),
 ("madani", "نظام المعاملات المدنية", "655fdb42-8c96-422b-b8c4-b04f0095c94c"),
 ("tijari", "نظام المحاكم التجارية", "38334008-3b70-4c6c-b3af-aba3016a8061"),
 ("amal", "نظام العمل", "08381293-6388-48e2-8ad2-a9a700f2aa94"),
 ("ahwal", "نظام الأحوال الشخصية", "4d72d829-947b-45d5-b9b5-ae5800d6bac2"),
 ("jazai", "نظام الإجراءات الجزائية", "8f1b7079-a5f0-425d-b5e0-a9a700f26b2d"),
 ("tanfeeth", "نظام التنفيذ", "c81ba2f1-1bf1-443b-9b1c-a9a700f27110"),
 ("muhamah", "نظام المحاماة", "f42655be-79b0-4fd4-bb90-a9a700f26a3e"),
 ("mazalim", "نظام المرافعات أمام ديوان المظالم", "f2f7b465-b576-4f47-a8e7-a9a700f27202"),
 ("qadaa", "نظام القضاء", "ea1765a3-dec3-41a0-a32f-a9a700f26d58"),
]
def text(fragment):
    t = re.sub(r'<br\s*/?>|</p>|</div>|</li>', '\n', fragment)
    t = re.sub(r'<[^>]+>', '', t); t = html.unescape(t).replace('\xa0', ' ')
    t = re.sub(r'[ \t]+', ' ', t); t = re.sub(r'\s*\n\s*', '\n', t).strip()
    return t
def parse(path):
    s = open(path, encoding='utf-8').read()
    meta = {}
    m = re.search(r'تاريخ الإصدار\s*</[^>]+>\s*<[^>]+>\s*([^<]+)', s)
    if m: meta['issued'] = html.unescape(m.group(1)).strip()
    blocks = re.split(r'<div class="article_item ', s)[1:]
    arts = []
    for b in blocks:
        cls = b.split('"', 1)[0]
        # Main headings carry class="center"; amendment popups use a bare <h3>.
        heads = [text(h) for h in re.findall(r'<h3 class="center">(.*?)</h3>', b, re.S)]
        heads = [h.rstrip(':： ').strip() for h in heads if h.strip().startswith('المادة')]
        if not heads: continue
        main, notes = [], []
        for c in re.finditer(r'<div class="HTMLContainer">(.*?)</div>', b, re.S):
            # Inside an amendment popup when no </div> closes the popup item before this container.
            before = b[:c.start()]; k = before.rfind('<div class="article_item_popup">')
            in_popup = k >= 0 and '</div>' not in before[k:]
            (notes if in_popup else main).append(text(c.group(1)))
        if not main: continue
        body = main[-1]
        if 'canceled-article' in cls: body = 'مادة ملغاة. ' + body
        if notes: body += '\n[تعديلات المادة المسجلة]: ' + ' | '.join(n for n in notes if n)
        arts.append({"article": heads[-1], "num": len(arts) + 1, "body": body})
    return meta, arts
def fetch(gid):
    import urllib.request
    req = urllib.request.Request(f"https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/{gid}/1", headers={"User-Agent": "Mozilla/5.0 (rakz-law-library)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")

if __name__ == "__main__":
    import datetime, tempfile, time
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = {"source": "laws.boe.gov.sa", "extracted": datetime.date.today().isoformat(), "laws": {}}
    with tempfile.TemporaryDirectory() as tmp:
        for slug, name, gid in LAWS:
            p = os.path.join(tmp, slug + ".html")
            open(p, "w", encoding="utf-8").write(fetch(gid)); time.sleep(1)
            meta, arts = parse(p)
            out["laws"][slug] = {"name": name, "url": f"https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/{gid}/1", "issued": meta.get("issued", ""), "articles": arts}
            print(f"{name}: {len(arts)} مادة")
    dest = os.path.join(root, "docs", "laws", "core.json")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    json.dump(out, open(dest, "w", encoding="utf-8"), ensure_ascii=False)
    print("written", dest)
