// Supabase Edge Function: embed-outfit
// Computes a float embedding for an outfit description (worn or suggested).
// Uses Google Gemini text-embedding-004 (768 dims).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { enforceQuota } from "../_shared/quota.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const EMBED_MODEL = "text-embedding-004";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Fail-fast at cold-start: silently skipping the cache on missing SERVICE_ROLE
// would multiply Gemini calls unnoticed. Crash explicitly instead.
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SERVICE_ROLE) {
  throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const userId = await requireUser(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  try {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    const body = await req.json();
    const text = body?.text;
    if (typeof text !== "string" || text.length === 0 || text.length > 2000) {
      throw new Error("text must be a non-empty string ≤ 2000 chars");
    }

    const guard = await enforceQuota(userId, "embed-outfit");
    if (!guard.ok) return guard.response(cors);

    // Dedup: if we've already embedded an outfit with the same text for this user,
    // reuse that embedding instead of hitting Gemini again.
    const textHash = await sha256Hex(text);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: existing } = await admin
      .from("outfits")
      .select("embedding")
      .eq("user_id", userId)
      .eq("embedding_text_hash", textHash)
      .not("embedding", "is", null)
      .limit(1)
      .maybeSingle();
    if (existing?.embedding && Array.isArray(existing.embedding)) {
      return new Response(JSON.stringify({ embedding: existing.embedding, cached: true, text_hash: textHash }), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType: "SEMANTIC_SIMILARITY",
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`gemini embed ${res.status}: ${msg.slice(0, 200)}`);
    }

    const json = await res.json();
    const values = json?.embedding?.values;
    if (!Array.isArray(values)) throw new Error("embedding missing in response");

    return new Response(JSON.stringify({ embedding: values, text_hash: textHash }), {
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    const status = msg.includes("must be") ? 400 : 500;
    return new Response(JSON.stringify({ error: "Erreur embedding." }), {
      status,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }
});
