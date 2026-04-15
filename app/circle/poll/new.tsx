import { useState } from "react";
import { View, Text, TextInput, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useLocalSearchParams, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";
import { PressableScale } from "@/components/ui/PressableScale";
import { colors } from "@/lib/theme";

interface Draft {
  label: string;
  localUri: string | null;
}

export default function NewPollScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<Draft[]>([
    { label: "", localUri: null },
    { label: "", localUri: null },
  ]);
  const [saving, setSaving] = useState(false);

  function update(i: number, patch: Partial<Draft>) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  async function pickFor(i: number) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!res.canceled && res.assets[0]) {
      update(i, { localUri: res.assets[0].uri });
    }
  }

  function addOption() {
    if (options.length >= 4) return;
    setOptions((prev) => [...prev, { label: "", localUri: null }]);
  }

  async function create() {
    if (!circleId) return;
    const trimmedQ = question.trim();
    if (!trimmedQ) {
      Alert.alert("Question requise", "Pose une question.");
      return;
    }
    const valid = options.filter((o) => o.label.trim() || o.localUri);
    if (valid.length < 2) {
      Alert.alert("2 options min.", "Ajoute au moins 2 options.");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");
      const { data: poll, error: pErr } = await supabase
        .from("polls")
        .insert({ circle_id: circleId, author_id: user.id, question: trimmedQ.slice(0, 160) })
        .select()
        .single();
      if (pErr || !poll) throw pErr ?? new Error("poll creation failed");

      const rows = [];
      for (let i = 0; i < valid.length; i++) {
        const o = valid[i];
        let image_path: string | null = null;
        if (o.localUri) {
          const compressed = await ImageManipulator.manipulateAsync(
            o.localUri,
            [{ resize: { width: 1080 } }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
          );
          const name = `${user.id}/${poll.id}-${i}.jpg`;
          const resp = await fetch(compressed.uri);
          const buf = await (await resp.blob()).arrayBuffer();
          const { error: upErr } = await supabase.storage
            .from("polls")
            .upload(name, new Uint8Array(buf), { contentType: "image/jpeg", upsert: true });
          if (upErr) throw upErr;
          image_path = name;
        }
        rows.push({
          poll_id: poll.id,
          label: o.label.trim() ? o.label.trim().slice(0, 60) : null,
          image_path,
          position: i,
        });
      }
      const { error: optErr } = await supabase.from("poll_options").insert(rows);
      if (optErr) throw optErr;

      router.back();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Échec création");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-paper-100">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-6 pt-4 pb-4 flex-row items-center justify-between border-b border-ink-100">
        <PressableScale onPress={() => router.back()}>
          <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
            ← ANNULER
          </Text>
        </PressableScale>
        <PressableScale
          onPress={create}
          disabled={saving}
          className="bg-ink-900 px-4 py-2"
          style={{ opacity: saving ? 0.5 : 1 }}
        >
          <Text className="font-body-semibold text-paper-100" style={{ fontSize: 11, letterSpacing: 2 }}>
            {saving ? "…" : "CRÉER"}
          </Text>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        <Text
          className="font-display text-ink-900 mb-6"
          style={{ fontSize: 48, letterSpacing: -1, lineHeight: 50 }}
        >
          SONDAGE
        </Text>

        <Text className="font-body-medium text-ink-500 mb-2" style={{ fontSize: 10, letterSpacing: 2.5 }}>
          QUESTION · {160 - question.length} CAR.
        </Text>
        <TextInput
          value={question}
          onChangeText={(t) => setQuestion(t.slice(0, 160))}
          placeholder="ex. A ou B pour ce soir ?"
          placeholderTextColor={colors.ink[300]}
          multiline
          className="border-b border-ink-900 pb-2 mb-8 font-display text-ink-900"
          style={{ fontSize: 22, minHeight: 40 }}
        />

        {options.map((o, i) => (
          <View key={i} className="mb-5">
            <Text
              className="font-body-medium text-ink-500 mb-2"
              style={{ fontSize: 10, letterSpacing: 2.5 }}
            >
              OPTION {i + 1}
            </Text>
            {o.localUri ? (
              <PressableScale onPress={() => pickFor(i)} className="mb-2">
                <Image
                  source={{ uri: o.localUri }}
                  style={{ width: "100%", aspectRatio: 1, backgroundColor: "#E5E3DC" }}
                  contentFit="cover"
                />
              </PressableScale>
            ) : (
              <PressableScale
                onPress={() => pickFor(i)}
                className="border border-ink-100 items-center justify-center mb-2"
                style={{ aspectRatio: 3, backgroundColor: "#FAFAF8" }}
              >
                <Text
                  className="font-body text-ink-300"
                  style={{ fontSize: 11, letterSpacing: 2 }}
                >
                  + PHOTO (OPTIONNEL)
                </Text>
              </PressableScale>
            )}
            <TextInput
              value={o.label}
              onChangeText={(t) => update(i, { label: t.slice(0, 60) })}
              placeholder="Label (60 car.)"
              placeholderTextColor={colors.ink[300]}
              className="border border-ink-100 px-3 py-2 font-body text-ink-900"
              style={{ fontSize: 14 }}
            />
          </View>
        ))}

        {options.length < 4 && (
          <PressableScale
            onPress={addOption}
            className="border border-ink-900 py-3 items-center mb-4"
          >
            <Text
              className="font-body-semibold text-ink-900"
              style={{ fontSize: 11, letterSpacing: 2.5 }}
            >
              + AJOUTER UNE OPTION
            </Text>
          </PressableScale>
        )}

        <Text className="font-body text-ink-300 text-center" style={{ fontSize: 11, letterSpacing: 1 }}>
          EXPIRE DANS 24H
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
