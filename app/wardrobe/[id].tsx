import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { HatchedPlaceholder } from "@/components/HatchedPlaceholder";
import { cleanValue, confirmAction, notifyError } from "@/lib/ui";

interface WardrobeItem {
  id: string;
  photo_url: string | null;
  type: string;
  color: string | null;
  material: string | null;
  style_tags: string[];
  description: string;
  created_at: string;
}

export default function WardrobeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<WardrobeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("wardrobe_items")
        .select("id, photo_url, type, color, material, style_tags, description, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error && __DEV__) console.warn("wardrobe detail:", error.message);
      setItem((data as WardrobeItem | null) ?? null);
      setLoading(false);
    })();
  }, [id]);

  async function handleDelete() {
    if (!item || deleting) return;
    const confirmed = await confirmAction(
      "Supprimer cette piece ?",
      "Action irreversible.",
      "Supprimer",
      true,
    );
    if (!confirmed) return;
    setDeleting(true);
    const { error } = await supabase.from("wardrobe_items").delete().eq("id", item.id);
    setDeleting(false);
    if (error) {
      notifyError("Echec", error.message);
      return;
    }
    router.back();
  }

  const material = cleanValue(item?.material);
  const color = cleanValue(item?.color);
  const description = cleanValue(item?.description);

  return (
    <View className="flex-1 bg-paper">
      <SafeAreaView className="flex-1">
        <View className="flex-row items-center justify-between px-6 pt-2 pb-4">
          <PressableScale onPress={() => router.back()} hitSlop={12}>
            <Text className="font-body-medium text-eyebrow text-ink-500">RETOUR</Text>
          </PressableScale>
          {item && (
            <PressableScale onPress={handleDelete} disabled={deleting} hitSlop={12}>
              <Text className="font-body-medium text-eyebrow text-error">
                {deleting ? "SUPPRESSION..." : "SUPPRIMER"}
              </Text>
            </PressableScale>
          )}
        </View>

        <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
          <View className="aspect-square w-full">
            {item?.photo_url ? (
              <Image
                source={{ uri: item.photo_url }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <HatchedPlaceholder style={{ width: "100%", height: "100%" }} />
            )}
          </View>

          {!loading && !item && (
            <View className="px-6 pt-8">
              <Text className="font-body text-body-sm text-ink-500">Piece introuvable.</Text>
            </View>
          )}

          {item && (
            <View className="px-6 pt-6">
              <Text className="font-body-medium text-eyebrow text-ice mb-2">
                {labelForType(item.type).toUpperCase()}
              </Text>
              <Text className="font-display text-h1 text-ink-900 mb-4">
                {color ? `${color} ${labelForType(item.type)}` : labelForType(item.type)}
              </Text>

              {material && <Row label="MATIERE" value={material} />}
              {item.style_tags?.length > 0 && (
                <Row label="STYLE" value={item.style_tags.join(" · ")} />
              )}
              {description && <Row label="DESCRIPTION" value={description} />}
              <Row
                label="AJOUTE"
                value={new Date(item.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="py-3 border-b border-paper-300">
      <Text className="font-body-medium text-micro text-ink-300 mb-1">{label}</Text>
      <Text className="font-body text-body text-ink-900">{value}</Text>
    </View>
  );
}

function labelForType(t: string): string {
  switch (t) {
    case "top":
      return "haut";
    case "bottom":
      return "bas";
    case "outerwear":
      return "manteau";
    case "shoes":
      return "chaussure";
    case "accessory":
      return "accessoire";
    default:
      return t;
  }
}
