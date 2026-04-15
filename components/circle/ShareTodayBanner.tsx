import { useCallback, useEffect, useState } from "react";
import { View, Text } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { supabase } from "@/lib/supabase";
import { localDateISO } from "@/lib/dates";

interface Props {
  circleId: string;
  userId: string;
  onShared: () => void;
}

export function ShareTodayBanner({ circleId, userId, onShared }: Props) {
  const [outfitId, setOutfitId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const check = useCallback(async () => {
    const today = localDateISO();
    const { data } = await supabase
      .from("outfits")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .not("photo_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data as { id: string }[] | null)?.[0];
    if (!row) {
      setOutfitId(null);
      return;
    }
    const { data: share } = await supabase
      .from("outfit_shares")
      .select("outfit_id")
      .eq("outfit_id", row.id)
      .eq("circle_id", circleId)
      .maybeSingle();
    setOutfitId(share ? null : row.id);
  }, [circleId, userId]);

  useEffect(() => {
    void check();
  }, [check]);

  async function share() {
    if (!outfitId || sharing) return;
    setSharing(true);
    const { error } = await supabase
      .from("outfit_shares")
      .insert({ outfit_id: outfitId, circle_id: circleId });
    setSharing(false);
    if (error) {
      console.warn("share today outfit", error);
      return;
    }
    setOutfitId(null);
    onShared();
  }

  if (!outfitId) return null;

  return (
    <View className="mt-4 mb-2 border border-ink-100 px-4 py-4 flex-row items-center">
      <View className="flex-1 pr-3">
        <Text
          className="font-body-semibold text-ink-900"
          style={{ fontSize: 11, letterSpacing: 2 }}
        >
          TA TENUE DU JOUR N&apos;EST PAS ICI
        </Text>
        <Text
          className="font-body text-ink-500 mt-1"
          style={{ fontSize: 12 }}
        >
          Partage-la dans ce cercle.
        </Text>
      </View>
      <PressableScale
        onPress={() => void share()}
        disabled={sharing}
        className="bg-ink-900 active:bg-ink-700 px-4 py-3"
        style={{ opacity: sharing ? 0.5 : 1 }}
      >
        <Text
          className="font-body-semibold text-paper-100"
          style={{ fontSize: 11, letterSpacing: 2 }}
        >
          {sharing ? "…" : "PARTAGER"}
        </Text>
      </PressableScale>
    </View>
  );
}
