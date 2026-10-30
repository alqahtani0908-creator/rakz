// Rakz — phone notifications (Supabase Edge Function «push», deployed without JWT verification).
// Modes:
//   outbox — delivers what the database trigger push_on_change() recorded in public.push_outbox, then empties it.
//            Anyone may call it: it only ever delivers events that really happened.
//   daily  — morning digest (pg_cron, 07:00 Riyadh): sessions today/tomorrow, overdue tasks, pending approvals.
//            Runs at most once a day (public.push_runs).
//   test   — a signed-in member sends a test notification to their own devices.
// Needs the secret VAPID_PRIVATE_KEY (Supabase → Edge Functions → Secrets). The public key is below and in the app.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const VAPID_PUBLIC = "BJngIDWHuu62WM0mlrcSjksYqxwSoUjtX-VZic2m7rSlD5inQJfTMd92ZKmpgkuOZ0cJw3u6Cc0h1jd-eHm88vU";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Doc = Record<string, any>;
type Note = { title: string; body: string; url: string; tag?: string };

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function lawyers() {
  const { data } = await db.from("documents").select("id,data").eq("collection", "lawyers");
  return (data || []).map((r: any) => ({ id: r.id, ...r.data })).filter((l: Doc) => l.active !== false);
}
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

/* send one note to every device of the given emails; forget devices the push service no longer knows */
async function deliver(emails: string[], note: Note) {
  const list = [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()))];
  if (!list.length) return 0;
  const { data: subs } = await db.from("push_subs").select("*").in("email", list);
  let sent = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(note), { TTL: 86400, urgency: "high" });
      sent++; await db.from("push_subs").update({ last_ok: new Date().toISOString() }).eq("endpoint", s.endpoint);
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
      else console.error(JSON.stringify({ push_error: e?.statusCode || String(e), body: e?.body }));
    }
  }
  return sent;
}

/* who should hear about a change, and what they read */
function notesFor(ev: { op: string; collection: string; doc_id: string; old_data: Doc | null; new_data: Doc }, L: Doc[]): [string[], Note][] {
  const byId = (id: string) => L.find((l) => l.id === id);
  const name = (id: string) => byId(id)?.name || "أحد أعضاء الفريق";
  const mail = (id: string) => byId(id)?.email || "";
  const managers = L.filter((l) => l.role === "manager").map((l) => l.email);
  const n = ev.new_data || {}, o = ev.old_data || {}; const out: [string[], Note][] = [];
  if (ev.collection === "cases") {
    const a = n.assignment, p = o.assignment;
    if (a && a.to && a.to !== a.from) {
      if (a.status === "pending" && (!p || p.status !== "pending" || p.to !== a.to))
        out.push([[mail(a.to)], { title: "طلب إسناد قضية", body: `${n.title || "قضية"} — من ${name(a.from)}. افتح المنصة لقبوله أو الاعتذار.`, url: "/#assign", tag: "asg-" + ev.doc_id }]);
      else if (a.status === "accepted" && a.direct && (!p || p.to !== a.to || p.status !== "accepted"))
        out.push([[mail(a.to)], { title: "أُسندت إليك قضية", body: `${n.title || "قضية"} — أسندها ${name(a.from)}.`, url: "/#cases", tag: "asg-" + ev.doc_id }]);
      else if (p?.status === "pending" && (a.status === "accepted" || a.status === "declined"))
        out.push([[mail(a.from)], { title: a.status === "accepted" ? "قُبل الإسناد" : "اعتذار عن إسناد", body: `${name(a.to)} ${a.status === "accepted" ? "قبل" : "اعتذر عن"} قضية: ${n.title || ""}${a.reason ? ` — ${a.reason}` : ""}`, url: "/#cases", tag: "asg-" + ev.doc_id }]);
    }
  }
  if (ev.collection === "tasks" && n.assignee && n.status !== "done" && n.assignee !== n.createdBy && (ev.op === "INSERT" || o.assignee !== n.assignee)) {
    const kind: Record<string, string> = { session: "جلسة", memo: "رفع مذكرة", requirement: "متطلب", event: "موعد" };
    out.push([[mail(n.assignee)], { title: `${kind[n.kind] || "مهمة"} جديدة لك`, body: `${n.title || ""}${n.due ? ` — ${n.due}${n.time ? " " + n.time : ""}` : ""}`, url: "/#tasks", tag: "task-" + ev.doc_id }]);
  }
  if (ev.collection === "finreq" || ev.collection === "fees") {
    const isFee = ev.collection === "fees";
    const what = isFee ? "اقتراح أتعاب" : ({ expense: "مصروف", payment: "دفعة مستلمة", invoice: "طلب مطالبة", fee: "اقتراح أتعاب" } as Record<string, string>)[n.type] || "طلب مالي";
    const st = n.status || "pending";
    if (ev.op === "INSERT" && st === "pending")
      out.push([managers, { title: "طلب مالي بانتظار اعتمادك", body: `${what} ${money(n.amount)} ر.س — ${name(n.by || n.proposedBy || n.lawyerId)}${n.desc ? `: ${n.desc}` : ""}`, url: "/#finreqs", tag: "fin-" + ev.doc_id }]);
    else if (ev.op === "UPDATE" && o.status === "pending" && (st === "approved" || st === "rejected"))
      out.push([[mail(n.by || n.proposedBy || n.lawyerId)], { title: st === "approved" ? "اعتُمد طلبك المالي" : "رُفض طلبك المالي", body: `${what} ${money(n.amount)} ر.س${n.decisionNote || n.reason ? ` — ${n.decisionNote || n.reason}` : ""}`, url: "/#dashboard", tag: "fin-" + ev.doc_id }]);
  }
  return out;
}

async function runOutbox() {
  const { data: evs } = await db.from("push_outbox").select("*").order("id").limit(200);
  if (!evs?.length) return { events: 0, sent: 0 };
  await db.from("push_outbox").delete().in("id", evs.map((e: any) => e.id)); // claim first, so a parallel call does not repeat them
  const L = await lawyers(); let sent = 0;
  const fresh = Date.now() - 30 * 60e3; // events that waited longer (e.g. before the key was set) are stale
  for (const ev of evs.filter((e: any) => Date.parse(e.created_at) > fresh)) for (const [to, note] of notesFor(ev, L)) sent += await deliver(to, note);
  return { events: evs.length, sent };
}

async function runDaily() {
  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // Riyadh date
  const { error } = await db.from("push_runs").insert({ day: today });
  if (error) return { skipped: "already ran today" };
  const tomorrow = new Date(Date.parse(today) + 864e5).toISOString().slice(0, 10);
  const L = await lawyers();
  const { data: rows } = await db.from("documents").select("collection,id,data").in("collection", ["tasks", "cases", "finreq", "fees"]);
  const cases = new Map((rows || []).filter((r: any) => r.collection === "cases").map((r: any) => [r.id, r.data]));
  const tasks = (rows || []).filter((r: any) => r.collection === "tasks" && r.data.status !== "done" && r.data.due).map((r: any) => r.data);
  const owner = (t: Doc) => t.assignee || cases.get(t.caseId)?.lawyerId;
  const pending = (rows || []).filter((r: any) => (r.collection === "finreq" || r.collection === "fees") && (r.data.status || "pending") === "pending").length;
  let sent = 0;
  for (const l of L) {
    const mine = tasks.filter((t: Doc) => owner(t) === l.id);
    const sToday = mine.filter((t: Doc) => t.kind === "session" && t.due === today).length;
    const sTomorrow = mine.filter((t: Doc) => t.kind === "session" && t.due === tomorrow).length;
    const dueToday = mine.filter((t: Doc) => t.kind !== "session" && t.due === today).length;
    const late = mine.filter((t: Doc) => t.due < today).length;
    const parts = [sToday && `جلسات اليوم: ${sToday}`, sTomorrow && `جلسات الغد: ${sTomorrow}`, dueToday && `مهام مستحقة اليوم: ${dueToday}`, late && `متأخرة: ${late}`, l.role === "manager" && pending && `طلبات مالية بانتظار اعتمادك: ${pending}`].filter(Boolean);
    if (parts.length) sent += await deliver([l.email], { title: "ملخص اليوم — ركز", body: parts.join(" · "), url: "/#tasks", tag: "daily" });
  }
  return { sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!priv) return json({ error: "not_configured" }, 503);
  webpush.setVapidDetails("mailto:info@rakzlaw.sa", VAPID_PUBLIC, priv);
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  try {
    if (body.mode === "outbox") return json(await runOutbox());
    if (body.mode === "daily") return json(await runDaily());
    if (body.mode === "test") {
      const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data } = await db.auth.getUser(jwt); const email = data?.user?.email;
      if (!email) return json({ error: "unauthorized" }, 401);
      const n = await deliver([email], { title: "تنبيهات ركز تعمل ✓", body: "ستصلك هنا طلبات الإسناد والمهام الجديدة والطلبات المالية وملخص الصباح.", url: "/#dashboard", tag: "test" });
      return json({ sent: n });
    }
    return json({ error: "mode" }, 400);
  } catch (e) {
    console.error(JSON.stringify({ push_fatal: String(e) }));
    return json({ error: "failed" }, 500);
  }
});
