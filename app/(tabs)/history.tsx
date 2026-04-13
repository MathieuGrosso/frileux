import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Image, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { Outfit } from "@/lib/types";
import { RatingStars } from "@/components/RatingStars";
import { EmptyState } from "@/components/EmptyState";

export default function HistoryScreen() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "top">("all");
  const router = useRouter();

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

  function renderOutfit({ item }: { item: Outfit }) {
    return (
      <Pressable
        onPress={() => router.push(`/outfit/${item.id}`)}
        className="mb-9 active:opacity-70"
      >
        <Image
          source={{ uri: item.photo_url }}
          className="w-full h-[280px]"
          resizeMode="cover"
        />
        <View className="pt-3">
          <View className="flex-row justify-between items-center mb-2.5">
            <Text className="font-body-medium text-[10px] text-ink-300 tracking-[1.5px]">
              {new Date(item.date).toLocaleDateString("fr-FR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).toUpperCase()}
            </Text>
            <Text className="font-body text-[13px] text-ink-500">
              {item.weather_data?.temp ?? "?"}°
            </Text>
          </View>
          {item.rating != null && item.rating > 0 && (
            <View className="mb-2">
              <RatingStars rating={item.rating} size="small" />
            </View>
          )}
          {item.occasion && (
            <Text className="font-body-medium text-[9px] text-ice tracking-[1.6px] mt-1">
              {item.occasion.toUpperCase()}
            </Text>
          )}
          {item.notes ? (
            <Text className="font-body text-[13px] text-ink-300 leading-5 mt-1" numberOfLines={2}>
              {item.notes}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="px-6 pt-2 pb-5 border-b border-paper-300 mb-2">
        <Text className="font-display text-4xl text-ink-900 tracking-[1px] mb-5">
          MES TENUES
        </Text>
        <View className="flex-row" style={{ gap: 24 }}>
          <Pressable onPress={() => setFilter("all")} className="pb-1.5 relative">
            <Text
              className={`font-body-medium text-[11px] tracking-[2px] ${
                filter === "all" ? "text-ink-900" : "text-ink-300"
              }`}
            >
              TOUTES
            </Text>
            {filter === "all" && <View className="absolute -bottom-px left-0 right-0 h-px bg-ink-900" />}
          </Pressable>
          <Pressable onPress={() => setFilter("top")} className="pb-1.5 relative">
            <Text
              className={`font-body-medium text-[11px] tracking-[2px] ${
                filter === "top" ? "text-ink-900" : "text-ink-300"
              }`}
            >
              FAVORIS
            </Text>
            {filter === "top" && <View className="absolute -bottom-px left-0 right-0 h-px bg-ink-900" />}
          </Pressable>
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
