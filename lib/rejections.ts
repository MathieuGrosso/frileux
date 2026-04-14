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

export async function insertRejection(params: {
  suggestion_text: string;
  reason: RejectionReason;
  weather_data: WeatherData | null;
  occasion: OutfitOccasion | null;
  reason_note?: string | null;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("outfit_rejections").insert({
    user_id: user.id,
    suggestion_text: params.suggestion_text,
    reason: params.reason,
    reason_note: params.reason_note ?? null,
    weather_data: params.weather_data,
    occasion: params.occasion,
  });
  if (error && __DEV__) console.warn("insertRejection failed:", error.message);
}
