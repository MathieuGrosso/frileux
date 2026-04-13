// Supabase Edge Function: suggest-outfit
// Generates AI-powered outfit suggestions based on weather and coldness level

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

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
  recent_worn?: string[]; // descriptions des tenues portees ces 7 derniers jours
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { weather, coldness_level, recent_worn }: RequestBody = await req.json();

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

Donne une suggestion de tenue COURTE (3-4 phrases max) en français. Pense en couches. Sois spécifique sur les types de vêtements (ex: "pull en laine épaisse" plutôt que juste "pull"). Adapte tes suggestions au fait que cette personne est ${coldnessDescriptions[coldness_level]} — elle a besoin de plus de couches et de chaleur que la moyenne.${recentBlock ? " Évite de proposer les mêmes pièces clés que ces derniers jours — varie les matières, couleurs et coupes." : ""}

Réponds UNIQUEMENT avec la suggestion, sans introduction ni conclusion.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const suggestion =
      data.content?.[0]?.text ?? "Impossible de générer une suggestion.";

    return new Response(JSON.stringify({ suggestion }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Erreur lors de la génération de la suggestion." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
