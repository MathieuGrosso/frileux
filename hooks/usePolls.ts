import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface PollOption {
  id: string;
  poll_id: string;
  label: string | null;
  image_path: string | null;
  image_url: string | null;
  position: number;
  votes: number;
}

export interface Poll {
  id: string;
  circle_id: string;
  author_id: string;
  question: string;
  created_at: string;
  closes_at: string;
  options: PollOption[];
  total_votes: number;
  my_option_id: string | null;
  closed: boolean;
}

function publicUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("polls").getPublicUrl(path);
  return data.publicUrl;
}

export function usePolls(circleId: string | null) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!circleId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: rows } = await supabase
      .from("polls")
      .select("id, circle_id, author_id, question, created_at, closes_at, poll_options(id, poll_id, label, image_path, position)")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(30);

    type Row = {
      id: string;
      circle_id: string;
      author_id: string;
      question: string;
      created_at: string;
      closes_at: string;
      poll_options: {
        id: string;
        poll_id: string;
        label: string | null;
        image_path: string | null;
        position: number;
      }[];
    };
    const list = ((rows as unknown as Row[]) ?? []);
    const pollIds = list.map((p) => p.id);
    if (pollIds.length === 0) {
      setPolls([]);
      setLoading(false);
      return;
    }

    const { data: votes } = await supabase
      .from("poll_votes")
      .select("poll_id, user_id, option_id")
      .in("poll_id", pollIds);
    type VoteRow = { poll_id: string; user_id: string; option_id: string };
    const voteList = (votes as VoteRow[]) ?? [];

    const polls: Poll[] = list.map((r) => {
      const myVote = voteList.find((v) => v.poll_id === r.id && v.user_id === user.id);
      const options: PollOption[] = r.poll_options
        .sort((a, b) => a.position - b.position)
        .map((o) => ({
          ...o,
          image_url: publicUrl(o.image_path),
          votes: voteList.filter((v) => v.option_id === o.id).length,
        }));
      const total = options.reduce((sum, o) => sum + o.votes, 0);
      return {
        id: r.id,
        circle_id: r.circle_id,
        author_id: r.author_id,
        question: r.question,
        created_at: r.created_at,
        closes_at: r.closes_at,
        options,
        total_votes: total,
        my_option_id: myVote?.option_id ?? null,
        closed: new Date(r.closes_at) <= new Date(),
      };
    });
    setPolls(polls);
    setLoading(false);
  }, [circleId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!circleId) return;
    const ch = supabase
      .channel(`polls-${circleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "polls" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, () => {
        void load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [circleId, load]);

  const vote = useCallback(
    async (pollId: string, optionId: string) => {
      if (!userId) return;
      await supabase
        .from("poll_votes")
        .upsert(
          { poll_id: pollId, user_id: userId, option_id: optionId },
          { onConflict: "poll_id,user_id" },
        );
    },
    [userId],
  );

  return { polls, loading, userId, vote, reload: load };
}
