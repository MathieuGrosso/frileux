// Supabase Edge Function: critique-outfit
// Génère une critique éditoriale (score /10 + verdict + forces + axes) d'une tenue loggée.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { enforceQuota, recordTokens } from "../_shared/quota.ts";

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

    const guard = await enforceQuota(userId, "critique-outfit");
    if (!guard.ok) return guard.response(corsHeaders);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: outfit, error: outfitErr } = await admin
      .from("outfits")
      .select("id, user_id, photo_url, worn_description, ai_suggestion, weather_data, occasion, intention, date")
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

    const intentionLabel: Record<string, string> = {
      assume: "J'assume (parti-pris volontaire)",
      pragmatic: "Pragmatique (choix fonctionnel)",
      lazy: "Flemme (peu d'effort consenti)",
      test: "Test (j'essaie quelque chose)",
    };
    const intentionLine = outfit.intention
      ? `Intention déclarée : ${intentionLabel[outfit.intention] ?? outfit.intention}`
      : "Intention : non précisée";

    const prompt = `Tu es un observateur éditorial type Ssense — précis, cultivé, curieux. Tu n'es pas juge, tu es styliste. Tu poses des hypothèses sur ce que la personne a cherché à faire, tu proposes des pistes. Précision > sévérité : ne rabaisse pas, éclaire.

Tu reçois la photo de la tenue portée. Si la description textuelle et la photo divergent, fais confiance à la photo.

${wornLine}
${suggestionLine}
${occasionLine}
${intentionLine}
Météo : ${weatherLine || "inconnue"}${tasteBlock}${recentBlock}

Lis la tenue en français, ton posé et expert. Pas de pédagogie molle, mais pas de sentence non plus. Pas d'emoji. Pas de markdown. Jamais nommer de marque explicitement (utilise le vocabulaire : silhouette, matière, proportion, palette, texture).

Si l'intention est "J'assume", ne reproche pas les choix radicaux : questionne-les comme des partis-pris, propose des variations plutôt que des corrections.
Si l'intention est "Flemme" ou "Pragmatique", reste bienveillant : propose 1 geste rapide qui élève sans refondre la tenue.
Si l'intention est "Test", encourage l'exploration, note ce qui ouvre des pistes.

Réponds UNIQUEMENT en JSON valide, exactement ce schéma :
{
  "score": <entier 1 à 10, note calibrée honnêtement : 5-6 = moyen, 7 = bien, 8 = très bien, 9+ = remarquable. N'invente pas de défauts pour baisser la note.>,
  "verdict": "<une ligne, 80 caractères max, observation éditoriale (pas un jugement)>",
  "strengths": ["<observation concrète sur matière/palette/silhouette>", "..."],
  "improvements": ["<piste concrète, formulée comme proposition pas comme reproche>", "..."],
  "weather_note": <string si risque thermique réel (trop léger, trop chaud, pluie ignorée), sinon null>,
  "vs_suggestion": <string reliant au choix proposé ce matin si pertinent : "j'avais proposé X, tu as porté Y — l'écart tient parce que… / déraille parce que…", sinon null>
}

Règles :
- strengths et improvements : 1 à 3 entrées, phrases courtes (12 mots max).
- weather_note : seulement si vraiment pertinent (écart coldness_level ${profile?.coldness_level ?? 3} / météo).
- vs_suggestion : tourne la phrase vers l'écart et sa justification, pas vers la conformité. Null si pas de suggestion initiale ou si la tenue est proche.
- Aucun texte en dehors du JSON.`;

    let imageBlock: { type: "image"; source: { type: "base64"; media_type: string; data: string } } | null = null;
    try {
      const imgRes = await fetch(outfit.photo_url);
      if (imgRes.ok) {
        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        const mediaType = contentType.split(";")[0].trim();
        const buf = new Uint8Array(await imgRes.arrayBuffer());
        let binary = "";
        for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
        const b64 = btoa(binary);
        imageBlock = {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: b64 },
        };
      }
    } catch (_) { /* fallback to text-only */ }

    const userContent = imageBlock
      ? [imageBlock, { type: "text", text: prompt }]
      : [{ type: "text", text: prompt }];

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
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic error ${response.status}`);
    }

    const data = await response.json();
    const text: string = data.content?.[0]?.text ?? "";
    const parsed = extractJson(text);
    const critique = coerceCritique(parsed);

    recordTokens(
      userId,
      "critique-outfit",
      data?.usage?.input_tokens ?? 0,
      data?.usage?.output_tokens ?? 0,
    ).catch(() => {});

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
