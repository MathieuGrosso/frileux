import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { OutfitWithProfile } from "@/lib/types";

const PAGE_SIZE = 20;

interface UseFeedReturn {
  outfits: OutfitWithProfile[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useFeed(): UseFeedReturn {
  const [outfits, setOutfits] = useState<OutfitWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const fetchPage = useCallback(
    async (offset: number): Promise<OutfitWithProfile[]> => {
      const { data, error } = await supabase
        .from("outfits")
        .select(
          "*, profile:profiles!outfits_user_id_fkey(username, avatar_url)",
        )
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        console.warn("[useFeed] fetch error", error);
        return [];
      }
      return (data ?? []) as unknown as OutfitWithProfile[];
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchPage(0);
    offsetRef.current = rows.length;
    setOutfits(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [fetchPage]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const rows = await fetchPage(0);
    offsetRef.current = rows.length;
    setOutfits(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setRefreshing(false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const rows = await fetchPage(offsetRef.current);
    offsetRef.current += rows.length;
    setOutfits((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [fetchPage, loadingMore, hasMore]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("feed-outfits")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "outfits" },
        (payload) => {
          const row = payload.new as { is_public?: boolean; id?: string };
          if (!row.is_public || !row.id) return;
          void supabase
            .from("outfits")
            .select(
              "*, profile:profiles!outfits_user_id_fkey(username, avatar_url)",
            )
            .eq("id", row.id)
            .maybeSingle()
            .then(({ data }) => {
              if (!data) return;
              setOutfits((prev) => {
                if (prev.some((o) => o.id === data.id)) return prev;
                return [data as unknown as OutfitWithProfile, ...prev];
              });
            });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { outfits, loading, refreshing, loadingMore, hasMore, refresh, loadMore };
}
