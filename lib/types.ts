export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  coldness_level: ColdnessLevel;
  push_token: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  onboarding_completed: boolean;
  taste_completed: boolean;
  gender_presentation: GenderPresentation | null;
  style_universes: string[];
  favorite_brands: string[];
  avoid_tags: string[];
  fit_preference: FitPreference | null;
  height_cm: number | null;
  build: Build | null;
  shoe_size_eu: number | null;
  created_at: string;
  updated_at: string;
}

export type GenderPresentation = "menswear" | "womenswear" | "both";
export type FitPreference = "relaxed" | "regular" | "slim";
export type Build = "petite" | "slim" | "athletic" | "curvy" | "strong" | "tall";

export interface Morphology {
  height_cm: number | null;
  build: Build | null;
  shoe_size_eu: number | null;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  universe: string[];
  tier: "luxury" | "designer" | "contemporary" | "street" | "technical" | "heritage" | null;
}

export interface TasteProfile {
  gender_presentation: GenderPresentation | null;
  style_universes: string[];
  favorite_brands: string[];
  avoid_tags: string[];
  fit_preference: FitPreference | null;
}

export type WardrobeItemType = "top" | "bottom" | "outerwear" | "shoes" | "accessory";

export interface WardrobeItem {
  id: string;
  user_id: string;
  photo_url: string | null;
  type: WardrobeItemType;
  color: string | null;
  material: string | null;
  style_tags: string[];
  description: string;
  created_at: string;
}

export interface ClothingAnalysis {
  type: WardrobeItemType;
  color: string;
  material: string | null;
  style_tags: string[];
  description: string;
  photo_url?: string | null;
}

export interface OutfitCombo {
  item_ids: string[];
  rationale: string;
}

export interface PieceSuggestion {
  type: WardrobeItemType;
  description: string;
  rationale: string;
}

export type SwipeCardPayload =
  | { kind: "combo"; combo: OutfitCombo; items: WardrobeItem[] }
  | { kind: "suggestion"; suggestion: PieceSuggestion };

export type ColdnessLevel = 1 | 2 | 3 | 4 | 5;
// 1 = "un peu frileuse" → 5 = "je vis en doudoune"

export type OutfitOccasion =
  | "casual"
  | "travail"
  | "sortie"
  | "soiree"
  | "sport"
  | "repos";

export const OUTFIT_OCCASIONS: { value: OutfitOccasion; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "travail", label: "Travail" },
  { value: "sortie", label: "Sortie" },
  { value: "soiree", label: "Soirée" },
  { value: "sport", label: "Sport" },
  { value: "repos", label: "Repos" },
];

export type ThermalFeeling = "too_cold" | "just_right" | "too_warm";

export const THERMAL_FEELINGS: { value: ThermalFeeling; label: string }[] = [
  { value: "too_cold", label: "Trop froid" },
  { value: "just_right", label: "Pile bien" },
  { value: "too_warm", label: "Trop chaud" },
];

export interface OutfitCritique {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  weather_note: string | null;
  vs_suggestion: string | null;
}

export interface Outfit {
  id: string;
  user_id: string;
  photo_url: string;
  date: string; // YYYY-MM-DD
  weather_data: WeatherData;
  rating: number | null; // 1-5
  notes: string | null;
  ai_suggestion: string | null;
  worn_description: string | null;
  occasion: OutfitOccasion | null;
  thermal_feeling: ThermalFeeling | null;
  critique: OutfitCritique | null;
  critique_score: number | null;
  created_at: string;
}

export interface DayForecastSlot {
  hour: number;
  temp: number;
  icon: string;
  rain: boolean;
}

export interface DayForecast {
  morning: DayForecastSlot | null;
  midday: DayForecastSlot | null;
  evening: DayForecastSlot | null;
}

export interface WeatherData {
  temp: number; // Celsius
  feels_like: number;
  humidity: number;
  wind_speed: number; // m/s
  description: string; // "ciel dégagé", "pluie légère", etc.
  icon: string; // OpenWeatherMap icon code
  rain: boolean;
  snow: boolean;
  uv_index: number;
}

export type CircleVisibility = "private" | "public";

export interface Circle {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  visibility?: CircleVisibility;
  slug?: string | null;
  description?: string | null;
  accent_hue?: number | null;
  member_count?: number;
  last_activity_at?: string;
  is_featured?: boolean;
}

export interface PublicCirclePreview extends Circle {
  members_preview: Pick<Profile, "id" | "username" | "avatar_url">[];
  recent_outfits: { id: string; photo_url: string }[];
}

export interface CircleMember {
  circle_id: string;
  user_id: string;
  joined_at: string;
  last_read_at?: string | null;
  profile?: Profile;
}

export interface CircleMessage {
  id: string;
  circle_id: string;
  user_id: string;
  body: string;
  mentions?: string[];
  created_at: string;
  profile?: Pick<Profile, "username" | "avatar_url">;
}

export interface OutfitWithProfile extends Outfit {
  profile: Pick<Profile, "username" | "avatar_url">;
  notes_count?: number;
}

export interface OutfitComment {
  id: string;
  outfit_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: Pick<Profile, "username" | "avatar_url">;
}

export interface AISuggestion {
  suggestion: string;
  layers: string[];
  accessories: string[];
  vibe: string;
}
