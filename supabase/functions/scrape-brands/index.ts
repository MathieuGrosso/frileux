// Supabase Edge Function: scrape-brands
// Fetches a sample of new arrivals per brand and upserts into brand_products.
// Strategy:
//   1. For Shopify shops, hit /collections/<handle>/products.json — clean JSON.
//   2. Otherwise fetch HTML and parse JSON-LD Product entries.
//   3. OG image as last-resort fallback.
// Breakage per source (WAF, 404, geoblock) is expected and logged.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("SCRAPE_CRON_SECRET") ?? "";

interface BrandSource {
  slug: string;
  tags: string[];
  shopify?: { host: string; handle: string };
  htmlUrl?: string;
}

const SOURCES: BrandSource[] = [
  { slug: "aime-leon-dore", shopify: { host: "aimeleondore.com", handle: "new-arrivals" }, tags: ["preppy"] },
  { slug: "stussy", shopify: { host: "www.stussy.com", handle: "new-arrivals" }, tags: ["streetwear"] },
  { slug: "noah", shopify: { host: "noahny.com", handle: "new-arrivals" }, tags: ["preppy-rebel"] },
  { slug: "bode", shopify: { host: "bode.com", handle: "new-arrivals" }, tags: ["vintage"] },
  { slug: "patta", shopify: { host: "patta.nl", handle: "new-arrivals" }, tags: ["streetwear"] },
  { slug: "gramicci", shopify: { host: "gramicci.com", handle: "new-arrivals" }, tags: ["outdoor"] },
  { slug: "drakes", shopify: { host: "www.drakes.com", handle: "new-arrivals" }, tags: ["tailoring"] },
  { slug: "marine-serre", shopify: { host: "www.marineserre.com", handle: "new-arrivals" }, tags: ["upcycling"] },
  { slug: "universal-works", shopify: { host: "universalworks.co.uk", handle: "new-in" }, tags: ["british-workwear"] },
  { slug: "needles", shopify: { host: "www.nepenthesny.com", handle: "needles" }, tags: ["retro"] },
  { slug: "engineered-garments", shopify: { host: "www.nepenthesny.com", handle: "engineered-garments" }, tags: ["workwear"] },
  { slug: "palace", shopify: { host: "shop-usa.palaceskateboards.com", handle: "all" }, tags: ["skate"] },
  { slug: "jw-anderson", shopify: { host: "www.jwanderson.com", handle: "new-arrivals" }, tags: ["conceptual"] },
  { slug: "jacquemus", shopify: { host: "www.jacquemus.com", handle: "new-arrivals" }, tags: ["mediterranean"] },
  { slug: "kapital", shopify: { host: "www.kapital-webshop.jp", handle: "all" }, tags: ["japanese"] },
  { slug: "apc", shopify: { host: "www.apc-us.com", handle: "mens-new-arrivals" }, tags: ["parisian"] },
  { slug: "acne-studios", htmlUrl: "https://www.acnestudios.com/fr/fr/man/new-arrivals/", tags: ["scandinavian"] },
  { slug: "arcteryx", htmlUrl: "https://arcteryx.com/us/en/c/mens/new-arrivals", tags: ["technical"] },
  { slug: "our-legacy", htmlUrl: "https://www.ourlegacy.com/en-eur/collections/men", tags: ["workwear"] },
  { slug: "lemaire", htmlUrl: "https://www.lemaire.fr/", tags: ["minimal"] },
  { slug: "stone-island", htmlUrl: "https://www.stoneisland.com/fr-fr/homme/nouveautes.html", tags: ["technical"] },
  { slug: "rick-owens", htmlUrl: "https://www.rickowens.eu/en-GB/men/ready-to-wear", tags: ["gothic"] },
  { slug: "margiela", htmlUrl: "https://www.maisonmargiela.com/fr-fr/homme.html", tags: ["deconstruction"] },
  { slug: "ralph-lauren", htmlUrl: "https://www.ralphlauren.fr/", tags: ["preppy"] },
  { slug: "uniqlo-u", htmlUrl: "https://www.uniqlo.com/eu-en/uniqlo-u", tags: ["minimal"] },
  { slug: "carhartt-wip", htmlUrl: "https://www.carhartt-wip.com/en/", tags: ["workwear"] },
  { slug: "auralee", htmlUrl: "https://auralee.jp/", tags: ["japanese-luxe"] },
  { slug: "beams-plus", htmlUrl: "https://www.beams.co.jp/global/beamsplus/", tags: ["japanese-ivy"] },
  { slug: "junya-watanabe", htmlUrl: "https://www.doverstreetmarket.com/london/designers/junya-watanabe-man/", tags: ["experimental"] },
  { slug: "cdg", htmlUrl: "https://www.doverstreetmarket.com/london/designers/comme-des-garcons/", tags: ["avant-garde"] },
];

interface ScrapedProduct {
  name: string;
  image_url: string;
  product_url: string | null;
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

async function scrapeShopify(host: string, handle: string, limit = 6): Promise<ScrapedProduct[]> {
  const url = `https://${host}/collections/${handle}/products.json?limit=${limit}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const json = await res.json();
  const products = Array.isArray(json.products) ? json.products : [];
  return products.slice(0, limit).map((p: Record<string, unknown>) => {
    const title = String(p.title ?? "").slice(0, 120);
    const imgs = Array.isArray(p.images) ? (p.images as Record<string, unknown>[]) : [];
    const src = imgs[0]?.src ? String(imgs[0].src) : "";
    const h = typeof p.handle === "string" ? p.handle : "";
    return {
      name: title,
      image_url: src.slice(0, 500),
      product_url: h ? `https://${host}/products/${h}` : null,
    };
  }).filter((p: ScrapedProduct) => p.name && p.image_url);
}

function extractFromHtml(html: string, baseUrl: string, limit = 6): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  const seen = new Set<string>();

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
    } catch { /* skip */ }
  }

  if (products.length === 0) {
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogImage && ogTitle) {
      products.push({
        name: ogTitle[1].slice(0, 120),
        image_url: new URL(ogImage[1], baseUrl).toString().slice(0, 500),
        product_url: baseUrl,
      });
    }
  }

  return products;
}

async function scrapeHtml(url: string, limit = 6): Promise<ScrapedProduct[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const html = await res.text();
  return extractFromHtml(html, url, limit);
}

async function scrapeSource(source: BrandSource, supabase: ReturnType<typeof createClient>) {
  try {
    let products: ScrapedProduct[] = [];
    if (source.shopify) {
      products = await scrapeShopify(source.shopify.host, source.shopify.handle);
    } else if (source.htmlUrl) {
      products = await scrapeHtml(source.htmlUrl);
    }
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
    } catch { /* ignore */ }
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
