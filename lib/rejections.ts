import { supabase } from "./supabase";
import type { WeatherData, OutfitOccasion } from "./types";

export type RejectionReason =
  | "too_warm"
  | "too_cold"
  | "too_formal"
  | "too_casual"
  | "deja_vu"
  | "autre";

export const REJECTION_REASONS: { value: RejectionReason; label: string; prompt: string }[] = [
  { value: "too_warm", label: "trop chaud", prompt: "la dernière était trop chaude" },
  { value: "too_cold", label: "trop froid", prompt: "la dernière était trop froide" },
  { value: "too_formal", label: "trop formel", prompt: "la dernière était trop formelle" },
  { value: "too_casual", label: "trop casual", prompt: "la dernière était trop casual" },
  { value: "deja_vu", label: "déjà vu", prompt: "propose une silhouette radicalement différente" },
  { value: "autre", label: "autre", prompt: "propose une silhouette différente" },
];

export interface RefinementChainItem {
  iteration: number;
  rejected_suggestion: string;
  reason: RejectionReason;
  reason_note?: string | null;
  steer_text?: string | null;
  steer_brands?: string[] | null;
}

export interface InsertRejectionResult {
  id: string | null;
  iteration: number;
}

export async function insertRejection(params: {
  suggestion_text: string;
  reason: RejectionReason;
  weather_data: WeatherData | null;
  occasion: OutfitOccasion | null;
  reason_note?: string | null;
  parent_rejection_id?: string | null;
  iteration_number?: number;
  steer_text?: string | null;
  steer_brands?: string[] | null;
}): Promise<InsertRejectionResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null, iteration: 1 };
  const iteration = params.iteration_number ?? 1;
  const { data, error } = await supabase
    .from("outfit_rejections")
    .insert({
      user_id: user.id,
      suggestion_text: params.suggestion_text,
      reason: params.reason,
      reason_note: params.reason_note ?? null,
      weather_data: params.weather_data,
      occasion: params.occasion,
      parent_rejection_id: params.parent_rejection_id ?? null,
      iteration_number: iteration,
      steer_text: params.steer_text ?? null,
      steer_brands: params.steer_brands ?? null,
    })
    .select("id")
    .single();
  if (error && __DEV__) console.warn("insertRejection failed:", error.message);
  return { id: (data?.id as string | undefined) ?? null, iteration };
}

export async function loadTodayRefinementChain(limit = 5): Promise<RefinementChainItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("outfit_rejections")
    .select("iteration_number, suggestion_text, reason, reason_note, steer_text, steer_brands")
    .eq("user_id", user.id)
    .eq("date", today)
    .order("iteration_number", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => ({
    iteration: (row.iteration_number as number) ?? 1,
    rejected_suggestion: (row.suggestion_text as string) ?? "",
    reason: (row.reason as RejectionReason) ?? "autre",
    reason_note: (row.reason_note as string | null) ?? null,
    steer_text: (row.steer_text as string | null) ?? null,
    steer_brands: (row.steer_brands as string[] | null) ?? null,
  }));
}
