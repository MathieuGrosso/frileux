import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface DailyPost {
  id: string;
  user_id: string;
  circle_id: string | null;
  image_path: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  image_url: string;
  profile: {
    username: string;
    avatar_url: string | null;
  };
  seen: boolean;
}

function publicUrl(path: string): string {
  const { data } = supabase.storage.from("daily-posts").getPublicUrl(path);
  return data.publicUrl;
}

export function useDailyPosts(circleId: string | null) {
  const [posts, setPosts] = useState<DailyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    let query = supabase
      .from("daily_posts")
      .select("*, profile:profiles(username, avatar_url)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (circleId) query = query.or(`circle_id.eq.${circleId},circle_id.is.null`);

    const { data } = await query;
    const list = (data as unknown as DailyPost[]) ?? [];

    const ids = list.map((p) => p.id);
    let seenSet = new Set<string>();
    if (ids.length > 0) {
      const { data: views } = await supabase
        .from("daily_post_views")
        .select("post_id")
        .in("post_id", ids)
        .eq("user_id", user.id);
      seenSet = new Set(((views as { post_id: string }[]) ?? []).map((v) => v.post_id));
    }

    setPosts(list.map((p) => ({ ...p, image_url: publicUrl(p.image_path), seen: seenSet.has(p.id) })));
    setLoading(false);
  }, [circleId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`daily-posts-${circleId ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "daily_posts" },
        () => { void load(); },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "daily_posts" },
        () => { void load(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId, circleId, load]);

  async function markSeen(postId: string) {
    if (!userId) return;
    await supabase
      .from("daily_post_views")
      .insert({ post_id: postId, user_id: userId })
      .select();
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, seen: true } : p)));
  }

  async function deletePost(postId: string) {
    await supabase.from("daily_posts").delete().eq("id", postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return { posts, loading, userId, markSeen, deletePost, reload: load };
}
