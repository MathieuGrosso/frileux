import { supabase } from "./supabase";
import type {
  ColdnessLevel,
  OutfitOccasion,
  ThermalFeeling,
} from "./types";

export interface RecentFeedback {
  description: string;
  thermal: ThermalFeeling | null;
  occasion: OutfitOccasion | null;
  feels_like: number | null;
}

export interface ProfileTaste {
  gender_presentation: string | null;
  style_universes: string[];
  favorite_brands: string[];
  avoid_tags: string[];
  fit_preference: string | null;
  build: string | null;
  height_cm: number | null;
  shoe_size_eu: number | null;
}

export interface ProfileBundle {
  userId: string | null;
  coldness: ColdnessLevel;
  taste: ProfileTaste | undefined;
  recent_worn: string[];
  recent_feedback: RecentFeedback[];
}

const EMPTY_BUNDLE: ProfileBundle = {
  userId: null,
  coldness: 3,
  taste: undefined,
  recent_worn: [],
  recent_feedback: [],
};

export async function loadProfileBundle(): Promise<ProfileBundle> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_BUNDLE;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [profileRes, outfitsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "coldness_level, gender_presentation, style_universes, favorite_brands, avoid_tags, fit_preference, build, height_cm, shoe_size_eu"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("outfits")
      .select("worn_description, thermal_feeling, occasion, weather_data")
      .eq("user_id", user.id)
      .gte("date", sevenDaysAgo.toISOString().split("T")[0])
      .not("worn_description", "is", null)
      .order("date", { ascending: false })
      .limit(7),
  ]);

  const profile = profileRes.data;
  const rows = outfitsRes.data ?? [];

  const recent_worn = rows
    .map((o) => o.worn_description as string | null)
    .filter((w): w is string => !!w && w.trim().length > 0);

  const recent_feedback: RecentFeedback[] = rows
    .filter((o) => !!o.worn_description)
    .map((o) => ({
      description: o.worn_description as string,
      thermal: (o.thermal_feeling as ThermalFeeling | null) ?? null,
      occasion: (o.occasion as OutfitOccasion | null) ?? null,
      feels_like:
        (o.weather_data as { feels_like?: number } | null)?.feels_like ?? null,
    }));

  const taste: ProfileTaste | undefined = profile
    ? {
        gender_presentation: profile.gender_presentation ?? null,
        style_universes: profile.style_universes ?? [],
        favorite_brands: profile.favorite_brands ?? [],
        avoid_tags: profile.avoid_tags ?? [],
        fit_preference: profile.fit_preference ?? null,
        build: profile.build ?? null,
        height_cm: profile.height_cm ?? null,
        shoe_size_eu: profile.shoe_size_eu ?? null,
      }
    : undefined;

  return {
    userId: user.id,
    coldness: (profile?.coldness_level ?? 3) as ColdnessLevel,
    taste,
    recent_worn,
    recent_feedback,
  };
}
