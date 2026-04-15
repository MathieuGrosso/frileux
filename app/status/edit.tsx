import { useEffect, useState } from "react";
import { View, Text, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { PressableScale } from "@/components/ui/PressableScale";
import { colors } from "@/lib/theme";

export default function EditStatusScreen() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_statuses")
        .select("text, expires_at")
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (data) setText((data as { text: string }).text);
      setLoading(false);
    })();
  }, []);

  async function save() {
    const body = text.trim();
    if (!body) {
      Alert.alert("Vide", "Écris un statut.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const payload = {
      user_id: user.id,
      text: body.slice(0, 40),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const { error } = await supabase
      .from("user_statuses")
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }
    router.back();
  }

  async function clear() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_statuses").delete().eq("user_id", user.id);
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-paper-100">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
        <PressableScale onPress={() => router.back()}>
          <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
            ← ANNULER
          </Text>
        </PressableScale>
        <PressableScale
          onPress={save}
          disabled={!text.trim() || saving}
          className="bg-ink-900 px-4 py-2"
          style={{ opacity: !text.trim() || saving ? 0.4 : 1 }}
        >
          <Text className="font-body-semibold text-paper-100" style={{ fontSize: 11, letterSpacing: 2 }}>
            {saving ? "…" : "ENREGISTRER"}
          </Text>
        </PressableScale>
      </View>

      <View className="px-6 mt-6">
        <Text
          className="font-display text-ink-900"
          style={{ fontSize: 56, letterSpacing: -1, lineHeight: 56 }}
        >
          STATUT
        </Text>
        <Text
          className="font-body text-ink-300 mt-2 mb-10"
          style={{ fontSize: 13, letterSpacing: 1 }}
        >
          40 CARACTÈRES · EXPIRE EN 24H
        </Text>

        <TextInput
          value={text}
          onChangeText={(t) => setText(t.slice(0, 40))}
          placeholder="ex. en vacances en Sicile"
          placeholderTextColor={colors.ink[300]}
          multiline
          className="border-b border-ink-900 pb-3 font-display text-ink-900 italic"
          style={{ fontSize: 24 }}
        />
        <Text
          className="font-body text-ink-300 mt-2 text-right"
          style={{ fontSize: 11, letterSpacing: 1 }}
        >
          {40 - text.length} CAR. RESTANTS
        </Text>

        {!loading && text.length > 0 && (
          <PressableScale onPress={clear} className="mt-10 py-3 items-center border border-error">
            <Text className="font-body-semibold text-error" style={{ fontSize: 11, letterSpacing: 2.5 }}>
              EFFACER MON STATUT
            </Text>
          </PressableScale>
        )}
      </View>
    </SafeAreaView>
  );
}
