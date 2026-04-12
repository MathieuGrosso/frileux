import { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, TextInput, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

  useEffect(() => {
    loadOutfit();
  }, [id]);

  async function loadOutfit() {
    const { data } = await supabase
      .from("outfits")
      .select("*")
      .eq("id", id)
      .single();

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
      <SafeAreaView className="flex-1 bg-midnight items-center justify-center">
        <Text className="text-cream-300">Chargement...</Text>
      </SafeAreaView>
    );
  }

  const weather = outfit.weather_data;

  return (
    <SafeAreaView className="flex-1 bg-midnight">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          className="absolute top-4 left-4 z-10 bg-midnight/80 rounded-full px-4 py-2"
        >
          <Text className="text-cream-200">← Retour</Text>
        </Pressable>

        {/* Photo */}
        <Image
          source={{ uri: outfit.photo_url }}
          className="w-full h-[500px]"
          resizeMode="cover"
        />

        <View className="px-6 py-6">
          {/* Date & Weather */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-cream-200 text-lg font-sans-semibold">
              {new Date(outfit.date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
            {weather && (
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl">
                  {weatherEmoji(weather.icon)}
                </Text>
                <Text className="text-cream-300">{weather.temp}°C</Text>
              </View>
            )}
          </View>

          {/* Weather details */}
          {weather && (
            <View className="bg-midnight-500 rounded-2xl p-4 mb-6">
              <View className="flex-row flex-wrap gap-4">
                <View>
                  <Text className="text-cream-300 text-xs opacity-60">Ressenti</Text>
                  <Text className="text-cream-200">{weather.feels_like}°C</Text>
                </View>
                <View>
                  <Text className="text-cream-300 text-xs opacity-60">Vent</Text>
                  <Text className="text-cream-200">{weather.wind_speed} m/s</Text>
                </View>
                <View>
                  <Text className="text-cream-300 text-xs opacity-60">Humidité</Text>
                  <Text className="text-cream-200">{weather.humidity}%</Text>
                </View>
                <View>
                  <Text className="text-cream-300 text-xs opacity-60">Condition</Text>
                  <Text className="text-cream-200 capitalize">{weather.description}</Text>
                </View>
              </View>
            </View>
          )}

          {/* AI Suggestion */}
          {outfit.ai_suggestion && (
            <View className="bg-cream-500/10 rounded-2xl p-4 mb-6">
              <Text className="text-cream-500 text-sm font-sans-semibold mb-2">
                Suggestion IA du jour
              </Text>
              <Text className="text-cream-200 text-sm leading-5">
                {outfit.ai_suggestion}
              </Text>
            </View>
          )}

          {/* Rating */}
          <View className="mb-6">
            <Text className="text-cream-200 text-lg font-sans-semibold mb-2">
              Note
            </Text>
            <RatingStars
              rating={rating}
              onRate={editing ? setRating : undefined}
            />
          </View>

          {/* Notes */}
          <View className="mb-6">
            <Text className="text-cream-200 text-lg font-sans-semibold mb-2">
              Notes
            </Text>
            {editing ? (
              <TextInput
                className="bg-midnight-500 text-cream-50 rounded-xl px-4 py-3 text-base min-h-[100px]"
                placeholder="Comment te sentais-tu dans cette tenue ?"
                placeholderTextColor="#6F6F91"
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <Text className="text-cream-300 text-base">
                {notes || "Aucune note"}
              </Text>
            )}
          </View>

          {/* Actions */}
          <View className="flex-row gap-3 mb-12">
            {editing ? (
              <>
                <Pressable
                  onPress={saveChanges}
                  className="flex-1 bg-cream-500 rounded-xl py-3 items-center"
                >
                  <Text className="text-midnight font-sans-semibold">Sauvegarder</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEditing(false);
                    setRating(outfit.rating ?? 0);
                    setNotes(outfit.notes ?? "");
                  }}
                  className="flex-1 border border-cream-500/30 rounded-xl py-3 items-center"
                >
                  <Text className="text-cream-300 font-sans-medium">Annuler</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => setEditing(true)}
                  className="flex-1 border border-cream-500 rounded-xl py-3 items-center"
                >
                  <Text className="text-cream-500 font-sans-semibold">Modifier</Text>
                </Pressable>
                <Pressable
                  onPress={deleteOutfit}
                  className="flex-1 border border-blush-400/30 rounded-xl py-3 items-center"
                >
                  <Text className="text-blush-400 font-sans-medium">Supprimer</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
