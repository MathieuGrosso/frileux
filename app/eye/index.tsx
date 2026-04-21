import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { PressableScale } from "@/components/ui/PressableScale";
import { EyeCard } from "@/components/EyeCard";
import EyeAddSheet from "@/components/EyeAddSheet";
import { deleteInspiration, listInspirations } from "@/lib/inspirations";
import { confirmAction, notifyError } from "@/lib/ui";
import { colors } from "@/lib/theme";
import type { InspirationKind, UserInspiration } from "@/lib/types";

type Filter = "all" | InspirationKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "TOUT" },
  { value: "piece", label: "PIÈCES" },
  { value: "shop", label: "ADRESSES" },
  { value: "lookbook", label: "PLANCHES" },
];

export default function EyeIndex() {
  const router = useRouter();
  const [items, setItems] = useState<UserInspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listInspirations({ limit: 200 });
      setItems(data);
    } catch (e) {
      if (__DEV__) console.warn("load inspirations:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.kind === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const base: Record<InspirationKind, number> = { piece: 0, shop: 0, lookbook: 0 };
    for (const i of items) base[i.kind] += 1;
    return base;
  }, [items]);

  async function handleLongPress(item: UserInspiration) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const ok = await confirmAction(
      "Retirer de l'œil ?",
      "Cette inspiration ne nourrira plus l'algo.",
      "Retirer",
      true
    );
    if (!ok) return;
    try {
      await deleteInspiration(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      notifyError("Échec", e instanceof Error ? e.message : "Impossible de retirer.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color={colors.ice[600]} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
      <View className="px-6 pt-4 pb-4 border-b border-paper-300">
        <View className="flex-row items-center justify-between">
          <PressableScale onPress={() => router.back()} hitSlop={12}>
            <Text className="font-body text-caption text-ink-500 uppercase tracking-widest">
              Retour
            </Text>
          </PressableScale>
          <PressableScale onPress={() => setAddOpen(true)} hitSlop={12}>
            <Text className="font-display text-ink-900" style={{ fontSize: 16, letterSpacing: 1 }}>
              + DÉPOSER
            </Text>
            <View className="h-px bg-ice-600 mt-0.5" />
          </PressableScale>
        </View>

        <Text className="font-body-medium text-ink-300 mt-6" style={{ fontSize: 10, letterSpacing: 2 }}>
          GARDE-ROBE / L'ŒIL
        </Text>
        <Text className="font-display text-ink-900 tracking-tight mt-1" style={{ fontSize: 40, lineHeight: 44 }}>
          L'ŒIL
        </Text>
        <Text className="font-body text-ink-500 mt-2" style={{ fontSize: 13 }}>
          {counts.piece} pièce{counts.piece > 1 ? "s" : ""} · {counts.shop} adresse
          {counts.shop > 1 ? "s" : ""} · {counts.lookbook} planche
          {counts.lookbook > 1 ? "s" : ""}
        </Text>
      </View>

      {items.length > 0 && (
        <View className="flex-row px-4 py-3 border-b border-paper-300 gap-2">
          {FILTERS.map((f) => {
            const active = f.value === filter;
            return (
              <PressableScale
                key={f.value}
                onPress={() => setFilter(f.value)}
                className={"px-3 py-2 border " + (active ? "bg-ink-900 border-ink-900" : "bg-paper-50 border-ink-900")}
              >
                <Text
                  className={"font-body-medium " + (active ? "text-paper" : "text-ink-900")}
                  style={{ fontSize: 10, letterSpacing: 1.4 }}
                >
                  {f.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      )}

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Text className="font-body-medium text-ink-300" style={{ fontSize: 10, letterSpacing: 2 }}>
            L'ŒIL EST VIERGE
          </Text>
          <View className="h-px bg-paper-300 w-12 my-2" />
          <Text
            className="font-body text-ink-700 text-center"
            style={{ fontSize: 14, lineHeight: 20 }}
          >
            Rien n'est encore déposé.{"\n"}Dépose la première pièce, marque ou planche que tu as
            retenue cette semaine.
          </Text>
          <PressableScale
            onPress={() => setAddOpen(true)}
            className="bg-ink-900 px-6 py-4 mt-4"
          >
            <Text className="font-display text-paper" style={{ fontSize: 15, letterSpacing: 1.2 }}>
              + DÉPOSER
            </Text>
          </PressableScale>
        </View>
      ) : (
        <FlatList
          data={filtered}
          numColumns={2}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 6, paddingTop: 8, paddingBottom: 48 }}
          renderItem={({ item }) => (
            <EyeCard
              item={item}
              onPress={() => router.push(`/eye/${item.id}` as const)}
              onLongPress={() => handleLongPress(item)}
            />
          )}
          ListEmptyComponent={
            <View className="items-center pt-16 px-6">
              <Text className="font-body text-ink-500" style={{ fontSize: 13 }}>
                Aucune inspiration de ce type.
              </Text>
            </View>
          }
        />
      )}

      <EyeAddSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(item) => {
          setItems((prev) => [item, ...prev]);
        }}
      />
    </SafeAreaView>
  );
}
