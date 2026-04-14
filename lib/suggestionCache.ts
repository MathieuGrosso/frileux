import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ColdnessLevel, OutfitOccasion, WeatherData } from "./types";

export interface CachedSuggestion {
  text: string;
  imageUrl: string | null;
  weather: WeatherData;
  ts: number;
}

const TEMP_TOLERANCE = 2;

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function buildKey(params: {
  userId: string;
  coldness: ColdnessLevel;
  occasion: OutfitOccasion | null;
}): string {
  const { userId, coldness, occasion } = params;
  return `suggestion:${userId}:${todayKey()}:${coldness}:${occasion ?? "any"}`;
}

export async function readSuggestion(
  params: {
    userId: string;
    coldness: ColdnessLevel;
    occasion: OutfitOccasion | null;
    currentTemp: number;
  }
): Promise<CachedSuggestion | null> {
  const key = buildKey(params);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as CachedSuggestion;
    if (Math.abs(value.weather.temp - params.currentTemp) > TEMP_TOLERANCE) return null;
    return value;
  } catch { return null; }
}

export async function writeSuggestion(
  params: {
    userId: string;
    coldness: ColdnessLevel;
    occasion: OutfitOccasion | null;
  },
  value: Omit<CachedSuggestion, "ts">
): Promise<void> {
  const key = buildKey(params);
  try {
    const payload: CachedSuggestion = { ...value, ts: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

export async function clearSuggestion(
  params: {
    userId: string;
    coldness: ColdnessLevel;
    occasion: OutfitOccasion | null;
  }
): Promise<void> {
  const key = buildKey(params);
  try { await AsyncStorage.removeItem(key); } catch {}
}

export async function patchSuggestionImage(
  params: {
    userId: string;
    coldness: ColdnessLevel;
    occasion: OutfitOccasion | null;
  },
  imageUrl: string
): Promise<void> {
  const key = buildKey(params);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return;
    const value = JSON.parse(raw) as CachedSuggestion;
    value.imageUrl = imageUrl;
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
