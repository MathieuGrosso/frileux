import { supabase } from "@/lib/supabase";
import type { OutfitCritique } from "@/lib/types";

export async function fetchOutfitCritique(outfitId: string): Promise<OutfitCritique | null> {
  const { data, error } = await supabase.functions.invoke<{ critique: OutfitCritique }>(
    "critique-outfit",
    { body: { outfit_id: outfitId } },
  );
  if (error) {
    if (__DEV__) console.warn("critique-outfit error:", error);
    return null;
  }
  return data?.critique ?? null;
}
