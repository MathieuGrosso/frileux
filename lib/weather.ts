import { supabase } from "./supabase";
import type { DayForecast, DayForecastSlot, WeatherData } from "./types";

const API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5";

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

interface ForecastEntry {
  dt: number;
  main: { temp: number };
  weather: Array<{ icon: string; main: string }>;
  rain?: { "3h"?: number };
}

interface ForecastResponse {
  list: ForecastEntry[];
  city: { timezone: number };
}

/**
 * Fenetre meteo de la journee : matin (~9h), midi (~13h), soir (~19h)
 * en heure locale du lieu. Granularite 3h via /forecast.
 */
export async function getDayForecast(
  lat: number,
  lon: number
): Promise<DayForecast> {
  const res = await fetch(
    `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&lang=fr&appid=${API_KEY}`
  );
  if (!res.ok) throw new Error(`Erreur forecast: ${res.status}`);
  const data: ForecastResponse = await res.json();
  const tzShift = data.city.timezone;

  const todayLocalDate = new Date(Date.now() + tzShift * 1000)
    .toISOString()
    .split("T")[0];

  const todaySlots = data.list
    .map((entry) => {
      const local = new Date((entry.dt + tzShift) * 1000);
      return {
        entry,
        localDate: local.toISOString().split("T")[0],
        localHour: local.getUTCHours(),
      };
    })
    .filter((s) => s.localDate === todayLocalDate);

  function pickClosest(targetHour: number): DayForecastSlot | null {
    if (todaySlots.length === 0) return null;
    const best = todaySlots.reduce((a, b) =>
      Math.abs(a.localHour - targetHour) <= Math.abs(b.localHour - targetHour)
        ? a
        : b
    );
    return {
      hour: best.localHour,
      temp: Math.round(best.entry.main.temp),
      icon: best.entry.weather[0]?.icon ?? "01d",
      rain:
        !!best.entry.rain || best.entry.weather[0]?.main === "Rain",
    };
  }

  return {
    morning: pickClosest(9),
    midday: pickClosest(13),
    evening: pickClosest(19),
  };
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
