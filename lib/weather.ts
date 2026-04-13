import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import type { WeatherData } from "./types";

const WEATHER_TTL_MS = 15 * 60 * 1000;

function cacheKey(lat: number, lon: number) {
  return `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
}

async function readCache(key: string): Promise<WeatherData | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; value: WeatherData };
    if (Date.now() - parsed.ts > WEATHER_TTL_MS) return null;
    return parsed.value;
  } catch { return null; }
}

async function writeCache(key: string, value: WeatherData): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
  } catch {}
}

export async function getWeather(
  lat: number,
  lon: number
): Promise<WeatherData> {
  const { data, error } = await supabase.functions.invoke("get-weather", {
    body: { lat, lon },
  });
  if (error) throw new Error(`Erreur météo: ${error.message}`);
  if (!data) throw new Error("Erreur météo: réponse vide");
  return data as WeatherData;
}

/**
 * SWR-style : cache hit < 15 min → renvoyé immédiatement, revalidation
 * silencieuse en arrière-plan (callback `onFresh` pour mettre à jour l'UI).
 */
export async function getWeatherCached(
  lat: number,
  lon: number,
  onFresh?: (fresh: WeatherData) => void
): Promise<WeatherData> {
  const key = cacheKey(lat, lon);
  const cached = await readCache(key);
  if (cached) {
    getWeather(lat, lon)
      .then((fresh) => {
        writeCache(key, fresh);
        if (onFresh) onFresh(fresh);
      })
      .catch(() => {});
    return cached;
  }
  const fresh = await getWeather(lat, lon);
  writeCache(key, fresh);
  return fresh;
}

/** Get a weather emoji from the icon code */
export function weatherEmoji(icon: string): string {
  const map: Record<string, string> = {
    "01d": "\u2600\uFE0F",
    "01n": "\uD83C\uDF19",
    "02d": "\u26C5",
    "02n": "\u26C5",
    "03d": "\u2601\uFE0F",
    "03n": "\u2601\uFE0F",
    "04d": "\u2601\uFE0F",
    "04n": "\u2601\uFE0F",
    "09d": "\uD83C\uDF27\uFE0F",
    "09n": "\uD83C\uDF27\uFE0F",
    "10d": "\uD83C\uDF26\uFE0F",
    "10n": "\uD83C\uDF27\uFE0F",
    "11d": "\u26A1",
    "11n": "\u26A1",
    "13d": "\u2744\uFE0F",
    "13n": "\u2744\uFE0F",
    "50d": "\uD83C\uDF2B\uFE0F",
    "50n": "\uD83C\uDF2B\uFE0F",
  };
  return map[icon] ?? "\u2600\uFE0F";
}
