import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface FollowStats {
  followers: number;
  following: number;
  iFollow: boolean;
  myId: string | null;
}

export function useFollow(targetUserId: string | null) {
  const [stats, setStats] = useState<FollowStats>({
    followers: 0,
    following: 0,
    iFollow: false,
    myId: null,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!targetUserId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const me = user?.id ?? null;

    const [{ count: followers }, { count: following }, { data: link }] =
      await Promise.all([
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("followed_id", targetUserId),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", targetUserId),
        me
          ? supabase
              .from("follows")
              .select("follower_id")
              .eq("follower_id", me)
              .eq("followed_id", targetUserId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    setStats({
      followers: followers ?? 0,
      following: following ?? 0,
      iFollow: !!link,
      myId: me,
    });
    setLoading(false);
  }, [targetUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(async () => {
    if (!targetUserId || !stats.myId) return;
    if (stats.iFollow) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", stats.myId)
        .eq("followed_id", targetUserId);
      setStats((s) => ({ ...s, iFollow: false, followers: Math.max(0, s.followers - 1) }));
    } else {
      await supabase
        .from("follows")
        .insert({ follower_id: stats.myId, followed_id: targetUserId });
      setStats((s) => ({ ...s, iFollow: true, followers: s.followers + 1 }));
    }
  }, [targetUserId, stats.myId, stats.iFollow]);

  return { stats, loading, toggle, reload: load };
}
