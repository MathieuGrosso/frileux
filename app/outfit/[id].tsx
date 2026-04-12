import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { Outfit } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";
import { RatingStars } from "@/components/RatingStars";

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => { loadOutfit(); }, [id]);

  async function loadOutfit() {
    const { data } = await supabase.from("outfits").select("*").eq("id", id).single();
    if (data) {
      setOutfit(data);
      setRating(data.rating ?? 0);
      setNotes(data.notes ?? "");
    }
  }

  async function saveChanges() {
    if (!outfit) return;
    const { error } = await supabase
      .from("outfits")
      .update({ rating, notes: notes || null })
      .eq("id", outfit.id);
    if (error) {
      Alert.alert("Erreur", "Impossible de sauvegarder.");
    } else {
      setEditing(false);
      setOutfit({ ...outfit, rating, notes });
    }
  }

  async function deleteOutfit() {
    Alert.alert("Supprimer ?", "Cette tenue sera supprimée définitivement.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          if (!outfit) return;
          await supabase.from("outfits").delete().eq("id", outfit.id);
          router.back();
        },
      },
    ]);
  }

  if (!outfit) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.loadingCenter}>
          <Text style={styles.loadingText}>—</Text>
        </SafeAreaView>
      </View>
    );
  }

  const weather = outfit.weather_data;
  const dateStr = new Date(outfit.date).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

          {/* Photo hero */}
          <View style={styles.heroContainer}>
            <Image source={{ uri: outfit.photo_url }} style={styles.heroPhoto} resizeMode="cover" />
            <LinearGradient
              colors={["rgba(28,25,23,0.6)", "transparent", "rgba(28,25,23,0.95)"]}
              style={StyleSheet.absoluteFill}
            />
            {/* Back button */}
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>←</Text>
            </Pressable>

            {/* Date overlay */}
            <View style={styles.heroMeta}>
              <Text style={styles.heroDate}>{dateStr}</Text>
              {weather && (
                <View style={styles.heroBadge}>
                  <Text style={{ fontSize: 16 }}>{weatherEmoji(weather.icon)}</Text>
                  <Text style={styles.heroBadgeTemp}>{weather.temp}°</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.content}>

            {/* Weather strip */}
            {weather && (
              <View style={styles.weatherStrip}>
                <WeatherStat label="Ressenti" value={`${weather.feels_like}°`} />
                <View style={styles.weatherDivider} />
                <WeatherStat label="Vent" value={`${weather.wind_speed} m/s`} />
                <View style={styles.weatherDivider} />
                <WeatherStat label="Humidité" value={`${weather.humidity}%`} />
                <View style={styles.weatherDivider} />
                <WeatherStat label="Ciel" value={weather.description} />
              </View>
            )}

            {/* AI Suggestion */}
            {outfit.ai_suggestion && (
              <View style={styles.suggestionCard}>
                <View style={styles.suggestionAccent} />
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionLabel}>SUGGESTION IA</Text>
                  <Text style={styles.suggestionText}>{outfit.ai_suggestion}</Text>
                </View>
              </View>
            )}

            {/* Rating */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NOTE</Text>
              <RatingStars rating={rating} onRate={editing ? setRating : undefined} />
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NOTES</Text>
              {editing ? (
                <TextInput
                  style={styles.notesInput}
                  placeholder="Comment te sentais-tu dans cette tenue ?"
                  placeholderTextColor="#57534E"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  textAlignVertical="top"
                  selectionColor="#F59E0B"
                />
              ) : (
                <Text style={styles.notesText}>
                  {notes || <Text style={styles.notesMuted}>Aucune note</Text>}
                </Text>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              {editing ? (
                <>
                  <Pressable
                    onPress={saveChanges}
                    style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
                  >
                    <Text style={styles.saveBtnText}>Sauvegarder</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { setEditing(false); setRating(outfit.rating ?? 0); setNotes(outfit.notes ?? ""); }}
                    style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
                  >
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => setEditing(true)}
                    style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
                  >
                    <Text style={styles.editBtnText}>Modifier</Text>
                  </Pressable>
                  <Pressable
                    onPress={deleteOutfit}
                    style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
                  >
                    <Text style={styles.deleteBtnText}>Supprimer</Text>
                  </Pressable>
                </>
              )}
            </View>

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={weatherStatStyles.label}>{label.toUpperCase()}</Text>
      <Text style={weatherStatStyles.value}>{value}</Text>
    </View>
  );
}

const weatherStatStyles = StyleSheet.create({
  label: { fontFamily: "DMSans_500Medium", fontSize: 9, color: "#57534E", letterSpacing: 1.5, marginBottom: 4 },
  value: { fontFamily: "DMSans_500Medium", fontSize: 13, color: "#D6D3D1" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1C1917" },
  safe: { flex: 1 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontFamily: "Cormorant_600SemiBold", fontSize: 48, color: "#292524" },

  heroContainer: { height: 520, position: "relative" },
  heroPhoto: { width: "100%", height: "100%" },
  backBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(28,25,23,0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#44403C",
  },
  backText: { fontFamily: "DMSans_500Medium", fontSize: 18, color: "#D6D3D1" },

  heroMeta: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  heroDate: {
    fontFamily: "Cormorant_600SemiBold",
    fontSize: 22,
    color: "#FAFAF9",
    flex: 1,
    lineHeight: 28,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(28,25,23,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#44403C",
  },
  heroBadgeTemp: { fontFamily: "DMSans_500Medium", fontSize: 14, color: "#D6D3D1" },

  content: { paddingHorizontal: 24, paddingTop: 24 },

  weatherStrip: {
    flexDirection: "row",
    backgroundColor: "#292524",
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#312E2B",
  },
  weatherDivider: { width: 1, backgroundColor: "#44403C", marginVertical: 4 },

  suggestionCard: {
    flexDirection: "row",
    backgroundColor: "#292524",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#312E2B",
  },
  suggestionAccent: { width: 3, backgroundColor: "#F59E0B" },
  suggestionContent: { flex: 1, padding: 16 },
  suggestionLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 9,
    color: "#F59E0B",
    letterSpacing: 2,
    marginBottom: 8,
  },
  suggestionText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#D6D3D1",
    lineHeight: 22,
  },

  section: { marginBottom: 24 },
  sectionLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 10,
    color: "#57534E",
    letterSpacing: 2,
    marginBottom: 12,
  },
  notesInput: {
    backgroundColor: "#292524",
    borderWidth: 1,
    borderColor: "#44403C",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#E7E5E4",
    minHeight: 100,
    lineHeight: 22,
  },
  notesText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#D6D3D1",
    lineHeight: 22,
  },
  notesMuted: { color: "#57534E" },

  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  saveBtn: {
    flex: 1,
    backgroundColor: "#F59E0B",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnPressed: { backgroundColor: "#D97706" },
  saveBtnText: { fontFamily: "DMSans_700Bold", fontSize: 14, color: "#1C1917" },

  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#44403C",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelBtnPressed: { backgroundColor: "#292524" },
  cancelBtnText: { fontFamily: "DMSans_500Medium", fontSize: 14, color: "#78716C" },

  editBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  editBtnPressed: { backgroundColor: "rgba(245,158,11,0.08)" },
  editBtnText: { fontFamily: "DMSans_500Medium", fontSize: 14, color: "#F59E0B" },

  deleteBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#44403C",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  deleteBtnPressed: { backgroundColor: "#292524" },
  deleteBtnText: { fontFamily: "DMSans_500Medium", fontSize: 14, color: "#78716C" },
});
