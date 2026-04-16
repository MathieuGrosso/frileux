import { embedOutfitTextWithHash } from "./embedOutfit";
import { supabase } from "./supabase";
import { extractItemsFromOutfitPhoto } from "./wardrobe-extract";

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function enrichOutfitInBackground(params: {
  outfitId: string;
  userId: string;
  blob: Blob;
  mimeType: string;
  photoUri: string;
  suggestion: string | null;
}): Promise<void> {
  const { outfitId, userId, blob, mimeType, photoUri, suggestion } = params;

  let base64: string;
  try {
    base64 = await blobToBase64(blob);
  } catch (e) {
    if (__DEV__) console.warn("enrich-outfit: base64 conversion failed", e);
    return;
  }

  let worn_description: string | null = null;
  try {
    const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
      body: { action: "describe_worn", image_base64: base64, mime_type: mimeType, suggestion },
    });
    if (error) {
      if (__DEV__) console.warn("enrich-outfit: describe_worn failed", error.message);
    } else {
      worn_description = data?.worn_description ?? null;
    }
  } catch (e) {
    if (__DEV__) console.warn("enrich-outfit: describe_worn skipped", e);
  }

  const embeddingSource = worn_description ?? suggestion ?? null;
  const embedRes = embeddingSource
    ? await embedOutfitTextWithHash(embeddingSource).catch(() => null)
    : null;
  const embedding = embedRes?.embedding ?? null;

  const patch: Record<string, unknown> = {};
  if (worn_description !== null) patch.worn_description = worn_description;
  if (embedding !== null) {
    patch.embedding = embedding;
    patch.embedding_text_hash = embedRes?.textHash ?? null;
    patch.embedding_source = worn_description ? "worn" : "suggested";
  }
  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase
      .from("outfits")
      .update(patch)
      .eq("id", outfitId);
    if (updateError && __DEV__) console.warn("enrich-outfit: update failed", updateError.message);
  }

  await extractItemsFromOutfitPhoto({
    userId,
    imageBase64: base64,
    mimeType,
    photoUri,
  }).catch((err) => {
    if (__DEV__) console.warn("enrich-outfit: extract skipped", err);
  });
}
