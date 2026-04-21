// Supabase Edge Function: og-scrape
// Fetch an external URL and extract Open Graph metadata (og:image, og:title, og:site_name).
// Minimal, no third-party parser: regex on the first 16 KB of HTML.
// Nourrit la route "LIEN" du dépôt d'inspirations L'ŒIL.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { enforceQuota } from "../_shared/quota.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Vary": "Origin",
};

async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function pickMeta(html: string, prop: string): string | null {
  // Cover both property="og:..." (Facebook OG) and name="og:..." / name="twitter:...".
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function decodeEntities(s: string | null): string | null {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function resolveUrl(raw: string, base: string): string {
  try {
    return new URL(raw, base).toString();
  } catch {
    return raw;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const userId = await requireUser(req);
  if (!userId) return json(401, { error: "unauthorized" });

  const guard = await enforceQuota(userId, "og-scrape:fetch");
  if (!guard.ok) return guard.response(CORS);

  let url: string;
  try {
    const body = await req.json();
    url = String(body?.url ?? "").trim();
  } catch {
    return json(400, { error: "invalid_body" });
  }

  if (!/^https?:\/\//i.test(url)) {
    return json(400, { error: "invalid_url" });
  }

  try {
    const upstream = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; FrileuxBot/1.0; +https://frileux.app)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!upstream.ok || !upstream.body) {
      return json(200, { ok: false, image: null, title: null, site_name: null, description: null });
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let size = 0;
    const cap = 16 * 1024;
    while (size < cap) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      size += value.byteLength;
    }
    await reader.cancel();

    const rawImage = pickMeta(html, "og:image") ?? pickMeta(html, "twitter:image");
    const image = rawImage ? resolveUrl(decodeEntities(rawImage) ?? rawImage, upstream.url) : null;
    const title = decodeEntities(pickMeta(html, "og:title") ?? pickMeta(html, "twitter:title"));
    const siteName = decodeEntities(pickMeta(html, "og:site_name"));
    const description = decodeEntities(
      pickMeta(html, "og:description") ?? pickMeta(html, "twitter:description")
    );

    return json(200, {
      ok: true,
      image,
      title,
      site_name: siteName,
      description: description ? description.slice(0, 280) : null,
    });
  } catch (e) {
    console.warn("[og-scrape] fetch failed:", e instanceof Error ? e.message : e);
    return json(200, { ok: false, image: null, title: null, site_name: null, description: null });
  }
});
