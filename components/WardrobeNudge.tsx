import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import {
  computeCounts,
  computeScore,
  missingCategories,
  CATEGORY_LABELS,
  type WardrobeCategory,
} from "@/lib/wardrobe-score";

interface Row {
  type: string;
}

function unlockedCombos(counts: Record<WardrobeCategory, number>): number {
  const tops = Math.max(counts.top, 1);
  const bottoms = Math.max(counts.bottom, 1);
  const shoes = Math.max(counts.shoes, 1);
  if (counts.top === 0 || counts.bottom === 0 || counts.shoes === 0) return 0;
  return tops * bottoms * shoes;
}

function pluralize(n: number, singular: string, plural: string): string {
  return n > 1 ? plural : singular;
}

export function WardrobeNudge() {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<WardrobeCategory, number> | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("type")
      .eq("user_id", user.id);
    if (error) return;
    setCounts(computeCounts((data ?? []) as Row[]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!counts) return null;
  const score = computeScore(counts);
  const missing = missingCategories(counts);
  if (score >= 100) return null;

  const top = missing[0];
  const needed = top ? top.target - top.count : 0;
  const currentCombos = unlockedCombos(counts);
  const projectedCounts: Record<WardrobeCategory, number> = top
    ? { ...counts, [top.type]: counts[top.type] + needed }
    : counts;
  const projectedCombos = unlockedCombos(projectedCounts);
  const delta = Math.max(projectedCombos - currentCombos, 0);

  const label = top
    ? `Ajoute ${needed} ${CATEGORY_LABELS[top.type].toLowerCase()} ${pluralize(
        needed,
        "pour débloquer",
        "pour débloquer",
      )} ${delta > 0 ? `${delta} ${pluralize(delta, "tenue", "tenues")}` : "de nouvelles combinaisons"}.`
    : null;

  return (
    <Pressable onPress={() => router.push("/wardrobe")} className="mx-6 mb-6">
      <View className="border border-paper-300 bg-paper-100 px-4 py-3">
        <View className="flex-row items-baseline justify-between">
          <Text className="font-display text-micro text-ink-500 uppercase tracking-widest">
            Garde-robe
          </Text>
          <Text className="font-body text-caption text-ink-900 tracking-widest">
            {score}%
          </Text>
        </View>
        {label && (
          <Text className="font-body text-caption text-ink-500 mt-2">
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
