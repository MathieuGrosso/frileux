import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Image, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { Outfit } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";
import { RatingStars } from "@/components/RatingStars";

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
        className="mb-4 active:opacity-80"
      >
        <View className="bg-midnight-500 rounded-2xl overflow-hidden">
          <Image
            source={{ uri: item.photo_url }}
            className="w-full h-64"
            resizeMode="cover"
          />
          <View className="p-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-cream-200 text-sm">
                {new Date(item.date).toLocaleDateString("fr-FR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-lg">
                  {weatherEmoji(item.weather_data?.icon ?? "01d")}
                </Text>
                <Text className="text-cream-300 text-sm">
                  {item.weather_data?.temp ?? "?"}°C
                </Text>
              </View>
            </View>
            {item.rating && (
              <View className="mt-2">
                <RatingStars rating={item.rating} size="small" />
              </View>
            )}
            {item.notes && (
              <Text className="text-cream-300 text-sm mt-2 opacity-70" numberOfLines={2}>
                {item.notes}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-midnight">
      <View className="px-6 pt-4 pb-4">
        <Text className="text-cream-500 text-3xl font-sans-bold">
          Mes tenues
        </Text>

        {/* Filter tabs */}
        <View className="flex-row gap-3 mt-4">
          <Pressable
            onPress={() => setFilter("all")}
            className={`px-4 py-2 rounded-full ${
              filter === "all" ? "bg-cream-500" : "bg-midnight-500"
            }`}
          >
            <Text
              className={`font-sans-medium ${
                filter === "all" ? "text-midnight" : "text-cream-300"
              }`}
            >
              Toutes
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilter("top")}
            className={`px-4 py-2 rounded-full ${
              filter === "top" ? "bg-cream-500" : "bg-midnight-500"
            }`}
          >
            <Text
              className={`font-sans-medium ${
                filter === "top" ? "text-midnight" : "text-cream-300"
              }`}
            >
              Top looks
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={outfits}
        renderItem={renderOutfit}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center pt-20">
            <Text className="text-6xl mb-4">👗</Text>
            <Text className="text-cream-300 text-lg text-center">
              Pas encore de tenue !{"\n"}Prends ta première photo.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
