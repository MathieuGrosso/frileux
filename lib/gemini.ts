// Thin client wrapper around the `wardrobe-ai` Supabase edge function.
// The Gemini API key is kept server-side (GEMINI_API_KEY secret).

import { supabase } from "./supabase";
import type {
  ClothingAnalysis,
  OutfitCombo,
  PieceSuggestion,
  WardrobeItem,
} from "./types";

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wardrobe-ai", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function analyzeClothingImage(
  imageBase64: string,
  mimeType = "image/jpeg"
): Promise<ClothingAnalysis> {
  return invoke<ClothingAnalysis>({
    action: "analyze_image",
    image_base64: imageBase64,
    mime_type: mimeType,
  });
}

export async function analyzeClothingDescription(text: string): Promise<ClothingAnalysis> {
  return invoke<ClothingAnalysis>({ action: "analyze_text", text });
}

function liteItems(items: WardrobeItem[]) {
  return items.map((i) => ({
    id: i.id,
    type: i.type,
    color: i.color,
    description: i.description,
    style_tags: i.style_tags,
  }));
}

export async function generateOutfitCombos(items: WardrobeItem[]): Promise<OutfitCombo[]> {
  const res = await invoke<{ combos: OutfitCombo[] }>({
    action: "generate_combos",
    items: liteItems(items),
  });
  return res.combos ?? [];
}

export async function generateMissingPieces(
  items: WardrobeItem[]
): Promise<PieceSuggestion[]> {
  const res = await invoke<{ pieces: PieceSuggestion[] }>({
    action: "generate_pieces",
    items: liteItems(items),
  });
  return res.pieces ?? [];
}
