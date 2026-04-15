import { supabase } from "@/lib/supabase";
import type { OutfitCritique } from "@/lib/types";

export interface StyleMemoryFact {
  id: string;
  fact: string;
  kind: "strength" | "avoid" | "pattern";
  created_at: string;
}

function truncate(s: string, max = 200): string {
  const clean = s.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export async function recordCritiqueFacts(
  outfitId: string,
  critique: OutfitCritique,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const rows: Array<{
    user_id: string;
    fact: string;
    kind: StyleMemoryFact["kind"];
    source_outfit_id: string;
  }> = [];

  if (critique.score >= 8 && critique.strengths?.length) {
    rows.push({
      user_id: user.id,
      fact: truncate(critique.strengths[0]),
      kind: "strength",
      source_outfit_id: outfitId,
    });
  }

  if (critique.score <= 5 && critique.improvements?.length) {
    rows.push({
      user_id: user.id,
      fact: truncate(critique.improvements[0]),
      kind: "avoid",
      source_outfit_id: outfitId,
    });
  }

  if (rows.length === 0) return;
  await supabase.from("style_memory").insert(rows);
}

export async function loadRecentFacts(limit = 8): Promise<StyleMemoryFact[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("style_memory")
    .select("id, fact, kind, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as StyleMemoryFact[];
}

export function factsToDerivedPrefs(facts: StyleMemoryFact[]): string[] {
  return facts.map((f) => {
    const tag = f.kind === "strength" ? "fonctionne bien" : f.kind === "avoid" ? "à éviter" : "pattern";
    return `mémoire (${tag}) : ${f.fact}`;
  });
}
