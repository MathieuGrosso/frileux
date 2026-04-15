import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Alert,
  Animated,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { getWeatherCached } from "@/lib/weather";
import { generateOutfitImage } from "@/lib/gemini";
import { comfortVerdict } from "@/lib/comfort";
import type { ColdnessLevel, DayForecast, OutfitOccasion, WeatherData } from "@/lib/types";
import { OUTFIT_OCCASIONS } from "@/lib/types";
import { RatingStars } from "@/components/RatingStars";
import { Skeleton } from "@/components/Skeleton";
import { TodayLoader, type LoaderStep } from "@/components/TodayLoader";
import { OutfitImageLoader } from "@/components/OutfitImageLoader";
import { loadProfileBundle, type ProfileBundle } from "@/lib/profile";
import { clearSuggestion, patchSuggestionAdoption, patchSuggestionImage, readSuggestion, writeSuggestion } from "@/lib/suggestionCache";
import { REJECTION_REASONS, insertRejection, type RejectionReason } from "@/lib/rejections";
import { embedOutfitText } from "@/lib/embedOutfit";
import { extractItemsFromOutfitPhoto } from "@/lib/wardrobe-extract";
import { SuggestionSwipeArea } from "@/components/SuggestionSwipeArea";
import { WardrobeNudge } from "@/components/WardrobeNudge";
import { RefineSheet } from "@/components/RefineSheet";
import { OutfitCritique } from "@/components/OutfitCritique";
import { fetchOutfitCritique } from "@/lib/critique";
import { colors, motion } from "@/lib/theme";
import { useFocusEffect, useRouter } from "expo-router";

function getLocalDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TodayScreen() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<DayForecast | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestionImage, setSuggestionImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [occasion, setOccasion] = useState<OutfitOccasion | null>(null);
  const [coldness, setColdness] = useState<ColdnessLevel | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refining, setRefining] = useState(false);
  const [steerText, setSteerText] = useState("");
  const [steerBrands, setSteerBrands] = useState<string[]>([]);
  const [favoriteBrands, setFavoriteBrands] = useState<string[]>([]);
  const [adopted, setAdopted] = useState(false);
  const [adoptedOutfitId, setAdoptedOutfitId] = useState<string | null>(null);
  const [adopting, setAdopting] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [critique, setCritique] = useState<import("@/lib/types").OutfitCritique | null>(null);
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [critiqueOutfitId, setCritiqueOutfitId] = useState<string | null>(null);
  const critiqueTargetRef = useRef<string | null>(null);
  const [todayOutfit, setTodayOutfit] = useState<{
    id: string;
    photo_url: string;
    occasion: OutfitOccasion | null;
    rating: number | null;
    notes: string | null;
  } | null>(null);
  const router = useRouter();

  const today = new Date();
  const dayLabel = today.toLocaleDateString("fr-FR", { weekday: "long" });
  const dateLabel = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  const profilePromiseRef = useRef<Promise<ProfileBundle> | null>(null);

  useEffect(() => {
    profilePromiseRef.current = loadProfileBundle();
    loadWeather();
    loadTodayOutfit();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTodayOutfit();
    }, [])
  );

  async function loadTodayOutfit() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const todayStr = getLocalDateISO(today);
      const { data } = await supabase
        .from("outfits")
        .select("id, photo_url, occasion, rating, notes, critique")
        .eq("user_id", user.id)
        .eq("date", todayStr)
        .not("photo_url", "is", null)
        .maybeSingle();
      if (data?.photo_url) {
        setTodayOutfit({
          id: data.id,
          photo_url: data.photo_url,
          occasion: (data.occasion ?? null) as OutfitOccasion | null,
          rating: data.rating ?? null,
          notes: data.notes ?? null,
        });
        setCritiqueOutfitId(data.id);
        critiqueTargetRef.current = data.id;
        if (data.critique) {
          setCritique(data.critique as import("@/lib/types").OutfitCritique);
          setCritiqueLoading(false);
        } else {
          setCritique(null);
          setCritiqueLoading(true);
          const targetId = data.id;
          fetchOutfitCritique(targetId)
            .then((c) => { if (critiqueTargetRef.current === targetId) setCritique(c); })
            .catch((err) => { if (__DEV__) console.warn("critique fetch:", err); })
            .finally(() => { if (critiqueTargetRef.current === targetId) setCritiqueLoading(false); });
        }
      }
    } catch (e) { if (__DEV__) console.warn("loadTodayOutfit:", e); }
  }

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
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = user
          ? await supabase
              .from("profiles")
              .select("last_latitude, last_longitude")
              .eq("id", user.id)
              .maybeSingle()
          : { data: null };
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

      const data = await getWeatherCached(lat, lon, (fresh) => {
        setWeather(fresh);
      });
      setWeather(data);
      fetchSuggestion(data);

      if (fromGeoloc) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: upErr } = await supabase
            .from("profiles")
            .update({ last_latitude: latitude, last_longitude: longitude })
            .eq("id", user.id);
          if (upErr && __DEV__) console.warn("profile location update:", upErr.message);
        }
      }
    } catch (e) { if (__DEV__) console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchSuggestion(
    weatherData: WeatherData,
    opts: {
      avoid_reasons?: string[];
      steer_text?: string | null;
      steer_brands?: string[];
      skipCache?: boolean;
    } = {}
  ) {
    try {
      const bundle = await (profilePromiseRef.current ?? loadProfileBundle());
      const { userId, coldness: userColdness, taste, recent_worn, recent_feedback, liked_anchors, derived_prefs, wardrobe, wardrobeOnlyMode } = bundle;
      setColdness(userColdness);
      if (taste?.favorite_brands?.length) setFavoriteBrands(taste.favorite_brands);

      if (userId && !opts.skipCache) {
        const cached = await readSuggestion({
          userId,
          coldness: userColdness,
          occasion,
          currentTemp: weatherData.temp,
        });
        if (cached) {
          setSuggestion(cached.text);
          if (cached.adopted) {
            setAdopted(true);
            setAdoptedOutfitId(cached.adoptedOutfitId ?? null);
          }
          if (cached.imageUrl) setSuggestionImage(cached.imageUrl);
          else {
            setImageLoading(true);
            generateOutfitImage(cached.text)
              .then((url) => {
                setSuggestionImage(url);
                if (url) patchSuggestionImage({ userId, coldness: userColdness, occasion }, url);
              })
              .catch((err) => { if (__DEV__) console.warn("outfit image failed:", err); })
              .finally(() => setImageLoading(false));
          }
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("suggest-outfit", {
        body: {
          weather: weatherData,
          coldness_level: userColdness,
          recent_worn,
          recent_feedback,
          occasion,
          taste,
          avoid_reasons: opts.avoid_reasons,
          steer_text: opts.steer_text,
          steer_brands: opts.steer_brands,
          liked_anchors,
          derived_prefs,
          wardrobe,
          wardrobe_mode: wardrobeOnlyMode ? ("strict" as const) : ("priority" as const),
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
        if (userId) {
          writeSuggestion(
            { userId, coldness: userColdness, occasion },
            { text: cleaned, imageUrl: null, weather: weatherData }
          );
        }
        setImageLoading(true);
        generateOutfitImage(cleaned)
          .then((url) => {
            setSuggestionImage(url);
            if (userId && url) patchSuggestionImage({ userId, coldness: userColdness, occasion }, url);
          })
          .catch((err) => { if (__DEV__) console.warn("outfit image failed:", err); })
          .finally(() => setImageLoading(false));
      } else setSuggestion("Suggestion indisponible.");
    } catch (e) {
      if (__DEV__) console.error("fetchSuggestion exception:", e);
      setSuggestion("Suggestion indisponible.");
    }
  }

  async function refineSuggestion(opts: {
    reason?: RejectionReason | null;
    steerText?: string;
    steerBrands?: string[];
  }) {
    if (!weather || !suggestion || refining) return;
    const reason = opts.reason ?? null;
    const trimmedText = opts.steerText?.trim() ?? "";
    const brands = opts.steerBrands ?? [];
    setRefining(true);
    try {
      const reasonEntry = reason
        ? REJECTION_REASONS.find((r) => r.value === reason)
        : null;
      const notePieces: string[] = [];
      if (trimmedText) notePieces.push(trimmedText);
      if (brands.length) notePieces.push(`marques: ${brands.join(", ")}`);
      await insertRejection({
        suggestion_text: suggestion,
        reason: reason ?? "autre",
        weather_data: weather,
        occasion,
        reason_note: notePieces.join(" · ") || null,
      });
      const bundle = await (profilePromiseRef.current ?? loadProfileBundle());
      if (bundle.userId) {
        await clearSuggestion({
          userId: bundle.userId,
          coldness: bundle.coldness,
          occasion,
        });
      }
      setSuggestion(null);
      setSuggestionImage(null);
      const avoid = [
        `Ne reprends pas cette tenue : "${suggestion}".`,
        ...(reasonEntry ? [reasonEntry.prompt] : []),
      ];
      await fetchSuggestion(weather, {
        avoid_reasons: avoid,
        steer_text: trimmedText || null,
        steer_brands: brands.length ? brands : undefined,
        skipCache: true,
      });
      setSteerText("");
      setSteerBrands([]);
      setRefineOpen(false);
      setAdopted(false);
      setAdoptedOutfitId(null);
    } finally {
      setRefining(false);
    }
  }

  async function adoptSuggestion() {
    if (!suggestion || !weather || adopting || adopted) return;
    setAdopting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert("Non connecté"); return; }
      const embedding = await embedOutfitText(suggestion).catch(() => null);
      const { data, error } = await supabase
        .from("outfits")
        .insert({
          user_id: user.id,
          photo_url: null,
          date: getLocalDateISO(today),
          weather_data: weather,
          ai_suggestion: suggestion,
          occasion,
          embedding,
          embedding_source: embedding ? "suggested" : null,
          adopted: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      setAdopted(true);
      setAdoptedOutfitId(data.id);
      const bundle = await (profilePromiseRef.current ?? loadProfileBundle());
      if (bundle.userId) {
        await patchSuggestionAdoption(
          { userId: bundle.userId, coldness: bundle.coldness, occasion },
          true,
          data.id
        );
      }
    } catch (e: any) {
      if (__DEV__) console.error("adoptSuggestion:", e);
      Alert.alert("Impossible d'adopter", e?.message ?? "Erreur inconnue");
    } finally {
      setAdopting(false);
    }
  }

  async function unadoptSuggestion() {
    if (!adoptedOutfitId) { setAdopted(false); return; }
    try {
      await supabase.from("outfits").delete().eq("id", adoptedOutfitId);
    } catch (e) { if (__DEV__) console.warn("unadopt delete:", e); }
    setAdopted(false);
    setAdoptedOutfitId(null);
    const bundle = await (profilePromiseRef.current ?? loadProfileBundle());
    if (bundle.userId) {
      await patchSuggestionAdoption(
        { userId: bundle.userId, coldness: bundle.coldness, occasion },
        false,
        null
      );
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

        void extractItemsFromOutfitPhoto({
          userId: user.id,
          imageBase64: base64,
          mimeType,
        }).catch((err) => {
          if (__DEV__) console.warn("wardrobe extract skipped:", err);
        });
      } catch (e) { if (__DEV__) console.warn("worn_description analysis skipped:", e); }

      const embeddingSource = worn_description ?? suggestion ?? null;
      const embedding = embeddingSource ? await embedOutfitText(embeddingSource) : null;

      const payload = {
        user_id: user.id,
        photo_url: urlData.publicUrl,
        date: getLocalDateISO(today),
        weather_data: weather,
        rating: rating || null,
        ai_suggestion: suggestion,
        worn_description,
        occasion,
        notes: notes.trim() || null,
        embedding,
        embedding_source: embedding ? (worn_description ? "worn" : "suggested") : null,
        adopted: adopted || adoptedOutfitId !== null,
      };
      let savedId: string | null = null;
      if (adoptedOutfitId) {
        const { error: updateError } = await supabase
          .from("outfits")
          .update(payload)
          .eq("id", adoptedOutfitId);
        if (updateError) throw updateError;
        savedId = adoptedOutfitId;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("outfits")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        savedId = inserted?.id ?? null;
      }

      if (savedId) {
        setTodayOutfit({
          id: savedId,
          photo_url: urlData.publicUrl,
          occasion,
          rating: rating || null,
          notes: notes.trim() || null,
        });
        setCritique(null);
        setCritiqueOutfitId(savedId);
        setCritiqueLoading(true);
        const targetId = savedId;
        critiqueTargetRef.current = targetId;
        fetchOutfitCritique(targetId)
          .then((c) => {
            if (critiqueTargetRef.current === targetId) setCritique(c);
          })
          .finally(() => {
            if (critiqueTargetRef.current === targetId) setCritiqueLoading(false);
          });
      }

      setSaved(true);
      setPhotoUri(null);
      setRating(0);
      setOccasion(null);
      setNotes("");
      setAdoptedOutfitId(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      if (__DEV__) console.error("saveOutfit error:", e);
      Alert.alert("Impossible de sauvegarder", e?.message ?? "Erreur inconnue");
    }
    finally { setSaving(false); }
  }

  const loaderStep: LoaderStep = !weather ? 1 : !suggestion ? 2 : 3;
  const suggestionFade = useRef(new Animated.Value(0)).current;
  const suggestionShift = useRef(new Animated.Value(6)).current;
  useEffect(() => {
    if (!suggestion) {
      suggestionFade.setValue(0);
      suggestionShift.setValue(6);
      return;
    }
    Animated.parallel([
      Animated.timing(suggestionFade, {
        toValue: 1,
        duration: motion.base,
        easing: motion.easing,
        useNativeDriver: true,
      }),
      Animated.timing(suggestionShift, {
        toValue: 0,
        duration: motion.base,
        easing: motion.easing,
        useNativeDriver: true,
      }),
    ]).start();
  }, [suggestion, suggestionFade, suggestionShift]);

  const verdict = weather && coldness ? comfortVerdict(weather.feels_like, coldness) : null;
  const verdictToneClass =
    verdict?.tone === "cold" ? "text-ice" : verdict?.tone === "warm" ? "text-warning" : "text-ink-700";

  return (
    <View className="flex-1 bg-paper">
      <SafeAreaView className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-6 pt-2 pb-10">

          {/* Header */}
          <View className="flex-row justify-between items-start mb-6">
            <View>
              <Text className="font-body-medium text-eyebrow text-ink-300">
                {dayLabel.toUpperCase()}
              </Text>
              <Text className="font-body text-body-sm text-ink-900 mt-1">{dateLabel}</Text>
            </View>
            <Pressable onPress={() => router.push("/settings")} hitSlop={12}>
              <Text className="font-body-medium text-eyebrow text-ink-300">
                RÉGLAGES
              </Text>
            </Pressable>
          </View>

          {/* Weather */}
          <View className="mb-6">
            <Text className="font-body-medium text-eyebrow text-ink-300 mb-2">
              {loading ? "CHARGEMENT" : weather?.description?.toUpperCase() ?? "INDISPONIBLE"}
            </Text>
            {loading ? (
              <Skeleton style={{ width: 140, height: 72, marginBottom: 12 }} />
            ) : (
              <Text className="font-display text-display-2xl text-ink-900 mb-3">
                {weather ? `${weather.temp}°` : "—"}
              </Text>
            )}

            {forecast && (forecast.morning || forecast.midday || forecast.evening) && (
              <View className="flex-row items-end mb-3" style={{ gap: 14 }}>
                {forecast.morning && (
                  <View className="flex-col gap-0.5">
                    <Text className="font-body-medium text-micro text-ice">MATIN</Text>
                    <Text className="font-body-medium text-body-sm text-ink-700">{forecast.morning.temp}°</Text>
                  </View>
                )}
                {forecast.morning && (forecast.midday || forecast.evening) && (
                  <Text className="font-body text-body-sm text-ink-200 pb-px">—</Text>
                )}
                {forecast.midday && (
                  <View className="flex-col gap-0.5">
                    <Text className="font-body-medium text-micro text-ice">MIDI</Text>
                    <Text className="font-body-medium text-body-sm text-ink-700">{forecast.midday.temp}°</Text>
                  </View>
                )}
                {forecast.midday && forecast.evening && (
                  <Text className="font-body text-body-sm text-ink-200 pb-px">—</Text>
                )}
                {forecast.evening && (
                  <View className="flex-col gap-0.5">
                    <Text className="font-body-medium text-micro text-ice">SOIR</Text>
                    <Text className="font-body-medium text-body-sm text-ink-700">{forecast.evening.temp}°</Text>
                  </View>
                )}
              </View>
            )}

            {verdict && (
              <View className="mb-2.5">
                <Text className={`font-body-medium text-micro ${verdictToneClass}`}>
                  {verdict.label.toUpperCase()}
                </Text>
              </View>
            )}

            {weather && (
              <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
                <Text className="font-body text-caption text-ink-500">Ressenti {weather.feels_like}°</Text>
                <Text className="font-body text-caption text-ink-200">·</Text>
                <Text className="font-body text-caption text-ink-500">Vent {weather.wind_speed} m/s</Text>
                {weather.rain && (
                  <>
                    <Text className="font-body text-caption text-ink-200">·</Text>
                    <Text className="font-body text-caption text-ice">Pluie</Text>
                  </>
                )}
                {weather.snow && (
                  <>
                    <Text className="font-body text-caption text-ink-200">·</Text>
                    <Text className="font-body text-caption text-ice">Neige</Text>
                  </>
                )}
              </View>
            )}
          </View>

          <View className="h-px bg-paper-300 mb-6" />

          {todayOutfit ? (
            <View className="mb-8">
              <Text className="font-body-medium text-eyebrow text-ice mb-3">
                TENUE DU JOUR
              </Text>
              <View className="h-[520px] mb-5">
                <Image
                  source={{ uri: todayOutfit.photo_url }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
              {(todayOutfit.occasion || todayOutfit.rating || todayOutfit.notes) && (
                <View className="mb-6" style={{ gap: 8 }}>
                  {todayOutfit.occasion && (
                    <Text className="font-body text-body-sm text-ink-700">
                      {OUTFIT_OCCASIONS.find((o) => o.value === todayOutfit.occasion)?.label}
                    </Text>
                  )}
                  {todayOutfit.rating ? (
                    <Text className="font-body text-body-sm text-ink-700">
                      {"★".repeat(todayOutfit.rating)}
                      {"☆".repeat(Math.max(0, 5 - todayOutfit.rating))}
                    </Text>
                  ) : null}
                  {todayOutfit.notes && (
                    <Text className="font-body text-body-sm text-ink-500">
                      {todayOutfit.notes}
                    </Text>
                  )}
                </View>
              )}
              <View className="flex-row" style={{ gap: 24 }}>
                <Pressable
                  onPress={() => {
                    setTodayOutfit(null);
                    setCritique(null);
                    setCritiqueOutfitId(null);
                    critiqueTargetRef.current = null;
                    if (weather) fetchSuggestion(weather, { skipCache: true });
                  }}
                  hitSlop={8}
                >
                  <Text className="font-body-medium text-micro text-ink-300">
                    NOUVELLE SUGGESTION
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setAdoptedOutfitId(todayOutfit.id);
                    setRating(todayOutfit.rating ?? 0);
                    setOccasion(todayOutfit.occasion);
                    setNotes(todayOutfit.notes ?? "");
                    setTodayOutfit(null);
                    setPhotoUri(null);
                  }}
                  hitSlop={8}
                >
                  <Text className="font-body-medium text-micro text-ink-300">
                    MODIFIER LA PHOTO
                  </Text>
                </Pressable>
              </View>
              {critiqueOutfitId === todayOutfit.id && (
                <View className="mt-8 -mx-6">
                  <OutfitCritique critique={critique} loading={critiqueLoading} />
                </View>
              )}
            </View>
          ) : (
          <>
          {/* Suggestion */}
          <View className="mb-8">
            <Text className={`font-body-medium text-eyebrow mb-3 ${adopted ? "text-ink-900" : "text-ice"}`}>
              {adopted ? "ADOPTÉE POUR AUJOURD'HUI" : "SUGGESTION DU JOUR"}
            </Text>

            <View className="aspect-square mb-4">
              {suggestionImage ? (
                <Image
                  source={{ uri: suggestionImage }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <OutfitImageLoader style={{ width: "100%", height: "100%" }} />
              )}
            </View>

            {suggestion ? (
              <SuggestionSwipeArea
                disabled={refining || adopting || adopted}
                onPass={() => refineSuggestion({ reason: null })}
                onKeep={() => adoptSuggestion()}
              >
                <Animated.View
                  className={`pl-3 pr-3 py-3 border-l-2 ${adopted ? "bg-ink-900 border-ink-900" : "bg-ice/10 border-ice"}`}
                  style={{
                    opacity: suggestionFade,
                    transform: [{ translateY: suggestionShift }],
                  }}
                >
                  <Text className={`font-body text-body ${adopted ? "text-paper" : "text-ink-900"}`}>
                    {suggestion}
                  </Text>
                  {suggestion === "Suggestion indisponible." && weather && (
                    <Pressable
                      onPress={() => fetchSuggestion(weather, { skipCache: true })}
                      className="mt-3 self-start py-2 px-3 border border-ink-900 bg-paper active:bg-paper-200"
                    >
                      <Text className="font-body-medium text-eyebrow text-ink-900">RÉESSAYER</Text>
                    </Pressable>
                  )}
                </Animated.View>
              </SuggestionSwipeArea>
            ) : (
              <TodayLoader step={loaderStep} />
            )}

            {suggestion && suggestion !== "Suggestion indisponible." && !adopted && (
              <View className="mt-5" style={{ gap: 8 }}>
                <Pressable
                  onPress={adoptSuggestion}
                  disabled={adopting}
                  className={`py-[18px] items-center ${adopting ? "bg-ink-200" : "bg-ink-900 active:bg-ink-700"}`}
                >
                  <Text className="font-body-semibold text-eyebrow text-paper">
                    {adopting ? "…" : "JE LA PORTE"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setRefineOpen(true)}
                  disabled={refining}
                  className="py-[14px] items-center border border-ink-900 bg-paper active:bg-paper-200"
                >
                  <Text className="font-body-medium text-eyebrow text-ink-900">
                    RAFFINER
                  </Text>
                </Pressable>
              </View>
            )}

            {adopted && (
              <View className="mt-4 items-start">
                <Pressable onPress={unadoptSuggestion} hitSlop={8}>
                  <Text className="font-body-medium text-micro text-ink-300">
                    CHANGER D'AVIS
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <View className="h-px bg-paper-300 mb-8" />

          {/* Photo */}
          <View className="mb-6">
            <Text className="font-body-medium text-micro text-ink-300 mb-4">
              {adopted ? "PHOTO DE LA TENUE" : "OU PHOTOGRAPHIE TA TENUE"}
            </Text>
            {photoUri ? (
              <View className="h-[440px] relative overflow-hidden">
                <Image source={{ uri: photoUri }} className="w-full h-full" resizeMode="cover" />
                <Pressable
                  onPress={() => setPhotoUri(null)}
                  className="absolute bottom-4 right-4 bg-paper/95 px-3.5 py-2 border border-paper-300"
                >
                  <Text className="font-body-medium text-eyebrow text-ink-900">
                    CHANGER
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="flex-row" style={{ gap: 12 }}>
                <Pressable
                  onPress={takePhoto}
                  className="flex-1 border border-paper-300 py-6 items-center bg-paper active:bg-paper-200"
                >
                  <Text className="font-body-medium text-eyebrow text-ink-500">
                    CAMÉRA
                  </Text>
                </Pressable>
                <Pressable
                  onPress={pickPhoto}
                  className="flex-1 border border-paper-300 py-6 items-center bg-paper active:bg-paper-200"
                >
                  <Text className="font-body-medium text-eyebrow text-ink-500">
                    GALERIE
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Feedback + Save */}
          {photoUri && (
            <>
              <View className="h-px bg-paper-300 mb-8" />
              <View className="mb-4">
                <Text className="font-body-medium text-micro text-ink-300 mb-4">
                  OCCASION
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {OUTFIT_OCCASIONS.map((opt) => {
                    const active = occasion === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setOccasion(active ? null : opt.value)}
                        className={`py-2 px-3 border ${active ? "bg-ink-900 border-ink-900" : "bg-paper-50 border-paper-300"}`}
                      >
                        <Text className={`font-body text-xs ${active ? "text-paper" : "text-ink-900"}`}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text className="font-body-medium text-micro text-ink-300 mt-6 mb-4">
                  NOTE
                </Text>
                <RatingStars rating={rating} onRate={setRating} />

                <Text className="font-body-medium text-micro text-ink-300 mt-6 mb-4">
                  COMMENTAIRE
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ce qui a marché, ce qui a manqué…"
                  placeholderTextColor={colors.ink[300]}
                  className="border border-paper-300 bg-paper-50 p-3 font-body text-body-sm text-ink-900"
                  style={{ minHeight: 70, textAlignVertical: "top" }}
                  multiline
                />
                <Pressable
                  onPress={saveOutfit}
                  disabled={saving}
                  className={`py-[18px] items-center mt-6 ${saving ? "bg-ink-200" : "bg-ink-900 active:bg-ink-700"}`}
                >
                  <Text className="font-body-semibold text-eyebrow text-paper">
                    {saving ? "SAUVEGARDE…" : "SAUVEGARDER"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
          </>
          )}

          {saved && (
            <View className="py-3 items-center mt-2 border-t border-b border-paper-300">
              <Text className="font-body-medium text-eyebrow text-ice">
                SAUVEGARDÉ
              </Text>
            </View>
          )}

          <View className="-mx-6 mt-10">
            <WardrobeNudge />
          </View>
        </ScrollView>
      </SafeAreaView>

      <RefineSheet
        visible={refineOpen}
        refining={refining}
        favoriteBrands={favoriteBrands}
        steerText={steerText}
        steerBrands={steerBrands}
        onSteerTextChange={setSteerText}
        onToggleBrand={(brand) =>
          setSteerBrands((prev) =>
            prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
          )
        }
        onRefine={(opts) => refineSuggestion(opts)}
        onClose={() => setRefineOpen(false)}
      />
    </View>
  );
}
