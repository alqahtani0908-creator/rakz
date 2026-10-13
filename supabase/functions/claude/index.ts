// Rakz — Claude proxy (Supabase Edge Function).
// Keeps ANTHROPIC_API_KEY on the server. Only team members can call it
// (Supabase verifies the JWT, then the function checks public.is_member()).
// Streams newline-delimited JSON to the browser: {"t": "..."} text deltas,
// then {"done": true, "stop": "<stop_reason>"} or {"error": "<code>"}.
import Anthropic from "npm:@anthropic-ai/sdk";

// Model chosen by the firm for cost/quality balance. The app asks for a tier; effort controls depth.
const MODEL = "claude-sonnet-5-5";
const EFFORT: Record<string, "low" | "medium" | "high"> = { quick: "low", default: "medium", complex: "high" };

const SYSTEM =
  "أنت المساعد القانوني لمنصة «ركز النظامية للمحاماة والاستشارات القانونية» في المملكة العربية السعودية. " +
  "اكتب بالعربية الفصحى المهنية، والتزم حرفيًا بالصيغة التي يطلبها المستخدم في كل طلب. " +
  "لا تخترع وقائع أو أرقام مواد غير متيقن منها؛ ضع [........] لما ينقص.";

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

  // Images ride on the final user turn, before its text.
  const images = (body.images ?? []).slice(0, 8);
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((m, i) =>
    i === turns.length - 1 && images.length
      ? { role: "user", content: [...images.map((im) => ({ type: "image" as const, source: { type: "base64" as const, media_type: im.media_type, data: im.data } })), { type: "text" as const, text: m.content }] }
      : { role: m.role, content: m.content },
  );

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        if (!Deno.env.get("ANTHROPIC_API_KEY")) { send({ error: "not_configured" }); return; }
        const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets
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
        for await (const event of s) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") send({ t: event.delta.text });
        }
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") send({ error: "refused" });
        else send({ done: true, stop: final.stop_reason });
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) send({ error: "not_configured" });
        else if (e instanceof Anthropic.RateLimitError) send({ error: "rate_limited" });
        else if (e instanceof Anthropic.APIUserAbortError) send({ error: "cancelled" });
        else if (e instanceof Anthropic.BadRequestError) { console.error(e.message); send({ error: "invalid_request" }); }
        else { console.error(e); send({ error: "upstream_error" }); }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { ...cors, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
});
