import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  View,
  Text,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { PressableScale } from "@/components/ui/PressableScale";
import { MemberAvatar } from "@/components/circle/MemberAvatar";
import { colors } from "@/lib/theme";

interface DMMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface Peer {
  id: string;
  username: string;
  avatar_url: string | null;
}

const MAX_LEN = 1000;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function DMThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: thread } = await supabase
      .from("dm_threads")
      .select(
        "id, user_a, user_b, a:profiles!dm_threads_user_a_fkey(id, username, avatar_url), b:profiles!dm_threads_user_b_fkey(id, username, avatar_url)",
      )
      .eq("id", id)
      .maybeSingle();

    if (thread) {
      type T = {
        user_a: string;
        a: Peer;
        b: Peer;
      };
      const t = thread as unknown as T;
      setPeer(t.user_a === user.id ? t.b : t.a);
    }

    const { data: msgs } = await supabase
      .from("dm_messages")
      .select("*")
      .eq("thread_id", id)
      .order("created_at", { ascending: false })
      .limit(200);
    setMessages((msgs as DMMessage[]) ?? []);

    await supabase
      .from("dm_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", id)
      .neq("sender_id", user.id)
      .is("read_at", null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`dm-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages", filter: `thread_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => {
            const row = payload.new as DMMessage;
            if (prev.some((m) => m.id === row.id)) return prev;
            return [row, ...prev];
          });
        },
      )
      .subscribe();
    channelRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [id]);

  async function send() {
    const trimmed = draft.trim();
    if (!trimmed || !id || !userId || sending) return;
    setSending(true);
    const { error } = await supabase.from("dm_messages").insert({
      thread_id: id,
      sender_id: userId,
      body: trimmed.slice(0, MAX_LEN),
    });
    setSending(false);
    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }
    setDraft("");
  }

  async function handleDelete(msg: DMMessage) {
    if (msg.sender_id !== userId) return;
    Alert.alert("Supprimer", "Supprimer ce message ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supabase.from("dm_messages").delete().eq("id", msg.id);
          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-5 py-3 border-b border-ink-100 flex-row items-center">
        <PressableScale onPress={() => router.back()} className="mr-3">
          <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
            ←
          </Text>
        </PressableScale>
        {peer ? (
          <>
            <MemberAvatar username={peer.username} avatarUrl={peer.avatar_url} size={32} />
            <Text
              className="font-display text-ink-900 ml-3"
              style={{ fontSize: 22, letterSpacing: -0.3 }}
            >
              {peer.username.toUpperCase()}
            </Text>
          </>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 20 }}
          renderItem={({ item }) => {
            const mine = item.sender_id === userId;
            return (
              <Pressable
                onLongPress={() => handleDelete(item)}
                className={`my-1.5 ${mine ? "items-end" : "items-start"}`}
              >
                <View
                  className={`max-w-[80%] px-4 py-2.5 ${mine ? "bg-ink-900" : "bg-paper-200 border border-ink-100"}`}
                >
                  <Text
                    className={mine ? "text-paper-100" : "text-ink-900"}
                    style={{ fontSize: 14, lineHeight: 20 }}
                  >
                    {item.body}
                  </Text>
                </View>
                <Text
                  className="font-body text-ink-300 mt-1"
                  style={{ fontSize: 10, letterSpacing: 0.5 }}
                >
                  {formatTime(item.created_at)}
                </Text>
              </Pressable>
            );
          }}
        />

        <View className="px-4 pb-3 pt-2 border-t border-ink-100 bg-paper-100">
          <View className="flex-row items-end gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message"
              placeholderTextColor={colors.ink[300]}
              multiline
              maxLength={MAX_LEN}
              className="flex-1 border border-ink-100 px-4 py-3 font-body text-ink-900"
              style={{ fontSize: 14, maxHeight: 120 }}
            />
            <PressableScale
              onPress={send}
              disabled={!draft.trim() || sending}
              className="bg-ink-900 px-5 py-3.5"
              style={{ opacity: !draft.trim() || sending ? 0.4 : 1 }}
            >
              <Text
                className="font-body-semibold text-paper-100"
                style={{ fontSize: 11, letterSpacing: 2 }}
              >
                ENVOYER
              </Text>
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
