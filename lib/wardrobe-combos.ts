import type { WardrobeCategory } from "@/lib/wardrobe-score";

export interface ComboItem {
  id: string;
  type: WardrobeCategory;
  color: string | null;
  material: string | null;
  description: string;
  photo_url: string | null;
  style_tags?: string[] | null;
}

export interface WardrobeCombo {
  top: ComboItem;
  bottom: ComboItem;
  shoes: ComboItem;
  outerwear: ComboItem | null;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function needsOuterwear(feelsLike: number, coldness: number): boolean {
  const threshold = 10 + (3 - coldness) * 2;
  return feelsLike < threshold;
}

function clashes(a: ComboItem, b: ComboItem): boolean {
  if (!a.color || !b.color) return false;
  const ac = a.color.toLowerCase();
  const bc = b.color.toLowerCase();
  if (ac === bc && (ac.includes("rouge") || ac.includes("vert") || ac.includes("orange"))) return true;
  return false;
}

export function generateCombos(
  items: ComboItem[],
  opts: { feelsLike: number; coldness: number; max?: number; seed?: number },
): WardrobeCombo[] {
  const max = opts.max ?? 3;
  const seed = opts.seed ?? Date.now();

  const byType: Record<WardrobeCategory, ComboItem[]> = {
    top: [], bottom: [], outerwear: [], shoes: [], accessory: [],
  };
  for (const item of items) {
    if (item.type in byType) byType[item.type].push(item);
  }

  if (byType.top.length === 0 || byType.bottom.length === 0 || byType.shoes.length === 0) {
    return [];
  }

  const tops = seededShuffle(byType.top, seed);
  const bottoms = seededShuffle(byType.bottom, seed + 1);
  const shoes = seededShuffle(byType.shoes, seed + 2);
  const outerwears = seededShuffle(byType.outerwear, seed + 3);

  const requireOuter = needsOuterwear(opts.feelsLike, opts.coldness);
  const combos: WardrobeCombo[] = [];
  const usedTops = new Set<string>();
  const usedBottoms = new Set<string>();

  for (const top of tops) {
    if (combos.length >= max) break;
    if (usedTops.has(top.id) && tops.length > max) continue;
    for (const bottom of bottoms) {
      if (combos.length >= max) break;
      if (usedBottoms.has(bottom.id) && bottoms.length > max) continue;
      if (clashes(top, bottom)) continue;
      const shoe = shoes[combos.length % shoes.length];
      if (!shoe) continue;
      const outer = requireOuter && outerwears.length > 0
        ? outerwears[combos.length % outerwears.length]
        : null;
      if (requireOuter && !outer) continue;
      combos.push({ top, bottom, shoes: shoe, outerwear: outer });
      usedTops.add(top.id);
      usedBottoms.add(bottom.id);
    }
  }

  return combos;
}
