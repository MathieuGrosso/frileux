import { useState } from "react";
import { View, Text, Pressable, TextInput, Alert } from "react-native";
import type { Circle } from "@/lib/types";
import { colors } from "@/lib/theme";

interface Props {
  onCreate: () => Promise<Circle | null>;
  onJoin: (code: string) => Promise<Circle | null>;
}

export function CircleOnboarding({ onCreate, onJoin }: Props) {
  const [inviteCode, setInviteCode] = useState("");

  async function handleCreate() {
    const c = await onCreate();
    if (!c) {
      Alert.alert("Erreur", "Impossible de créer le cercle.");
      return;
    }
    Alert.alert("Cercle créé", `Code d'invitation : ${c.invite_code}`);
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    const c = await onJoin(inviteCode);
    if (!c) {
      Alert.alert("Erreur", "Code invalide ou déjà rejoint.");
      return;
    }
    Alert.alert("Bienvenue", `Tu as rejoint "${c.name}".`);
  }

  return (
    <View className="flex-1 justify-center px-8">
      <Text
        className="font-display text-ink-900 mb-2"
        style={{ fontSize: 40, letterSpacing: 2 }}
      >
        CERCLE PRIVÉ
      </Text>
      <Text className="font-body text-ink-300 text-sm mb-12">
        Partage tes tenues avec tes proches
      </Text>

      <Pressable
        onPress={handleCreate}
        className="bg-ink-900 active:bg-ink-700 py-5 items-center mb-6"
      >
        <Text
          className="font-body-semibold text-paper-100 text-eyebrow"
          style={{ letterSpacing: 2.5 }}
        >
          CRÉER UN CERCLE
        </Text>
      </Pressable>

      <View className="flex-row items-center gap-3 mb-6">
        <View className="flex-1 h-px bg-paper-300" />
        <Text className="font-body text-ink-300 text-body-sm">ou</Text>
        <View className="flex-1 h-px bg-paper-300" />
      </View>

      <TextInput
        className="border border-paper-300 bg-paper-200 px-5 py-4 text-center font-display text-ink-900 mb-3"
        style={{ fontSize: 20, letterSpacing: 6 }}
        placeholder="CODE D'INVITATION"
        placeholderTextColor={colors.ink[300]}
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="characters"
        maxLength={6}
        selectionColor={colors.ice[600]}
      />

      <Pressable
        onPress={handleJoin}
        className="border border-ink-900 active:bg-paper-200 py-5 items-center"
      >
        <Text
          className="font-body-semibold text-ink-900 text-eyebrow"
          style={{ letterSpacing: 2.5 }}
        >
          REJOINDRE
        </Text>
      </Pressable>
    </View>
  );
}
