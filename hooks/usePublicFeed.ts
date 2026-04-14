import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface PublicFeedItem {
  id: string;
  user_id: string;
  photo_url: string;
  created_at: string;
  weather_data: { temp?: number } | null;
  profile: { username: string; avatar_url: string | null };
}

const PAGE = 30;

export function usePublicFeed() {
  const [items, setItems] = useState<PublicFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPage = useCallback(async (pageOffset: number, replace: boolean) => {
    const { data: publicCircles } = await supabase
      .from("circles")
      .select("id")
      .eq("visibility", "public");
    const circleIds = ((publicCircles as { id: string }[]) ?? []).map((c) => c.id);
    if (circleIds.length === 0) {
      setItems((prev) => (replace ? [] : prev));
      setHasMore(false);
      return;
    }

    const { data: memberRows } = await supabase
      .from("circle_members")
      .select("user_id")
      .in("circle_id", circleIds);
    const userIds = Array.from(
      new Set(((memberRows as { user_id: string }[]) ?? []).map((m) => m.user_id)),
    );
    if (userIds.length === 0) {
      setItems((prev) => (replace ? [] : prev));
      setHasMore(false);
      return;
    }

    const { data } = await supabase
      .from("outfits")
      .select("id, user_id, photo_url, created_at, weather_data, profile:profiles(username, avatar_url)")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .range(pageOffset, pageOffset + PAGE - 1);

    const list = (data as unknown as PublicFeedItem[]) ?? [];
    setHasMore(list.length === PAGE);
    setItems((prev) => (replace ? list : [...prev, ...list]));
    setOffset(pageOffset + list.length);
  }, []);

  useEffect(() => {
    (async () => {
      await fetchPage(0, true);
      setLoading(false);
    })();
  }, [fetchPage]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPage(0, true);
    setRefreshing(false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || refreshing) return;
    await fetchPage(offset, false);
  }, [hasMore, refreshing, offset, fetchPage]);

  return { items, loading, refreshing, hasMore, refresh, loadMore };
}
