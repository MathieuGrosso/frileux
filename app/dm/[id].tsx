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
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { PressableScale } from "@/components/ui/PressableScale";
import { MemberAvatar } from "@/components/MemberAvatar";
import { PhotoLightbox } from "@/components/feed/PhotoLightbox";
import { colors } from "@/lib/theme";

interface DMMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_kind: "image" | null;
  created_at: string;
  read_at: string | null;
}

interface Peer {
  id: string;
  username: string;
  avatar_url: string | null;
}

type PendingPhoto = { uri: string; base64: string };

const MAX_LEN = 1000;
const DM_MESSAGE_SELECT =
  "id, thread_id, sender_id, body, attachment_url, attachment_kind, created_at, read_at";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

async function readBase64(uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const r = reader.result as string;
        const comma = r.indexOf(",");
        resolve(comma >= 0 ? r.slice(comma + 1) : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function DMThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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
      .select(DM_MESSAGE_SELECT)
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

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Galerie", "Active l'accès à la galerie dans les réglages.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    let base64 = asset.base64 ?? null;
    if (!base64) base64 = await readBase64(asset.uri);
    if (!base64) {
      Alert.alert("Image illisible", "Format non supporté, essaie une autre image.");
      return;
    }
    setPending({ uri: asset.uri, base64 });
  }

  async function uploadAttachment(
    base64: string,
    threadId: string,
    senderId: string,
  ): Promise<string> {
    const fileName = `${threadId}/${senderId}/${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("dm_media")
      .upload(fileName, decode(base64), { contentType: "image/jpeg" });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("dm_media").getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function send() {
    const trimmed = draft.trim();
    if ((!trimmed && !pending) || !id || !userId || sending) return;
    setSending(true);
    try {
      let attachmentUrl: string | null = null;
      if (pending) {
        attachmentUrl = await uploadAttachment(pending.base64, id, userId);
      }
      const { error } = await supabase.from("dm_messages").insert({
        thread_id: id,
        sender_id: userId,
        body: trimmed ? trimmed.slice(0, MAX_LEN) : null,
        attachment_url: attachmentUrl,
        attachment_kind: attachmentUrl ? "image" : null,
      });
      if (error) throw error;
      setDraft("");
      setPending(null);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
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

  const canSend = (draft.trim().length > 0 || !!pending) && !sending;

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
            const hasPhoto =
              item.attachment_kind === "image" && !!item.attachment_url;
            const hasBody = !!item.body && item.body.length > 0;
            return (
              <Pressable
                onLongPress={() => handleDelete(item)}
                className={`my-1.5 ${mine ? "items-end" : "items-start"}`}
              >
                {hasPhoto && (
                  <Pressable
                    onPress={() => setLightboxUrl(item.attachment_url)}
                    className="bg-paper-200 mb-1"
                    style={{ width: 160, height: 210 }}
                    accessibilityLabel="Voir la photo en plein écran"
                  >
                    <Image
                      source={{ uri: item.attachment_url ?? undefined }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </Pressable>
                )}
                {hasBody && (
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
                )}
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
          {pending && (
            <View className="mb-2">
              <View
                className="bg-paper-200 relative"
                style={{ width: 80, height: 108 }}
              >
                <Image
                  source={{ uri: pending.uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
                <Pressable
                  onPress={() => setPending(null)}
                  hitSlop={8}
                  accessibilityLabel="Retirer la photo"
                  className="absolute -top-2 -right-2 bg-ink-900 w-5 h-5 items-center justify-center"
                >
                  <Feather name="x" size={12} color={colors.paper[100]} />
                </Pressable>
              </View>
            </View>
          )}
          <View className="flex-row items-end gap-2">
            <Pressable
              onPress={pickPhoto}
              hitSlop={8}
              accessibilityLabel="Envoyer une photo"
              className="border border-ink-100 bg-paper-200 px-3.5 py-3.5 active:opacity-60"
            >
              <Feather name="image" size={18} color={colors.ink[700]} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={pending ? "Légende (optionnel)" : "Message"}
              placeholderTextColor={colors.ink[300]}
              multiline
              maxLength={MAX_LEN}
              className="flex-1 border border-ink-100 px-4 py-3 font-body text-ink-900"
              style={{ fontSize: 14, maxHeight: 120 }}
            />
            <PressableScale
              onPress={send}
              disabled={!canSend}
              style={{
                backgroundColor: colors.ink[900],
                paddingHorizontal: 20,
                paddingVertical: 14,
                opacity: canSend ? 1 : 0.4,
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.paper[100]} />
              ) : (
                <Text
                  className="font-body-semibold text-paper-100"
                  style={{ fontSize: 11, letterSpacing: 2 }}
                >
                  ENVOYER
                </Text>
              )}
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
      <PhotoLightbox photoUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </SafeAreaView>
  );
}
