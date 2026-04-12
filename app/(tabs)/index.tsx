import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { getWeather, weatherEmoji } from "@/lib/weather";
import type { WeatherData } from "@/lib/types";
import { WeatherBanner } from "@/components/WeatherBanner";
import { AISuggestion } from "@/components/AISuggestion";
import { RatingStars } from "@/components/RatingStars";

export default function TodayScreen() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWeather();
  }, []);

  async function loadWeather() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Active la localisation pour la météo.");
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const data = await getWeather(
        location.coords.latitude,
        location.coords.longitude
      );
      setWeather(data);

      // Fetch AI suggestion
      fetchSuggestion(data);
    } catch (error) {
      console.error("Erreur météo:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSuggestion(weatherData: WeatherData) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("coldness_level")
        .single();

      const { data, error } = await supabase.functions.invoke(
        "suggest-outfit",
        {
          body: {
            weather: weatherData,
            coldness_level: profile?.coldness_level ?? 3,
          },
        }
      );

      if (!error && data?.suggestion) {
        setSuggestion(data.suggestion);
      }
    } catch {
      // Suggestion is optional, don't block on failure
    }
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "Active la caméra pour prendre une photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function saveOutfit() {
    if (!photoUri || !weather) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upload photo
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const response = await fetch(photoUri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("outfits")
        .upload(fileName, blob, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("outfits")
        .getPublicUrl(fileName);

      // Save outfit record
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("outfits").insert({
        user_id: user.id,
        photo_url: urlData.publicUrl,
        date: today,
        weather_data: weather,
        rating: rating || null,
        notes: notes || null,
        ai_suggestion: suggestion,
      });

      if (error) throw error;

      Alert.alert("Sauvegardé !", "Ta tenue du jour est enregistrée.");
      setPhotoUri(null);
      setRating(0);
      setNotes("");
    } catch (error) {
      Alert.alert("Erreur", "Impossible de sauvegarder la tenue.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-midnight">
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="pt-4 pb-6">
          <Text className="text-cream-500 text-3xl font-sans-bold">
            Bonjour !
          </Text>
          <Text className="text-cream-200 text-base opacity-60 mt-1">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </Text>
        </View>

        {/* Weather */}
        <WeatherBanner weather={weather} loading={loading} />

        {/* AI Suggestion */}
        <AISuggestion suggestion={suggestion} loading={!weather} />

        {/* Photo Section */}
        <View className="mt-6">
          <Text className="text-cream-200 text-lg font-sans-semibold mb-3">
            Ta tenue du jour
          </Text>

          {photoUri ? (
            <View>
              <Image
                source={{ uri: photoUri }}
                className="w-full h-96 rounded-2xl"
                resizeMode="cover"
              />
              <Pressable
                onPress={() => setPhotoUri(null)}
                className="absolute top-3 right-3 bg-midnight/80 rounded-full px-3 py-1"
              >
                <Text className="text-cream-200 text-sm">Changer</Text>
              </Pressable>
            </View>
          ) : (
            <View className="flex-row gap-3">
              <Pressable
                onPress={takePhoto}
                className="flex-1 bg-midnight-500 rounded-2xl py-12 items-center active:bg-midnight-400"
              >
                <Text className="text-3xl mb-2">📷</Text>
                <Text className="text-cream-200 font-sans-medium">
                  Prendre une photo
                </Text>
              </Pressable>
              <Pressable
                onPress={pickPhoto}
                className="flex-1 bg-midnight-500 rounded-2xl py-12 items-center active:bg-midnight-400"
              >
                <Text className="text-3xl mb-2">🖼️</Text>
                <Text className="text-cream-200 font-sans-medium">
                  Galerie
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Rating */}
        {photoUri && (
          <View className="mt-6">
            <Text className="text-cream-200 text-lg font-sans-semibold mb-3">
              Note ta tenue
            </Text>
            <RatingStars rating={rating} onRate={setRating} />
          </View>
        )}

        {/* Save Button */}
        {photoUri && (
          <Pressable
            onPress={saveOutfit}
            disabled={saving}
            className="bg-cream-500 rounded-xl py-4 items-center mt-8 mb-12 active:bg-cream-400"
          >
            <Text className="text-midnight text-lg font-sans-semibold">
              {saving ? "Sauvegarde..." : "Sauvegarder ma tenue"}
            </Text>
          </Pressable>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
