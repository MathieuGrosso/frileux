import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface CircleMemberLite {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

export function useCircleMembers(circleId: string | null | undefined): {
  members: CircleMemberLite[];
  loading: boolean;
} {
  const [members, setMembers] = useState<CircleMemberLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!circleId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("circle_members")
        .select("user_id, profile:profiles(username, avatar_url)")
        .eq("circle_id", circleId);
      if (cancelled) return;
      const list: CircleMemberLite[] = (data ?? [])
        .map((row) => {
          const r = row as unknown as {
            user_id: string;
            profile: { username: string | null; avatar_url: string | null } | null;
          };
          return {
            user_id: r.user_id,
            username: r.profile?.username ?? "",
            avatar_url: r.profile?.avatar_url ?? null,
          };
        })
        .filter((m) => m.username.length > 0);
      setMembers(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [circleId]);

  return { members, loading };
}
