import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { PressableScale } from "@/components/ui/PressableScale";
import type { Circle } from "@/lib/types";

const ACTIVE_CIRCLE_KEY = "frileux.circle.active";

interface Row extends Circle {
  member_count?: number;
  last_message?: string | null;
  last_activity_at?: string;
}

function relTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "maintenant";
  if (mins < 60) return `il y a ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function MyCirclesScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const stored = await AsyncStorage.getItem(ACTIVE_CIRCLE_KEY);
    setActiveId(stored);

    const { data } = await supabase
      .from("circle_members")
      .select("circles(*)")
      .eq("user_id", user.id);

    const circles: Circle[] = ((data ?? []) as unknown as { circles: Circle }[])
      .map((m) => m.circles)
      .filter((c): c is Circle => !!c);

    if (circles.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const ids = circles.map((c) => c.id);
    const { data: previews } = await supabase
      .from("circle_messages")
      .select("circle_id, body, created_at")
      .in("circle_id", ids)
      .order("created_at", { ascending: false })
      .limit(100);

    const lastByCircle = new Map<string, { body: string; at: string }>();
    for (const p of (previews as { circle_id: string; body: string; created_at: string }[]) ?? []) {
      if (!lastByCircle.has(p.circle_id)) {
        lastByCircle.set(p.circle_id, { body: p.body, at: p.created_at });
      }
    }

    const enriched: Row[] = circles
      .map((c) => ({
        ...c,
        last_message: lastByCircle.get(c.id)?.body ?? null,
        last_activity_at: lastByCircle.get(c.id)?.at ?? c.last_activity_at ?? c.created_at,
      }))
      .sort((a, b) => ((a.last_activity_at ?? "") < (b.last_activity_at ?? "") ? 1 : -1));

    setRows(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectCircle(id: string) {
    await AsyncStorage.setItem(ACTIVE_CIRCLE_KEY, id);
    router.replace("/circle");
  }

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-6 pt-2 pb-5 border-b border-ink-100">
        <View className="flex-row items-center justify-between mb-3">
          <PressableScale onPress={() => router.back()}>
            <Text
              className="font-body-medium text-ink-900"
              style={{ fontSize: 12, letterSpacing: 2 }}
            >
              ← RETOUR
            </Text>
          </PressableScale>
          <PressableScale onPress={() => router.push("/circle/new")}>
            <Text
              className="font-body-medium text-ice-600"
              style={{ fontSize: 12, letterSpacing: 2 }}
            >
              + NOUVEAU
            </Text>
          </PressableScale>
        </View>
        <Text
          className="font-display text-ink-900"
          style={{ fontSize: 56, letterSpacing: -1, lineHeight: 56 }}
        >
          MES CERCLES
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#637D8E" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor="#637D8E"
            />
          }
          renderItem={({ item }) => {
            const active = item.id === activeId;
            return (
              <PressableScale onPress={() => void selectCircle(item.id)} scaleTo={0.99}>
                <View
                  className={`px-5 py-4 border-b border-ink-100 flex-row items-center ${active ? "bg-paper-200" : ""}`}
                >
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-baseline gap-2">
                      <Text
                        className="font-display text-ink-900"
                        style={{ fontSize: 22, letterSpacing: -0.3 }}
                        numberOfLines={1}
                      >
                        {item.name.toUpperCase()}
                      </Text>
                      <Text
                        className={`font-body-semibold ${item.visibility === "public" ? "text-ice-600" : "text-ink-300"}`}
                        style={{ fontSize: 9, letterSpacing: 2 }}
                      >
                        {item.visibility === "public" ? "PUBLIC" : "PRIVÉ"}
                      </Text>
                      {active ? (
                        <Text
                          className="font-body-semibold text-ice-600"
                          style={{ fontSize: 9, letterSpacing: 2 }}
                        >
                          · ACTIF
                        </Text>
                      ) : null}
                    </View>
                    {item.last_message ? (
                      <Text
                        className="font-body text-ink-500 mt-0.5"
                        style={{ fontSize: 13 }}
                        numberOfLines={1}
                      >
                        {item.last_message}
                      </Text>
                    ) : null}
                    <Text
                      className="font-body text-ink-300 mt-1"
                      style={{ fontSize: 10, letterSpacing: 1.2 }}
                    >
                      {(item.member_count ?? 1)} MEMBRE{(item.member_count ?? 1) > 1 ? "S" : ""} · {relTime(item.last_activity_at).toUpperCase()}
                    </Text>
                  </View>
                  {!active ? (
                    <Text
                      className="font-body-medium text-ink-300"
                      style={{ fontSize: 14 }}
                    >
                      →
                    </Text>
                  ) : null}
                </View>
              </PressableScale>
            );
          }}
          ListEmptyComponent={
            <View className="py-16 items-center px-6">
              <Text className="font-display text-ink-300" style={{ fontSize: 28 }}>
                AUCUN CERCLE
              </Text>
              <Text className="font-body text-ink-500 mt-2 text-center" style={{ fontSize: 13 }}>
                Crée ou rejoins-en un.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
