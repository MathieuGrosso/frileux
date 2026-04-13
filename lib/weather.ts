import { supabase } from "./supabase";
import type { WeatherData } from "./types";

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
