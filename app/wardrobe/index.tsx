import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { HatchedPlaceholder } from "@/components/HatchedPlaceholder";
import { EmptyState } from "@/components/EmptyState";
import {
  computeCounts,
  computeScore,
  categoryBreakdown,
  CATEGORY_LABELS,
  type WardrobeCategory,
} from "@/lib/wardrobe-score";

type ItemSource = "manual" | "auto_extracted" | "imported";

interface WardrobeItem {
  id: string;
  photo_url: string | null;
  type: WardrobeCategory;
  color: string | null;
  material: string | null;
  description: string;
  source: ItemSource;
  created_at: string;
}

const CATEGORY_ORDER: WardrobeCategory[] = ["top", "bottom", "outerwear", "shoes", "accessory"];

export default function WardrobeIndex() {
  const router = useRouter();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("id, photo_url, type, color, material, description, source, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      if (__DEV__) console.warn("wardrobe load failed:", error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as WardrobeItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = useMemo(() => computeCounts(items), [items]);
  const score = useMemo(() => computeScore(counts), [counts]);
  const breakdown = useMemo(() => categoryBreakdown(counts), [counts]);

  const grouped = useMemo(() => {
    const m: Record<WardrobeCategory, WardrobeItem[]> = {
      top: [], bottom: [], outerwear: [], shoes: [], accessory: [],
    };
    for (const item of items) {
      if (item.type in m) m[item.type].push(item);
    }
    return m;
  }, [items]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color="#0F0F0D" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
      <ScrollView contentContainerClassName="pb-20">
        {/* Header */}
        <View className="px-6 pt-4 pb-6 border-b border-paper-300">
          <View className="flex-row items-center justify-between mb-6">
            <PressableScale onPress={() => router.back()} className="py-1">
              <Text className="font-body text-caption text-ink-500 uppercase tracking-widest">
                Retour
              </Text>
            </PressableScale>
            <Text className="font-body text-caption text-ink-500 uppercase tracking-widest">
              {items.length} pièce{items.length > 1 ? "s" : ""}
            </Text>
          </View>

          <Text className="font-display text-micro text-ink-500 uppercase tracking-widest mb-2">
            Ta garde-robe
          </Text>
          <Text className="font-display text-display-xl text-ink-900 tracking-tight">
            {score}%
          </Text>
          <Text className="font-body text-caption text-ink-500 mt-2">
            Complétude minimum viable.
          </Text>

          {/* Breakdown */}
          <View className="mt-6 space-y-2">
            {breakdown.map((b) => {
              const done = b.target === 0 ? true : b.count >= b.target;
              return (
                <View key={b.type} className="flex-row items-center justify-between py-1">
                  <Text className="font-body text-body-sm text-ink-900">
                    {CATEGORY_LABELS[b.type]}
                  </Text>
                  <Text
                    className={
                      "font-body text-caption tracking-widest " +
                      (done ? "text-ink-900" : "text-ice")
                    }
                  >
                    {b.count}
                    {b.target > 0 ? ` / ${b.target}` : ""}
                    {b.target > 0 && !done ? "  ·  à compléter" : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Empty state */}
        {items.length === 0 && (
          <View className="px-6 pt-10">
            <EmptyState
              title="Aucune pièce pour l'instant"
              subtitle="Logue une tenue depuis Aujourd'hui : les pièces seront extraites automatiquement."
            />
          </View>
        )}

        {/* Category lists */}
        {CATEGORY_ORDER.map((cat) => {
          const list = grouped[cat];
          if (list.length === 0) return null;
          return (
            <View key={cat} className="px-6 pt-8">
              <Text className="font-display text-micro text-ink-500 uppercase tracking-widest mb-3">
                {CATEGORY_LABELS[cat]}
              </Text>
              <View className="flex-row flex-wrap -mx-1">
                {list.map((item) => (
                  <PressableScale
                    key={item.id}
                    onPress={() => router.push(`/wardrobe/${item.id}` as const)}
                    className="w-1/2 p-1"
                  >
                    <View className="bg-paper-200 aspect-square overflow-hidden">
                      {item.photo_url ? (
                        <Image
                          source={{ uri: item.photo_url }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <HatchedPlaceholder />
                      )}
                      {item.source === "auto_extracted" && (
                        <View className="absolute top-2 left-2 bg-paper px-2 py-1">
                          <Text className="font-body text-micro text-ice uppercase tracking-widest">
                            Auto
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      className="font-body text-caption text-ink-900 mt-2"
                    >
                      {item.description}
                    </Text>
                    {item.color && (
                      <Text
                        numberOfLines={1}
                        className="font-body text-micro text-ink-500 uppercase tracking-widest mt-0.5"
                      >
                        {item.color}
                      </Text>
                    )}
                  </PressableScale>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
