import { supabase } from "@/lib/supabase";
import { BRAND_CATALOG } from "@/lib/brands/catalog";

export interface BrandProduct {
  id: string;
  brand_slug: string;
  brand_name: string;
  name: string;
  image_url: string | null;
  product_url: string | null;
}

const SLUG_TO_NAME: Record<string, string> = Object.fromEntries(
  BRAND_CATALOG.map((b) => [b.slug, b.name]),
);

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function fetchBrandInspiration(
  favoriteBrands: string[],
  limit = 6,
): Promise<BrandProduct[]> {
  if (favoriteBrands.length === 0) return [];
  const slugs = favoriteBrands.map(nameToSlug);
  const { data, error } = await supabase
    .from("brand_products")
    .select("id, brand_slug, name, image_url, product_url")
    .in("brand_slug", slugs)
    .limit(60);
  if (error || !data || data.length === 0) return [];

  const shuffled = [...data].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit).map((p) => ({
    id: p.id as string,
    brand_slug: p.brand_slug as string,
    brand_name: SLUG_TO_NAME[p.brand_slug as string] ?? (p.brand_slug as string),
    name: p.name as string,
    image_url: (p.image_url as string | null) ?? null,
    product_url: (p.product_url as string | null) ?? null,
  }));
}
