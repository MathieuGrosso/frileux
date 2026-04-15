import { useState } from "react";
import { View, Text, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useLocalSearchParams, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";
import { PressableScale } from "@/components/ui/PressableScale";
import { colors } from "@/lib/theme";

export default function ComposeStoryScreen() {
  const { circleId } = useLocalSearchParams<{ circleId?: string }>();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Accès refusé", "Active l'accès aux photos dans les réglages.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) {
      setLocalUri(res.assets[0].uri);
    }
  }

  async function publish() {
    if (!localUri || uploading) return;
    setUploading(true);

    try {
      const compressed = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const filename = `${user.id}/${Date.now()}.jpg`;
      const resp = await fetch(compressed.uri);
      const blob = await resp.blob();
      const arrayBuf = await new Response(blob).arrayBuffer();

      const { error: upErr } = await supabase.storage
        .from("daily-posts")
        .upload(filename, new Uint8Array(arrayBuf), { contentType: "image/jpeg" });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("daily_posts").insert({
        user_id: user.id,
        circle_id: circleId || null,
        image_path: filename,
        caption: caption.trim() ? caption.trim().slice(0, 60) : null,
      });
      if (insErr) throw insErr;

      router.back();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Publication échouée.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-paper-100">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-6 pt-4 pb-6 flex-row items-center justify-between border-b border-ink-100">
        <PressableScale onPress={() => router.back()}>
          <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
            ← ANNULER
          </Text>
        </PressableScale>
        <PressableScale
          onPress={publish}
          disabled={!localUri || uploading}
          className="bg-ink-900 px-4 py-2"
          style={{ opacity: !localUri || uploading ? 0.4 : 1 }}
        >
          <Text className="font-body-semibold text-paper-100" style={{ fontSize: 11, letterSpacing: 2 }}>
            {uploading ? "…" : "PUBLIER"}
          </Text>
        </PressableScale>
      </View>

      <View className="flex-1 px-6 pt-8">
        <Text
          className="font-display text-ink-900 mb-8"
          style={{ fontSize: 44, letterSpacing: -0.8, lineHeight: 46 }}
        >
          POST DU{"\n"}JOUR
        </Text>

        {localUri ? (
          <PressableScale onPress={pick}>
            <Image
              source={{ uri: localUri }}
              style={{ width: "100%", aspectRatio: 9 / 16, backgroundColor: "#E5E3DC" }}
              contentFit="cover"
            />
          </PressableScale>
        ) : (
          <PressableScale
            onPress={pick}
            className="border border-ink-900 items-center justify-center"
            style={{ aspectRatio: 9 / 16 }}
          >
            <Text className="font-display text-ink-900" style={{ fontSize: 48 }}>+</Text>
            <Text
              className="font-body text-ink-500 mt-2"
              style={{ fontSize: 11, letterSpacing: 2 }}
            >
              CHOISIR UNE PHOTO
            </Text>
          </PressableScale>
        )}

        <Text
          className="font-body-medium text-ink-500 mt-6 mb-2"
          style={{ fontSize: 10, letterSpacing: 2.5 }}
        >
          LÉGENDE · {60 - caption.length} CAR.
        </Text>
        <TextInput
          value={caption}
          onChangeText={(t) => setCaption(t.slice(0, 60))}
          placeholder="Optionnel"
          placeholderTextColor={colors.ink[300]}
          className="border-b border-ink-900 pb-2 font-display text-ink-900"
          style={{ fontSize: 20 }}
        />
        <Text
          className="font-body text-ink-300 mt-4"
          style={{ fontSize: 11, letterSpacing: 1 }}
        >
          EXPIRE DANS 24H · {circleId ? "VISIBLE PAR CE CERCLE" : "VISIBLE PAR TES CERCLES"}
        </Text>
      </View>
    </SafeAreaView>
  );
}
