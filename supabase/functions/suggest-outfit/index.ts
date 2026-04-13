// Supabase Edge Function: suggest-outfit
// Generates AI-powered outfit suggestions based on weather and coldness level

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

interface RequestBody {
  weather: {
    temp: number;
    feels_like: number;
    humidity: number;
    wind_speed: number;
    description: string;
    rain: boolean;
    snow: boolean;
    uv_index: number;
  };
  coldness_level: number; // 1-5
  recent_worn?: string[];
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validate(body: unknown): RequestBody {
  if (!body || typeof body !== "object") throw new Error("invalid body");
  const b = body as Record<string, unknown>;
  const cl = b.coldness_level;
  if (!isFiniteNumber(cl) || cl < 1 || cl > 5 || !Number.isInteger(cl)) {
    throw new Error("coldness_level must be an integer 1-5");
  }
  const w = b.weather as Record<string, unknown> | undefined;
  if (!w || typeof w !== "object") throw new Error("weather required");
  for (const k of ["temp", "feels_like", "humidity", "wind_speed"] as const) {
    if (!isFiniteNumber(w[k])) throw new Error(`weather.${k} must be a number`);
  }
  if (typeof w.description !== "string" || w.description.length > 200) {
    throw new Error("weather.description invalid");
  }
  const rw = b.recent_worn;
  if (rw !== undefined) {
    if (!Array.isArray(rw) || rw.length > 14) throw new Error("recent_worn invalid");
    for (const item of rw) {
      if (typeof item !== "string" || item.length > 500) {
        throw new Error("recent_worn entry invalid");
      }
    }
  }
  return body as RequestBody;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
    const raw = await req.json();
    const { weather, coldness_level, recent_worn } = validate(raw);

    const coldnessDescriptions: Record<number, string> = {
      1: "légèrement frileuse",
      2: "frileuse",
      3: "très frileuse",
      4: "ultra frileuse",
      5: "extrêmement frileuse, a froid même quand les autres ont chaud",
    };

    const recentBlock = recent_worn && recent_worn.length > 0
      ? `\n\nTenues portées ces 7 derniers jours (à NE PAS répéter — propose des pièces, couleurs et silhouettes différentes) :\n${recent_worn.map((w, i) => `${i + 1}. ${w}`).join("\n")}`
      : "";

    const prompt = `Tu es une styliste personnelle pour une personne ${coldnessDescriptions[coldness_level] ?? "très frileuse"}.

Météo du jour :
- Température : ${weather.temp}°C (ressenti ${weather.feels_like}°C)
- Conditions : ${weather.description}
- Vent : ${weather.wind_speed} m/s
- Humidité : ${weather.humidity}%
${weather.rain ? "- Il pleut" : ""}
${weather.snow ? "- Il neige" : ""}${recentBlock}

Donne une suggestion de tenue ULTRA COURTE en français (1 phrase, 20 mots max). Liste 4 à 6 pièces séparées par des virgules, dans l'ordre haut → bas (haut, bas, manteau si besoin, chaussures, accessoires). Sois spécifique sur les matières (ex: "pull laine épaisse" plutôt que "pull"). Adapte au fait que la personne est ${coldnessDescriptions[coldness_level]}.${recentBlock ? " Varie les matières, couleurs et coupes par rapport aux dernières tenues." : ""}

Règles strictes :
- AUCUN markdown (pas de **, pas d'astérisques, pas de tirets en début de ligne).
- Texte plat brut.
- Pas d'introduction ni conclusion.
- Pas d'emoji.

Exemple de format attendu :
Pull col roulé laine grise, jean droit brut, manteau en laine noire, bottines en cuir, écharpe en cachemire camel.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic error ${response.status}`);
    }

    const data = await response.json();
    const suggestion =
      data.content?.[0]?.text ?? "Impossible de générer une suggestion.";

    return new Response(JSON.stringify({ suggestion }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = message.includes("must be") || message.includes("required") || message.includes("invalid") ? 400 : 500;
    return new Response(
      JSON.stringify({ error: "Erreur lors de la génération de la suggestion." }),
      {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
