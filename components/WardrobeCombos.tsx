import { useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { HatchedPlaceholder } from "@/components/HatchedPlaceholder";
import { generateCombos, type ComboItem, type WardrobeCombo } from "@/lib/wardrobe-combos";

interface Props {
  items: ComboItem[];
  feelsLike: number;
  coldness: number;
  onSelect?: (combo: WardrobeCombo) => void;
}

function todaySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function WardrobeCombos({ items, feelsLike, coldness, onSelect }: Props) {
  const combos = useMemo(
    () => generateCombos(items, { feelsLike, coldness, max: 3, seed: todaySeed() }),
    [items, feelsLike, coldness],
  );

  if (combos.length === 0) return null;

  return (
    <View className="border-t border-paper-300 pt-8 mt-8">
      <View className="px-6 mb-4 flex-row items-baseline justify-between">
        <Text className="font-body-medium text-eyebrow text-ink-500 uppercase">
          Depuis ta garde-robe
        </Text>
        <Text className="font-body text-caption text-ink-400">
          {combos.length} combinaison{combos.length > 1 ? "s" : ""}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24 }}
      >
        {combos.map((combo, idx) => (
          <Pressable
            key={`${combo.top.id}-${combo.bottom.id}-${idx}`}
            onPress={() => onSelect?.(combo)}
            className="mr-3 w-40 active:opacity-80"
          >
            <View className="border border-paper-300 bg-paper">
              <View className="flex-row flex-wrap">
                {[combo.top, combo.bottom, combo.outerwear, combo.shoes]
                  .filter((x): x is ComboItem => Boolean(x))
                  .slice(0, 4)
                  .map((item) => (
                    <View key={item.id} className="w-1/2 aspect-square">
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
                    </View>
                  ))}
              </View>
              <View className="p-2 border-t border-paper-300">
                <Text
                  className="font-body text-caption text-ink-700"
                  numberOfLines={1}
                >
                  {combo.top.description || combo.top.color || "haut"} ·{" "}
                  {combo.bottom.description || combo.bottom.color || "bas"}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
