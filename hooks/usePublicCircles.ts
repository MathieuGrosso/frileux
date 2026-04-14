import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Circle } from "@/lib/types";

export interface UsePublicCirclesResult {
  circles: Circle[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

const PAGE = 50;

export function usePublicCircles(): UsePublicCirclesResult {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (nextOffset: number, replace: boolean) => {
    const { data, error: err } = await supabase.rpc("list_public_circles", {
      page_limit: PAGE,
      page_offset: nextOffset,
    });
    if (err) {
      setError(err.message);
      return;
    }
    const list = (data as Circle[]) ?? [];
    setHasMore(list.length === PAGE);
    setCircles((prev) => (replace ? list : [...prev, ...list]));
    setOffset(nextOffset + list.length);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    await fetchPage(0, true);
    setRefreshing(false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || refreshing) return;
    await fetchPage(offset, false);
  }, [fetchPage, hasMore, loading, refreshing, offset]);

  useEffect(() => {
    (async () => {
      setError(null);
      await fetchPage(0, true);
      setLoading(false);
    })();
  }, [fetchPage]);

  return { circles, loading, refreshing, error, refresh, loadMore, hasMore };
}

export async function joinPublicCircle(circleId: string): Promise<Circle | null> {
  const { data, error } = await supabase.rpc("join_public_circle", {
    target_circle_id: circleId,
  });
  if (error || !data) return null;
  return data as Circle;
}
