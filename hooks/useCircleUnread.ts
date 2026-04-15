import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Retourne le nombre de messages non lus dans le cercle courant,
 * basé sur circle_members.last_read_at du membre courant.
 */
export function useCircleUnread(circleId: string | null | undefined): {
  unread: number;
  refresh: () => Promise<void>;
} {
  const [unread, setUnread] = useState(0);

  const compute = useCallback(async () => {
    if (!circleId) {
      setUnread(0);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUnread(0);
      return;
    }
    const { data: member } = await supabase
      .from("circle_members")
      .select("last_read_at")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle();
    const since = member?.last_read_at ?? "1970-01-01T00:00:00Z";
    const { count } = await supabase
      .from("circle_messages")
      .select("id", { count: "exact", head: true })
      .eq("circle_id", circleId)
      .gt("created_at", since)
      .neq("user_id", user.id);
    setUnread(count ?? 0);
  }, [circleId]);

  useEffect(() => {
    void compute();
  }, [compute]);

  useEffect(() => {
    if (!circleId) return;
    const name = `circle-unread-${circleId}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(name);
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "circle_messages",
        filter: `circle_id=eq.${circleId}`,
      },
      () => {
        void compute();
      },
    );
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circleId, compute]);

  return { unread, refresh: compute };
}
