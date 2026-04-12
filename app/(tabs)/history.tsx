import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { Outfit } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";
import { RatingStars } from "@/components/RatingStars";

const { width } = Dimensions.get("window");

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

    if (filter === "top") query = query.gte("rating", 4);

    const { data } = await query;
    setOutfits(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadOutfits(); }, [loadOutfits]);

  function renderOutfit({ item, index }: { item: Outfit; index: number }) {
    const dateStr = new Date(item.date).toLocaleDateString("fr-FR", {
      weekday: "short", day: "numeric", month: "short",
    });

    return (
      <Pressable
        onPress={() => router.push(`/outfit/${item.id}`)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.photoContainer}>
          <Image source={{ uri: item.photo_url }} style={styles.photo} resizeMode="cover" />
          <LinearGradient
            colors={["transparent", "rgba(28,25,23,0.95)"]}
            style={styles.photoGradient}
          />
          {/* Weather badge */}
          <View style={styles.weatherBadge}>
            <Text style={styles.weatherBadgeEmoji}>
              {weatherEmoji(item.weather_data?.icon ?? "01d")}
            </Text>
            <Text style={styles.weatherBadgeTemp}>
              {item.weather_data?.temp ?? "—"}°
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <Text style={styles.dateText}>{dateStr.toUpperCase()}</Text>
          {item.rating ? (
            <RatingStars rating={item.rating} size="small" />
          ) : null}
        </View>

        {item.notes ? (
          <Text style={styles.notesText} numberOfLines={1}>{item.notes}</Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1C1917", "#1C1917"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Archives</Text>
          <View style={styles.filterRow}>
            <Pressable
              onPress={() => setFilter("all")}
              style={[styles.filterBtn, filter === "all" && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
                Toutes
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFilter("top")}
              style={[styles.filterBtn, filter === "top" && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, filter === "top" && styles.filterTextActive]}>
                ★ Top looks
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
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📸</Text>
              <Text style={styles.emptyTitle}>Aucune tenue</Text>
              <Text style={styles.emptyText}>
                {filter === "top"
                  ? "Aucun top look pour l'instant."
                  : "Commence par photographier ta tenue du jour."}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1C1917" },
  safe: { flex: 1 },

  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },
  title: {
    fontFamily: "Cormorant_600SemiBold",
    fontSize: 42,
    color: "#FAFAF9",
    letterSpacing: -1,
    marginBottom: 16,
  },
  filterRow: { flexDirection: "row", gap: 8 },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#292524",
    borderWidth: 1,
    borderColor: "#44403C",
  },
  filterBtnActive: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  filterText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: "#78716C",
  },
  filterTextActive: {
    color: "#1C1917",
  },

  list: { paddingHorizontal: 24, paddingBottom: 32, gap: 16 },

  card: {
    backgroundColor: "#292524",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#312E2B",
  },
  cardPressed: { opacity: 0.88 },

  photoContainer: { height: 280, position: "relative" },
  photo: { width: "100%", height: "100%" },
  photoGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 100 },
  weatherBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(28,25,23,0.75)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#44403C",
  },
  weatherBadgeEmoji: { fontSize: 14 },
  weatherBadgeTemp: { fontFamily: "DMSans_500Medium", fontSize: 13, color: "#D6D3D1" },

  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  dateText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 10,
    color: "#57534E",
    letterSpacing: 1.5,
  },
  notesText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: "#78716C",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },

  empty: { alignItems: "center", paddingTop: 80 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: {
    fontFamily: "Cormorant_600SemiBold",
    fontSize: 26,
    color: "#FAFAF9",
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#57534E",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 32,
  },
});
