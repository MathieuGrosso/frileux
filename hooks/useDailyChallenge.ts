import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface DailyChallenge {
  id: string;
  date: string;
  theme_fr: string;
  prompt_fr: string | null;
}

export function useDailyChallenge() {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [myEntryOutfitId, setMyEntryOutfitId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: c } = await supabase
      .from("daily_challenges")
      .select("*")
      .eq("date", today)
      .maybeSingle();
    setChallenge(c as DailyChallenge | null);

    if (c) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: entry } = await supabase
          .from("challenge_entries")
          .select("outfit_id")
          .eq("challenge_id", (c as DailyChallenge).id)
          .eq("user_id", user.id)
          .maybeSingle();
        setMyEntryOutfitId((entry as { outfit_id: string } | null)?.outfit_id ?? null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { challenge, loading, myEntryOutfitId, reload: load };
}
