import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Image, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { Outfit } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";
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
        style={({ pressed }) => [styles.outfitCard, pressed && styles.outfitCardPressed]}
      >
        <Image
          source={{ uri: item.photo_url }}
          style={styles.outfitPhoto}
          resizeMode="cover"
        />
        <View style={styles.outfitMeta}>
          <View style={styles.outfitMetaRow}>
            <Text style={styles.outfitDate}>
              {new Date(item.date).toLocaleDateString("fr-FR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).toUpperCase()}
            </Text>
            <View style={styles.outfitWeather}>
              <Text style={{ fontSize: 14 }}>
                {weatherEmoji(item.weather_data?.icon ?? "01d")}
              </Text>
              <Text style={styles.outfitTemp}>
                {item.weather_data?.temp ?? "?"}°
              </Text>
            </View>
          </View>
          {item.rating != null && item.rating > 0 && (
            <View style={styles.outfitRating}>
              <RatingStars rating={item.rating} size="small" />
            </View>
          )}
          {item.occasion && (
            <Text style={styles.outfitOccasion}>
              {item.occasion.toUpperCase()}
            </Text>
          )}
          {item.notes ? (
            <Text style={styles.outfitNotes} numberOfLines={2}>
              {item.notes}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MES TENUES</Text>
        <View style={styles.filters}>
          <Pressable
            onPress={() => setFilter("all")}
            style={[styles.filterTab, filter === "all" && styles.filterTabActive]}
          >
            <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
              Toutes
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilter("top")}
            style={[styles.filterTab, filter === "top" && styles.filterTabActive]}
          >
            <Text style={[styles.filterText, filter === "top" && styles.filterTextActive]}>
              Top looks
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={outfits}
        renderItem={renderOutfit}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DF",
    marginBottom: 8,
  },
  title: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 36,
    color: "#0F0F0D",
    letterSpacing: 1,
    marginBottom: 20,
  },
  filters: { flexDirection: "row", gap: 8 },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E8E5DF",
  },
  filterTabActive: {
    backgroundColor: "#E8F1F6",
    borderColor: "#D5E4EE",
  },
  filterText: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    color: "#9E9A96",
  },
  filterTextActive: {
    fontFamily: "Jost_500Medium",
    color: "#637D8E",
  },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  outfitCard: { marginBottom: 36 },
  outfitCardPressed: { opacity: 0.65 },
  outfitPhoto: { width: "100%", height: 280 },
  outfitMeta: { paddingTop: 12 },
  outfitMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  outfitDate: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    color: "#9E9A96",
    letterSpacing: 1.5,
  },
  outfitWeather: { flexDirection: "row", alignItems: "center", gap: 4 },
  outfitTemp: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    color: "#6B6A66",
  },
  outfitRating: { marginBottom: 8 },
  outfitNotes: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    color: "#9E9A96",
    lineHeight: 20,
  },
  outfitOccasion: {
    fontFamily: "Jost_500Medium",
    fontSize: 9,
    color: "#637D8E",
    letterSpacing: 1.6,
    marginTop: 4,
  },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyText: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#9E9A96",
    textAlign: "center",
    lineHeight: 24,
  },
});
