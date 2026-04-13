export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  coldness_level: ColdnessLevel;
  push_token: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
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

export interface Circle {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface CircleMember {
  circle_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
}

export interface OutfitWithProfile extends Outfit {
  profile: Pick<Profile, "username" | "avatar_url">;
}

export interface AISuggestion {
  suggestion: string;
  layers: string[];
  accessories: string[];
  vibe: string;
}
