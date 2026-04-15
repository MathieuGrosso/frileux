import { useState } from "react";
import { View, Text, TextInput, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { PressableScale } from "@/components/ui/PressableScale";
import { colors } from "@/lib/theme";
import type { Circle, CircleVisibility } from "@/lib/types";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function NewCircleScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CircleVisibility>("public");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    const clean = name.trim();
    if (!clean) {
      Alert.alert("Nom requis", "Donne un nom à ton cercle.");
      return;
    }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }
    const insert: Record<string, unknown> = {
      name: clean,
      invite_code: generateInviteCode(),
      created_by: user.id,
      visibility,
    };
    if (description.trim()) insert.description = description.trim().slice(0, 280);
    const { data, error } = await supabase.from("circles").insert(insert).select().single();
    if (error || !data) {
      setCreating(false);
      Alert.alert("Erreur", error?.message ?? "Création impossible.");
      return;
    }
    await supabase.from("circle_members").insert({
      circle_id: (data as Circle).id,
      user_id: user.id,
    });
    setCreating(false);
    router.replace("/circle");
  }

  return (
    <SafeAreaView className="flex-1 bg-paper-100">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-4 pb-8">
          <PressableScale onPress={() => router.back()} className="mb-8">
            <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
              ← ANNULER
            </Text>
          </PressableScale>
          <Text className="font-display text-ink-900" style={{ fontSize: 56, letterSpacing: -1, lineHeight: 56 }}>
            NOUVEAU{"\n"}CERCLE
          </Text>
        </View>

        <View className="px-6">
          <Text className="font-body-medium text-ink-500 mb-2" style={{ fontSize: 10, letterSpacing: 2.5 }}>
            VISIBILITÉ
          </Text>
          <View className="flex-row mb-8 border border-ink-900">
            <PressableScale
              onPress={() => setVisibility("private")}
              className={`flex-1 py-4 items-center ${visibility === "private" ? "bg-ink-900" : ""}`}
            >
              <Text
                className="font-body-semibold"
                style={{
                  fontSize: 12,
                  letterSpacing: 2.5,
                  color: visibility === "private" ? "#FAFAF8" : "#0F0F0D",
                }}
              >
                PRIVÉ
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => setVisibility("public")}
              className={`flex-1 py-4 items-center ${visibility === "public" ? "bg-ink-900" : ""}`}
            >
              <Text
                className="font-body-semibold"
                style={{
                  fontSize: 12,
                  letterSpacing: 2.5,
                  color: visibility === "public" ? "#FAFAF8" : "#0F0F0D",
                }}
              >
                PUBLIC
              </Text>
            </PressableScale>
          </View>

          <Text className="font-body-medium text-ink-500 mb-2" style={{ fontSize: 10, letterSpacing: 2.5 }}>
            NOM
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={40}
            placeholder="ex. Layering crew"
            placeholderTextColor={colors.ink[300]}
            className="border-b border-ink-900 pb-3 mb-8 font-display text-ink-900"
            style={{ fontSize: 24 }}
          />

          <Text className="font-body-medium text-ink-500 mb-2" style={{ fontSize: 10, letterSpacing: 2.5 }}>
            DESCRIPTION {visibility === "public" ? "· VISIBLE DANS EXPLORER" : "· (OPTIONNELLE)"}
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            maxLength={280}
            multiline
            placeholder={
              visibility === "public"
                ? "Pour quoi ce cercle existe ? (280 car.)"
                : "Optionnel"
            }
            placeholderTextColor={colors.ink[300]}
            className="border border-ink-100 bg-paper-100 px-4 py-3 mb-8 font-body text-ink-900"
            style={{ fontSize: 14, minHeight: 90, textAlignVertical: "top" }}
          />

          <Text className="font-body text-ink-300 mb-8" style={{ fontSize: 12, lineHeight: 18 }}>
            {visibility === "public"
              ? "Les cercles publics apparaissent dans EXPLORER. Tout le monde peut les rejoindre."
              : "Accessible uniquement via code d'invitation."}
          </Text>

          <PressableScale
            onPress={handleCreate}
            disabled={creating || !name.trim()}
            className="bg-ink-900 active:bg-ink-700 py-5 items-center"
            style={{ opacity: creating || !name.trim() ? 0.5 : 1 }}
          >
            <Text className="font-body-semibold text-paper-100" style={{ fontSize: 13, letterSpacing: 3 }}>
              {creating ? "…" : "CRÉER LE CERCLE"}
            </Text>
          </PressableScale>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
