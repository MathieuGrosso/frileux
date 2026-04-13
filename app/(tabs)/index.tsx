import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { getDayForecast, getWeather, weatherEmoji } from "@/lib/weather";
import { generateOutfitImage } from "@/lib/gemini";
import type { DayForecast, WeatherData } from "@/lib/types";
import { RatingStars } from "@/components/RatingStars";
import { useRouter } from "expo-router";

export default function TodayScreen() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<DayForecast | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestionImage, setSuggestionImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const today = new Date();
  const dayLabel = today.toLocaleDateString("fr-FR", { weekday: "long" });
  const dateLabel = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  useEffect(() => { loadWeather(); }, []);

  async function loadWeather() {
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;
      let fromGeoloc = false;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
          fromGeoloc = true;
        } catch (geoErr) {
          if (__DEV__) console.warn("Géoloc indisponible, fallback profil/Paris:", geoErr);
        }
      }

      if (latitude === null || longitude === null) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("last_latitude, last_longitude")
          .single();
        if (profile?.last_latitude && profile?.last_longitude) {
          latitude = profile.last_latitude;
          longitude = profile.last_longitude;
        } else {
          latitude = 48.8566;
          longitude = 2.3522;
        }
      }

      if (latitude === null || longitude === null) return;
      const lat = latitude;
      const lon = longitude;

      const data = await getWeather(lat, lon);
      setWeather(data);
      fetchSuggestion(data);

      getDayForecast(lat, lon)
        .then(setForecast)
        .catch((err) => { if (__DEV__) console.warn("forecast failed:", err); });

      if (fromGeoloc) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) supabase.from("profiles").update({ last_latitude: latitude, last_longitude: longitude }).eq("id", user.id);
      }
    } catch (e) { if (__DEV__) console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchSuggestion(weatherData: WeatherData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("coldness_level").eq("id", user.id).maybeSingle()
        : { data: null };

      let recent_worn: string[] = [];
      if (user) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: recentOutfits } = await supabase
          .from("outfits")
          .select("worn_description")
          .eq("user_id", user.id)
          .gte("date", sevenDaysAgo.toISOString().split("T")[0])
          .not("worn_description", "is", null)
          .order("date", { ascending: false })
          .limit(7);
        recent_worn = (recentOutfits ?? [])
          .map((o) => o.worn_description as string | null)
          .filter((w): w is string => !!w && w.trim().length > 0);
      }

      const { data, error } = await supabase.functions.invoke("suggest-outfit", {
        body: {
          weather: weatherData,
          coldness_level: profile?.coldness_level ?? 3,
          recent_worn,
        },
      });
      if (error) {
        if (__DEV__) console.error("suggest-outfit error:", error);
        setSuggestion("Suggestion indisponible.");
        return;
      }
      if (data?.suggestion) {
        const cleaned = stripMarkdown(data.suggestion);
        setSuggestion(cleaned);
        setImageLoading(true);
        generateOutfitImage(cleaned)
          .then((url) => setSuggestionImage(url))
          .catch((err) => { if (__DEV__) console.warn("outfit image failed:", err); })
          .finally(() => setImageLoading(false));
      } else setSuggestion("Suggestion indisponible.");
    } catch (e) {
      if (__DEV__) console.error("fetchSuggestion exception:", e);
      setSuggestion("Suggestion indisponible.");
    }
  }

  function stripMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/^[-•]\s+/gm, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.85 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [3, 4], quality: 0.85 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function saveOutfit() {
    if (!photoUri) { Alert.alert("Erreur", "Aucune photo."); return; }
    if (!weather) { Alert.alert("Erreur", "Météo non chargée."); return; }
    setSaving(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { Alert.alert("Erreur", "Non connecté."); setSaving(false); return; }

      const fileName = `${user.id}/${Date.now()}.jpg`;
      const response = await fetch(photoUri);
      const blob = await response.blob();
      const mimeType = blob.type || "image/jpeg";

      const { error: uploadError } = await supabase.storage
        .from("outfits")
        .upload(fileName, blob, { contentType: mimeType });
      if (uploadError) {
        Alert.alert("Upload échoué", "Réessaye dans un instant.");
        setSaving(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("outfits").getPublicUrl(fileName);

      let worn_description: string | null = null;
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const comma = result.indexOf(",");
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        const { data: wornData, error: wornError } = await supabase.functions.invoke("wardrobe-ai", {
          body: { action: "describe_worn", image_base64: base64, mime_type: mimeType, suggestion },
        });
        if (wornError) { if (__DEV__) console.warn("describe_worn failed:", wornError); }
        else worn_description = wornData?.worn_description ?? null;
      } catch (e) { if (__DEV__) console.warn("worn_description analysis skipped:", e); }

      const { error: insertError } = await supabase.from("outfits").insert({
        user_id: user.id, photo_url: urlData.publicUrl,
        date: today.toISOString().split("T")[0], weather_data: weather,
        rating: rating || null, ai_suggestion: suggestion,
        worn_description,
      });
      if (insertError) throw insertError;

      setSaved(true);
      setPhotoUri(null);
      setRating(0);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      if (__DEV__) console.error("saveOutfit error:", e);
      Alert.alert("Impossible de sauvegarder", e?.message ?? "Erreur inconnue");
    }
    finally { setSaving(false); }
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.dayText}>{dayLabel.toUpperCase()}</Text>
              <Text style={styles.dateText}>{dateLabel}</Text>
            </View>
            <Pressable onPress={() => router.push("/settings")} hitSlop={12}>
              <Text style={styles.settingsIcon}>–</Text>
            </Pressable>
          </View>

          {/* Weather */}
          <View style={styles.weatherSection}>
            <View style={styles.weatherTopRow}>
              <Text style={styles.weatherEmojiLabel}>
                {loading ? "" : weather ? weatherEmoji(weather.icon) : ""}
              </Text>
              <Text style={styles.weatherCondition}>
                {loading ? "CHARGEMENT" : weather?.description?.toUpperCase() ?? "INDISPONIBLE"}
              </Text>
            </View>
            <Text style={styles.tempDisplay}>
              {loading ? "—" : weather ? `${weather.temp}°` : "—"}
            </Text>
            {forecast && (forecast.morning || forecast.midday || forecast.evening) && (
              <View style={styles.forecastRow}>
                {forecast.morning && (
                  <View style={styles.forecastSlot}>
                    <Text style={styles.forecastLabel}>MATIN</Text>
                    <Text style={styles.forecastTemp}>{forecast.morning.temp}°</Text>
                  </View>
                )}
                {forecast.morning && (forecast.midday || forecast.evening) && (
                  <Text style={styles.forecastSep}>—</Text>
                )}
                {forecast.midday && (
                  <View style={styles.forecastSlot}>
                    <Text style={styles.forecastLabel}>MIDI</Text>
                    <Text style={styles.forecastTemp}>{forecast.midday.temp}°</Text>
                  </View>
                )}
                {forecast.midday && forecast.evening && (
                  <Text style={styles.forecastSep}>—</Text>
                )}
                {forecast.evening && (
                  <View style={styles.forecastSlot}>
                    <Text style={styles.forecastLabel}>SOIR</Text>
                    <Text style={styles.forecastTemp}>{forecast.evening.temp}°</Text>
                  </View>
                )}
              </View>
            )}
            {weather && (
              <View style={styles.weatherMeta}>
                <Text style={styles.weatherMetaText}>Ressenti {weather.feels_like}°</Text>
                <Text style={styles.weatherMetaDot}>·</Text>
                <Text style={styles.weatherMetaText}>Vent {weather.wind_speed} m/s</Text>
                {weather.rain && (
                  <>
                    <Text style={styles.weatherMetaDot}>·</Text>
                    <Text style={[styles.weatherMetaText, styles.weatherAccent]}>Pluie</Text>
                  </>
                )}
                {weather.snow && (
                  <>
                    <Text style={styles.weatherMetaDot}>·</Text>
                    <Text style={[styles.weatherMetaText, styles.weatherAccent]}>Neige</Text>
                  </>
                )}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Suggestion */}
          <View style={styles.suggestionSection}>
            <Text style={styles.suggestionLabel}>SUGGESTION DU JOUR</Text>

            <View style={styles.suggestionImageWrap}>
              {suggestionImage ? (
                <Image
                  source={{ uri: suggestionImage }}
                  style={styles.suggestionImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.suggestionImagePlaceholder}>
                  {(imageLoading || (suggestion && !suggestionImage)) && (
                    <ActivityIndicator size="small" color="#637D8E" />
                  )}
                </View>
              )}
            </View>

            {suggestion ? (
              <Text style={styles.suggestionText}>{suggestion}</Text>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ActivityIndicator size="small" color="#637D8E" />
                <Text style={[styles.suggestionText, styles.suggestionMuted]}>
                  {loading ? "Récupération de la météo…" : "Génération en cours…"}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Photo */}
          <View style={styles.photoSection}>
            <Text style={styles.sectionLabel}>TENUE DU JOUR</Text>
            {photoUri ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                <Pressable onPress={() => setPhotoUri(null)} style={styles.changePhotoBtn}>
                  <Text style={styles.changePhotoText}>CHANGER</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.photoButtons}>
                <Pressable
                  onPress={takePhoto}
                  style={({ pressed }) => [styles.photoBtn, pressed && styles.photoBtnPressed]}
                >
                  <Text style={styles.photoBtnIcon}>📷</Text>
                  <Text style={styles.photoBtnText}>CAMÉRA</Text>
                </Pressable>
                <Pressable
                  onPress={pickPhoto}
                  style={({ pressed }) => [styles.photoBtn, pressed && styles.photoBtnPressed]}
                >
                  <Text style={styles.photoBtnIcon}>🖼</Text>
                  <Text style={styles.photoBtnText}>GALERIE</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Rating + Save */}
          {photoUri && (
            <>
              <View style={styles.divider} />
              <View style={styles.ratingSection}>
                <Text style={styles.sectionLabel}>NOTE</Text>
                <RatingStars rating={rating} onRate={setRating} />
                <Pressable
                  onPress={saveOutfit}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    pressed && styles.saveBtnPressed,
                    saving && styles.saveBtnDisabled,
                  ]}
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? "SAUVEGARDE…" : "SAUVEGARDER"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {saved && (
            <View style={styles.savedBanner}>
              <Text style={styles.savedBannerText}>Sauvegardé</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 8 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
  },
  dayText: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    color: "#9E9A96",
    letterSpacing: 2,
  },
  dateText: {
    fontFamily: "Jost_400Regular",
    fontSize: 16,
    color: "#0F0F0D",
    marginTop: 3,
  },
  settingsIcon: {
    fontFamily: "Jost_400Regular",
    fontSize: 24,
    color: "#9E9A96",
    lineHeight: 28,
    marginTop: 4,
  },

  weatherSection: { marginBottom: 40 },
  weatherTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  weatherEmojiLabel: { fontSize: 18 },
  weatherCondition: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    color: "#9E9A96",
    letterSpacing: 2,
  },
  tempDisplay: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 88,
    color: "#0F0F0D",
    lineHeight: 88,
    letterSpacing: -2,
    marginBottom: 14,
  },
  weatherMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  weatherMetaText: {
    fontFamily: "Jost_400Regular",
    fontSize: 12,
    color: "#6B6A66",
  },
  weatherMetaDot: {
    fontFamily: "Jost_400Regular",
    fontSize: 12,
    color: "#C4C0BC",
  },
  weatherAccent: { color: "#637D8E" },

  forecastRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
    marginBottom: 14,
  },
  forecastSlot: { flexDirection: "column", gap: 2 },
  forecastLabel: {
    fontFamily: "Jost_500Medium",
    fontSize: 9,
    color: "#637D8E",
    letterSpacing: 1.8,
  },
  forecastTemp: {
    fontFamily: "Jost_500Medium",
    fontSize: 14,
    color: "#3A3836",
  },
  forecastSep: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#C4C0BC",
    paddingBottom: 1,
  },

  divider: { height: 1, backgroundColor: "#E8E5DF", marginBottom: 32 },

  suggestionSection: { marginBottom: 32 },
  suggestionLabel: {
    fontFamily: "Jost_500Medium",
    fontSize: 9,
    color: "#637D8E",
    letterSpacing: 2,
    marginBottom: 12,
  },
  suggestionText: {
    fontFamily: "Jost_400Regular",
    fontSize: 15,
    color: "#3A3836",
    lineHeight: 25,
  },
  suggestionMuted: { color: "#9E9A96" },

  suggestionImageWrap: {
    aspectRatio: 1,
    backgroundColor: "#EFEBE5",
    marginBottom: 16,
    overflow: "hidden",
  },
  suggestionImage: { width: "100%", height: "100%" },
  suggestionImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  photoSection: { marginBottom: 24 },
  sectionLabel: {
    fontFamily: "Jost_500Medium",
    fontSize: 9,
    color: "#9E9A96",
    letterSpacing: 2,
    marginBottom: 16,
  },
  photoContainer: { height: 440, position: "relative", overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  changePhotoBtn: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(250,250,248,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E8E5DF",
  },
  changePhotoText: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    color: "#0F0F0D",
    letterSpacing: 1.5,
  },
  photoButtons: { flexDirection: "row", gap: 12 },
  photoBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    paddingVertical: 36,
    alignItems: "center",
    backgroundColor: "#FAFAF8",
  },
  photoBtnPressed: { backgroundColor: "#F2F0EC" },
  photoBtnIcon: { fontSize: 22, marginBottom: 10 },
  photoBtnText: {
    fontFamily: "Jost_500Medium",
    fontSize: 9,
    color: "#9E9A96",
    letterSpacing: 1.5,
  },

  ratingSection: { marginBottom: 16 },
  saveBtn: {
    backgroundColor: "#0F0F0D",
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnPressed: { backgroundColor: "#3A3836" },
  saveBtnDisabled: { backgroundColor: "#C4C0BC" },
  saveBtnText: {
    fontFamily: "Jost_600SemiBold",
    fontSize: 11,
    color: "#FAFAF8",
    letterSpacing: 2.5,
  },

  savedBanner: {
    backgroundColor: "#E8F1F6",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  savedBannerText: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    color: "#637D8E",
    letterSpacing: 2,
  },
});
