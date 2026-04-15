import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { localDateISO } from "@/lib/dates";

interface Props {
  circleId: string;
  userId: string;
  onShared?: () => void;
}

export function ShareTodayAction({ circleId, userId, onShared }: Props) {
  const [myOutfitId, setMyOutfitId] = useState<string | null>(null);
  const [alreadyShared, setAlreadyShared] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    const today = localDateISO();
    const { data: outfit, error: outfitErr } = await supabase
      .from("outfits")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (outfitErr) console.warn("share-today outfit", outfitErr);
    const outfitId = (outfit as { id: string } | null)?.id ?? null;
    setMyOutfitId(outfitId);

    if (!outfitId) {
      setAlreadyShared(true);
      setLoading(false);
      return;
    }

    const { data: share, error: shareErr } = await supabase
      .from("outfit_shares")
      .select("outfit_id")
      .eq("outfit_id", outfitId)
      .eq("circle_id", circleId)
      .maybeSingle();
    if (shareErr) console.warn("share-today check", shareErr);
    setAlreadyShared(!!share);
    setLoading(false);
  }, [circleId, userId]);

  useEffect(() => {
    void check();
  }, [check]);

  if (loading || !myOutfitId || alreadyShared) return null;

  async function share() {
    if (!myOutfitId) return;
    setSharing(true);
    const { error } = await supabase
      .from("outfit_shares")
      .upsert(
        { outfit_id: myOutfitId, circle_id: circleId },
        { onConflict: "outfit_id,circle_id", ignoreDuplicates: true },
      );
    setSharing(false);
    if (error) {
      console.warn("share-today insert", error);
      Alert.alert("Erreur", "Impossible de partager.");
      return;
    }
    setAlreadyShared(true);
    onShared?.();
  }

  return (
    <View className="mx-6 mb-4 border border-ink-900 px-4 py-3 flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text
          className="font-body-semibold text-ink-900 text-eyebrow"
          style={{ letterSpacing: 1.5 }}
        >
          TA TENUE DU JOUR N&apos;EST PAS ICI
        </Text>
        <Text className="font-body text-ink-500 mt-1" style={{ fontSize: 12 }}>
          Partage-la dans ce cercle.
        </Text>
      </View>
      <Pressable
        onPress={share}
        disabled={sharing}
        className="bg-ink-900 active:bg-ink-700 px-3 py-2"
      >
        <Text
          className="font-body-semibold text-paper-100 text-eyebrow"
          style={{ letterSpacing: 1.5 }}
        >
          {sharing ? "…" : "PARTAGER"}
        </Text>
      </Pressable>
    </View>
  );
}
