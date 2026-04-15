import { supabase } from "./supabase";

export interface EmbedResult {
  embedding: number[];
  textHash: string | null;
}

export async function embedOutfitText(text: string): Promise<number[] | null> {
  const res = await embedOutfitTextWithHash(text);
  return res?.embedding ?? null;
}

export async function embedOutfitTextWithHash(text: string): Promise<EmbedResult | null> {
  const clean = text.trim();
  if (!clean) return null;
  const { data, error } = await supabase.functions.invoke("embed-outfit", {
    body: { text: clean },
  });
  if (error) {
    if (__DEV__) console.warn("embed-outfit failed:", error.message);
    return null;
  }
  const values = data?.embedding;
  if (!Array.isArray(values)) return null;
  return { embedding: values as number[], textHash: typeof data?.text_hash === "string" ? data.text_hash : null };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
