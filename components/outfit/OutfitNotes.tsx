import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import type { OutfitComment } from "@/lib/types";
import { MemberAvatar } from "@/components/MemberAvatar";
import { PhotoLightbox } from "@/components/feed/PhotoLightbox";
import { colors } from "@/lib/theme";
import { notifyError } from "@/lib/ui";

interface Props {
  outfitId: string;
}

const MAX_LEN = 200;

type PendingPhoto = { uri: string; base64: string };

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  if (diffMin < 60 * 24) return `il y a ${Math.floor(diffMin / 60)}h`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function OutfitNotes({ outfitId }: Props) {
  const [notes, setNotes] = useState<OutfitComment[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("outfit_comments")
      .select("*, profile:profiles(username, avatar_url)")
      .eq("outfit_id", outfitId)
      .order("created_at", { ascending: true });
    setNotes((data as unknown as OutfitComment[]) ?? []);
  }, [outfitId]);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      await load();
    })();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`outfit-notes-${outfitId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "outfit_comments",
          filter: `outfit_id=eq.${outfitId}`,
        },
        async (payload) => {
          const row = payload.new as { id: string };
          const { data } = await supabase
            .from("outfit_comments")
            .select("*, profile:profiles(username, avatar_url)")
            .eq("id", row.id)
            .single();
          if (!data) return;
          setNotes((prev) =>
            prev.some((n) => n.id === data.id)
              ? prev
              : [...prev, data as unknown as OutfitComment]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "outfit_comments",
          filter: `outfit_id=eq.${outfitId}`,
        },
        (payload) => {
          const row = payload.old as { id: string };
          setNotes((prev) => prev.filter((n) => n.id !== row.id));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [outfitId]);

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

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      notifyError("Galerie", "Active l'accès à la galerie dans les réglages.");
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
      notifyError("Image illisible", "Format non supporté, essaie une autre image.");
      return;
    }
    setPending({ uri: asset.uri, base64 });
  }

  async function uploadPhoto(base64: string, userId: string): Promise<string> {
    const fileName = `${userId}/${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("outfit_replies")
      .upload(fileName, decode(base64), { contentType: "image/jpeg" });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("outfit_replies").getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function send() {
    const body = draft.trim();
    if ((!body && !pending) || sending) return;
    if (!currentUserId) {
      notifyError("Erreur", "Session expirée, reconnecte-toi.");
      return;
    }
    setSending(true);
    try {
      let photoUrl: string | null = null;
      if (pending) {
        photoUrl = await uploadPhoto(pending.base64, currentUserId);
      }
      const { error } = await supabase.from("outfit_comments").insert({
        outfit_id: outfitId,
        user_id: currentUserId,
        body: body || null,
        photo_url: photoUrl,
      });
      if (error) throw error;
      setDraft("");
      setPending(null);
    } catch (e) {
      notifyError("Erreur", e instanceof Error ? e.message : "Impossible d'envoyer.");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("outfit_comments").delete().eq("id", id);
    if (error) {
      notifyError("Erreur", "Suppression refusée.");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  const canSend = (draft.trim().length > 0 || !!pending) && !sending;

  return (
    <View className="pt-6">
      <Text
        className="font-body-semibold text-ink-300 text-eyebrow mb-4"
        style={{ letterSpacing: 1.5 }}
      >
        NOTES ({notes.length})
      </Text>
      {notes.length === 0 && (
        <Text className="font-body text-ink-300 text-body-sm mb-4">
          Aucune note pour le moment.
        </Text>
      )}
      {notes.map((n) => {
        const isMine = n.user_id === currentUserId;
        return (
          <View key={n.id} className="flex-row items-start gap-2.5 mb-4">
            <MemberAvatar
              username={n.profile?.username}
              avatarUrl={n.profile?.avatar_url}
              size={20}
            />
            <View className="flex-1">
              <View className="flex-row items-baseline gap-2">
                <Text className="font-body-medium text-ink-900 text-caption">
                  {n.profile?.username ?? "—"}
                </Text>
                <Text className="font-body text-ink-300 text-eyebrow">
                  {formatRelative(n.created_at)}
                </Text>
              </View>
              {n.photo_url && (
                <Pressable
                  onPress={() => setLightboxUrl(n.photo_url)}
                  className="mt-1.5 bg-paper-200 active:opacity-70"
                  style={{ width: 128, height: 170 }}
                  accessibilityLabel="Voir la photo de la réponse"
                >
                  <Image
                    source={{ uri: n.photo_url }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </Pressable>
              )}
              {n.body && (
                <Text className="font-body text-ink-700 text-body-sm leading-5 mt-0.5">
                  {n.body}
                </Text>
              )}
            </View>
            {isMine && (
              <Pressable onPress={() => remove(n.id)} className="active:opacity-50 pt-0.5">
                <Text
                  className="font-body-semibold text-ink-300 text-micro"
                  style={{ letterSpacing: 1 }}
                >
                  SUPPR.
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}

      {pending && (
        <View className="mb-3">
          <View
            className="bg-paper-200 relative"
            style={{ width: 72, height: 96 }}
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

      <View className="flex-row items-center gap-2 mt-2">
        <Pressable
          onPress={pickPhoto}
          hitSlop={8}
          accessibilityLabel="Ajouter une photo"
          className="border border-paper-300 bg-paper-200 px-3 py-3 active:opacity-60"
        >
          <Feather name="image" size={16} color={colors.ink[700]} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, MAX_LEN))}
          placeholder={pending ? "Légende (optionnel)" : "Ajouter une note"}
          placeholderTextColor={colors.ink[300]}
          selectionColor={colors.ice[600]}
          className="flex-1 border border-paper-300 bg-paper-200 px-3 py-2 font-body text-ink-900 text-body-sm"
          multiline
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          className={`px-4 py-3 ${canSend ? "bg-ink-900 active:bg-ink-700" : "bg-paper-300"}`}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.paper[100]} />
          ) : (
            <Text
              className="font-body-semibold text-paper-100 text-eyebrow"
              style={{ letterSpacing: 2 }}
            >
              ENVOYER
            </Text>
          )}
        </Pressable>
      </View>
      <Text className="font-body text-ink-300 text-micro mt-1 text-right">
        {draft.length}/{MAX_LEN}
      </Text>
      <PhotoLightbox photoUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </View>
  );
}
