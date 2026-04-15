import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  View,
  Text,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { CircleMessage } from "@/lib/types";
import { useCircleMembers } from "@/hooks/useCircleMembers";
import { MentionInput } from "@/components/circle/MentionInput";
import { MessageBody } from "@/components/circle/MessageBody";
import { MessageReactions } from "@/components/circle/MessageReactions";
import { ReactionPicker } from "@/components/circle/ReactionPicker";
import { useMessageReactions, type ReactionKey } from "@/hooks/useMessageReactions";
import { usePolls, type Poll } from "@/hooks/usePolls";
import { PollCard } from "@/components/circle/PollCard";
import { DMPane } from "@/components/circle/DMPane";

const MAX_LEN = 500;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "AUJOURD'HUI";
  if (d.toDateString() === yest.toDateString()) return "HIER";
  return d
    .toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();
}

interface MessageRow {
  type: "message";
  message: CircleMessage;
  showAuthor: boolean;
}

interface DayRow {
  type: "day";
  label: string;
  key: string;
}

interface PollRow {
  type: "poll";
  poll: Poll;
}

type Row = MessageRow | DayRow | PollRow;

export default function CircleChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<CircleMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const listRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStateRef = useRef(false);
  const { members } = useCircleMembers(id ?? null);
  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const { rows: reactionRows, userId: reactionUserId, toggle: toggleReaction } =
    useMessageReactions(id ?? null, messageIds);
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);
  const { polls, vote: votePoll } = usePolls(id ?? null);
  const [tab, setTab] = useState<"cercle" | "mp">("cercle");

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("circle_messages")
      .select("*")
      .eq("circle_id", id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.warn("circle_messages load failed", error);
      return;
    }
    setMessages((data as unknown as CircleMessage[]) ?? []);
  }, [id]);

  const markRead = useCallback(async () => {
    if (!id || !userId) return;
    await supabase
      .from("circle_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("circle_id", id)
      .eq("user_id", userId);
  }, [id, userId]);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await load();
    })();
  }, [load]);

  useEffect(() => {
    if (userId) void markRead();
  }, [userId, markRead, messages.length]);

  useEffect(() => {
    if (!id || !userId) return;
    const channel = supabase
      .channel(`circle-chat-${id}`, { config: { presence: { key: userId } } })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "circle_messages",
          filter: `circle_id=eq.${id}`,
        },
        async (payload) => {
          const row = payload.new as { id: string };
          const { data, error } = await supabase
            .from("circle_messages")
            .select("*")
            .eq("id", row.id)
            .single();
          if (error) {
            console.warn("circle_messages realtime reload failed", error);
            return;
          }
          if (!data) return;
          setMessages((prev) =>
            prev.some((m) => m.id === data.id)
              ? prev
              : [data as unknown as CircleMessage, ...prev],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "circle_messages",
          filter: `circle_id=eq.${id}`,
        },
        (payload) => {
          const row = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== row.id));
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ typing: boolean; user_id: string }>();
        const ids: string[] = [];
        for (const key of Object.keys(state)) {
          if (key === userId) continue;
          const entries = state[key];
          if (entries.some((e) => e.typing)) ids.push(key);
        }
        setTypingUserIds(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, typing: false });
        }
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [id, userId]);

  const setTyping = useCallback((next: boolean) => {
    if (typingStateRef.current === next) return;
    typingStateRef.current = next;
    const ch = channelRef.current;
    if (!ch || !userId) return;
    void ch.track({ user_id: userId, typing: next });
  }, [userId]);

  const onDraftChange = useCallback((t: string) => {
    setDraft(t.slice(0, MAX_LEN));
    if (t.trim().length === 0) {
      setTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 2500);
  }, [setTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const typingLabel = useMemo(() => {
    if (typingUserIds.length === 0) return null;
    const names = typingUserIds
      .map((uid) => members.find((m) => m.user_id === uid)?.username ?? null)
      .filter((n): n is string => !!n);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} écrit…`;
    if (names.length === 2) return `${names[0]} et ${names[1]} écrivent…`;
    return `${names[0]}, ${names[1]} +${names.length - 2} écrivent…`;
  }, [typingUserIds, members]);

  const rows = useMemo<Row[]>(() => {
    // Merge messages + polls, newest first (FlatList inverted)
    type Stream =
      | { kind: "message"; at: string; m: CircleMessage }
      | { kind: "poll"; at: string; p: Poll };
    const stream: Stream[] = [
      ...messages.map((m) => ({ kind: "message" as const, at: m.created_at, m })),
      ...polls.map((p) => ({ kind: "poll" as const, at: p.created_at, p })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    const out: Row[] = [];
    for (let i = 0; i < stream.length; i++) {
      const item = stream[i];
      const next = stream[i + 1];
      if (item.kind === "poll") {
        out.push({ type: "poll", poll: item.p });
      } else {
        const m = item.m;
        const nextMsg =
          next && next.kind === "message" && next.m.user_id === m.user_id ? next.m : null;
        const showAuthor =
          !nextMsg || !isSameDay(nextMsg.created_at, m.created_at);
        out.push({ type: "message", message: m, showAuthor });
      }
      const crossesDay =
        !next || !isSameDay(next.at, item.at);
      if (crossesDay) {
        out.push({
          type: "day",
          label: formatDayLabel(item.at),
          key: `day-${item.at.slice(0, 10)}-${i}`,
        });
      }
    }
    return out;
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || sending || !id || !userId) return;
    setSending(true);
    const { error } = await supabase
      .from("circle_messages")
      .insert({ circle_id: id, user_id: userId, body, mentions: mentionedIds });
    setSending(false);
    if (error) {
      Alert.alert("Erreur", "Impossible d'envoyer.");
      return;
    }
    setDraft("");
    setMentionedIds([]);
    setTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    void markRead();
  }

  async function remove(messageId: string) {
    const { error } = await supabase
      .from("circle_messages")
      .delete()
      .eq("id", messageId);
    if (error) {
      Alert.alert("Erreur", "Suppression refusée.");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <View className="px-6 pt-2 pb-3 border-b border-ink-100">
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/circle");
          }}
          hitSlop={16}
          className="active:opacity-50 mb-2"
        >
          <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
            ← CERCLE
          </Text>
        </Pressable>
      </View>
      <View className="flex-row border-b border-ink-100">
        <Pressable
          onPress={() => setTab("cercle")}
          className={`flex-1 py-3 items-center ${tab === "cercle" ? "bg-paper-200" : ""}`}
        >
          <Text
            className={`font-body-semibold ${tab === "cercle" ? "text-ink-900" : "text-ink-300"}`}
            style={{ fontSize: 12, letterSpacing: 2.5 }}
          >
            CERCLE
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("mp")}
          className={`flex-1 py-3 items-center ${tab === "mp" ? "bg-paper-200" : ""}`}
        >
          <Text
            className={`font-body-semibold ${tab === "mp" ? "text-ink-900" : "text-ink-300"}`}
            style={{ fontSize: 12, letterSpacing: 2.5 }}
          >
            PRIVÉ
          </Text>
        </Pressable>
      </View>

      {tab === "mp" ? (
        <DMPane circleId={id ?? undefined} />
      ) : (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        className="flex-1"
      >
        <FlatList
          ref={listRef}
          data={rows}
          inverted
          keyExtractor={(r) =>
            r.type === "message" ? r.message.id : r.type === "poll" ? `poll-${r.poll.id}` : r.key
          }
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.type === "day") {
              return (
                <View className="items-center py-4">
                  <Text
                    className="font-body-semibold text-ink-300 text-eyebrow"
                    style={{ letterSpacing: 2 }}
                  >
                    {item.label}
                  </Text>
                </View>
              );
            }
            if (item.type === "poll") {
              return (
                <PollCard
                  poll={item.poll}
                  onVote={(optId) => { void votePoll(item.poll.id, optId); }}
                />
              );
            }
            const m = item.message;
            const isMine = m.user_id === userId;
            const authorName =
              members.find((mem) => mem.user_id === m.user_id)?.username ?? "—";
            return (
              <View className="mb-2">
                {item.showAuthor && (
                  <View className="flex-row items-baseline justify-between mb-0.5">
                    <Text
                      className="font-display text-ink-900"
                      style={{ fontSize: 13, letterSpacing: 1 }}
                    >
                      {authorName.toUpperCase()}
                    </Text>
                    <Text className="font-body text-ink-300 text-eyebrow">
                      {formatTime(m.created_at)}
                    </Text>
                  </View>
                )}
                <Pressable
                  onLongPress={() => setPickerTarget(m.id)}
                  className="active:opacity-60"
                >
                  <MessageBody body={m.body} />
                </Pressable>
                <MessageReactions
                  rows={reactionRows.filter((r) => r.message_id === m.id)}
                  userId={reactionUserId}
                  onToggle={(k) => { void toggleReaction(m.id, k); }}
                />
              </View>
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text
                className="font-body-semibold text-ink-300 text-eyebrow"
                style={{ letterSpacing: 2 }}
              >
                AUCUN MESSAGE
              </Text>
              <Text className="font-body text-ink-300 text-caption mt-2">
                Lance la conversation.
              </Text>
            </View>
          }
        />

        {typingLabel && (
          <View className="px-6 pb-1 pt-1">
            <Text className="font-body text-caption text-ink-500">
              {typingLabel}
            </Text>
          </View>
        )}

        <View className="border-t border-paper-300 px-4 py-2 flex-row items-end gap-2 bg-paper-100">
          <Pressable
            onPress={() =>
              router.push({ pathname: "/circle/poll/new", params: { circleId: id ?? "" } })
            }
            className="px-3 py-3 border border-ink-100 active:bg-paper-200"
            hitSlop={6}
          >
            <Text
              className="font-body-semibold text-ink-900"
              style={{ fontSize: 16, lineHeight: 16 }}
            >
              ⊟
            </Text>
          </Pressable>
          <MentionInput
            value={draft}
            onChangeText={onDraftChange}
            placeholder="Écrire un message"
            maxLength={MAX_LEN}
            members={members}
            mentionedUserIds={mentionedIds}
            onMentionedUserIdsChange={setMentionedIds}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || sending}
            className={`px-4 py-3 ${draft.trim() ? "bg-ink-900 active:bg-ink-700" : "bg-paper-300"}`}
          >
            <Text
              className="font-body-semibold text-paper-100 text-eyebrow"
              style={{ letterSpacing: 2 }}
            >
              ENVOYER
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      )}

      <ReactionPicker
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onPick={(k: ReactionKey) => {
          if (pickerTarget) void toggleReaction(pickerTarget, k);
        }}
        onDelete={
          pickerTarget &&
          messages.find((m) => m.id === pickerTarget)?.user_id === userId
            ? () => {
                if (pickerTarget) void remove(pickerTarget);
              }
            : undefined
        }
      />
    </SafeAreaView>
  );
}
