// Rakz — Claude proxy (Supabase Edge Function).
// Keeps ANTHROPIC_API_KEY on the server. Only team members can call it
// (Supabase verifies the JWT, then the function checks public.is_member()).
// Streams newline-delimited JSON to the browser: {"t": "..."} text deltas,
// then {"done": true, "stop": "<stop_reason>"} or {"error": "<code>"}.
import Anthropic from "npm:@anthropic-ai/sdk";

// The firm's choice: the most capable model. The app asks for a tier; effort controls depth and cost.
const MODEL = "claude-opus-5-5";
const EFFORT: Record<string, "low" | "medium" | "high"> = { quick: "low", default: "medium", complex: "high" };
// Supabase stops a function at 150 s (free plan). Stop a little earlier and tell the browser to ask for the rest
// in a follow-up call («time_limit»), so long contracts and reviews finish across several calls.
const TIME_BUDGET_MS = 130_000;

const SYSTEM =
  "أنت المساعد القانوني لمنصة «ركز النظامية للمحاماة والاستشارات القانونية» في المملكة العربية السعودية. " +
  "اكتب بالعربية الفصحى المهنية، والتزم حرفيًا بالصيغة التي يطلبها المستخدم في كل طلب. " +
  "لا تخترع وقائع أو أرقام مواد غير متيقن منها؛ ضع [........] لما ينقص. " +
  "إذا أُرفقت مواد من المكتبة النظامية فهي النصوص الرسمية المعتمدة: استند إلى النظام ثم إلى لائحته التنفيذية وقواعده التي تفصّله، وراعِ حالة النفاذ.";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ImagePart = { media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string };
type Turn = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  // Anyone can create an account, so only answer a member on the team list (SQL: public.is_member).
  const auth = req.headers.get("Authorization") ?? "";
  const check = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/is_member`, {
    method: "POST",
    headers: { Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "", "Content-Type": "application/json" },
    body: "{}",
  });
  if (!check.ok || (await check.json()) !== true) return new Response("Members only", { status: 401, headers: cors });

  let body: { messages?: Turn[]; images?: ImagePart[]; tier?: string };
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: cors }); }
  const turns = (body.messages ?? []).filter((m) => m && m.content);
  if (!turns.length || turns[turns.length - 1].role !== "user") return new Response("Bad messages", { status: 400, headers: cors });

  // Images ride on the first user turn, before its text, so they stay in view on continuation calls.
  const images = (body.images ?? []).slice(0, 8);
  const first = turns.findIndex((m) => m.role === "user");
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((m, i) =>
    i === first && images.length
      ? { role: "user", content: [...images.map((im) => ({ type: "image" as const, source: { type: "base64" as const, media_type: im.media_type, data: im.data } })), { type: "text" as const, text: m.content }] }
      : { role: m.role, content: m.content },
  );

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { /* browser went away */ } };
      const started = Date.now(); let timedOut = false;
      try {
        if (!Deno.env.get("ANTHROPIC_API_KEY")) { send({ error: "not_configured" }); return; }
        // Reads ANTHROPIC_API_KEY. An organization-level key must also name a workspace (secret ANTHROPIC_WORKSPACE_ID).
        const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
        const client = new Anthropic(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {});
        const s = client.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 64000,
            system: SYSTEM,
            messages,
            output_config: { effort: EFFORT[body.tier ?? "default"] ?? "medium" },
            // On a safety decline the API re-runs the request on a fallback model it picks by category.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          } as Anthropic.Beta.MessageStreamParams,
          { signal: req.signal },
        );
        // Keep-alive while the model is thinking, and a hard stop before the platform's wall-clock limit.
        const tick = setInterval(() => { if (Date.now() - started > TIME_BUDGET_MS) { timedOut = true; s.abort(); } else send({ k: 1 }); }, 10_000);
        try {
          for await (const event of s) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") send({ t: event.delta.text });
            if (Date.now() - started > TIME_BUDGET_MS) { timedOut = true; s.abort(); break; }
          }
        } catch (e) { if (!timedOut) throw e; } finally { clearInterval(tick); }
        const ms = Date.now() - started;
        if (timedOut) { console.log(JSON.stringify({ ms, stop: "time_limit", tier: body.tier })); send({ done: true, stop: "time_limit" }); return; }
        const final = await s.finalMessage();
        console.log(JSON.stringify({ ms, stop: final.stop_reason, tier: body.tier, out: final.usage?.output_tokens, in: final.usage?.input_tokens }));
        if (final.stop_reason === "refusal") send({ error: "refused" });
        else send({ done: true, stop: final.stop_reason });
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) send({ error: "not_configured" });
        else if (e instanceof Anthropic.RateLimitError) send({ error: "rate_limited" });
        else if (e instanceof Anthropic.APIUserAbortError) send(timedOut ? { done: true, stop: "time_limit" } : { error: "cancelled" });
        else if (e instanceof Anthropic.BadRequestError) { console.error(e.message); send({ error: /workspace/i.test(e.message) ? "workspace_key" : /credit|balance|billing/i.test(e.message) ? "no_credit" : "invalid_request" }); }
        else { console.error(e); send({ error: "upstream_error" }); }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { ...cors, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
});
