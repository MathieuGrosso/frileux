import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { supabase } from "@/lib/supabase";
import type { OutfitComment } from "@/lib/types";
import { MemberAvatar } from "./MemberAvatar";
import { colors } from "@/lib/theme";
import { notifyError } from "@/lib/ui";

interface Props {
  outfitId: string;
}

const MAX_LEN = 200;

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

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    if (!currentUserId) {
      notifyError("Erreur", "Session expirée, reconnecte-toi.");
      return;
    }
    setSending(true);
    const { error } = await supabase
      .from("outfit_comments")
      .insert({ outfit_id: outfitId, user_id: currentUserId, body });
    setSending(false);
    if (error) {
      notifyError("Erreur", "Impossible d'envoyer.");
      return;
    }
    setDraft("");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("outfit_comments").delete().eq("id", id);
    if (error) {
      notifyError("Erreur", "Suppression refusée.");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <View className="pt-6">
      <Text
        className="font-body-semibold text-ink-300 text-eyebrow mb-4"
        style={{ letterSpacing: 1.5 }}
      >
        NOTES DU CERCLE ({notes.length})
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
              <Text className="font-body text-ink-700 text-body-sm leading-5 mt-0.5">
                {n.body}
              </Text>
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

      <View className="flex-row items-center gap-2 mt-2">
        <TextInput
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, MAX_LEN))}
          placeholder="Ajouter une note"
          placeholderTextColor={colors.ink[300]}
          selectionColor={colors.ice[600]}
          className="flex-1 border border-paper-300 bg-paper-200 px-3 py-2 font-body text-ink-900 text-body-sm"
          multiline
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
      <Text className="font-body text-ink-300 text-micro mt-1 text-right">
        {draft.length}/{MAX_LEN}
      </Text>
    </View>
  );
}
