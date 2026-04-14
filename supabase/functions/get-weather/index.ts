// Supabase Edge Function: get-weather
// Proxy OpenWeather pour eviter d'embarquer la cle API dans le bundle client.
// Pas d'auth : proxy public, protégé par CORS (ALLOWED_ORIGIN) et secret serveur.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENWEATHER_API_KEY = Deno.env.get("OPENWEATHER_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    if (!OPENWEATHER_API_KEY) throw new Error("OPENWEATHER_API_KEY not configured");
    const body = await req.json();
    const { lat, lon } = body ?? {};
    if (!isLat(lat) || !isLon(lon)) throw new Error("invalid coordinates");

    const [weatherRes, uvRes] = await Promise.all([
      fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&lang=fr&appid=${OPENWEATHER_API_KEY}`),
      fetch(`${BASE_URL}/uvi?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`).catch(() => null),
    ]);

    if (!weatherRes.ok) throw new Error(`OpenWeather error ${weatherRes.status}`);
    const w = await weatherRes.json();
    const uv = uvRes && uvRes.ok ? await uvRes.json() : null;

    const result = {
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
