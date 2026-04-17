import { supabase } from "@/lib/supabase";

export interface TasteProbe {
  id: string;
  axis: string;
  axis_label_fr: string;
  option_a_text: string;
  option_a_tags: string[];
  option_b_text: string;
  option_b_tags: string[];
}

export interface TasteProbeBatch {
  batch_id: string;
  probes: TasteProbe[];
}

export const CALIBRATION_TARGET = 30;
export const CALIBRATION_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4h

export async function getJudgedCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from("taste_probes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("judged_at", "is", null);
  if (error) return 0;
  return count ?? 0;
}

export async function getLastProbeActivity(): Promise<Date | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("taste_probes")
    .select("judged_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const ts = (data.judged_at as string | null) ?? (data.created_at as string | null);
  return ts ? new Date(ts) : null;
}

export async function requestBatch(): Promise<TasteProbeBatch> {
  const { data, error } = await supabase.functions.invoke("daily-taste-probe", {
    body: {},
  });
  if (error) throw new Error(error.message ?? "daily-taste-probe failed");
  if (!data || !Array.isArray(data.probes) || !data.batch_id) {
    throw new Error("daily-taste-probe returned invalid payload");
  }
  return data as TasteProbeBatch;
}

export async function submitProbeChoice(
  probeId: string,
  chosen: "a" | "b" | "none",
): Promise<void> {
  const { error } = await supabase
    .from("taste_probes")
    .update({ chosen, judged_at: new Date().toISOString() })
    .eq("id", probeId);
  if (error && __DEV__) console.warn("submitProbeChoice:", error.message);
}

export async function shouldShowCalibrationGate(): Promise<boolean> {
  const judged = await getJudgedCount();
  if (judged >= CALIBRATION_TARGET) return false;
  const last = await getLastProbeActivity();
  if (!last) return true;
  return Date.now() - last.getTime() > CALIBRATION_COOLDOWN_MS;
}
