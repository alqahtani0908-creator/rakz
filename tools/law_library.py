# -*- coding: utf-8 -*-
"""Build the firm's law library: every main law followed by the regulations that explain it.

    python3 -X utf8 tools/law_library.py

Sources (official only):
  - هيئة الخبراء بمجلس الوزراء  laws.boe.gov.sa   (main laws, with every recorded amendment)
  - البوابة القانونية لوزارة العدل  laws.moj.gov.sa  (executive regulations, rules, procedural guides)

Writes docs/laws/core.json. In the platform open «المكتبة النظامية» and press «استيراد المكتبة الرسمية».
Each entry carries `kind` (نظام / لائحة تنفيذية / قواعد …) and `parent` (the slug of its main law),
so the library shows a tree and the assistant cites regulations together with the law they implement.
"""
import json, os, re, subprocess, sys, time, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from boe_laws import parse, fetch as boe_fetch, text as clean

MOJ_API = "https://laws-gateway.moj.gov.sa/apis/legislations/v1/statute/get-Statute-gateway-Detail?Serial="

# (slug, source, id, name or None to use the source's own title, [children with the same shape], status note)
B, M = "boe", "moj"
FAMILIES = [
 ("muraf", B, "f0eaae46-9f84-40ee-815e-a9a700f268b3", "نظام المرافعات الشرعية", [
   ("muraf-lw", M, "3PpcH7Pox63dH0Jw82s-UA"), ("muraf-itirad", M, "7uUvC6c0BoKLJuwB021doA"),
   ("muraf-qisma", M, "XxHJGQ-J8UHQHL_lpdKCVw"), ("muraf-khibra", M, "IVuNhqeASR-irehY2BPMag"),
   ("muraf-etaqadi", M, "myVO-TMtIwgPSdkK_pOfJw"), ("musalaha", M, "mCPOIfIgk6kj3UgjqgQr_g"),
   ("musalaha-q", M, "YNVUhtA-DFDvjZuGr7BgvQ")]),
 ("ithbat", B, "2716057c-c097-4bad-8e1e-ae1400c678d5", "نظام الإثبات", [
   ("ithbat-adilla", M, "ZNMI0PpA1fSRgK60lVLGEw"), ("ithbat-e", M, "4MlQ7qXft074z0DphE_Zmw"),
   ("tibbiya", M, "InZySyW64YqKkkChZ2dPQw")]),
 ("madani", B, "655fdb42-8c96-422b-b8c4-b04f0095c94c", "نظام المعاملات المدنية", []),
 ("tijari", B, "38334008-3b70-4c6c-b3af-aba3016a8061", "نظام المحاكم التجارية", [("tijari-lw", M, "AOQoW16lDlm3PYZCshWpNw")]),
 ("sharikat", B, "a8376aea-1bc3-49d4-9027-aed900b555af", "نظام الشركات", []),
 ("awraq", B, "4763eb94-047b-46f1-9697-a9a700f1b7ed", "نظام الأوراق التجارية", []),
 ("iflas", M, "-FF20eK5iu1hvvKJe5GZVQ", None, [
   ("iflas-lw", M, "aGx3rOE4CvQArw0oIGZqHA"), ("iflas-q", M, "xCbJni6ThD9OP5PQVEydMA"),
   ("iflas-cross", M, "JqVX64FCZsPywIN66P7frg"), ("iflas-fees", M, "p9K3NeTcz-honBTszlknag")]),
 ("tahkeem", M, "b_jI6RVZmizpiPSUSqLs7g", None, [("tahkeem-lw", M, "9N8-JQQJhKbDPIbtoqdmWA")]),
 ("amal", B, "08381293-6388-48e2-8ad2-a9a700f2aa94", "نظام العمل", [
   ("amal-tafteesh", B, "c0469b2e-535b-43ca-a5a8-a9a700f2c095", "لائحة تنظيم أعمال التفتيش العمالي")]),
 ("ahwal", B, "4d72d829-947b-45d5-b9b5-ae5800d6bac2", "نظام الأحوال الشخصية", [
   ("ahwal-lw", M, "41zDyO33ty4qZnGWAhpbNg"), ("ahwal-zawaj", M, "1AoXN6J0ydAy9kyJKJfpSQ"),
   ("ahwal-ajnabi", M, "cdVNBap_GPi_zJD9y-FanQ"), ("nafaqa", M, "67uch7WWWr6P-lA0jHckjA")]),
 ("jazai", B, "8f1b7079-a5f0-425d-b5e0-a9a700f26b2d", "نظام الإجراءات الجزائية", [
   ("jazai-lw", M, "zhNDy4NzpQqEM5bW2AEjLg"), ("jazai-muhami", M, "GE-StIXcjF_Wfc2MFGx8ww")]),
 ("ahdath", M, "V1f6in82wT3BPwf9H7NhEw", None, [("ahdath-lw", M, "F9FZzwRzHRu4HsrEnXXLXg")]),
 ("tanfeeth", B, "c81ba2f1-1bf1-443b-9b1c-a9a700f27110", "نظام التنفيذ (1433هـ)", [
   ("tanfeeth-lw", M, "2KK9IIMLdTfAJnqAEC5WgQ"), ("tanfeeth-khadamat", M, "03EAOZXr3s2hStbtwGClTA"),
   ("tanfeeth-ijara", M, "HhAP0DcfNk8sKHJPtNg1dQ"), ("isnad", M, "QVtXRU6y2h9rjbxiiuy5Fw")],
  "ساري حتى نفاذ نظام التنفيذ 1447هـ في 2026-10-28م"),
 ("tanfeeth47", M, "Cl5QbqZSJlZ1EfYkT6d83A", "نظام التنفيذ (1447هـ)", [], "يُعمل به من 2026-10-28م ويحل محل نظام التنفيذ 1433هـ"),
 ("tanfeeth-mazalim", B, "ae1d79bf-3716-4bc5-a85e-ada100c8a870", "نظام التنفيذ أمام ديوان المظالم", []),
 ("muhamah", B, "f42655be-79b0-4fd4-bb90-a9a700f26a3e", "نظام المحاماة", [
   ("muhamah-lw", M, "5huwCrAuvCK62BbuXv7fjg"), ("muhamah-suluk", M, "JmI0BPgVlA5GuIxkJUi08A")]),
 ("takaleef", M, "9j060LnrW4ciKWpB8MI6aQ", None, [("takaleef-lw", M, "aAfeitJIgUcjbCD_KwTSSw")]),
 ("tawtheeq", M, "g28zaD-gXzN_8DAm9qbydw", None, [("tawtheeq-lw", M, "o7IAhRJFBAF2F4r_7fwXZA")]),
 ("mazalim", B, "f2f7b465-b576-4f47-a8e7-a9a700f27202", "نظام المرافعات أمام ديوان المظالم", []),
 ("diwan", B, "5d3379bd-3547-494e-9fbd-a9a700f26e24", "نظام ديوان المظالم", []),
 ("qadaa", B, "ea1765a3-dec3-41a0-a32f-a9a700f26d58", "نظام القضاء", [
   ("qadaa-alia", M, "M_MNnBytdjItcEAchShd1A"), ("qadaa-tafteesh", M, "Ww2A6oRouRcpgSq9a1afTQ"),
   ("qadaa-awan", M, "mCiUQA0aZAqdlyvwphKQLA"), ("qadaa-wathaiq", M, "Lw717agoWszH5smTAcoEBg")]),
 ("tasjeel", M, "R6fIk9qPUhuhF88Guk0ElQ", None, [("tasjeel-lw", M, "BYdqpHdqmwrPxK4Ztzcuyw")]),
 ("wahdat", M, "NxyLlTO6s0vXcVye01L86w", None, [("wahdat-lw", M, "WI7DvWXdAUlTbxUcmor2cQ")]),
 ("rahn", M, "VA_EVOTL3kldJoLTm8bsPg", None, []),
 ("tamweel", M, "HrBPfYDorrX5HOf2HWdt7A", None, []),
 ("naza", M, "mPQUrifig6mu9wqaXFBSyg", None, []),
 ("tamaluk", M, "tkU2W-f5WvKUHWGIZ0ymmg", None, []),
 ("baladiya", M, "jk019vnbAQwKm84HI2b71Q", None, [("baladiya-lw", M, "B7D-j_XxxycAWZaIKocXYA")]),
 ("khaleeji", M, "9htZuFje7R79fXP0-6y7pg", None, []),
 ("irhab", M, "X8IDl-4Y4xsFvZNZD60qwQ", None, [("irhab-lw", M, "mliYdQJDqF_LAOK0tJrUhg")]),
 ("ghasl", M, "Pks9qcrIXuX5Lae5DxuqhA", None, []),
 ("himaya", M, "DiUjlNSHbWPxg1M_HXlZlQ", None, []),
 ("munafasa", B, "e3605c0d-ef87-4cff-b5da-aa3f0102bbb4", "نظام المنافسة", []),
 ("tijara-e", B, "360de590-0286-4fa5-a243-aa9100c31979", "نظام التجارة الإلكترونية", []),
 ("tasattur", B, "bf9e0aae-6df6-4785-a305-ac2300bd0856", "نظام مكافحة التستر", []),
]

def moj_detail(serial, cache=None):
    if cache:
        p = os.path.join(cache, serial + ".json")
        if os.path.exists(p): return json.load(open(p, encoding="utf-8"))
    # The gateway's firewall rejects Python's HTTP client; curl gets through.
    for i in range(5):
        out = subprocess.run(["curl", "-s", "-m", "120", "-A", "Mozilla/5.0", "-H", "Accept: application/json",
                              "-H", "Origin: https://laws.moj.gov.sa", "-H", "Referer: https://laws.moj.gov.sa/", MOJ_API + serial],
                             capture_output=True).stdout
        try: return json.loads(out.decode("utf-8"))["model"]
        except Exception: time.sleep(3 + 3 * i)
    raise SystemExit("تعذّر جلب " + serial)

def kind_of(name, legal_type):
    if re.match(r"^(اللائحة|اللوائح) التنفيذية", name): return "لائحة تنفيذية"
    if name.startswith("نظام"): return "نظام"
    for prefix, k in (("القواعد", "قواعد"), ("قواعد", "قواعد"), ("ضوابط", "ضوابط"), ("آلية", "آلية"), ("الأدلة", "أدلة إجرائية"), ("الدليل", "دليل"), ("تنظيم", "تنظيم"), ("الترتيبات", "ترتيبات")):
        if name.startswith(prefix): return k
    return {"لائحة": "لائحة", "قواعد": "قواعد", "آلية": "آلية", "أدلة": "أدلة إجرائية", "ضوابط": "ضوابط", "تنظيم": "تنظيم", "ترتيبات": "ترتيبات", "دليل": "دليل"}.get(legal_type or "", legal_type or "لائحة")

def moj_articles(m):
    arts = []
    def walk(nodes):
        for x in nodes or []:
            if x.get("type") == 1:
                seq = re.sub(r"[:：\s]+$", "", (x.get("sequence") or "").strip())
                label = seq if re.match(r"^(المادة|القاعدة|البند|الفقرة|أولاً|ثانياً)", seq) else ("المادة " + seq if seq else f"البند {len(arts) + 1}")
                body = clean(x.get("text") or "")
                if x.get("name"): body = x["name"].strip() + ": " + body
                if x.get("isCancelled"): body = "مادة ملغاة. " + body
                st = x.get("legalStatusName")
                if st in ("معدلة", "مضافة") and x.get("decree"):
                    body += f"\n[{st} بموجب {x['decree']} وتاريخ {(x.get('decreeDate') or '')[:10]}هـ]"
                if body.strip(): arts.append({"article": label, "num": len(arts) + 1, "body": body})
            walk(x.get("items"))
    walk(m.get("statuteStructure"))
    return arts

def build(entry, parent, cache, tmp):
    slug, src, ident = entry[:3]
    name = entry[3] if len(entry) > 3 and isinstance(entry[3], str) else None
    status = entry[5] if len(entry) > 5 else None
    if src == B:
        p = os.path.join(tmp, slug + ".html")
        open(p, "w", encoding="utf-8").write(boe_fetch(ident)); time.sleep(1)
        meta, arts = parse(p)
        rec = {"name": name, "url": f"https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/{ident}/1", "issued": meta.get("issued", ""),
               "kind": kind_of(name, None), "source": "هيئة الخبراء بمجلس الوزراء"}
    else:
        m = moj_detail(ident, cache)
        name = name or re.sub(r"[.\s]+$", "", m["name"].strip())
        arts = moj_articles(m)
        rec = {"name": name, "url": f"https://laws.moj.gov.sa/ar/legislation/{ident}", "issued": (m.get("issuanceDate") or "")[:10].replace("-", "/") + "هـ",
               "kind": kind_of(name, m.get("legalType")), "source": "البوابة القانونية لوزارة العدل"}
        if m.get("legalStatueName") and m["legalStatueName"] != "ساري": rec["status"] = m["legalStatueName"]
    if status: rec["status"] = status
    if parent: rec["parent"] = parent
    rec["articles"] = arts
    return slug, rec

if __name__ == "__main__":
    import tempfile
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cache = sys.argv[1] if len(sys.argv) > 1 else None  # optional folder of cached MoJ JSON responses
    out = {"source": "laws.boe.gov.sa + laws.moj.gov.sa", "extracted": datetime.date.today().isoformat(), "laws": {}}
    with tempfile.TemporaryDirectory() as tmp:
        for fam in FAMILIES:
            slug, src, ident, name, children = fam[:5]
            note = fam[5] if len(fam) > 5 else None
            s, rec = build((slug, src, ident, name, None, note) if note else (slug, src, ident, name), None, cache, tmp)
            out["laws"][s] = rec; print(f"{rec['name']}: {len(rec['articles'])}")
            for ch in children:
                s2, r2 = build(ch, slug, cache, tmp); out["laws"][s2] = r2
                print(f"   └ {r2['name']} [{r2['kind']}]: {len(r2['articles'])}")
    n = sum(len(r["articles"]) for r in out["laws"].values())
    dest = os.path.join(root, "docs", "laws", "core.json")
    json.dump(out, open(dest, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"written {dest}: {len(out['laws'])} entries, {n} articles, {os.path.getsize(dest) // 1024} KB")
