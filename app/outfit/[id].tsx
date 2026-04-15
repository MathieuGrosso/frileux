import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { Outfit, OutfitIntention, OutfitOccasion, ThermalFeeling } from "@/lib/types";
import { OUTFIT_INTENTIONS, OUTFIT_OCCASIONS, THERMAL_FEELINGS } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";
import { RatingStars } from "@/components/RatingStars";
import { OutfitNotes } from "@/components/circle/OutfitNotes";
import { OutfitCritique } from "@/components/OutfitCritique";
import { fetchOutfitCritique } from "@/lib/critique";
import { colors } from "@/lib/theme";
import { confirmAction, notifyError } from "@/lib/ui";

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [occasion, setOccasion] = useState<OutfitOccasion | null>(null);
  const [intention, setIntention] = useState<OutfitIntention | null>(null);
  const [thermal, setThermal] = useState<ThermalFeeling | null>(null);
  const [editing, setEditing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [critiqueLoading, setCritiqueLoading] = useState(false);

  useEffect(() => { loadOutfit(); }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`outfit-detail-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "outfits",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as Outfit;
          setOutfit(row);
          if (!editing) {
            setRating(row.rating ?? 0);
            setNotes(row.notes ?? "");
            setOccasion(row.occasion ?? null);
            setIntention(row.intention ?? null);
            setThermal(row.thermal_feeling ?? null);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, editing]);

  async function loadOutfit() {
    const { data } = await supabase.from("outfits").select("*").eq("id", id).single();
    if (data) {
      setOutfit(data);
      setRating(data.rating ?? 0);
      setNotes(data.notes ?? "");
      setOccasion(data.occasion ?? null);
      setIntention(data.intention ?? null);
      setThermal(data.thermal_feeling ?? null);
      const { data: { user } } = await supabase.auth.getUser();
      const owner = !!user && user.id === data.user_id;
      setIsOwner(owner);

      if (owner && !data.critique && data.photo_url) {
        setCritiqueLoading(true);
        fetchOutfitCritique(data.id)
          .then((c) => {
            if (c) setOutfit((prev) => (prev ? { ...prev, critique: c, critique_score: c.score } : prev));
          })
          .finally(() => setCritiqueLoading(false));
      }
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
        intention,
        thermal_feeling: thermal,
      })
      .eq("id", outfit.id);
    if (error) {
      Alert.alert("Erreur", "Impossible de sauvegarder.");
    } else {
      setEditing(false);
      setOutfit({ ...outfit, rating, notes, occasion, intention, thermal_feeling: thermal });
    }
  }

  async function deleteOutfit() {
    if (!outfit || deleting) return;
    const confirmed = await confirmAction(
      "Supprimer ?",
      "Cette tenue sera supprimée définitivement.",
      "Supprimer",
      true,
    );
    if (!confirmed) return;
    setDeleting(true);
    const { error } = await supabase.from("outfits").delete().eq("id", outfit.id);
    setDeleting(false);
    if (error) {
      notifyError("Échec", error.message);
      return;
    }
    router.back();
  }

  if (!outfit) {
    return (
      <View className="flex-1 bg-paper-100">
        <SafeAreaView className="flex-1 items-center justify-center">
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
    <View className="flex-1 bg-paper-100">
      <SafeAreaView className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

          <View className="relative" style={{ height: 520 }}>
            <Image
              source={{ uri: outfit.photo_url }}
              className="w-full h-full"
              resizeMode="cover"
            />
            <Pressable
              onPress={() => router.back()}
              className="absolute top-4 left-4 bg-paper-100/90 px-3.5 py-2 border border-paper-300"
            >
              <Text className="font-body-medium text-body-sm text-ink-900">←</Text>
            </Pressable>
          </View>

          <View className="px-6 pt-6">

            <View className="flex-row justify-between items-end mb-5">
              <Text className="font-display text-h2 tracking-tight text-ink-900 flex-1">
                {dateStr}
              </Text>
              {weather && (
                <View className="flex-row items-center gap-1.5 px-2.5 py-1 border border-paper-300 bg-paper-200">
                  <Text style={{ fontSize: 14 }}>{weatherEmoji(weather.icon)}</Text>
                  <Text className="font-body-medium text-body-sm text-ink-500">
                    {weather.temp}°
                  </Text>
                </View>
              )}
            </View>

            {weather && (
              <View className="flex-row bg-paper-200 border border-paper-300 py-4 mb-6">
                <WeatherStat label="Ressenti" value={`${weather.feels_like}°`} />
                <View className="w-px bg-paper-300 my-1" />
                <WeatherStat label="Vent" value={`${weather.wind_speed} m/s`} />
                <View className="w-px bg-paper-300 my-1" />
                <WeatherStat label="Humidité" value={`${weather.humidity}%`} />
                <View className="w-px bg-paper-300 my-1" />
                <WeatherStat label="Ciel" value={weather.description} />
              </View>
            )}

            {isOwner && (critiqueLoading || outfit.critique) && (
              <View className="-mx-6 mb-6">
                <OutfitCritique
                  critique={outfit.critique ?? null}
                  loading={critiqueLoading}
                />
              </View>
            )}

            <View className="h-px bg-paper-300 mb-6" />

            {outfit.ai_suggestion && (
              <View className="mb-6">
                <Text className="font-body-medium text-micro tracking-widest text-ice mb-3">
                  SUGGESTION DU MATIN
                </Text>
                <Text className="font-body text-body-sm text-ink-700 leading-6">
                  {outfit.ai_suggestion}
                </Text>
              </View>
            )}

            {outfit.worn_description && (
              <View className="mb-6">
                <Text className="font-body-medium text-micro tracking-widest text-ink-900 mb-3">
                  CE QUE TU AS PORTÉ
                </Text>
                <Text className="font-body text-body-sm text-ink-700 leading-6">
                  {outfit.worn_description}
                </Text>
              </View>
            )}

            {(outfit.ai_suggestion || outfit.worn_description) && (
              <View className="h-px bg-paper-300 mb-6" />
            )}

            <View className="mb-6">
              <Text className="font-body-medium text-micro tracking-widest text-ink-300 mb-3">
                OCCASION
              </Text>
              {editing ? (
                <View className="flex-row flex-wrap gap-1.5">
                  {OUTFIT_OCCASIONS.map((opt) => {
                    const active = occasion === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setOccasion(active ? null : opt.value)}
                        className={`py-2 px-3 border ${
                          active
                            ? "bg-ink-900 border-ink-900"
                            : "bg-paper-50 border-paper-300"
                        }`}
                      >
                        <Text
                          className={`font-body text-caption ${
                            active ? "text-paper-100" : "text-ink-900"
                          }`}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text
                  className={`font-body text-body-sm leading-6 ${
                    occasion ? "text-ink-700" : "text-ink-300"
                  }`}
                >
                  {OUTFIT_OCCASIONS.find((o) => o.value === occasion)?.label ?? "Non renseignée"}
                </Text>
              )}
            </View>

            <View className="mb-6">
              <Text className="font-body-medium text-micro tracking-widest text-ink-300 mb-3">
                INTENTION
              </Text>
              {editing ? (
                <View className="flex-row flex-wrap gap-1.5">
                  {OUTFIT_INTENTIONS.map((opt) => {
                    const active = intention === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setIntention(active ? null : opt.value)}
                        className={`py-2 px-3 border ${
                          active
                            ? "bg-ink-900 border-ink-900"
                            : "bg-paper-50 border-paper-300"
                        }`}
                      >
                        <Text
                          className={`font-body text-caption ${
                            active ? "text-paper-100" : "text-ink-900"
                          }`}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text
                  className={`font-body text-body-sm leading-6 ${
                    intention ? "text-ink-700" : "text-ink-300"
                  }`}
                >
                  {OUTFIT_INTENTIONS.find((o) => o.value === intention)?.label ?? "Non renseignée"}
                </Text>
              )}
            </View>

            <View className="mb-6">
              <Text className="font-body-medium text-micro tracking-widest text-ink-300 mb-3">
                RESSENTI
              </Text>
              {editing ? (
                <View className="flex-row flex-wrap gap-1.5">
                  {THERMAL_FEELINGS.map((opt) => {
                    const active = thermal === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setThermal(active ? null : opt.value)}
                        className={`py-2 px-3 border ${
                          active
                            ? "bg-ink-900 border-ink-900"
                            : "bg-paper-50 border-paper-300"
                        }`}
                      >
                        <Text
                          className={`font-body text-caption ${
                            active ? "text-paper-100" : "text-ink-900"
                          }`}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text
                  className={`font-body text-body-sm leading-6 ${
                    thermal ? "text-ink-700" : "text-ink-300"
                  }`}
                >
                  {THERMAL_FEELINGS.find((t) => t.value === thermal)?.label ?? "Non renseigné"}
                </Text>
              )}
            </View>

            <View className="mb-6">
              <Text className="font-body-medium text-micro tracking-widest text-ink-300 mb-3">
                NOTE
              </Text>
              <RatingStars rating={rating} onRate={editing ? setRating : undefined} />
            </View>

            <View className="mb-6">
              <Text className="font-body-medium text-micro tracking-widest text-ink-300 mb-3">
                NOTES
              </Text>
              {editing ? (
                <TextInput
                  className="bg-paper-200 border border-paper-300 px-4 py-3.5 font-body text-body-sm text-ink-900 leading-6"
                  style={{ minHeight: 100 }}
                  placeholder="Comment te sentais-tu dans cette tenue ?"
                  placeholderTextColor={colors.ink[300]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  textAlignVertical="top"
                  selectionColor={colors.ice[600]}
                />
              ) : (
                <Text
                  className={`font-body text-body-sm leading-6 ${
                    notes ? "text-ink-700" : "text-ink-300"
                  }`}
                >
                  {notes || "Aucune note"}
                </Text>
              )}
            </View>

            {isOwner && (
              <View className="flex-row gap-2.5 mt-2">
                {editing ? (
                  <>
                    <Pressable
                      onPress={saveChanges}
                      className="flex-1 bg-ink-900 py-4 items-center active:bg-ink-700"
                    >
                      <Text className="font-body-semibold text-eyebrow tracking-widest text-paper-100">
                        SAUVEGARDER
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setEditing(false);
                        setRating(outfit.rating ?? 0);
                        setNotes(outfit.notes ?? "");
                        setOccasion(outfit.occasion ?? null);
                        setIntention(outfit.intention ?? null);
                        setThermal(outfit.thermal_feeling ?? null);
                      }}
                      className="flex-1 border border-paper-300 py-4 items-center active:bg-paper-200"
                    >
                      <Text className="font-body text-body-sm text-ink-300">
                        Annuler
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      onPress={() => setEditing(true)}
                      className="flex-1 border border-ink-900 py-4 items-center active:bg-paper-200"
                    >
                      <Text className="font-body-semibold text-eyebrow tracking-widest text-ink-900">
                        MODIFIER
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={deleteOutfit}
                      disabled={deleting}
                      className={`flex-1 border border-paper-300 py-4 items-center ${deleting ? "opacity-50" : "active:bg-paper-200"}`}
                    >
                      <Text className="font-body text-body-sm text-error">
                        {deleting ? "Suppression…" : "Supprimer"}
                      </Text>
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
    <View className="flex-1 items-center">
      <Text className="font-body-medium text-micro tracking-widest text-ink-300 mb-1">
        {label.toUpperCase()}
      </Text>
      <Text className="font-body-medium text-body-sm text-ink-900">
        {value}
      </Text>
    </View>
  );
}
