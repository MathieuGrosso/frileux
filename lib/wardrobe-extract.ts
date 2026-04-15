import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Image } from "react-native";
import { supabase } from "./supabase";

type WardrobeItemType = "top" | "bottom" | "outerwear" | "shoes" | "accessory";

interface ExtractedItem {
  type: WardrobeItemType;
  color: string;
  material: string | null;
  style_tags: string[];
  description: string;
  bbox?: [number, number, number, number];
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

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

async function cropAndUpload(params: {
  userId: string;
  photoUri: string;
  imgWidth: number;
  imgHeight: number;
  bbox: [number, number, number, number];
  index: number;
}): Promise<string | null> {
  const { userId, photoUri, imgWidth, imgHeight, bbox, index } = params;
  const [ymin, xmin, ymax, xmax] = bbox;
  const y = Math.max(0, Math.min(1000, ymin));
  const x = Math.max(0, Math.min(1000, xmin));
  const y2 = Math.max(y, Math.min(1000, ymax));
  const x2 = Math.max(x, Math.min(1000, xmax));
  const originX = Math.round((x / 1000) * imgWidth);
  const originY = Math.round((y / 1000) * imgHeight);
  const width = Math.max(1, Math.round(((x2 - x) / 1000) * imgWidth));
  const height = Math.max(1, Math.round(((y2 - y) / 1000) * imgHeight));

  try {
    const ctx = ImageManipulator.manipulate(photoUri);
    ctx.crop({ originX, originY, width, height });
    const rendered = await ctx.renderAsync();
    const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });

    const response = await fetch(result.uri);
    const blob = await response.blob();
    const fileName = `${userId}/crops/${Date.now()}-${index}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("wardrobe")
      .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });
    if (uploadError) {
      if (__DEV__) console.warn("extract-items: crop upload failed", uploadError.message);
      return null;
    }
    const { data } = supabase.storage.from("wardrobe").getPublicUrl(fileName);
    return data.publicUrl;
  } catch (e) {
    if (__DEV__) console.warn("extract-items: crop failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function extractItemsFromOutfitPhoto(params: {
  userId: string;
  imageBase64: string;
  mimeType: string;
  photoUri: string;
}): Promise<{ inserted: number; skipped: number }> {
  const { userId, imageBase64, mimeType, photoUri } = params;

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

  let imgSize: { width: number; height: number } | null = null;
  try {
    imgSize = await getImageSize(photoUri);
  } catch (e) {
    if (__DEV__) console.warn("extract-items: getSize failed", e instanceof Error ? e.message : e);
  }

  const toInsert: Array<{
    user_id: string;
    type: WardrobeItemType;
    color: string | null;
    material: string | null;
    style_tags: string[];
    description: string;
    photo_url: string | null;
    source: "auto_extracted";
  }> = [];
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = dedupeKey(item.type, item.color ?? null, item.material ?? null);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);

    let photo_url: string | null = null;
    if (imgSize && item.bbox && item.bbox.length === 4) {
      photo_url = await cropAndUpload({
        userId,
        photoUri,
        imgWidth: imgSize.width,
        imgHeight: imgSize.height,
        bbox: item.bbox,
        index: i,
      });
    }

    toInsert.push({
      user_id: userId,
      type: item.type,
      color: item.color ?? null,
      material: item.material ?? null,
      style_tags: Array.isArray(item.style_tags) ? item.style_tags.slice(0, 6) : [],
      description: item.description,
      photo_url,
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
