// Supabase Edge Function: critique-outfit
// Génère une critique éditoriale (score /10 + verdict + forces + axes) d'une tenue loggée.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

interface Critique {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  weather_note: string | null;
  vs_suggestion: string | null;
}

function coerceCritique(raw: unknown): Critique {
  if (!raw || typeof raw !== "object") throw new Error("critique not an object");
  const r = raw as Record<string, unknown>;
  const score = typeof r.score === "number" ? Math.round(r.score) : NaN;
  if (!Number.isFinite(score) || score < 1 || score > 10) {
    throw new Error("score out of range");
  }
  const verdict = typeof r.verdict === "string" ? r.verdict.trim().slice(0, 160) : "";
  if (!verdict) throw new Error("verdict missing");
  const toStrList = (v: unknown, max: number): string[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, max)
      .map((s) => s.trim().slice(0, 200));
  };
  const strengths = toStrList(r.strengths, 3);
  const improvements = toStrList(r.improvements, 3);
  const weather_note =
    typeof r.weather_note === "string" && r.weather_note.trim().length > 0
      ? r.weather_note.trim().slice(0, 240)
      : null;
  const vs_suggestion =
    typeof r.vs_suggestion === "string" && r.vs_suggestion.trim().length > 0
      ? r.vs_suggestion.trim().slice(0, 240)
      : null;
  return { score, verdict, strengths, improvements, weather_note, vs_suggestion };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in response");
  return JSON.parse(trimmed.slice(start, end + 1));
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

  const userId = await requireUser(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
    const body = await req.json();
    const outfitId = typeof body?.outfit_id === "string" ? body.outfit_id : null;
    if (!outfitId) throw new Error("outfit_id required");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: outfit, error: outfitErr } = await admin
      .from("outfits")
      .select("id, user_id, photo_url, worn_description, ai_suggestion, weather_data, occasion, date")
      .eq("id", outfitId)
      .single();
    if (outfitErr || !outfit) throw new Error("outfit not found");
    if (outfit.user_id !== userId) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!outfit.photo_url) {
      throw new Error("outfit has no photo to critique");
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("coldness_level, gender_presentation, style_universes, favorite_brands, avoid_tags, fit_preference")
      .eq("id", userId)
      .single();

    const { data: recent } = await admin
      .from("outfits")
      .select("date, worn_description, ai_suggestion")
      .eq("user_id", userId)
      .neq("id", outfitId)
      .order("date", { ascending: false })
      .limit(5);

    const w = outfit.weather_data ?? {};
    const weatherLine = [
      typeof w.temp === "number" ? `${w.temp}°C` : null,
      typeof w.feels_like === "number" ? `ressenti ${w.feels_like}°C` : null,
      w.description || null,
      typeof w.wind_speed === "number" ? `vent ${w.wind_speed} m/s` : null,
      w.rain ? "pluie" : null,
      w.snow ? "neige" : null,
    ].filter(Boolean).join(", ");

    const tasteLines: string[] = [];
    if (profile?.gender_presentation && profile.gender_presentation !== "both") {
      tasteLines.push(`- Présentation : ${profile.gender_presentation}`);
    }
    if (profile?.style_universes?.length) {
      tasteLines.push(`- Univers : ${profile.style_universes.join(", ")}`);
    }
    if (profile?.favorite_brands?.length) {
      tasteLines.push(`- Inspirations (vocabulaire, ne jamais nommer) : ${profile.favorite_brands.join(", ")}`);
    }
    if (profile?.avoid_tags?.length) {
      tasteLines.push(`- À éviter : ${profile.avoid_tags.join(", ")}`);
    }
    if (profile?.fit_preference) {
      tasteLines.push(`- Coupe préférée : ${profile.fit_preference}`);
    }
    const tasteBlock = tasteLines.length ? `\n\nProfil stylistique :\n${tasteLines.join("\n")}` : "";

    const recentBlock = recent && recent.length
      ? `\n\nTenues récentes (pour repérer répétitions) :\n${recent
          .map((r: any) => `- ${r.date}: ${r.worn_description ?? r.ai_suggestion ?? "?"}`)
          .join("\n")}`
      : "";

    const wornLine = outfit.worn_description
      ? `Tenue portée aujourd'hui : ${outfit.worn_description}`
      : "Tenue portée aujourd'hui : (pas de description, base-toi sur la photo)";

    const suggestionLine = outfit.ai_suggestion
      ? `Ma suggestion du matin : ${outfit.ai_suggestion}`
      : "Je n'avais pas fait de suggestion ce matin.";

    const occasionLine = outfit.occasion
      ? `Occasion : ${outfit.occasion}`
      : "Occasion : non précisée";

    const prompt = `Tu es un styliste senior, ton Hypebeast/Ssense — éditorial, tranchant, précis, jamais mielleux. Tu juges une tenue qu'une personne a portée aujourd'hui. Tu la connais, tu avais proposé quelque chose ce matin.

${wornLine}
${suggestionLine}
${occasionLine}
Météo : ${weatherLine || "inconnue"}${tasteBlock}${recentBlock}

Évalue la tenue en français, ton franc et expert, niveau styliste Ssense. Pas de pédagogie molle. Pas d'emoji. Pas de markdown. Jamais nommer de marque explicitement (utilise le vocabulaire : silhouette, matière, proportion, palette, texture).

Réponds UNIQUEMENT en JSON valide, exactement ce schéma :
{
  "score": <entier 1 à 10, sois exigeant : 7 = correct, 8 = bien, 9+ = exceptionnel>,
  "verdict": "<une ligne, 80 caractères max, tranchante, éditoriale>",
  "strengths": ["<point fort concret sur matière/palette/silhouette>", "..."],
  "improvements": ["<proposition concrète d'amélioration>", "..."],
  "weather_note": <string si risque thermique réel (trop léger, trop chaud, pluie ignorée), sinon null>,
  "vs_suggestion": <string comparant au choix que j'avais proposé ce matin si pertinent, sinon null>
}

Règles :
- strengths et improvements : 1 à 3 entrées, phrases courtes (12 mots max).
- weather_note : seulement si vraiment pertinent (écart coldness_level ${profile?.coldness_level ?? 3} / météo).
- vs_suggestion : style "j'avais proposé X, ton choix Y tient / déraille parce que...". Null si pas de suggestion initiale ou si la tenue est proche.
- Aucun texte en dehors du JSON.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic error ${response.status}`);
    }

    const data = await response.json();
    const text: string = data.content?.[0]?.text ?? "";
    const parsed = extractJson(text);
    const critique = coerceCritique(parsed);

    const { error: updateErr } = await admin
      .from("outfits")
      .update({ critique, critique_score: critique.score })
      .eq("id", outfitId);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ critique }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = message.includes("required") || message.includes("not found") ? 400 : 500;
    return new Response(
      JSON.stringify({ error: "critique_failed", detail: message }),
      {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
