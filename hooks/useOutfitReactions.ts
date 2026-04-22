import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type OutfitReactionKind = "fit" | "color" | "styling" | "piece";

export const OUTFIT_REACTION_KINDS: OutfitReactionKind[] = [
  "fit",
  "color",
  "styling",
  "piece",
];

export const OUTFIT_REACTION_LABELS: Record<OutfitReactionKind, string> = {
  fit: "FIT",
  color: "COLOR",
  styling: "STYLING",
  piece: "PIECE",
};

export type ReactionCounts = Record<OutfitReactionKind, number>;

const EMPTY_COUNTS: ReactionCounts = { fit: 0, color: 0, styling: 0, piece: 0 };

interface Options {
  realtime?: boolean;
}

export function useOutfitReactions(
  outfitId: string | null,
  opts: Options = {},
) {
  const [counts, setCounts] = useState<ReactionCounts>(EMPTY_COUNTS);
  const [mine, setMine] = useState<Set<OutfitReactionKind>>(() => new Set());
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef<Set<OutfitReactionKind>>(new Set());

  const load = useCallback(async () => {
    if (!outfitId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const me = user?.id ?? null;
    setMyId(me);

    const { data, error } = await supabase
      .from("outfit_reactions")
      .select("kind, user_id")
      .eq("outfit_id", outfitId);

    if (error || !data) {
      setCounts(EMPTY_COUNTS);
      setMine(new Set());
      setLoading(false);
      return;
    }

    const nextCounts: ReactionCounts = { ...EMPTY_COUNTS };
    const nextMine = new Set<OutfitReactionKind>();
    for (const row of data) {
      const kind = row.kind as OutfitReactionKind;
      nextCounts[kind] = (nextCounts[kind] ?? 0) + 1;
      if (me && row.user_id === me) nextMine.add(kind);
    }
    setCounts(nextCounts);
    setMine(nextMine);
    setLoading(false);
  }, [outfitId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!outfitId || !opts.realtime) return;
    const channel = supabase
      .channel(`outfit-reactions-${outfitId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "outfit_reactions",
          filter: `outfit_id=eq.${outfitId}`,
        },
        () => { void load(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [outfitId, opts.realtime, load]);

  const toggle = useCallback(
    async (kind: OutfitReactionKind) => {
      if (!outfitId || !myId) return;
      if (inFlight.current.has(kind)) return;
      inFlight.current.add(kind);

      const hasIt = mine.has(kind);

      setMine((prev) => {
        const next = new Set(prev);
        if (hasIt) next.delete(kind);
        else next.add(kind);
        return next;
      });
      setCounts((prev) => ({
        ...prev,
        [kind]: Math.max(0, prev[kind] + (hasIt ? -1 : 1)),
      }));

      try {
        if (hasIt) {
          await supabase
            .from("outfit_reactions")
            .delete()
            .eq("outfit_id", outfitId)
            .eq("user_id", myId)
            .eq("kind", kind);
        } else {
          await supabase
            .from("outfit_reactions")
            .insert({ outfit_id: outfitId, user_id: myId, kind });
        }
      } finally {
        inFlight.current.delete(kind);
      }
    },
    [outfitId, myId, mine],
  );

  return { counts, mine, myId, loading, toggle, reload: load };
}
