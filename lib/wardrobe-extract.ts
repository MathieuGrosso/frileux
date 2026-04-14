import { supabase } from "./supabase";

type WardrobeItemType = "top" | "bottom" | "outerwear" | "shoes" | "accessory";

interface ExtractedItem {
  type: WardrobeItemType;
  color: string;
  material: string | null;
  style_tags: string[];
  description: string;
}

interface ExistingItem {
  type: string;
  color: string | null;
  material: string | null;
}

function dedupeKey(type: string, color: string | null, material: string | null): string {
  const c = (color ?? "").trim().toLowerCase();
  const m = (material ?? "").trim().toLowerCase();
  return `${type}|${c}|${m}`;
}

export async function extractItemsFromOutfitPhoto(params: {
  userId: string;
  imageBase64: string;
  mimeType: string;
}): Promise<{ inserted: number; skipped: number }> {
  const { userId, imageBase64, mimeType } = params;

  const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
    body: {
      action: "analyze_image_multi",
      image_base64: imageBase64,
      mime_type: mimeType,
    },
  });
  if (error) {
    if (__DEV__) console.warn("extract-items: analyze failed", error.message);
    return { inserted: 0, skipped: 0 };
  }

  const items = (data as { items?: ExtractedItem[] } | null)?.items ?? [];
  if (!items.length) return { inserted: 0, skipped: 0 };

  const { data: existingRows, error: existingError } = await supabase
    .from("wardrobe_items")
    .select("type, color, material")
    .eq("user_id", userId);
  if (existingError) {
    if (__DEV__) console.warn("extract-items: fetch existing failed", existingError.message);
  }
  const existingKeys = new Set<string>(
    ((existingRows ?? []) as ExistingItem[]).map((r) => dedupeKey(r.type, r.color, r.material)),
  );

  const toInsert: Array<{
    user_id: string;
    type: WardrobeItemType;
    color: string | null;
    material: string | null;
    style_tags: string[];
    description: string;
    source: "auto_extracted";
  }> = [];
  let skipped = 0;

  for (const item of items) {
    const key = dedupeKey(item.type, item.color ?? null, item.material ?? null);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);
    toInsert.push({
      user_id: userId,
      type: item.type,
      color: item.color ?? null,
      material: item.material ?? null,
      style_tags: Array.isArray(item.style_tags) ? item.style_tags.slice(0, 6) : [],
      description: item.description,
      source: "auto_extracted",
    });
  }

  if (!toInsert.length) return { inserted: 0, skipped };

  const { error: insertError } = await supabase.from("wardrobe_items").insert(toInsert);
  if (insertError) {
    if (__DEV__) console.warn("extract-items: insert failed", insertError.message);
    return { inserted: 0, skipped };
  }

  return { inserted: toInsert.length, skipped };
}
