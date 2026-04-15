import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useDMThreads, openDMThread } from "@/hooks/useDMThreads";
import { PressableScale } from "@/components/ui/PressableScale";
import { MemberAvatar } from "@/components/circle/MemberAvatar";
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

type Row =
  | { kind: "thread"; id: string }
  | { kind: "header"; label: string }
  | { kind: "member"; member: CoMember };

export function DMPane({ circleId }: { circleId?: string }) {
  const { threads, loading, userId } = useDMThreads();
  const [coMembers, setCoMembers] = useState<CoMember[]>([]);
  const [opening, setOpening] = useState<string | null>(null);

  const loadCoMembers = useCallback(async () => {
    if (!userId) return;
    let circleIds: string[] = [];
    if (circleId) {
      circleIds = [circleId];
    } else {
      const { data: myCircles } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", userId);
      circleIds = ((myCircles as { circle_id: string }[]) ?? []).map((c) => c.circle_id);
    }
    if (circleIds.length === 0) {
      setCoMembers([]);
      return;
    }
    const { data: others } = await supabase
      .from("circle_members")
      .select("user_id, profile:profiles(id, username, avatar_url)")
      .in("circle_id", circleIds)
      .neq("user_id", userId);
    type ORow = {
      user_id: string;
      profile: { id: string; username: string; avatar_url: string | null };
    };
    const unique = new Map<string, CoMember>();
    for (const row of (others as unknown as ORow[]) ?? []) {
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
  }, [userId, circleId]);

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

  if (loading && threads.length === 0 && coMembers.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#637D8E" />
      </View>
    );
  }

  const existingPeerIds = new Set(threads.map((t) => t.peer.id));
  const newContacts = coMembers.filter((m) => !existingPeerIds.has(m.id));

  const rows: Row[] = [];
  if (threads.length > 0) {
    rows.push({ kind: "header", label: "CONVERSATIONS" });
    for (const t of threads) rows.push({ kind: "thread", id: t.id });
  }
  if (newContacts.length > 0) {
    rows.push({ kind: "header", label: threads.length > 0 ? "NOUVEAU MESSAGE" : "MEMBRES DE TES CERCLES" });
    for (const m of newContacts) rows.push({ kind: "member", member: m });
  }

  if (rows.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text
          className="font-display text-ink-300 text-center"
          style={{ fontSize: 24, letterSpacing: -0.3 }}
        >
          PERSONNE ENCORE
        </Text>
        <Text className="font-body text-ink-500 mt-3 text-center" style={{ fontSize: 13 }}>
          Invite un·e membre dans ton cercle pour démarrer une conversation privée.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(r, i) =>
        r.kind === "thread" ? `t-${r.id}` : r.kind === "member" ? `m-${r.member.id}` : `h-${i}`
      }
      contentContainerStyle={{ paddingBottom: 32 }}
      renderItem={({ item }) => {
        if (item.kind === "header") {
          return (
            <Text
              className="font-body-medium text-ink-300 px-5 pt-5 pb-2"
              style={{ fontSize: 10, letterSpacing: 2.5 }}
            >
              {item.label}
            </Text>
          );
        }
        if (item.kind === "thread") {
          const thread = threads.find((t) => t.id === item.id);
          if (!thread) return null;
          return (
            <PressableScale
              onPress={() => router.push({ pathname: "/dm/[id]", params: { id: thread.id } })}
              scaleTo={0.99}
            >
              <View className="flex-row items-center px-5 py-3.5 border-b border-ink-100">
                <MemberAvatar
                  username={thread.peer.username}
                  avatarUrl={thread.peer.avatar_url}
                  size={40}
                />
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center gap-1.5">
                    <Text
                      className="font-body-semibold text-ink-900"
                      style={{ fontSize: 14 }}
                      numberOfLines={1}
                    >
                      {thread.peer.username}
                    </Text>
                    <PresenceDot userId={thread.peer.id} />
                    <View style={{ flex: 1 }} />
                    <Text
                      className="font-body text-ink-300"
                      style={{ fontSize: 10, letterSpacing: 1 }}
                    >
                      {relTime(thread.last_message_at).toUpperCase()}
                    </Text>
                  </View>
                  {thread.peer.status ? (
                    <Text
                      className="font-body italic text-ice-600"
                      style={{ fontSize: 11 }}
                      numberOfLines={1}
                    >
                      « {thread.peer.status} »
                    </Text>
                  ) : null}
                  <Text
                    className="font-body text-ink-500 mt-0.5"
                    style={{ fontSize: 13 }}
                    numberOfLines={1}
                  >
                    {thread.last_message_preview ?? "—"}
                  </Text>
                </View>
              </View>
            </PressableScale>
          );
        }
        const m = item.member;
        return (
          <View className="flex-row items-center px-5 py-3 border-b border-ink-100">
            <MemberAvatar username={m.username} avatarUrl={m.avatar_url} size={36} />
            <View className="flex-1 ml-3">
              <View className="flex-row items-center gap-1.5">
                <Text
                  className="font-body-semibold text-ink-900"
                  style={{ fontSize: 14 }}
                  numberOfLines={1}
                >
                  {m.username}
                </Text>
                <PresenceDot userId={m.id} />
              </View>
              {m.status ? (
                <Text
                  className="font-body italic text-ice-600 mt-0.5"
                  style={{ fontSize: 11 }}
                  numberOfLines={1}
                >
                  « {m.status} »
                </Text>
              ) : null}
            </View>
            <PressableScale
              onPress={() => void openWith(m.id)}
              disabled={opening === m.id}
              className="border border-ink-900 px-3 py-2"
              style={{ opacity: opening === m.id ? 0.5 : 1 }}
            >
              <Text
                className="font-body-semibold text-ink-900"
                style={{ fontSize: 10, letterSpacing: 2 }}
              >
                {opening === m.id ? "…" : "MESSAGE"}
              </Text>
            </PressableScale>
          </View>
        );
      }}
    />
  );
}
