import { useEffect, useState } from "react";
import { View, Text, ScrollView, Linking, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { PressableScale } from "@/components/ui/PressableScale";
import { HatchedPlaceholder } from "@/components/HatchedPlaceholder";
import { colors } from "@/lib/theme";
import { confirmAction, notifyError } from "@/lib/ui";
import {
  KIND_LABEL,
  deleteInspiration,
  getInspiration,
} from "@/lib/inspirations";
import type { UserInspiration } from "@/lib/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function EyeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<UserInspiration | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const fetched = await getInspiration(id);
        setItem(fetched);
      } catch (e) {
        if (__DEV__) console.warn("eye detail:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleDelete() {
    if (!item || deleting) return;
    const ok = await confirmAction(
      "Retirer de l'œil ?",
      "Cette inspiration ne nourrira plus l'algo.",
      "Retirer",
      true
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteInspiration(item.id);
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    } catch (e) {
      setDeleting(false);
      notifyError("Échec", e instanceof Error ? e.message : "Retrait impossible.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color={colors.ice[600]} />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
        <View className="px-6 pt-4">
          <PressableScale onPress={() => router.back()} hitSlop={12}>
            <Text className="font-body text-caption text-ink-500 uppercase tracking-widest">
              ← L'œil
            </Text>
          </PressableScale>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-body text-ink-500" style={{ fontSize: 13 }}>
            Inspiration introuvable.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const label =
    (item.title && item.title.trim()) ||
    (item.extracted_description && item.extracted_description.split(",")[0].trim().toUpperCase()) ||
    "SANS TITRE";

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="px-6 pt-4 pb-2">
          <PressableScale onPress={() => router.back()} hitSlop={12}>
            <Text className="font-body text-caption text-ink-500 uppercase tracking-widest">
              ← L'œil
            </Text>
          </PressableScale>
        </View>

        <View className="px-6 pt-4">
          <View className="bg-paper-200" style={{ aspectRatio: 4 / 5 }}>
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <HatchedPlaceholder style={{ width: "100%", height: "100%" }} />
            )}
          </View>

          <Text
            className="font-body-medium text-ice-600 mt-6"
            style={{ fontSize: 10, letterSpacing: 2 }}
          >
            {KIND_LABEL[item.kind]}
            {item.site_name ? ` / ${item.site_name.toUpperCase()}` : ""}
          </Text>
          <Text
            className="font-display text-ink-900 mt-1 tracking-tight"
            style={{ fontSize: 32, lineHeight: 36 }}
          >
            {label.toUpperCase()}
          </Text>

          {item.extracted_description && (
            <Text
              className="font-body text-ink-700 mt-3"
              style={{ fontSize: 15, lineHeight: 22 }}
            >
              {item.extracted_description}
            </Text>
          )}

          {(item.extracted_color || item.extracted_material) && (
            <Text
              className="font-body text-ink-500 mt-2"
              style={{ fontSize: 13 }}
            >
              {[item.extracted_color, item.extracted_material].filter(Boolean).join(" · ")}
            </Text>
          )}

          {item.extracted_tags.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 12 }}
              className="mt-3"
            >
              {item.extracted_tags.map((tag) => (
                <View
                  key={tag}
                  className="border border-paper-300 px-2.5 py-1.5 bg-paper-50"
                >
                  <Text
                    className="font-body text-ink-700"
                    style={{ fontSize: 12 }}
                  >
                    {tag}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {item.note && (
            <View className="mt-4 border-l-2 border-ice-600 pl-3">
              <Text
                className="font-body text-ink-700 italic"
                style={{ fontSize: 14, lineHeight: 20 }}
              >
                {item.note}
              </Text>
            </View>
          )}

          {item.external_url && (
            <PressableScale
              onPress={() => Linking.openURL(item.external_url as string)}
              className="mt-4"
              hitSlop={8}
            >
              <Text
                className="font-body text-ice-600 underline"
                style={{ fontSize: 13 }}
                numberOfLines={1}
              >
                {item.external_url}
              </Text>
            </PressableScale>
          )}

          <Text
            className="font-body text-ink-300 mt-4"
            style={{ fontSize: 10, letterSpacing: 1.8 }}
          >
            DÉPOSÉ LE {formatDate(item.created_at).toUpperCase()}
          </Text>

          <View className="h-px bg-paper-300 my-6" />

          <PressableScale
            disabled={deleting}
            onPress={handleDelete}
            className="border py-4 items-center"
            style={{ borderColor: colors.error, opacity: deleting ? 0.4 : 1 }}
          >
            <Text
              className="font-display"
              style={{ fontSize: 15, letterSpacing: 1.4, color: colors.error }}
            >
              RETIRER
            </Text>
          </PressableScale>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
