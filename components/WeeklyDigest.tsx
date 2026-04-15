import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { supabase } from "@/lib/supabase";

interface Stats {
  count: number;
  avgScore: number | null;
  loaded: boolean;
}

const EMPTY: Stats = { count: 0, avgScore: null, loaded: false };

function startOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay();
  const offset = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

export function WeeklyDigest() {
  const [stats, setStats] = useState<Stats>(EMPTY);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const since = startOfWeekISO();
      const { data } = await supabase
        .from("outfits")
        .select("critique_score")
        .eq("user_id", user.id)
        .gte("date", since);
      if (!active || !data) return;
      const count = data.length;
      const scores = data
        .map((o) => o.critique_score as number | null)
        .filter((s): s is number => typeof s === "number");
      const avgScore = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;
      setStats({ count, avgScore, loaded: true });
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!stats.loaded || stats.count === 0) return null;

  return (
    <View className="border border-paper-300 px-3 py-2 self-start mb-4 flex-row items-baseline">
      <Text className="font-body-medium text-eyebrow text-ink-500 uppercase tracking-widest">
        Cette semaine
      </Text>
      <Text className="font-body text-caption text-ink-700 ml-3">
        {stats.count} tenue{stats.count > 1 ? "s" : ""}
      </Text>
      {stats.avgScore !== null && (
        <>
          <Text className="font-body text-caption text-ink-300 mx-2">·</Text>
          <Text className="font-body text-caption text-ink-700">
            score {stats.avgScore.toString().replace(".", ",")}/10
          </Text>
        </>
      )}
    </View>
  );
}
