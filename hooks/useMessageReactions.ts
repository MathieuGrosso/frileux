import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const REACTION_KEYS = ["fire", "eye", "snow", "heart", "spark"] as const;
export type ReactionKey = (typeof REACTION_KEYS)[number];

export const REACTION_GLYPHS: Record<ReactionKey, string> = {
  fire: "△",
  eye: "◎",
  snow: "✸",
  heart: "♡",
  spark: "✦",
};

export interface ReactionRow {
  message_id: string;
  user_id: string;
  emoji_key: ReactionKey;
}

export function useMessageReactions(circleId: string | null, messageIds: string[]) {
  const [rows, setRows] = useState<ReactionRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (messageIds.length === 0) {
      setRows([]);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    const { data } = await supabase
      .from("message_reactions")
      .select("message_id, user_id, emoji_key")
      .in("message_id", messageIds);
    setRows((data as ReactionRow[]) ?? []);
  }, [messageIds]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!circleId) return;
    const ch = supabase
      .channel(`reactions-${circleId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => { void load(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [circleId, load]);

  const toggle = useCallback(
    async (messageId: string, key: ReactionKey) => {
      if (!userId) return;
      const exists = rows.some(
        (r) => r.message_id === messageId && r.user_id === userId && r.emoji_key === key,
      );
      if (exists) {
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", userId)
          .eq("emoji_key", key);
      } else {
        await supabase.from("message_reactions").insert({
          message_id: messageId,
          user_id: userId,
          emoji_key: key,
        });
      }
    },
    [userId, rows],
  );

  return { rows, userId, toggle };
}
