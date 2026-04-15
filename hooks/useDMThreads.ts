import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface DMThreadWithPeer {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string;
  last_message_preview: string | null;
  peer: {
    id: string;
    username: string;
    avatar_url: string | null;
    status: string | null;
  };
  unread: boolean;
}

export function useDMThreads() {
  const [threads, setThreads] = useState<DMThreadWithPeer[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data } = await supabase
      .from("dm_threads")
      .select(
        "id, user_a, user_b, last_message_at, last_message_preview, a:profiles!dm_threads_user_a_fkey(id, username, avatar_url), b:profiles!dm_threads_user_b_fkey(id, username, avatar_url)",
      )
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    type Row = {
      id: string;
      user_a: string;
      user_b: string;
      last_message_at: string;
      last_message_preview: string | null;
      a: { id: string; username: string; avatar_url: string | null };
      b: { id: string; username: string; avatar_url: string | null };
    };

    const rows = (data as unknown as Row[]) ?? [];
    const peerIds = rows.map((r) => (r.user_a === user.id ? r.b.id : r.a.id));
    let statusByUser = new Map<string, string>();
    if (peerIds.length > 0) {
      const { data: statuses } = await supabase
        .from("user_statuses")
        .select("user_id, text, expires_at")
        .in("user_id", peerIds)
        .gt("expires_at", new Date().toISOString());
      statusByUser = new Map(
        ((statuses as { user_id: string; text: string }[]) ?? []).map((s) => [s.user_id, s.text]),
      );
    }

    const mapped: DMThreadWithPeer[] = rows.map((r) => {
      const raw = r.user_a === user.id ? r.b : r.a;
      return {
        id: r.id,
        user_a: r.user_a,
        user_b: r.user_b,
        last_message_at: r.last_message_at,
        last_message_preview: r.last_message_preview,
        peer: { ...raw, status: statusByUser.get(raw.id) ?? null },
        unread: false,
      };
    });
    setThreads(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const name = `dm-threads-${userId}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(name)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_threads" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  return { threads, loading, userId, reload: load };
}

export async function openDMThread(otherUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("open_dm_thread", {
    other_user_id: otherUserId,
  });
  if (error || !data) return null;
  return (data as { id: string }).id;
}
