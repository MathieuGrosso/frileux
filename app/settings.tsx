import { useState, useEffect } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { ColdnessLevel } from "@/lib/types";

const COLDNESS_LABELS: Record<ColdnessLevel, string> = {
  1: "Un peu frileuse",
  2: "Frileuse",
  3: "Très frileuse",
  4: "Ultra frileuse",
  5: "Je vis en doudoune",
};

const COLDNESS_EMOJIS: Record<ColdnessLevel, string> = {
  1: "🌤️",
  2: "🧥",
  3: "🧣",
  4: "🧤",
  5: "🥶",
};

export default function SettingsScreen() {
  const router = useRouter();
  const [coldnessLevel, setColdnessLevel] = useState<ColdnessLevel>(3);
  const [username, setUsername] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("coldness_level, username")
      .single();

    if (data) {
      setColdnessLevel(data.coldness_level as ColdnessLevel);
      setUsername(data.username);
    }
  }

  async function updateColdness(level: ColdnessLevel) {
    setColdnessLevel(level);
    await supabase
      .from("profiles")
      .update({ coldness_level: level })
      .eq("id", (await supabase.auth.getUser()).data.user?.id);
  }

  async function handleLogout() {
    Alert.alert("Déconnexion", "Tu veux te déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnexion",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-midnight">
      <View className="px-6 pt-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
          <Pressable onPress={() => router.back()}>
            <Text className="text-cream-300 text-base">← Retour</Text>
          </Pressable>
          <Text className="text-cream-200 text-lg font-sans-semibold">
            Réglages
          </Text>
          <View className="w-16" />
        </View>

        {/* Profile */}
        <View className="bg-midnight-500 rounded-2xl p-5 mb-6">
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-cream-500/20 items-center justify-center mb-3">
              <Text className="text-cream-500 text-2xl font-sans-bold">
                {username?.[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
            <Text className="text-cream-200 text-xl font-sans-semibold">
              {username}
            </Text>
          </View>
        </View>

        {/* Coldness Level */}
        <View className="mb-6">
          <Text className="text-cream-200 text-lg font-sans-semibold mb-1">
            Niveau de frilosité
          </Text>
          <Text className="text-cream-300 text-sm opacity-60 mb-4">
            Les suggestions seront adaptées à ton niveau
          </Text>

          {([1, 2, 3, 4, 5] as ColdnessLevel[]).map((level) => (
            <Pressable
              key={level}
              onPress={() => updateColdness(level)}
              className={`flex-row items-center gap-3 p-4 rounded-xl mb-2 ${
                coldnessLevel === level
                  ? "bg-cream-500/20 border border-cream-500/40"
                  : "bg-midnight-500"
              }`}
            >
              <Text className="text-2xl">{COLDNESS_EMOJIS[level]}</Text>
              <View className="flex-1">
                <Text
                  className={`font-sans-medium ${
                    coldnessLevel === level ? "text-cream-500" : "text-cream-200"
                  }`}
                >
                  {COLDNESS_LABELS[level]}
                </Text>
              </View>
              {coldnessLevel === level && (
                <Text className="text-cream-500">✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          className="border border-blush-400/30 rounded-xl py-4 items-center mt-4"
        >
          <Text className="text-blush-400 font-sans-semibold">
            Se déconnecter
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
