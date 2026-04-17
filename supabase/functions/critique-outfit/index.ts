// Supabase Edge Function: critique-outfit
// Génère une critique éditoriale (score /10 + verdict + forces + axes) d'une tenue loggée.
//
// Pattern robuste :
// - SDK Anthropic officiel (maxRetries: 4, backoff exp sur 429/529/5xx).
// - tool_use forcé → JSON garanti par schéma, pas de parse artisanal.
// - Zod valide le payload serveur, aucune critique bidon n'est stockée.
// - État explicite en DB : critique_status (pending/running/done/failed) + error + attempts.
// - Fetch image avec retry court pour absorber la propagation storage → CDN.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@^0.32";
import { z } from "npm:zod@^3.23";
import { enforceQuota, recordTokens } from "../_shared/quota.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "claude-sonnet-4-6";
const TOOL_NAME = "record_critique";

const CritiqueSchema = z.object({
  score: z.number().int().min(1).max(10),
  verdict: z.string().min(1).max(160),
  strengths: z.array(z.string().max(200)).max(3),
  improvements: z.array(z.string().max(200)).max(3),
  weather_note: z.string().max(240).nullable(),
  vs_suggestion: z.string().max(240).nullable(),
});
type Critique = z.infer<typeof CritiqueSchema>;

const critiqueTool = {
  name: TOOL_NAME,
  description:
    "Enregistre la critique éditoriale de la tenue. Appelle cet outil EXACTEMENT une fois avec tous les champs remplis.",
  input_schema: {
    type: "object",
    required: ["score", "verdict", "strengths", "improvements", "weather_note", "vs_suggestion"],
    properties: {
      score: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description:
          "Note calibrée : 5-6 moyen, 7 bien, 8 très bien, 9+ remarquable. N'invente pas de défauts pour baisser.",
      },
      verdict: {
        type: "string",
        maxLength: 160,
        description: "Une ligne ≤ 80 caractères, observation éditoriale, pas jugement.",
      },
      strengths: {
        type: "array",
        items: { type: "string", maxLength: 200 },
        maxItems: 3,
        description: "1 à 3 observations concrètes sur matière/palette/silhouette, phrases ≤ 12 mots.",
      },
      improvements: {
        type: "array",
        items: { type: "string", maxLength: 200 },
        maxItems: 3,
        description: "1 à 3 pistes concrètes formulées comme propositions, phrases ≤ 12 mots.",
      },
      weather_note: {
        type: ["string", "null"],
        maxLength: 240,
        description: "Seulement si risque thermique réel vs coldness_level, sinon null.",
      },
      vs_suggestion: {
        type: ["string", "null"],
        maxLength: 240,
        description:
          "Reliance à la suggestion du matin si pertinent, null sinon ou si la tenue est proche.",
      },
    },
    additionalProperties: false,
  },
} as const;

async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

async function markCritique(
  admin: SupabaseClient,
  outfitId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin
    .from("outfits")
    .update({ ...patch, critique_updated_at: new Date().toISOString() })
    .eq("id", outfitId);
  if (error) console.warn(`[critique] update ${outfitId} failed:`, error.message);
}

async function fetchImageWithRetry(
  url: string,
): Promise<{ mediaType: string; base64: string } | null> {
  const delays = [0, 150, 400, 1000];
  let lastStatus = 0;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      const res = await fetch(url);
      lastStatus = res.status;
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? "image/jpeg";
      const mediaType = ct.split(";")[0].trim();
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength === 0) continue;
      let binary = "";
      const chunk = 0x8000;
      for (let j = 0; j < buf.length; j += chunk) {
        binary += String.fromCharCode.apply(
          null,
          buf.subarray(j, j + chunk) as unknown as number[],
        );
      }
      return { mediaType, base64: btoa(binary) };
    } catch (e) {
      console.warn(
        `[critique] image fetch attempt ${i + 1} threw:`,
        e instanceof Error ? e.message : e,
      );
    }
  }
  console.warn(`[critique] image fetch gave up after 4 attempts, last status ${lastStatus}`);
  return null;
}

function buildPrompt(args: {
  outfit: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  recent: Array<Record<string, unknown>> | null;
}): string {
  const { outfit, profile, recent } = args;
  const w = (outfit.weather_data as Record<string, unknown> | null) ?? {};
  const weatherLine = [
    typeof w.temp === "number" ? `${w.temp}°C` : null,
    typeof w.feels_like === "number" ? `ressenti ${w.feels_like}°C` : null,
    (w.description as string | undefined) || null,
    typeof w.wind_speed === "number" ? `vent ${w.wind_speed} m/s` : null,
    w.rain ? "pluie" : null,
    w.snow ? "neige" : null,
  ].filter(Boolean).join(", ");

  const tasteLines: string[] = [];
  const gp = profile?.gender_presentation;
  if (gp === "menswear") tasteLines.push("- Présentation : menswear (garde-robe masculine)");
  else if (gp === "womenswear") tasteLines.push("- Présentation : womenswear (garde-robe féminine)");
  else if (gp === "both")
    tasteLines.push("- Présentation : mix menswear + womenswear (pioche librement)");
  const su = profile?.style_universes as string[] | undefined;
  if (su?.length) tasteLines.push(`- Univers : ${su.join(", ")}`);
  const fb = profile?.favorite_brands as string[] | undefined;
  if (fb?.length) tasteLines.push(`- Inspirations (vocabulaire, ne jamais nommer) : ${fb.join(", ")}`);
  const av = profile?.avoid_tags as string[] | undefined;
  if (av?.length) tasteLines.push(`- À éviter : ${av.join(", ")}`);
  if (profile?.fit_preference) tasteLines.push(`- Coupe préférée : ${profile.fit_preference}`);
  const tasteBlock = tasteLines.length ? `\n\nProfil stylistique :\n${tasteLines.join("\n")}` : "";

  const recentBlock = recent && recent.length
    ? `\n\nTenues récentes (pour repérer répétitions) :\n${recent
      .map((r) => `- ${r.date}: ${r.worn_description ?? r.ai_suggestion ?? "?"}`)
      .join("\n")}`
    : "";

  const wornLine = outfit.worn_description
    ? `Tenue portée aujourd'hui : ${outfit.worn_description}`
    : "Tenue portée aujourd'hui : (pas de description, base-toi sur la photo)";
  const suggestionLine = outfit.ai_suggestion
    ? `Ma suggestion du matin : ${outfit.ai_suggestion}`
    : "Je n'avais pas fait de suggestion ce matin.";
  const occasionLine = outfit.occasion ? `Occasion : ${outfit.occasion}` : "Occasion : non précisée";

  const intentionLabel: Record<string, string> = {
    assume: "J'assume (parti-pris volontaire)",
    pragmatic: "Pragmatique (choix fonctionnel)",
    lazy: "Flemme (peu d'effort consenti)",
    test: "Test (j'essaie quelque chose)",
  };
  const intentionLine = outfit.intention
    ? `Intention déclarée : ${intentionLabel[outfit.intention as string] ?? outfit.intention}`
    : "Intention : non précisée";

  const isCamille = ((profile?.username as string | undefined) ?? "").toLowerCase().includes("camille");
  const camilleOverride = isCamille
    ? `

CAS PARTICULIER — l'utilisatrice est Camille Berche :
- Reste honnête sur la tenue : pas de complaisance, pas de score gonflé, critique la même que pour tout le monde.
- Une seule entorse : rappelle-lui qu'elle est belle et que c'est la gnome en chef. Glisse la mention exacte, en français, "belle et gnome en chef", quelque part dans le verdict ou dans le premier item de strengths. Une fois par critique, pas plus. Non négociable.`
    : "";

  const coldness = profile?.coldness_level ?? 3;

  return `Tu es un observateur éditorial type Ssense — précis, cultivé, curieux. Tu n'es pas juge, tu es styliste. Tu poses des hypothèses sur ce que la personne a cherché à faire, tu proposes des pistes. Précision > sévérité : ne rabaisse pas, éclaire.

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

Si l'image ne contient pas de tenue humaine portée (paysage, animal, selfie visage sans vêtement visible, objet, capture d'écran, image illisible), appelle l'outil avec :
- score : 1, 2 ou 3 selon le degré de hors-sujet
- verdict : une phrase sèche et éditoriale qui nomme ce que tu vois et renvoie au cadrage attendu. Ton Ssense, pas insulte. Ex. "Cascade, c'est joli. Mais ma job c'est les fringues — cadre-toi habillé(e)."
- strengths : []
- improvements : ["Plan large, de face ou de dos, lumière frontale, tenue visible des épaules aux pieds."]
- weather_note : null
- vs_suggestion : null

Règles :
- strengths et improvements : 1 à 3 entrées, phrases courtes (12 mots max).
- weather_note : seulement si vraiment pertinent (écart coldness_level ${coldness} / météo).
- vs_suggestion : tourne la phrase vers l'écart et sa justification, pas vers la conformité. Null si pas de suggestion initiale ou si la tenue est proche.

Tu DOIS appeler l'outil ${TOOL_NAME} exactement une fois. Ne produis aucun texte en dehors de l'appel.${camilleOverride}`;
}

type OkPayload = { status: "done"; critique: Critique };
type FailPayload = { status: "failed"; error: string; can_retry: boolean };

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userId = await requireUser(req);
  if (!userId) return jsonResponse({ error: "unauthorized" }, 401, corsHeaders);

  if (!ANTHROPIC_API_KEY) {
    console.error("[critique] ANTHROPIC_API_KEY not configured");
    return jsonResponse(
      { status: "failed", error: "config_missing", can_retry: false } satisfies FailPayload,
      200,
      corsHeaders,
    );
  }

  let outfitId: string | null = null;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => null);
    outfitId = typeof body?.outfit_id === "string" ? body.outfit_id : null;
    if (!outfitId) {
      return jsonResponse({ error: "outfit_id required" }, 400, corsHeaders);
    }

    const guard = await enforceQuota(userId, "critique-outfit");
    if (!guard.ok) return guard.response(corsHeaders);

    const { data: outfit, error: outfitErr } = await admin
      .from("outfits")
      .select(
        "id, user_id, photo_url, worn_description, ai_suggestion, weather_data, occasion, intention, date, critique_attempts",
      )
      .eq("id", outfitId)
      .single();
    if (outfitErr || !outfit) {
      return jsonResponse({ error: "outfit_not_found" }, 404, corsHeaders);
    }
    if (outfit.user_id !== userId) {
      return jsonResponse({ error: "forbidden" }, 403, corsHeaders);
    }
    if (!outfit.photo_url) {
      await markCritique(admin, outfitId, {
        critique_status: "failed",
        critique_error: "no_photo",
      });
      return jsonResponse(
        { status: "failed", error: "no_photo", can_retry: false } satisfies FailPayload,
        200,
        corsHeaders,
      );
    }

    await markCritique(admin, outfitId, {
      critique_status: "running",
      critique_attempts: (outfit.critique_attempts ?? 0) + 1,
      critique_error: null,
    });

    const image = await fetchImageWithRetry(outfit.photo_url);
    if (!image) {
      await markCritique(admin, outfitId, {
        critique_status: "failed",
        critique_error: "image_unreachable",
      });
      return jsonResponse(
        { status: "failed", error: "image_unreachable", can_retry: true } satisfies FailPayload,
        200,
        corsHeaders,
      );
    }

    const [{ data: profile }, { data: recent }] = await Promise.all([
      admin
        .from("profiles")
        .select(
          "coldness_level, gender_presentation, style_universes, favorite_brands, avoid_tags, fit_preference, username",
        )
        .eq("id", userId)
        .single(),
      admin
        .from("outfits")
        .select("date, worn_description, ai_suggestion")
        .eq("user_id", userId)
        .neq("id", outfitId)
        .order("date", { ascending: false })
        .limit(5),
    ]);

    const prompt = buildPrompt({ outfit, profile, recent });

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, maxRetries: 4 });

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      tools: [critiqueTool],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: image.mediaType, data: image.base64 },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    recordTokens(
      userId,
      "critique-outfit",
      msg.usage?.input_tokens ?? 0,
      msg.usage?.output_tokens ?? 0,
    ).catch(() => {});

    const toolBlock = msg.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
    );
    if (!toolBlock) {
      console.error(
        `[critique] no tool_use block, stop_reason=${msg.stop_reason}, content types=${msg.content.map((b) => b.type).join(",")}`,
      );
      await markCritique(admin, outfitId, {
        critique_status: "failed",
        critique_error: `no_tool_use:${msg.stop_reason ?? "unknown"}`,
      });
      return jsonResponse(
        { status: "failed", error: "llm_refused", can_retry: true } satisfies FailPayload,
        200,
        corsHeaders,
      );
    }

    const parsed = CritiqueSchema.safeParse(toolBlock.input);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}:${i.code}`)
        .join("|");
      console.error(
        `[critique] schema mismatch: ${issues}`,
        JSON.stringify(toolBlock.input).slice(0, 400),
      );
      await markCritique(admin, outfitId, {
        critique_status: "failed",
        critique_error: `schema_mismatch:${issues}`,
      });
      return jsonResponse(
        { status: "failed", error: "schema_mismatch", can_retry: true } satisfies FailPayload,
        200,
        corsHeaders,
      );
    }

    const critique = parsed.data;

    await markCritique(admin, outfitId, {
      critique,
      critique_score: critique.score,
      critique_status: "done",
      critique_error: null,
    });

    return jsonResponse({ status: "done", critique } satisfies OkPayload, 200, corsHeaders);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[critique] unexpected error:", message);
    if (outfitId) {
      await markCritique(admin, outfitId, {
        critique_status: "failed",
        critique_error: `exception:${message.slice(0, 200)}`,
      }).catch(() => {});
    }
    return jsonResponse(
      { status: "failed", error: "llm_error", can_retry: true } satisfies FailPayload,
      200,
      corsHeaders,
    );
  }
});
