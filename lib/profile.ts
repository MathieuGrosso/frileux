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

export interface WardrobePiece {
  id?: string;
  photo_url?: string | null;
  type: string;
  color: string | null;
  material: string | null;
  style_tags: string[];
  description: string;
}

export interface ProfileBundle {
  userId: string | null;
  coldness: ColdnessLevel;
  taste: ProfileTaste | undefined;
  recent_worn: string[];
  recent_feedback: RecentFeedback[];
  liked_anchors: string[];
  derived_prefs: string[];
  wardrobe: WardrobePiece[];
  wardrobeOnlyMode: boolean;
}

const EMPTY_BUNDLE: ProfileBundle = {
  userId: null,
  coldness: 3,
  taste: undefined,
  recent_worn: [],
  recent_feedback: [],
  liked_anchors: [],
  derived_prefs: [],
  wardrobe: [],
  wardrobeOnlyMode: false,
};

const REJECTION_REASON_TO_PREF: Record<string, string> = {
  too_warm: "tendance à proposer trop chaud → baisse d'un cran la warmth par défaut",
  too_cold: "tendance à proposer trop froid → monte d'un cran la warmth par défaut",
  too_formal: "tendance à proposer trop formel → va plus casual par défaut",
  too_casual: "tendance à proposer trop casual → monte d'un cran la formalité",
  deja_vu: "tendance à proposer des silhouettes répétitives → varie matières et coupes",
};

function buildDerivedPrefs(rejections: { reason: string | null }[]): string[] {
  const counts: Record<string, number> = {};
  for (const r of rejections) {
    if (!r.reason) continue;
    counts[r.reason] = (counts[r.reason] ?? 0) + 1;
  }
  const out: string[] = [];
  for (const [reason, count] of Object.entries(counts)) {
    if (count < 3) continue;
    const pref = REJECTION_REASON_TO_PREF[reason];
    if (pref) out.push(`${count}× rejet "${reason}" ce mois → ${pref}`);
  }
  return out;
}

export async function loadProfileBundle(): Promise<ProfileBundle> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_BUNDLE;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    profileRes,
    outfitsRes,
    likedRes,
    rejectionsRes,
    wardrobeRes,
    swipesRes,
    tasteProbesRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "coldness_level, gender_presentation, style_universes, favorite_brands, avoid_tags, fit_preference, build, height_cm, shoe_size_eu, wardrobe_only_mode"
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
    supabase
      .from("outfits")
      .select("worn_description, ai_suggestion, rating")
      .eq("user_id", user.id)
      .gte("rating", 4)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("outfit_rejections")
      .select("reason")
      .eq("user_id", user.id)
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0]),
    supabase
      .from("wardrobe_items")
      .select("id, photo_url, type, color, material, style_tags, description")
      .eq("user_id", user.id)
      .limit(80),
    supabase
      .from("outfit_preferences")
      .select("kind, payload, accepted, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("taste_probes")
      .select("axis, option_a_text, option_a_tags, option_b_text, option_b_tags, chosen, judged_at")
      .eq("user_id", user.id)
      .not("judged_at", "is", null)
      .order("judged_at", { ascending: false })
      .limit(30),
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

  const liked_anchors = (likedRes.data ?? [])
    .map((o) => (o.worn_description ?? o.ai_suggestion) as string | null)
    .filter((v): v is string => !!v && v.trim().length > 0);

  const base_prefs = buildDerivedPrefs(
    (rejectionsRes.data ?? []).map((r) => ({ reason: r.reason as string | null }))
  );

  const { data: regrettedRows } = await supabase
    .from("outfits")
    .select("worn_description")
    .eq("user_id", user.id)
    .eq("regretted", true)
    .order("date", { ascending: false })
    .limit(5);
  const regret_prefs = (regrettedRows ?? [])
    .map((r) => r.worn_description as string | null)
    .filter((v): v is string => !!v && v.trim().length > 0)
    .map((d) => `regretté récemment (à éviter de réitérer) : ${d.slice(0, 140)}`);

  const { data: memoryRows } = await supabase
    .from("style_memory")
    .select("id, fact, kind, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);
  const memory_prefs = (memoryRows ?? []).map((m) => {
    const tag = m.kind === "strength" ? "fonctionne bien" : m.kind === "avoid" ? "à éviter" : "pattern";
    return `mémoire (${tag}) : ${m.fact}`;
  });

  const swipes = (swipesRes.data ?? []) as Array<{
    kind: string;
    payload: Record<string, unknown> | null;
    accepted: boolean;
  }>;
  const acceptedSwipes = swipes.filter((s) => s.accepted === true);
  const rejectedSwipes = swipes.filter((s) => s.accepted === false);
  const describeSwipePayload = (s: { kind: string; payload: Record<string, unknown> | null }) => {
    const p = s.payload ?? {};
    const text =
      (p.description as string | undefined) ??
      (p.summary as string | undefined) ??
      (p.label as string | undefined) ??
      (p.name as string | undefined);
    return text ? text.slice(0, 140) : null;
  };
  const swipe_prefs: string[] = [];
  const acceptedSamples = acceptedSwipes
    .map(describeSwipePayload)
    .filter((v): v is string => !!v)
    .slice(0, 3);
  if (acceptedSamples.length > 0) {
    swipe_prefs.push(
      `swipes aimés (à reprendre comme esprit) : ${acceptedSamples.join(" | ")}`
    );
  }
  const rejectedSamples = rejectedSwipes
    .map(describeSwipePayload)
    .filter((v): v is string => !!v)
    .slice(0, 3);
  if (rejectedSamples.length > 0) {
    swipe_prefs.push(
      `swipes rejetés (à éviter d'imiter) : ${rejectedSamples.join(" | ")}`
    );
  }
  if (acceptedSwipes.length + rejectedSwipes.length >= 10) {
    const acceptRate = Math.round(
      (acceptedSwipes.length / (acceptedSwipes.length + rejectedSwipes.length)) * 100
    );
    swipe_prefs.push(`volume swipes : ${acceptedSwipes.length} aimés / ${rejectedSwipes.length} rejetés (${acceptRate}%)`);
  }

  const probes = (tasteProbesRes.data ?? []) as Array<{
    axis: string;
    option_a_tags: string[] | null;
    option_b_tags: string[] | null;
    chosen: string | null;
  }>;
  const tagCounts = new Map<string, { axis: string; count: number }>();
  for (const probe of probes) {
    const pickedTags = probe.chosen === "a"
      ? probe.option_a_tags
      : probe.chosen === "b"
      ? probe.option_b_tags
      : null;
    if (!pickedTags) continue;
    for (const tag of pickedTags) {
      if (!tag) continue;
      const key = `${probe.axis}:${tag}`;
      const prev = tagCounts.get(key);
      tagCounts.set(key, { axis: probe.axis, count: (prev?.count ?? 0) + 1 });
    }
  }
  const sortedTagPrefs = Array.from(tagCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([key, val]) => {
      const tag = key.split(":")[1];
      return `calibrage goût [${val.axis}] : penche vers ${tag} (${val.count}×)`;
    });

  // Priorité d'injection : signaux explicites (calibrage, mémoire) > patterns dérivés > volume swipe.
  // Max 10 — validation stricte côté edge.
  const derived_prefs = [
    ...sortedTagPrefs,
    ...memory_prefs,
    ...regret_prefs,
    ...swipe_prefs,
    ...base_prefs,
  ].slice(0, 10);

  const wardrobe: WardrobePiece[] = (wardrobeRes.data ?? []).map((w) => ({
    id: w.id as string,
    photo_url: (w.photo_url as string | null) ?? null,
    type: w.type as string,
    color: (w.color as string | null) ?? null,
    material: (w.material as string | null) ?? null,
    style_tags: (w.style_tags as string[] | null) ?? [],
    description: (w.description as string) ?? "",
  }));

  return {
    userId: user.id,
    coldness: (profile?.coldness_level ?? 3) as ColdnessLevel,
    taste,
    recent_worn,
    recent_feedback,
    liked_anchors,
    derived_prefs,
    wardrobe,
    wardrobeOnlyMode: Boolean(profile?.wardrobe_only_mode),
  };
}
