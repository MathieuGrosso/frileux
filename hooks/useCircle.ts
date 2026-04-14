import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { Circle, OutfitWithProfile } from "@/lib/types";

const ACTIVE_CIRCLE_KEY = "frileux.circle.active";
const VIEW_MODE_PREFIX = "frileux.circle.viewMode.";

export type CircleViewMode = "today" | "week";

export interface UseCircleResult {
  circles: Circle[];
  circle: Circle | null;
  outfits: OutfitWithProfile[];
  memberCount: number;
  loading: boolean;
  refreshing: boolean;
  userId: string | null;
  viewMode: CircleViewMode;
  setViewMode: (mode: CircleViewMode) => Promise<void>;
  setActiveCircleId: (id: string) => Promise<void>;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  createCircle: () => Promise<Circle | null>;
  joinCircle: (code: string) => Promise<Circle | null>;
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function weekAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split("T")[0];
}

export function useCircle(): UseCircleResult {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [outfits, setOutfits] = useState<OutfitWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [viewMode, setViewModeState] = useState<CircleViewMode>("today");
  const [memberCount, setMemberCount] = useState(0);

  const circle = circles.find((c) => c.id === activeId) ?? null;

  const loadOutfits = useCallback(async (
    circleId: string,
    currentUserId: string,
    mode: CircleViewMode,
  ) => {
    const { data: members } = await supabase
      .from("circle_members")
      .select("user_id")
      .eq("circle_id", circleId);

    if (!members) {
      setMemberCount(0);
      setOutfits([]);
      return;
    }

    setMemberCount(members.length);

    const memberIds = members
      .map((m) => m.user_id)
      .filter((id) => id !== currentUserId);

    if (memberIds.length === 0) {
      setOutfits([]);
      return;
    }

    let query = supabase
      .from("outfits")
      .select("*, profile:profiles(username, avatar_url)")
      .in("user_id", memberIds)
      .order("created_at", { ascending: false });

    if (mode === "today") {
      query = query.eq("date", todayIso());
    } else {
      query = query.gte("date", weekAgoIso()).lte("date", todayIso());
    }

    const { data } = await query;
    const list = (data as unknown as OutfitWithProfile[]) ?? [];

    if (list.length === 0) {
      setOutfits([]);
      return;
    }

    const ids = list.map((o) => o.id);
    const { data: comments } = await supabase
      .from("outfit_comments")
      .select("outfit_id")
      .in("outfit_id", ids);
    const counts = new Map<string, number>();
    (comments ?? []).forEach((c) => {
      const k = (c as { outfit_id: string }).outfit_id;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });

    setOutfits(list.map((o) => ({ ...o, notes_count: counts.get(o.id) ?? 0 })));
  }, []);

  const reload = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: memberships } = await supabase
      .from("circle_members")
      .select("circles(*)")
      .eq("user_id", user.id);

    const list: Circle[] = (memberships ?? [])
      .map((m) => m.circles as unknown as Circle)
      .filter((c): c is Circle => !!c);
    setCircles(list);

    if (list.length === 0) {
      setActiveId(null);
      setOutfits([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const stored = await AsyncStorage.getItem(ACTIVE_CIRCLE_KEY);
    const nextId =
      stored && list.some((c) => c.id === stored) ? stored : list[0].id;
    setActiveId(nextId);

    const storedMode = await AsyncStorage.getItem(VIEW_MODE_PREFIX + nextId);
    const mode: CircleViewMode = storedMode === "week" ? "week" : "today";
    setViewModeState(mode);

    await loadOutfits(nextId, user.id, mode);

    setLoading(false);
    setRefreshing(false);
  }, [loadOutfits]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!circle || !userId) return;
    const today = todayIso();
    const channel = supabase
      .channel(`circle-outfits-${circle.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "outfits" },
        async (payload) => {
          const row = payload.new as { id: string; user_id: string; date: string };
          if (row.user_id === userId) return;
          if (viewMode === "today" && row.date !== today) return;
          if (viewMode === "week" && row.date < weekAgoIso()) return;

          const { data: membership } = await supabase
            .from("circle_members")
            .select("user_id")
            .eq("circle_id", circle.id)
            .eq("user_id", row.user_id)
            .maybeSingle();
          if (!membership) return;

          const { data: full } = await supabase
            .from("outfits")
            .select("*, profile:profiles(username, avatar_url)")
            .eq("id", row.id)
            .single();
          if (!full) return;

          setOutfits((prev) => {
            if (prev.some((o) => o.id === full.id)) return prev;
            return [full as unknown as OutfitWithProfile, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "outfits" },
        async (payload) => {
          const row = payload.new as { id: string; user_id: string };
          if (row.user_id === userId) return;

          setOutfits((prev) => {
            if (!prev.some((o) => o.id === row.id)) return prev;
            return prev.map((o) =>
              o.id === row.id
                ? ({ ...o, ...(payload.new as Partial<OutfitWithProfile>) })
                : o,
            );
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "outfits" },
        (payload) => {
          const row = payload.old as { id: string };
          setOutfits((prev) => prev.filter((o) => o.id !== row.id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circle, userId, viewMode]);

  const setActiveCircleId = useCallback(async (id: string) => {
    if (!userId) return;
    setActiveId(id);
    setOutfits([]);
    await AsyncStorage.setItem(ACTIVE_CIRCLE_KEY, id);
    const storedMode = await AsyncStorage.getItem(VIEW_MODE_PREFIX + id);
    const mode: CircleViewMode = storedMode === "week" ? "week" : "today";
    setViewModeState(mode);
    await loadOutfits(id, userId, mode);
  }, [userId, loadOutfits]);

  const setViewMode = useCallback(async (mode: CircleViewMode) => {
    if (!userId || !activeId) return;
    setViewModeState(mode);
    await AsyncStorage.setItem(VIEW_MODE_PREFIX + activeId, mode);
    await loadOutfits(activeId, userId, mode);
  }, [userId, activeId, loadOutfits]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
  }, [reload]);

  const createCircle = useCallback(async (): Promise<Circle | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const code = generateInviteCode();
    const { data, error } = await supabase
      .from("circles")
      .insert({ name: "Mon cercle", invite_code: code, created_by: user.id })
      .select()
      .single();

    if (error || !data) return null;

    await supabase.from("circle_members").insert({ circle_id: data.id, user_id: user.id });
    const created = data as Circle;
    setCircles((prev) => [...prev, created]);
    setActiveId(created.id);
    await AsyncStorage.setItem(ACTIVE_CIRCLE_KEY, created.id);
    return created;
  }, []);

  const joinCircle = useCallback(async (code: string): Promise<Circle | null> => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: circleData, error } = await supabase.rpc("join_circle_by_code", {
      code: trimmed,
    });
    if (error || !circleData) return null;

    const joined = circleData as Circle;
    setCircles((prev) => (prev.some((c) => c.id === joined.id) ? prev : [...prev, joined]));
    setActiveId(joined.id);
    await AsyncStorage.setItem(ACTIVE_CIRCLE_KEY, joined.id);
    setViewModeState("today");
    await loadOutfits(joined.id, user.id, "today");
    return joined;
  }, [loadOutfits]);

  return {
    circles,
    circle,
    outfits,
    memberCount,
    loading,
    refreshing,
    userId,
    viewMode,
    setViewMode,
    setActiveCircleId,
    reload,
    refresh,
    createCircle,
    joinCircle,
  };
}
