import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const CHANNEL_NAME = "user_presence";

let sharedChannel: RealtimeChannel | null = null;
let sharedOnline: Set<string> = new Set();
const listeners = new Set<(online: Set<string>) => void>();

async function ensureChannel() {
  if (sharedChannel) return sharedChannel;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  sharedChannel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: user.id } },
  });

  sharedChannel.on("presence", { event: "sync" }, () => {
    if (!sharedChannel) return;
    const state = sharedChannel.presenceState();
    const next = new Set<string>(Object.keys(state));
    sharedOnline = next;
    for (const fn of listeners) fn(next);
  });

  sharedChannel.subscribe(async (status) => {
    if (status === "SUBSCRIBED" && sharedChannel) {
      await sharedChannel.track({ at: Date.now() });
    }
  });

  return sharedChannel;
}

export function usePresence() {
  const [online, setOnline] = useState<Set<string>>(sharedOnline);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void ensureChannel();
    const listener = (next: Set<string>) => {
      if (mounted.current) setOnline(next);
    };
    listeners.add(listener);
    return () => {
      mounted.current = false;
      listeners.delete(listener);
    };
  }, []);

  return { online, isOnline: (userId: string) => online.has(userId) };
}
