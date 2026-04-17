import { supabase } from "@/lib/supabase";
import type { CritiqueResult, OutfitCritique } from "@/lib/types";

type InvokeSuccess = { status: "done"; critique: OutfitCritique };
type InvokeFailure = { status: "failed"; error: string; can_retry: boolean };
type InvokeBody = InvokeSuccess | InvokeFailure;

export async function fetchOutfitCritique(outfitId: string): Promise<CritiqueResult> {
  const { data, error } = await supabase.functions.invoke<InvokeBody>("critique-outfit", {
    body: { outfit_id: outfitId },
  });
  if (error) {
    if (__DEV__) console.warn("critique-outfit transport error:", error);
    return { status: "failed", error: "network", canRetry: true };
  }
  if (!data) {
    return { status: "failed", error: "empty_response", canRetry: true };
  }
  if (data.status === "done") {
    return { status: "done", critique: data.critique };
  }
  if (__DEV__) console.warn("critique-outfit failed:", data.error);
  return { status: "failed", error: data.error, canRetry: data.can_retry };
}
