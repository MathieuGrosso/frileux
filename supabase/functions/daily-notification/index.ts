// Supabase Edge Function: daily-notification
// Called by pg_cron at 7:00 UTC (= 8h Paris)
// For each user with a push token + stored location:
//   1. Fetch today's weather (OpenWeatherMap)
//   2. Generate outfit suggestion (Claude Haiku)
//   3. Send push notification (Expo Push API)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENWEATHER_API_KEY = Deno.env.get("OPENWEATHER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

interface Profile {
  id: string;
  push_token: string;
  last_latitude: number;
  last_longitude: number;
  coldness_level: number;
  username: string;
}

interface WeatherData {
  temp: number;
  feels_like: number;
  description: string;
  rain: boolean;
  snow: boolean;
  wind_speed: number;
  humidity: number;
  icon: string;
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const key = requireEnv("OPENWEATHER_API_KEY", OPENWEATHER_API_KEY);
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=fr&appid=${key}`
  );
  if (!res.ok) throw new Error(`OpenWeather error ${res.status}`);
  const data = await res.json();
  if (!data?.main || !data?.weather?.[0]) throw new Error("OpenWeather invalid response");
  return {
    temp: Math.round(data.main.temp),
    feels_like: Math.round(data.main.feels_like),
    description: data.weather[0]?.description ?? "",
    rain: !!data.rain || data.weather[0]?.main === "Rain",
    snow: !!data.snow || data.weather[0]?.main === "Snow",
    wind_speed: data.wind?.speed ?? 0,
    humidity: data.main.humidity,
    icon: data.weather[0]?.icon ?? "01d",
  };
}

async function generateSuggestion(
  weather: WeatherData,
  coldnessLevel: number
): Promise<string> {
  const coldnessDescriptions: Record<number, string> = {
    1: "légèrement frileuse",
    2: "frileuse",
    3: "très frileuse",
    4: "ultra frileuse",
    5: "extrêmement frileuse, a froid même quand les autres ont chaud",
  };

  const prompt = `Tu es une styliste pour une personne ${coldnessDescriptions[coldnessLevel] ?? "très frileuse"}.

Météo : ${weather.temp}°C (ressenti ${weather.feels_like}°C), ${weather.description}${weather.rain ? ", pluie" : ""}${weather.snow ? ", neige" : ""}, vent ${weather.wind_speed} m/s.

Suggestion de tenue courte (2-3 phrases) adaptée au froid. Sois précise sur les matières et couches.`;

  const key = requireEnv("ANTHROPIC_API_KEY", ANTHROPIC_API_KEY);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "Couvre-toi bien aujourd'hui !";
}

function weatherEmoji(temp: number, rain: boolean, snow: boolean): string {
  if (snow) return "❄️";
  if (rain) return "🌧️";
  if (temp < 5) return "🥶";
  if (temp < 15) return "🧥";
  if (temp < 22) return "🌤️";
  return "☀️";
}

async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string
): Promise<void> {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify({
      to: pushToken,
      sound: "default",
      title,
      body,
      data: { screen: "today" },
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  const supabase = createClient(
    requireEnv("SUPABASE_URL", SUPABASE_URL),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY),
  );

  // Get all users with push token + stored location
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, push_token, last_latitude, last_longitude, coldness_level, username")
    .not("push_token", "is", null)
    .not("last_latitude", "is", null)
    .not("last_longitude", "is", null);

  if (error || !profiles?.length) {
    return new Response(JSON.stringify({ sent: 0, message: "No users to notify" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = await Promise.allSettled(
    (profiles as Profile[]).map(async (profile) => {
      const weather = await fetchWeather(profile.last_latitude, profile.last_longitude);
      const suggestion = await generateSuggestion(weather, profile.coldness_level);
      const emoji = weatherEmoji(weather.temp, weather.rain, weather.snow);

      await sendPushNotification(
        profile.push_token,
        `${emoji} ${weather.temp}°C — tenue du jour`,
        suggestion
      );

      return profile.id;
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const errors = results
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason?.message);

  return new Response(JSON.stringify({ sent, errors }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
