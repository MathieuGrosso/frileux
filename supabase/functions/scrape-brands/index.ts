// Supabase Edge Function: scrape-brands
// Fetches a small sample of new arrivals per brand and upserts into brand_products.
// Intended to be triggered weekly via pg_cron. Also callable on demand with
// { brand_slug?: string } body. Scraping is deliberately lightweight (regex on
// Open Graph / product image tags). Breakage per source is expected — we log
// and skip rather than failing the whole run.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("SCRAPE_CRON_SECRET") ?? "";

interface BrandSource {
  slug: string;
  url: string;
  tags: string[];
}

const SOURCES: BrandSource[] = [
  { slug: "our-legacy", url: "https://www.ourlegacy.com/en-eur/men/new-arrivals", tags: ["workwear", "muted"] },
  { slug: "lemaire", url: "https://www.lemaire.fr/en/collections/new-in-men", tags: ["minimal", "fluid"] },
  { slug: "acne-studios", url: "https://www.acnestudios.com/fr/fr/man/new-arrivals/", tags: ["scandinavian"] },
  { slug: "stussy", url: "https://www.stussy.com/collections/new-arrivals", tags: ["streetwear"] },
  { slug: "carhartt-wip", url: "https://www.carhartt-wip.com/en/men/latest", tags: ["workwear"] },
  { slug: "aime-leon-dore", url: "https://www.aimeleondore.com/collections/new-arrivals", tags: ["preppy"] },
  { slug: "palace", url: "https://www.palaceskateboards.com/collections/all", tags: ["streetwear"] },
  { slug: "arcteryx", url: "https://arcteryx.com/us/en/c/mens/new-arrivals", tags: ["technical"] },
];

interface ScrapedProduct {
  name: string;
  image_url: string;
  product_url: string | null;
}

function extractProducts(html: string, baseUrl: string, limit = 6): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  const seen = new Set<string>();

  // Open Graph fallback
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);

  // Try JSON-LD Product entries (common pattern on modern e-comm)
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRe.exec(html)) && products.length < limit) {
    try {
      const json = JSON.parse(m[1].trim());
      const entries = Array.isArray(json) ? json : [json];
      for (const e of entries) {
        if (!e || typeof e !== "object") continue;
        const items = e["@graph"] ?? [e];
        for (const it of items) {
          if (it["@type"] === "Product" && it.name && it.image) {
            const img = Array.isArray(it.image) ? it.image[0] : it.image;
            if (!seen.has(img)) {
              seen.add(img);
              products.push({
                name: String(it.name).slice(0, 120),
                image_url: String(img).slice(0, 500),
                product_url: typeof it.url === "string" ? it.url : null,
              });
              if (products.length >= limit) break;
            }
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  if (products.length === 0 && ogImage && ogTitle) {
    products.push({
      name: ogTitle[1].slice(0, 120),
      image_url: new URL(ogImage[1], baseUrl).toString().slice(0, 500),
      product_url: baseUrl,
    });
  }

  return products;
}

async function scrapeSource(source: BrandSource, supabase: ReturnType<typeof createClient>) {
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FrileuxBot/1.0; +https://frileux.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { slug: source.slug, ok: false, error: `http ${res.status}` };
    const html = await res.text();
    const products = extractProducts(html, source.url);
    if (products.length === 0) return { slug: source.slug, ok: true, inserted: 0 };

    const rows = products.map((p) => ({
      brand_slug: source.slug,
      name: p.name,
      image_url: p.image_url,
      product_url: p.product_url,
      tags: source.tags,
      source: "scrape",
    }));
    const { error } = await supabase.from("brand_products").insert(rows);
    if (error) return { slug: source.slug, ok: false, error: error.message };
    return { slug: source.slug, ok: true, inserted: rows.length };
  } catch (e) {
    return {
      slug: source.slug,
      ok: false,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

Deno.serve(async (req) => {
  const auth = req.headers.get("x-cron-secret");
  if (CRON_SECRET && auth !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let filterSlug: string | undefined;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.brand_slug === "string") filterSlug = body.brand_slug;
    } catch {
      // ignore
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const targets = filterSlug ? SOURCES.filter((s) => s.slug === filterSlug) : SOURCES;
  const results = [];
  for (const source of targets) {
    results.push(await scrapeSource(source, supabase));
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
});
