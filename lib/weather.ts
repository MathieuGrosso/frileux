import type { WeatherData } from "./types";

const API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5";

interface OpenWeatherResponse {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  wind: { speed: number };
  weather: Array<{ description: string; icon: string; main: string }>;
  rain?: { "1h"?: number };
  snow?: { "1h"?: number };
}

interface UVResponse {
  value: number;
}

export async function getWeather(
  lat: number,
  lon: number
): Promise<WeatherData> {
  const [weatherRes, uvRes] = await Promise.all([
    fetch(
      `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&lang=fr&appid=${API_KEY}`
    ),
    fetch(
      `${BASE_URL}/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`
    ).catch(() => null),
  ]);

  if (!weatherRes.ok) {
    throw new Error(`Erreur météo: ${weatherRes.status}`);
  }

  const weather: OpenWeatherResponse = await weatherRes.json();
  const uv: UVResponse | null = uvRes?.ok ? await uvRes.json() : null;

  return {
    temp: Math.round(weather.main.temp),
    feels_like: Math.round(weather.main.feels_like),
    humidity: weather.main.humidity,
    wind_speed: weather.wind.speed,
    description: weather.weather[0]?.description ?? "",
    icon: weather.weather[0]?.icon ?? "01d",
    rain: !!weather.rain || weather.weather[0]?.main === "Rain",
    snow: !!weather.snow || weather.weather[0]?.main === "Snow",
    uv_index: uv?.value ?? 0,
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
