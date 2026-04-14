import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, RefreshControl } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { HatchedPlaceholder } from "@/components/HatchedPlaceholder";
import { colors } from "@/lib/theme";
import { cleanValue } from "@/lib/ui";

type WardrobeType = "top" | "bottom" | "outerwear" | "shoes" | "accessory";

interface WardrobeItem {
  id: string;
  photo_url: string | null;
  type: WardrobeType;
  color: string | null;
  material: string | null;
  style_tags: string[];
  description: string;
  created_at: string;
}

const FILTERS: { value: WardrobeType | "all"; label: string }[] = [
  { value: "all", label: "TOUT" },
  { value: "top", label: "HAUT" },
  { value: "bottom", label: "BAS" },
  { value: "outerwear", label: "MANTEAU" },
  { value: "shoes", label: "CHAUSS." },
  { value: "accessory", label: "ACCESS." },
];

export default function WardrobeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<WardrobeType | "all">("all");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("id, photo_url, type, color, material, style_tags, description, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      if (__DEV__) console.warn("wardrobe load failed:", error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as WardrobeItem[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.type === filter)),
    [items, filter]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <View className="flex-1 bg-paper">
      <SafeAreaView className="flex-1">
        <View className="px-6 pt-2 pb-4 flex-row items-end justify-between">
          <View>
            <Text className="font-body-medium text-eyebrow text-ink-300">GARDE-ROBE</Text>
            <Text className="font-display text-h1 text-ink-900 mt-1">
              {items.length} {items.length > 1 ? "pieces" : "piece"}
            </Text>
          </View>
        </View>

        <View className="px-6 pb-4">
          <FlatList
            data={FILTERS}
            keyExtractor={(f) => f.value}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
            renderItem={({ item: f }) => {
              const active = filter === f.value;
              return (
                <PressableScale
                  onPress={() => setFilter(f.value)}
                  className={`py-2 px-3 border ${active ? "bg-ink-900 border-ink-900" : "bg-paper-50 border-paper-300"}`}
                >
                  <Text
                    className={`font-body-medium text-micro ${active ? "text-paper" : "text-ink-700"}`}
                  >
                    {f.label}
                  </Text>
                </PressableScale>
              );
            }}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 2, paddingHorizontal: 6 }}
          contentContainerStyle={{ gap: 2, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ice[600]} />
          }
          ListEmptyComponent={
            !loading ? (
              <View className="px-6 pt-12 items-center">
                <Text className="font-body text-body-sm text-ink-500 text-center">
                  Aucune piece pour ce filtre.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push(`/wardrobe/${item.id}`)}
              className="flex-1 active:opacity-70"
            >
              <View className="aspect-square bg-paper-200">
                {item.photo_url ? (
                  <Image
                    source={{ uri: item.photo_url }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <HatchedPlaceholder style={{ width: "100%", height: "100%" }} />
                )}
              </View>
              {(() => {
                const color = cleanValue(item.color);
                const material = cleanValue(item.material);
                return (
                  <View className="py-2 px-1">
                    <Text className="font-body-medium text-caption text-ink-900" numberOfLines={1}>
                      {color ? `${color} ` : ""}
                      {labelForType(item.type)}
                    </Text>
                    {material && (
                      <Text className="font-body text-caption text-ink-500" numberOfLines={1}>
                        {material}
                      </Text>
                    )}
                  </View>
                );
              })()}
            </PressableScale>
          )}
        />
      </SafeAreaView>
    </View>
  );
}

function labelForType(t: WardrobeType): string {
  switch (t) {
    case "top":
      return "haut";
    case "bottom":
      return "bas";
    case "outerwear":
      return "manteau";
    case "shoes":
      return "chaussure";
    case "accessory":
      return "accessoire";
  }
}
