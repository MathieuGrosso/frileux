import type { ColdnessLevel, ThermalFeeling } from "./types";

interface FeedbackEntry {
  thermal: ThermalFeeling;
}

export interface CalibrationSuggestion {
  current: ColdnessLevel;
  suggested: ColdnessLevel;
  reason: string;
  delta: number; // signe : +1 = monter d'un cran, -1 = baisser
}

/**
 * Pure helper : analyse les ressentis recents et propose un nouveau
 * coldness_level si un pattern net se degage. Renvoie null si aucun
 * pattern ou si l'echantillon est trop petit (< 3 entries).
 *
 * Heuristique :
 *   - >= 60% "too_cold" sur N >= 3 → +1 cran (max 5)
 *   - >= 60% "too_warm" sur N >= 3 → -1 cran (min 1)
 *   - sinon : null (calibre OK)
 */
export function suggestColdnessAdjustment(
  current: ColdnessLevel,
  feedback: FeedbackEntry[]
): CalibrationSuggestion | null {
  const sample = feedback.filter((f) => !!f.thermal);
  if (sample.length < 3) return null;

  const tooCold = sample.filter((f) => f.thermal === "too_cold").length;
  const tooWarm = sample.filter((f) => f.thermal === "too_warm").length;
  const ratio = (n: number) => n / sample.length;

  if (ratio(tooCold) >= 0.6 && current < 5) {
    return {
      current,
      suggested: (current + 1) as ColdnessLevel,
      reason: `${tooCold}/${sample.length} tenues récentes étaient trop légères pour toi.`,
      delta: 1,
    };
  }

  if (ratio(tooWarm) >= 0.6 && current > 1) {
    return {
      current,
      suggested: (current - 1) as ColdnessLevel,
      reason: `${tooWarm}/${sample.length} tenues récentes étaient trop chaudes.`,
      delta: -1,
    };
  }

  return null;
}
