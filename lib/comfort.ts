import type { ColdnessLevel } from "./types";

// Decalage ressenti applique au feels_like : une personne tres frileuse
// (5) percoit la temperature comme 2° plus froide qu'une personne
// peu frileuse (1).
const COLDNESS_OFFSETS: Record<ColdnessLevel, number> = {
  1: -2,
  2: -1,
  3: 0,
  4: 1,
  5: 2,
};

export interface ComfortVerdict {
  perceived: number; // temperature ressentie ajustee a la frilosite
  label: string;
  tone: "cold" | "neutral" | "warm";
}

export function comfortVerdict(
  feelsLike: number,
  coldness: ColdnessLevel
): ComfortVerdict {
  const perceived = feelsLike - COLDNESS_OFFSETS[coldness];

  if (perceived <= 2) {
    return { perceived, label: "Glacial pour toi", tone: "cold" };
  }
  if (perceived <= 8) {
    return { perceived, label: "Tu vas avoir froid", tone: "cold" };
  }
  if (perceived <= 14) {
    return { perceived, label: "Frais", tone: "neutral" };
  }
  if (perceived <= 20) {
    return { perceived, label: "Doux pour toi", tone: "neutral" };
  }
  if (perceived <= 26) {
    return { perceived, label: "Agreable", tone: "warm" };
  }
  return { perceived, label: "Chaud, allege la couche", tone: "warm" };
}
