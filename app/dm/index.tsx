import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useDMThreads, openDMThread } from "@/hooks/useDMThreads";
import { PressableScale } from "@/components/ui/PressableScale";
import { MemberAvatar } from "@/components/MemberAvatar";
import { PresenceDot } from "@/components/PresenceDot";

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "maintenant";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

interface CoMember {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string | null;
}

export default function DMListScreen() {
  const { threads, loading, userId } = useDMThreads();
  const [coMembers, setCoMembers] = useState<CoMember[]>([]);
  const [opening, setOpening] = useState<string | null>(null);

  const loadCoMembers = useCallback(async () => {
    if (!userId) return;
    const sinceIso = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("outfits")
      .select("user_id, created_at, profile:profiles!outfits_user_id_fkey(id, username, avatar_url)")
      .eq("is_public", true)
      .gte("created_at", sinceIso)
      .neq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    type Row = { user_id: string; profile: { id: string; username: string; avatar_url: string | null } | null };
    const unique = new Map<string, CoMember>();
    for (const row of (recent as unknown as Row[]) ?? []) {
      if (row.profile && !unique.has(row.profile.id)) {
        unique.set(row.profile.id, { ...row.profile, status: null });
      }
    }
    const ids = Array.from(unique.keys());
    if (ids.length > 0) {
      const { data: statuses } = await supabase
        .from("user_statuses")
        .select("user_id, text, expires_at")
        .in("user_id", ids)
        .gt("expires_at", new Date().toISOString());
      for (const s of ((statuses as { user_id: string; text: string }[]) ?? [])) {
        const m = unique.get(s.user_id);
        if (m) m.status = s.text;
      }
    }
    setCoMembers(Array.from(unique.values()));
  }, [userId]);

  useEffect(() => {
    void loadCoMembers();
  }, [loadCoMembers]);

  async function openWith(peerId: string) {
    setOpening(peerId);
    const threadId = await openDMThread(peerId);
    setOpening(null);
    if (!threadId) {
      Alert.alert("Erreur", "Impossible d'ouvrir la conversation.");
      return;
    }
    router.push({ pathname: "/dm/[id]", params: { id: threadId } });
  }

  const showEmpty = !loading && threads.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-6 pt-2 pb-6 border-b border-ink-100">
        <PressableScale onPress={() => router.back()} className="mb-4">
          <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
            ← RETOUR
          </Text>
        </PressableScale>
        <Text className="font-display text-ink-900" style={{ fontSize: 56, letterSpacing: -1, lineHeight: 56 }}>
          MESSAGES
        </Text>
        <Text className="font-body text-ink-500 mt-2" style={{ fontSize: 13, letterSpacing: 1 }}>
          privés · 1 à 1
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#637D8E" />
        </View>
      ) : showEmpty ? (
        <FlatList
          data={coMembers}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={
            <View className="px-6 pt-8 pb-4">
              <Text
                className="font-display text-ink-300"
                style={{ fontSize: 28, letterSpacing: -0.3 }}
              >
                AUCUN MESSAGE
              </Text>
              <Text
                className="font-body-medium text-ink-500 mt-6"
                style={{ fontSize: 10, letterSpacing: 2.5 }}
              >
                RÉCENTS SUR LE FEED
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View className="px-6 pt-2">
              <Text className="font-body text-ink-500" style={{ fontSize: 13 }}>
                Personne de récent sur le feed. Poste une tenue pour lancer la conversation.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center px-5 py-3.5 border-b border-ink-100">
              <MemberAvatar username={item.username} avatarUrl={item.avatar_url} size={40} />
              <View className="flex-1 ml-3">
                <View className="flex-row items-center gap-1.5">
                  <Text
                    className="font-body-semibold text-ink-900"
                    style={{ fontSize: 14 }}
                    numberOfLines={1}
                  >
                    {item.username}
                  </Text>
                  <PresenceDot userId={item.id} />
                </View>
                {item.status ? (
                  <Text
                    className="font-body italic text-ice-600 mt-0.5"
                    style={{ fontSize: 11 }}
                    numberOfLines={1}
                  >
                    « {item.status} »
                  </Text>
                ) : null}
              </View>
              <PressableScale
                onPress={() => void openWith(item.id)}
                disabled={opening === item.id}
                className="border border-ink-900 px-3 py-2"
                style={{ opacity: opening === item.id ? 0.5 : 1 }}
              >
                <Text
                  className="font-body-semibold text-ink-900"
                  style={{ fontSize: 10, letterSpacing: 2 }}
                >
                  {opening === item.id ? "…" : "MESSAGE"}
                </Text>
              </PressableScale>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push({ pathname: "/dm/[id]", params: { id: item.id } })}
              scaleTo={0.99}
            >
              <View className="flex-row items-center px-5 py-4 border-b border-ink-100">
                <MemberAvatar
                  username={item.peer.username}
                  avatarUrl={item.peer.avatar_url}
                  size={44}
                />
                <View className="flex-1 ml-4">
                  <View className="flex-row items-center gap-1.5 mb-0.5">
                    <Text
                      className="font-body-semibold text-ink-900"
                      style={{ fontSize: 15 }}
                      numberOfLines={1}
                    >
                      {item.peer.username}
                    </Text>
                    <PresenceDot userId={item.peer.id} />
                    <View style={{ flex: 1 }} />
                    <Text
                      className="font-body text-ink-300"
                      style={{ fontSize: 10, letterSpacing: 1 }}
                    >
                      {relTime(item.last_message_at).toUpperCase()}
                    </Text>
                  </View>
                  {item.peer.status ? (
                    <Text
                      className="font-body italic text-ice-600"
                      style={{ fontSize: 11 }}
                      numberOfLines={1}
                    >
                      « {item.peer.status} »
                    </Text>
                  ) : null}
                  <Text
                    className="font-body text-ink-500"
                    style={{ fontSize: 13 }}
                    numberOfLines={1}
                  >
                    {item.last_message_preview ?? "—"}
                  </Text>
                </View>
              </View>
            </PressableScale>
          )}
        />
      )}
    </SafeAreaView>
  );
}
