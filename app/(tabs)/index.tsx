import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Alert,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { getWeather, weatherEmoji } from "@/lib/weather";
import type { WeatherData } from "@/lib/types";
import { RatingStars } from "@/components/RatingStars";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

export default function TodayScreen() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const today = new Date();
  const dayLabel = today.toLocaleDateString("fr-FR", { weekday: "long" });
  const dateLabel = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  useEffect(() => { loadWeather(); }, []);

  async function loadWeather() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLoading(false); return; }
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      const data = await getWeather(latitude, longitude);
      setWeather(data);
      fetchSuggestion(data);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) supabase.from("profiles").update({ last_latitude: latitude, last_longitude: longitude }).eq("id", user.id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchSuggestion(weatherData: WeatherData) {
    try {
      const { data: profile } = await supabase.from("profiles").select("coldness_level").single();
      const { data, error } = await supabase.functions.invoke("suggest-outfit", {
        body: { weather: weatherData, coldness_level: profile?.coldness_level ?? 3 },
      });
      if (!error && data?.suggestion) setSuggestion(data.suggestion);
    } catch {}
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
    if (!photoUri || !weather) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const response = await fetch(photoUri);
      const blob = await response.blob();
      await supabase.storage.from("outfits").upload(fileName, blob, { contentType: "image/jpeg" });
      const { data: urlData } = supabase.storage.from("outfits").getPublicUrl(fileName);
      await supabase.from("outfits").insert({
        user_id: user.id, photo_url: urlData.publicUrl,
        date: today.toISOString().split("T")[0], weather_data: weather,
        rating: rating || null, ai_suggestion: suggestion,
      });
      Alert.alert("Sauvegardé ✓");
      setPhotoUri(null); setRating(0);
    } catch { Alert.alert("Erreur", "Impossible de sauvegarder."); }
    finally { setSaving(false); }
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1C1917", "#292524", "#1C1917"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.dayText}>{dayLabel.toUpperCase()}</Text>
              <Text style={styles.dateText}>{dateLabel}</Text>
            </View>
            <Pressable onPress={() => router.push("/settings")} style={styles.settingsBtn}>
              <Text style={styles.settingsIcon}>⚙</Text>
            </Pressable>
          </View>

          {/* Weather hero */}
          <View style={styles.weatherHero}>
            <Text style={styles.weatherEmoji}>
              {loading ? "—" : weather ? weatherEmoji(weather.icon) : "—"}
            </Text>
            <Text style={styles.tempDisplay}>
              {loading ? "—" : weather ? `${weather.temp}°` : "—"}
            </Text>
            <Text style={styles.weatherDesc}>
              {loading ? "CHARGEMENT..." : weather?.description?.toUpperCase() ?? "INDISPONIBLE"}
            </Text>
            {weather && (
              <View style={styles.weatherMeta}>
                <Text style={styles.weatherMetaText}>Ressenti {weather.feels_like}°</Text>
                <View style={styles.weatherDot} />
                <Text style={styles.weatherMetaText}>Vent {weather.wind_speed} m/s</Text>
                {weather.rain && (
                  <><View style={styles.weatherDot} /><Text style={[styles.weatherMetaText, { color: "#93C5FD" }]}>Pluie</Text></>
                )}
                {weather.snow && (
                  <><View style={styles.weatherDot} /><Text style={[styles.weatherMetaText, { color: "#BAE6FD" }]}>Neige</Text></>
                )}
              </View>
            )}
          </View>

          {/* AI Suggestion */}
          <View style={styles.suggestionCard}>
            <View style={styles.suggestionAccent} />
            <View style={styles.suggestionContent}>
              <Text style={styles.suggestionLabel}>SUGGESTION DU JOUR</Text>
              <Text style={[styles.suggestionText, !suggestion && { color: "#57534E" }]}>
                {suggestion ?? (loading ? "Récupération de la météo..." : "Génération en cours...")}
              </Text>
            </View>
          </View>

          {/* Photo section */}
          <View style={styles.photoSection}>
            <Text style={styles.sectionLabel}>TENUE DU JOUR</Text>
            {photoUri ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                <LinearGradient colors={["transparent", "rgba(28,25,23,0.9)"]} style={styles.photoGradient} />
                <Pressable onPress={() => setPhotoUri(null)} style={styles.changePhotoBtn}>
                  <Text style={styles.changePhotoText}>Changer</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.photoButtons}>
                <Pressable onPress={takePhoto} style={({ pressed }) => [styles.photoBtn, pressed && styles.photoBtnPressed]}>
                  <Text style={styles.photoBtnIcon}>📷</Text>
                  <Text style={styles.photoBtnText}>Caméra</Text>
                </Pressable>
                <Pressable onPress={pickPhoto} style={({ pressed }) => [styles.photoBtn, pressed && styles.photoBtnPressed]}>
                  <Text style={styles.photoBtnIcon}>🖼</Text>
                  <Text style={styles.photoBtnText}>Galerie</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Rating + Save */}
          {photoUri && (
            <View style={styles.ratingSection}>
              <Text style={styles.sectionLabel}>NOTE TA TENUE</Text>
              <RatingStars rating={rating} onRate={setRating} />
              <Pressable
                onPress={saveOutfit} disabled={saving}
                style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
              >
                <Text style={styles.saveBtnText}>{saving ? "Sauvegarde..." : "Sauvegarder"}</Text>
              </Pressable>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1C1917" },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 8 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 },
  dayText: { fontFamily: "DMSans_500Medium", fontSize: 11, color: "#57534E", letterSpacing: 2 },
  dateText: { fontFamily: "DMSans_400Regular", fontSize: 15, color: "#A8A29E", marginTop: 2 },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#292524", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#44403C" },
  settingsIcon: { fontSize: 15 },

  weatherHero: { alignItems: "center", paddingVertical: 8, marginBottom: 36 },
  weatherEmoji: { fontSize: 52, marginBottom: 4 },
  tempDisplay: { fontFamily: "Cormorant_300Light", fontSize: 120, color: "#FAFAF9", lineHeight: 120, letterSpacing: -4 },
  weatherDesc: { fontFamily: "DMSans_500Medium", fontSize: 11, color: "#57534E", letterSpacing: 3, marginTop: 12 },
  weatherMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" },
  weatherMetaText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: "#78716C" },
  weatherDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#44403C" },

  suggestionCard: { flexDirection: "row", backgroundColor: "#292524", borderRadius: 16, overflow: "hidden", marginBottom: 36, borderWidth: 1, borderColor: "#312E2B" },
  suggestionAccent: { width: 3, backgroundColor: "#F59E0B" },
  suggestionContent: { flex: 1, padding: 20 },
  suggestionLabel: { fontFamily: "DMSans_500Medium", fontSize: 10, color: "#F59E0B", letterSpacing: 2, marginBottom: 10 },
  suggestionText: { fontFamily: "DMSans_400Regular", fontSize: 15, color: "#D6D3D1", lineHeight: 23 },

  photoSection: { marginBottom: 24 },
  sectionLabel: { fontFamily: "DMSans_500Medium", fontSize: 10, color: "#57534E", letterSpacing: 2, marginBottom: 16 },
  photoContainer: { borderRadius: 20, overflow: "hidden", height: 440 },
  photo: { width: "100%", height: "100%" },
  photoGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 120 },
  changePhotoBtn: { position: "absolute", bottom: 16, right: 16, backgroundColor: "rgba(28,25,23,0.85)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#44403C" },
  changePhotoText: { fontFamily: "DMSans_500Medium", fontSize: 13, color: "#D6D3D1" },
  photoButtons: { flexDirection: "row", gap: 12 },
  photoBtn: { flex: 1, backgroundColor: "#292524", borderRadius: 16, paddingVertical: 32, alignItems: "center", borderWidth: 1, borderColor: "#44403C" },
  photoBtnPressed: { backgroundColor: "#312E2B" },
  photoBtnIcon: { fontSize: 28, marginBottom: 10 },
  photoBtnText: { fontFamily: "DMSans_500Medium", fontSize: 13, color: "#A8A29E" },

  ratingSection: { marginBottom: 16 },
  saveBtn: { backgroundColor: "#F59E0B", borderRadius: 14, paddingVertical: 18, alignItems: "center", marginTop: 24 },
  saveBtnPressed: { backgroundColor: "#D97706" },
  saveBtnText: { fontFamily: "DMSans_700Bold", fontSize: 15, color: "#1C1917", letterSpacing: 0.5 },
});
