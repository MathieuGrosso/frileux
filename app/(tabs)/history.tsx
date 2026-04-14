import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import { Image } from "expo-image";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { Outfit } from "@/lib/types";
import { enterFadeUp } from "@/lib/animations";
import { RatingStars } from "@/components/RatingStars";
import { EmptyState } from "@/components/EmptyState";
import { PressableScale } from "@/components/ui/PressableScale";

export default function HistoryScreen() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "top">("all");
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const loadOutfits = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from("outfits")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    if (filter === "top") {
      query = query.gte("rating", 4);
    }

    const { data } = await query;
    setOutfits(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadOutfits();
  }, [loadOutfits]);

  function renderOutfit({ item, index }: { item: Outfit; index: number }) {
    return (
      <Animated.View entering={enterFadeUp(index, reducedMotion)}>
      <PressableScale
        onPress={() => router.push(`/outfit/${item.id}`)}
        className="mb-9"
      >
        <Image
          source={item.photo_url ? { uri: item.photo_url } : null}
          className="w-full h-[280px] bg-paper-200"
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
        <View className="pt-3">
          <View className="flex-row justify-between items-center mb-2.5">
            <Text className="font-body-medium text-eyebrow text-ink-300 tracking-[1.5px]">
              {new Date(item.date).toLocaleDateString("fr-FR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).toUpperCase()}
            </Text>
            <Text className="font-body text-body-sm text-ink-500">
              {item.weather_data?.temp ?? "?"}°
            </Text>
          </View>
          {item.rating != null && item.rating > 0 && (
            <View className="mb-2">
              <RatingStars rating={item.rating} size="small" />
            </View>
          )}
          {item.occasion && (
            <Text className="font-body-medium text-micro text-ice tracking-[1.6px] mt-1">
              {item.occasion.toUpperCase()}
            </Text>
          )}
          {item.notes ? (
            <Text className="font-body text-body-sm text-ink-300 leading-5 mt-1" numberOfLines={2}>
              {item.notes}
            </Text>
          ) : null}
        </View>
      </PressableScale>
      </Animated.View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="px-6 pt-2 pb-5 border-b border-paper-300 mb-2">
        <Text className="font-display text-4xl text-ink-900 tracking-[1px] mb-5">
          MES TENUES
        </Text>
        <View className="flex-row" style={{ gap: 24 }}>
          <PressableScale onPress={() => setFilter("all")} className="pb-1.5 relative">
            <Text
              className={`font-body-medium text-eyebrow tracking-[2px] ${
                filter === "all" ? "text-ink-900" : "text-ink-300"
              }`}
            >
              TOUTES
            </Text>
            {filter === "all" && <View className="absolute -bottom-px left-0 right-0 h-px bg-ink-900" />}
          </PressableScale>
          <PressableScale onPress={() => setFilter("top")} className="pb-1.5 relative">
            <Text
              className={`font-body-medium text-eyebrow tracking-[2px] ${
                filter === "top" ? "text-ink-900" : "text-ink-300"
              }`}
            >
              FAVORIS
            </Text>
            {filter === "top" && <View className="absolute -bottom-px left-0 right-0 h-px bg-ink-900" />}
          </PressableScale>
        </View>
      </View>

      <FlatList
        data={outfits}
        renderItem={renderOutfit}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-6 pb-6"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title="Aucune tenue"
              subtitle="Tes prochaines tenues s'archiveront ici. Prends ta première photo depuis Aujourd'hui."
              cta={{ label: "Aller à aujourd'hui", onPress: () => router.replace("/(tabs)") }}
            />
          )
        }
      />
    </SafeAreaView>
  );
}
