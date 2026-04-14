import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { Outfit, OutfitOccasion, ThermalFeeling } from "@/lib/types";
import { OUTFIT_OCCASIONS, THERMAL_FEELINGS } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";
import { RatingStars } from "@/components/RatingStars";
import { OutfitNotes } from "@/components/circle/OutfitNotes";
import { colors } from "@/lib/theme";

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [occasion, setOccasion] = useState<OutfitOccasion | null>(null);
  const [thermal, setThermal] = useState<ThermalFeeling | null>(null);
  const [editing, setEditing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => { loadOutfit(); }, [id]);

  async function loadOutfit() {
    const { data } = await supabase.from("outfits").select("*").eq("id", id).single();
    if (data) {
      setOutfit(data);
      setRating(data.rating ?? 0);
      setNotes(data.notes ?? "");
      setOccasion(data.occasion ?? null);
      setThermal(data.thermal_feeling ?? null);
      const { data: { user } } = await supabase.auth.getUser();
      setIsOwner(!!user && user.id === data.user_id);
    }
  }

  async function saveChanges() {
    if (!outfit) return;
    const { error } = await supabase
      .from("outfits")
      .update({
        rating,
        notes: notes || null,
        occasion,
        thermal_feeling: thermal,
      })
      .eq("id", outfit.id);
    if (error) {
      Alert.alert("Erreur", "Impossible de sauvegarder.");
    } else {
      setEditing(false);
      setOutfit({ ...outfit, rating, notes, occasion, thermal_feeling: thermal });
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
          <ActivityIndicator size="small" color={colors.ice[600]} />
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

          {/* Photo with bare back button — no gradient overlay */}
          <View style={styles.heroContainer}>
            <Image source={{ uri: outfit.photo_url }} style={styles.heroPhoto} resizeMode="cover" />
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>←</Text>
            </Pressable>
          </View>

          <View style={styles.content}>

            {/* Date + weather row */}
            <View style={styles.metaRow}>
              <Text style={styles.heroDate}>{dateStr}</Text>
              {weather && (
                <View style={styles.heroBadge}>
                  <Text style={{ fontSize: 14 }}>{weatherEmoji(weather.icon)}</Text>
                  <Text style={styles.heroBadgeTemp}>{weather.temp}°</Text>
                </View>
              )}
            </View>

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

            <View style={styles.divider} />

            {/* AI Suggestion (what was suggested this morning) */}
            {outfit.ai_suggestion && (
              <View style={styles.suggestionSection}>
                <Text style={styles.suggestionLabel}>SUGGESTION DU MATIN</Text>
                <Text style={styles.suggestionText}>{outfit.ai_suggestion}</Text>
              </View>
            )}

            {/* Worn description (what was actually worn, from photo analysis) */}
            {outfit.worn_description && (
              <View style={styles.suggestionSection}>
                <Text style={[styles.suggestionLabel, styles.wornLabel]}>CE QUE TU AS PORTÉ</Text>
                <Text style={styles.suggestionText}>{outfit.worn_description}</Text>
              </View>
            )}

            {(outfit.ai_suggestion || outfit.worn_description) && <View style={styles.divider} />}

            {/* Occasion */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>OCCASION</Text>
              {editing ? (
                <View style={styles.chipRow}>
                  {OUTFIT_OCCASIONS.map((opt) => {
                    const active = occasion === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setOccasion(active ? null : opt.value)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.notesText, !occasion && styles.notesMuted]}>
                  {OUTFIT_OCCASIONS.find((o) => o.value === occasion)?.label ?? "Non renseignée"}
                </Text>
              )}
            </View>

            {/* Ressenti thermique */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RESSENTI</Text>
              {editing ? (
                <View style={styles.chipRow}>
                  {THERMAL_FEELINGS.map((opt) => {
                    const active = thermal === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setThermal(active ? null : opt.value)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.notesText, !thermal && styles.notesMuted]}>
                  {THERMAL_FEELINGS.find((t) => t.value === thermal)?.label ?? "Non renseigné"}
                </Text>
              )}
            </View>

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
                  placeholderTextColor={colors.ink[300]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  textAlignVertical="top"
                  selectionColor={colors.ice[600]}
                />
              ) : (
                <Text style={[styles.notesText, !notes && styles.notesMuted]}>
                  {notes || "Aucune note"}
                </Text>
              )}
            </View>

            {/* Actions — owner only */}
            {isOwner && (
            <View style={styles.actions}>
              {editing ? (
                <>
                  <Pressable
                    onPress={saveChanges}
                    style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
                  >
                    <Text style={styles.saveBtnText}>SAUVEGARDER</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setEditing(false);
                      setRating(outfit.rating ?? 0);
                      setNotes(outfit.notes ?? "");
                      setOccasion(outfit.occasion ?? null);
                      setThermal(outfit.thermal_feeling ?? null);
                    }}
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
                    <Text style={styles.editBtnText}>MODIFIER</Text>
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
            )}

            {outfit && <OutfitNotes outfitId={outfit.id} />}

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
  label: {
    fontFamily: "Jost_500Medium",
    fontSize: 8,
    color: "#9E9A96",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  value: {
    fontFamily: "Jost_500Medium",
    fontSize: 13,
    color: "#0F0F0D",
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  safe: { flex: 1 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 48,
    color: "#C4C0BC",
  },

  heroContainer: { height: 520, position: "relative" },
  heroPhoto: { width: "100%", height: "100%" },
  backBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(250,250,248,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E8E5DF",
  },
  backText: {
    fontFamily: "Jost_500Medium",
    fontSize: 14,
    color: "#0F0F0D",
  },

  content: { paddingHorizontal: 24, paddingTop: 24 },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  heroDate: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 24,
    color: "#0F0F0D",
    letterSpacing: 0.5,
    flex: 1,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    backgroundColor: "#F2F0EC",
  },
  heroBadgeTemp: {
    fontFamily: "Jost_500Medium",
    fontSize: 13,
    color: "#6B6A66",
  },

  weatherStrip: {
    flexDirection: "row",
    backgroundColor: "#F2F0EC",
    borderWidth: 1,
    borderColor: "#E8E5DF",
    paddingVertical: 16,
    marginBottom: 24,
  },
  weatherDivider: { width: 1, backgroundColor: "#E8E5DF", marginVertical: 4 },

  divider: { height: 1, backgroundColor: "#E8E5DF", marginBottom: 24 },

  suggestionSection: { marginBottom: 24 },
  suggestionLabel: {
    fontFamily: "Jost_500Medium",
    fontSize: 9,
    color: "#637D8E",
    letterSpacing: 2,
    marginBottom: 12,
  },
  wornLabel: { color: "#0F0F0D" },
  suggestionText: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#3A3836",
    lineHeight: 23,
  },

  section: { marginBottom: 24 },
  sectionLabel: {
    fontFamily: "Jost_500Medium",
    fontSize: 9,
    color: "#9E9A96",
    letterSpacing: 2,
    marginBottom: 12,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    backgroundColor: "#FFFFFF",
  },
  chipActive: { backgroundColor: "#0F0F0D", borderColor: "#0F0F0D" },
  chipText: {
    fontFamily: "Jost_400Regular",
    fontSize: 12,
    color: "#0F0F0D",
  },
  chipTextActive: { color: "#FAFAF8" },
  notesInput: {
    backgroundColor: "#F2F0EC",
    borderWidth: 1,
    borderColor: "#E8E5DF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#0F0F0D",
    minHeight: 100,
    lineHeight: 22,
  },
  notesText: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#3A3836",
    lineHeight: 22,
  },
  notesMuted: { color: "#9E9A96" },

  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  saveBtn: {
    flex: 1,
    backgroundColor: "#0F0F0D",
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnPressed: { backgroundColor: "#3A3836" },
  saveBtnText: {
    fontFamily: "Jost_600SemiBold",
    fontSize: 11,
    color: "#FAFAF8",
    letterSpacing: 2,
  },

  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelBtnPressed: { backgroundColor: "#F2F0EC" },
  cancelBtnText: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#9E9A96",
  },

  editBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#0F0F0D",
    paddingVertical: 16,
    alignItems: "center",
  },
  editBtnPressed: { backgroundColor: "#F2F0EC" },
  editBtnText: {
    fontFamily: "Jost_600SemiBold",
    fontSize: 11,
    color: "#0F0F0D",
    letterSpacing: 2,
  },

  deleteBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    paddingVertical: 16,
    alignItems: "center",
  },
  deleteBtnPressed: { backgroundColor: "#FDF2F1" },
  deleteBtnText: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#C0392B",
  },
});
