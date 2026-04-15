export type WardrobeCategory = "top" | "bottom" | "outerwear" | "shoes" | "accessory";

export interface CategoryCount {
  type: WardrobeCategory;
  count: number;
  target: number;
}

export const CATEGORY_TARGETS: Record<WardrobeCategory, number> = {
  top: 3,
  bottom: 2,
  outerwear: 1,
  shoes: 2,
  accessory: 0,
};

export const CATEGORY_LABELS: Record<WardrobeCategory, string> = {
  top: "Hauts",
  bottom: "Bas",
  outerwear: "Manteaux",
  shoes: "Chaussures",
  accessory: "Accessoires",
};

const CATEGORY_ORDER: WardrobeCategory[] = ["top", "bottom", "outerwear", "shoes", "accessory"];

export function computeCounts(
  items: Array<{ type: string }>,
): Record<WardrobeCategory, number> {
  const counts: Record<WardrobeCategory, number> = {
    top: 0,
    bottom: 0,
    outerwear: 0,
    shoes: 0,
    accessory: 0,
  };
  for (const item of items) {
    const t = item.type as WardrobeCategory;
    if (t in counts) counts[t] += 1;
  }
  return counts;
}

export function computeScore(counts: Record<WardrobeCategory, number>): number {
  const total = CATEGORY_ORDER.reduce((acc, cat) => acc + CATEGORY_TARGETS[cat], 0);
  if (total === 0) return 0;
  const filled = CATEGORY_ORDER.reduce(
    (acc, cat) => acc + Math.min(counts[cat], CATEGORY_TARGETS[cat]),
    0,
  );
  return Math.round((filled / total) * 100);
}

export function missingCategories(
  counts: Record<WardrobeCategory, number>,
): CategoryCount[] {
  return CATEGORY_ORDER
    .filter((cat) => CATEGORY_TARGETS[cat] > 0 && counts[cat] < CATEGORY_TARGETS[cat])
    .map((cat) => ({ type: cat, count: counts[cat], target: CATEGORY_TARGETS[cat] }));
}

export function categoryBreakdown(
  counts: Record<WardrobeCategory, number>,
): CategoryCount[] {
  return CATEGORY_ORDER.map((cat) => ({
    type: cat,
    count: counts[cat],
    target: CATEGORY_TARGETS[cat],
  }));
}
