// Supabase Edge Function: get-weather
// Proxy OpenWeather. Requires JWT (no anonymous DOS).
// Caches OpenWeather responses per (lat/lon rounded ~11km, hour) to share across users.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENWEATHER_API_KEY = Deno.env.get("OPENWEATHER_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_JWT") ?? "";
const BASE_URL = "https://api.openweathermap.org/data/2.5";

const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Vary": "Origin",
};

function isLat(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= -90 && v <= 90;
}
function isLon(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= -180 && v <= 180;
}

async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function gridKey(lat: number, lon: number): { lat_key: number; lon_key: number } {
  // ~11km cells (0.1°)
  return { lat_key: Math.round(lat * 10), lon_key: Math.round(lon * 10) };
}

function hourBucket(): string {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

interface WeatherResult {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  description: string;
  icon: string;
  rain: boolean;
  snow: boolean;
  uv_index: number;
}

async function fetchFromApi(lat: number, lon: number): Promise<WeatherResult> {
  const [weatherRes, uvRes] = await Promise.all([
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&lang=fr&appid=${OPENWEATHER_API_KEY}`),
    fetch(`${BASE_URL}/uvi?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`).catch(() => null),
  ]);

  if (!weatherRes.ok) throw new Error(`OpenWeather error ${weatherRes.status}`);
  const w = await weatherRes.json();
  const uv = uvRes && uvRes.ok ? await uvRes.json() : null;

  return {
    temp: Math.round(w.main.temp),
    feels_like: Math.round(w.main.feels_like),
    humidity: w.main.humidity,
    wind_speed: w.wind?.speed ?? 0,
    description: w.weather?.[0]?.description ?? "",
    icon: w.weather?.[0]?.icon ?? "01d",
    rain: !!w.rain || w.weather?.[0]?.main === "Rain",
    snow: !!w.snow || w.weather?.[0]?.main === "Snow",
    uv_index: uv?.value ?? 0,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const userId = await requireUser(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  try {
    if (!OPENWEATHER_API_KEY) throw new Error("OPENWEATHER_API_KEY not configured");
    const body = await req.json();
    const { lat, lon } = body ?? {};
    if (!isLat(lat) || !isLon(lon)) throw new Error("invalid coordinates");

    const { lat_key, lon_key } = gridKey(lat, lon);
    const bucket = hourBucket();

    let result: WeatherResult | null = null;
    const admin = SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE) : null;

    if (admin) {
      const { data: cached } = await admin
        .from("weather_cache")
        .select("payload")
        .eq("lat_key", lat_key)
        .eq("lon_key", lon_key)
        .eq("hour_bucket", bucket)
        .maybeSingle();
      if (cached?.payload) result = cached.payload as WeatherResult;
    }

    if (!result) {
      result = await fetchFromApi(lat, lon);
      if (admin) {
        admin
          .from("weather_cache")
          .upsert({ lat_key, lon_key, hour_bucket: bucket, payload: result })
          .then(() => {})
          .catch(() => {});
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = message.includes("invalid") ? 400 : 500;
    return new Response(JSON.stringify({ error: "Erreur meteo" }), {
      status,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
