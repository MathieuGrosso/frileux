import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Circle, OutfitWithProfile } from "@/lib/types";

export interface UseCircleResult {
  circle: Circle | null;
  outfits: OutfitWithProfile[];
  loading: boolean;
  refreshing: boolean;
  userId: string | null;
  reload: () => Promise<void>;
  createCircle: () => Promise<Circle | null>;
  joinCircle: (code: string) => Promise<Circle | null>;
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

export function useCircle(): UseCircleResult {
  const [circle, setCircle] = useState<Circle | null>(null);
  const [outfits, setOutfits] = useState<OutfitWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadOutfits = useCallback(async (circleId: string, currentUserId: string) => {
    const { data: members } = await supabase
      .from("circle_members")
      .select("user_id")
      .eq("circle_id", circleId);

    if (!members) {
      setOutfits([]);
      return;
    }

    const memberIds = members
      .map((m) => m.user_id)
      .filter((id) => id !== currentUserId);

    if (memberIds.length === 0) {
      setOutfits([]);
      return;
    }

    const { data } = await supabase
      .from("outfits")
      .select("*, profile:profiles(username, avatar_url)")
      .in("user_id", memberIds)
      .eq("date", todayIso())
      .order("created_at", { ascending: false });

    setOutfits((data as unknown as OutfitWithProfile[]) ?? []);
  }, []);

  const reload = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: membership } = await supabase
      .from("circle_members")
      .select("circle_id, circles(*)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membership?.circles) {
      const c = membership.circles as unknown as Circle;
      setCircle(c);
      await loadOutfits(c.id, user.id);
    } else {
      setCircle(null);
      setOutfits([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [loadOutfits]);

  useEffect(() => {
    void reload();
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
    setCircle(created);
    return created;
  }, []);

  const joinCircle = useCallback(async (code: string): Promise<Circle | null> => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: circleData } = await supabase
      .from("circles")
      .select()
      .eq("invite_code", trimmed)
      .single();

    if (!circleData) return null;

    const { error } = await supabase.from("circle_members").insert({
      circle_id: circleData.id,
      user_id: user.id,
    });
    if (error) return null;

    const joined = circleData as Circle;
    setCircle(joined);
    await loadOutfits(joined.id, user.id);
    return joined;
  }, [loadOutfits]);

  return {
    circle,
    outfits,
    loading,
    refreshing,
    userId,
    reload,
    createCircle,
    joinCircle,
  };
}
