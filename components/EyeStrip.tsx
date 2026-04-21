import { useCallback, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";

import { PressableScale } from "@/components/ui/PressableScale";
import { HatchedPlaceholder } from "@/components/HatchedPlaceholder";
import { KIND_LABEL_LOWER, listInspirations } from "@/lib/inspirations";
import type { UserInspiration } from "@/lib/types";

export function EyeStrip() {
  const router = useRouter();
  const [items, setItems] = useState<UserInspiration[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listInspirations({ limit: 8 });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!loaded) return null;

  const isEmpty = items.length === 0;

  return (
    <View className="border-t border-paper-300 pt-8 mt-8">
      <View className="px-6 mb-4 flex-row items-end justify-between">
        <View className="flex-1 pr-4">
          <Text className="font-body-medium text-eyebrow text-ink-500 uppercase">
            L'œil
          </Text>
          <Text className="font-body text-caption text-ink-400 mt-1">
            {isEmpty
              ? "Dépose ce que tu aimes ailleurs. Nourrit l'algo."
              : "Ce que l'œil a retenu — nourrit l'algo."}
          </Text>
        </View>
        <PressableScale onPress={() => router.push("/eye")} hitSlop={8}>
          <Text
            className="font-display text-ink-900"
            style={{ fontSize: 14, letterSpacing: 1.2 }}
          >
            + DÉPOSER
          </Text>
          <View className="h-px bg-ice-600 mt-0.5" />
        </PressableScale>
      </View>

      {isEmpty ? (
        <View className="px-6">
          <PressableScale
            onPress={() => router.push("/eye")}
            className="border border-ink-900 bg-paper-50 px-5 py-5"
          >
            <View className="flex-row items-end justify-between">
              <Text
                className="font-display text-ink-900"
                style={{ fontSize: 20, letterSpacing: 0.4 }}
              >
                DÉPOSER LA PREMIÈRE
              </Text>
              <Text
                className="font-body text-ice-600"
                style={{ fontSize: 11, letterSpacing: 1.2 }}
              >
                PIÈCE · ADRESSE · PLANCHE
              </Text>
            </View>
          </PressableScale>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24 }}
        >
          {items.map((item) => (
            <PressableScale
              key={item.id}
              onPress={() => router.push(`/eye/${item.id}` as const)}
              className="mr-3 w-40"
            >
              <View className="aspect-square border border-paper-300 bg-paper-200">
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <HatchedPlaceholder style={{ width: "100%", height: "100%" }} />
                )}
              </View>
              <Text
                numberOfLines={1}
                className="font-body-medium text-caption text-ink-900 mt-2"
              >
                {item.title?.trim() ||
                  item.extracted_description?.split(",")[0].trim() ||
                  item.site_name ||
                  "sans titre"}
              </Text>
              <Text className="font-body text-caption text-ink-500 mt-[2px]">
                {KIND_LABEL_LOWER[item.kind]}
              </Text>
            </PressableScale>
          ))}
          <PressableScale
            onPress={() => router.push("/eye")}
            className="w-40 aspect-square border border-ink-900 bg-paper-50 items-center justify-center"
          >
            <Text
              className="font-display text-ink-900"
              style={{ fontSize: 20, letterSpacing: 0.4 }}
            >
              + DÉPOSER
            </Text>
            <Text
              className="font-body text-ink-500 mt-1"
              style={{ fontSize: 10, letterSpacing: 1.4 }}
            >
              NOURRIR L'ŒIL
            </Text>
          </PressableScale>
        </ScrollView>
      )}
    </View>
  );
}
