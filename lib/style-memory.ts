import { supabase } from "@/lib/supabase";
import type { OutfitCritique } from "@/lib/types";
import type { RejectionReason } from "@/lib/rejections";

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

function normalizeFact(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function insertFacts(
  rows: Array<{ fact: string; kind: StyleMemoryFact["kind"]; source_outfit_id?: string | null }>,
): Promise<void> {
  if (rows.length === 0) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Dédoublonner : ne pas insérer un fact équivalent à un des 50 derniers.
  const { data: existing } = await supabase
    .from("style_memory")
    .select("id, fact, kind")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const seen = new Map<string, { id: string; kind: StyleMemoryFact["kind"] }>();
  for (const row of existing ?? []) {
    const key = `${row.kind}:${normalizeFact(row.fact as string)}`;
    seen.set(key, { id: row.id as string, kind: row.kind as StyleMemoryFact["kind"] });
  }

  const toInsert: Array<{
    user_id: string;
    fact: string;
    kind: StyleMemoryFact["kind"];
    source_outfit_id: string | null;
  }> = [];
  const idsToRefresh: string[] = [];

  for (const r of rows) {
    const key = `${r.kind}:${normalizeFact(r.fact)}`;
    const hit = seen.get(key);
    if (hit && hit.id !== "pending") {
      // Signal récurrent : on supprime l'ancien pour laisser le nouveau
      // remonter en tête (la recence pilote la priorité côté profile).
      idsToRefresh.push(hit.id);
    }
    seen.set(key, { id: "pending", kind: r.kind });
    toInsert.push({
      user_id: user.id,
      fact: r.fact,
      kind: r.kind,
      source_outfit_id: r.source_outfit_id ?? null,
    });
  }

  if (idsToRefresh.length > 0) {
    await supabase.from("style_memory").delete().in("id", idsToRefresh);
  }
  if (toInsert.length > 0) {
    await supabase.from("style_memory").insert(toInsert);
  }
}

export async function recordCritiqueFacts(
  outfitId: string,
  critique: OutfitCritique,
): Promise<void> {
  const rows: Array<{ fact: string; kind: StyleMemoryFact["kind"]; source_outfit_id: string }> = [];

  if (critique.score >= 7 && critique.strengths?.length) {
    rows.push({
      fact: truncate(critique.strengths[0]),
      kind: "strength",
      source_outfit_id: outfitId,
    });
  }

  if (critique.score <= 6 && critique.improvements?.length) {
    rows.push({
      fact: truncate(critique.improvements[0]),
      kind: "avoid",
      source_outfit_id: outfitId,
    });
  }

  if (critique.improvements && critique.improvements.length > 1) {
    rows.push({
      fact: truncate(critique.improvements[1] ?? critique.improvements[0]),
      kind: "pattern",
      source_outfit_id: outfitId,
    });
  }

  await insertFacts(rows);
}

const REASON_TO_PATTERN: Record<RejectionReason, string> = {
  too_warm: "tenues proposées souvent perçues trop chaudes — baisser d'un cran la couverture thermique",
  too_cold: "tenues proposées souvent perçues trop froides — monter d'un cran la couverture thermique",
  too_formal: "tenues proposées souvent perçues trop formelles — ouvrir le registre décontracté",
  too_casual: "tenues proposées souvent perçues trop casual — viser plus habillé / tailoring plus net",
  deja_vu: "rejets 'déjà vu' fréquents — varier plus radicalement silhouette / registre d'un jour à l'autre",
  autre: "rejets libres — pousser davantage la prise de parti-pris",
};

export async function recordRefinementFeedback(params: {
  reason: RejectionReason;
  reason_note?: string | null;
  steer_text?: string | null;
  steer_brands?: string[];
}): Promise<void> {
  const rows: Array<{ fact: string; kind: StyleMemoryFact["kind"] }> = [];

  const reasonNote = params.reason_note?.trim();
  if (reasonNote && reasonNote.length >= 5) {
    rows.push({
      fact: `feedback raffinement : ${truncate(reasonNote, 180)}`,
      kind: "pattern",
    });
  }

  const steerText = params.steer_text?.trim();
  if (steerText && steerText.length >= 5) {
    rows.push({
      fact: `direction demandée lors d'un raffinement : ${truncate(steerText, 180)}`,
      kind: "pattern",
    });
  }

  if (params.steer_brands && params.steer_brands.length > 0) {
    rows.push({
      fact: `marques d'inspiration citées en raffinement : ${params.steer_brands.slice(0, 6).join(", ")}`,
      kind: "pattern",
    });
  }

  if (!reasonNote && !steerText && (!params.steer_brands || params.steer_brands.length === 0)) {
    rows.push({
      fact: REASON_TO_PATTERN[params.reason],
      kind: "pattern",
    });
  }

  await insertFacts(rows);
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
