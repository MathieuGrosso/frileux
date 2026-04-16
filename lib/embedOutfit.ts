import { supabase } from "./supabase";

export interface EmbedResult {
  embedding: number[];
  textHash: string | null;
}

const EMBED_TIMEOUT_MS = 30_000;
const TIMEOUT_SENTINEL = Symbol("embed-outfit-timeout");

export async function embedOutfitText(text: string): Promise<number[] | null> {
  const res = await embedOutfitTextWithHash(text);
  return res?.embedding ?? null;
}

export async function embedOutfitTextWithHash(text: string): Promise<EmbedResult | null> {
  const clean = text.trim();
  if (!clean) return null;
  const invokePromise = supabase.functions.invoke("embed-outfit", {
    body: { text: clean },
  });
  const timeoutPromise = new Promise<typeof TIMEOUT_SENTINEL>((resolve) =>
    setTimeout(() => resolve(TIMEOUT_SENTINEL), EMBED_TIMEOUT_MS),
  );
  const raced = await Promise.race([invokePromise, timeoutPromise]);
  if (raced === TIMEOUT_SENTINEL) {
    if (__DEV__) console.warn("embed-outfit timeout");
    return null;
  }
  const { data, error } = raced;
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
