// Supabase Edge Function: derive-taste
// Agent quotidien : relit les derniers jugements de goût + feedbacks d'outfit +
// mémoire existante, puis distille 1 à 3 nouvelles observations stylistiques
// qu'il écrit dans style_memory. Ces observations sont déjà consommées par
// loadProfileBundle → suggest-outfit via derived_prefs.
//
// Déclenché par pg_cron (migration 047) avec le Bearer service_role — pas
// d'utilisateur authentifié dans la requête, on itère sur les profils actifs.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@^3.23";
import { callTool, AnthropicToolError, type AnthropicTool } from "../_shared/anthropic.ts";
import { recordTokens } from "../_shared/quota.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const MODEL = "claude-sonnet-4-6";
const TOOL_NAME = "emit_style_observations";
const MAX_OBSERVATIONS = 3;
const ACTIVITY_WINDOW_DAYS = 30;

const ObservationSchema = z.object({
  fact: z.string().min(8).max(200),
  kind: z.enum(["strength", "avoid", "pattern"]),
});

const ObservationsSchema = z.object({
  observations: z.array(ObservationSchema).max(MAX_OBSERVATIONS),
});

const observationsTool: AnthropicTool = {
  name: TOOL_NAME,
  description:
    "Émet 0 à 3 observations stylistiques nouvelles à mémoriser. Appelle cet outil EXACTEMENT une fois.",
  input_schema: {
    type: "object",
    required: ["observations"],
    properties: {
      observations: {
        type: "array",
        maxItems: MAX_OBSERVATIONS,
        items: {
          type: "object",
          required: ["fact", "kind"],
          properties: {
            fact: {
              type: "string",
              maxLength: 200,
              description:
                "Observation stylistique courte, FR, sans 'tu' ni impératif. Ex: 'préférence nette pour coupe tailored sur le haut, amples sur le bas'.",
            },
            kind: {
              type: "string",
              enum: ["strength", "avoid", "pattern"],
              description:
                "strength=fonctionne bien / avoid=à éviter / pattern=préférence récurrente observée.",
            },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
};

interface ActiveUser {
  id: string;
}

interface StyleMemoryRow {
  id: string;
  fact: string;
  kind: "strength" | "avoid" | "pattern";
  created_at: string;
}

async function listActiveUsers(admin: SupabaseClient): Promise<ActiveUser[]> {
  const since = new Date();
  since.setDate(since.getDate() - ACTIVITY_WINDOW_DAYS);
  const isoSince = since.toISOString();

  const [outfits, probes] = await Promise.all([
    admin.from("outfits").select("user_id").gte("date", isoSince.split("T")[0]),
    admin
      .from("taste_probes")
      .select("user_id")
      .gte("judged_at", isoSince)
      .not("judged_at", "is", null),
  ]);
  const ids = new Set<string>();
  for (const row of outfits.data ?? []) ids.add(row.user_id as string);
  for (const row of probes.data ?? []) ids.add(row.user_id as string);
  return Array.from(ids).map((id) => ({ id }));
}

function buildPrompt(args: {
  probes: Array<{
    axis: string;
    chosen: "a" | "b" | "none" | null;
    option_a_text: string;
    option_a_tags: string[] | null;
    option_b_text: string;
    option_b_tags: string[] | null;
  }>;
  outfits: Array<{
    worn_description: string | null;
    thermal_feeling: string | null;
    rating: number | null;
    regretted: boolean | null;
  }>;
  memory: StyleMemoryRow[];
}): string {
  const { probes, outfits, memory } = args;

  const probeLines = probes.slice(0, 20).map((p) => {
    const aTags = (p.option_a_tags ?? []).slice(0, 3).join(",");
    const bTags = (p.option_b_tags ?? []).slice(0, 3).join(",");
    const pick = p.chosen === "a" ? "A" : p.chosen === "b" ? "B" : "—";
    return `- [${p.axis}] A(${aTags}) vs B(${bTags}) → ${pick}`;
  });

  const outfitLines = outfits.slice(0, 10).map((o) => {
    const wd = (o.worn_description ?? "(sans description)").slice(0, 140);
    const therm = o.thermal_feeling ?? "—";
    const regret = o.regretted ? " · REGRETTÉ" : "";
    const rating = typeof o.rating === "number" ? ` · note ${o.rating}/5` : "";
    return `- ${wd} · thermique ${therm}${rating}${regret}`;
  });

  const memoryLines = memory.slice(0, 8).map((m) => `- [${m.kind}] ${m.fact}`);

  return `Tu es l'agent de mémoire stylistique personnel de l'utilisatrice. Tu tournes une fois par jour. Ton rôle : observer les derniers signaux, distiller au maximum ${MAX_OBSERVATIONS} nouvelles observations stylistiques utiles, courtes, concrètes — ou aucune si rien de nouveau n'émerge.

Signaux récents :

Jugements de goût (axes · choix) :
${probeLines.length ? probeLines.join("\n") : "(aucun récent)"}

Tenues portées récemment (description · ressenti) :
${outfitLines.length ? outfitLines.join("\n") : "(aucune récente)"}

Observations déjà en mémoire (ne répète PAS) :
${memoryLines.length ? memoryLines.join("\n") : "(aucune)"}

Règles dures :
- 0 à ${MAX_OBSERVATIONS} observations. Ne comble pas artificiellement. Rien de nouveau → retourne un tableau vide.
- Une observation = une phrase FR ≤ 200 caractères, concrète et vérifiable par quelqu'un qui lit son vestiaire. Ne commence pas par "tu", pas d'impératif, pas d'emoji, pas de jugement moral.
- Préfère les contrastes, les motifs récurrents (>= 3 signaux convergents), les regrets répétés.
- kind = strength (fonctionne, à reproduire), avoid (à éviter, confirmé), pattern (préférence récurrente observée).
- Ne duplique pas une observation déjà en mémoire, même reformulée.

Appelle ${TOOL_NAME} une seule fois avec les observations. Ne produis aucun texte hors de l'appel.`;
}

async function deriveForUser(admin: SupabaseClient, userId: string): Promise<number> {
  const [probesRes, outfitsRes, memoryRes] = await Promise.all([
    admin
      .from("taste_probes")
      .select("axis, chosen, option_a_text, option_a_tags, option_b_text, option_b_tags")
      .eq("user_id", userId)
      .not("judged_at", "is", null)
      .order("judged_at", { ascending: false })
      .limit(30),
    admin
      .from("outfits")
      .select("worn_description, thermal_feeling, rating, regretted, date")
      .eq("user_id", userId)
      .not("worn_description", "is", null)
      .order("date", { ascending: false })
      .limit(15),
    admin
      .from("style_memory")
      .select("id, fact, kind, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const probes = (probesRes.data ?? []) as Parameters<typeof buildPrompt>[0]["probes"];
  const outfits = (outfitsRes.data ?? []) as Parameters<typeof buildPrompt>[0]["outfits"];
  const memory = (memoryRes.data ?? []) as StyleMemoryRow[];

  if (probes.length === 0 && outfits.length === 0) {
    return 0;
  }

  let observations: z.infer<typeof ObservationsSchema>;
  try {
    const res = await callTool<z.infer<typeof ObservationsSchema>>({
      apiKey: ANTHROPIC_API_KEY!,
      model: MODEL,
      tool: observationsTool,
      prompt: buildPrompt({ probes, outfits, memory }),
      maxTokens: 600,
      schema: ObservationsSchema,
    });
    observations = res.data;
    recordTokens(userId, "derive-taste", res.tokensIn, res.tokensOut).catch(() => {});
  } catch (e) {
    const detail = e instanceof AnthropicToolError ? `${e.code}:${e.detail}` : String(e);
    console.warn(`[derive-taste] user ${userId.slice(0, 8)} skipped: ${detail.slice(0, 200)}`);
    return 0;
  }

  const existingFacts = new Set(memory.map((m) => m.fact.toLowerCase().trim()));
  const toInsert = observations.observations
    .filter((o) => {
      const normalized = o.fact.toLowerCase().trim();
      if (existingFacts.has(normalized)) return false;
      for (const existing of existingFacts) {
        if (existing.includes(normalized) || normalized.includes(existing)) return false;
      }
      return true;
    })
    .map((o) => ({
      user_id: userId,
      fact: o.fact,
      kind: o.kind,
      source_outfit_id: null,
    }));

  if (toInsert.length === 0) return 0;

  const { error } = await admin.from("style_memory").insert(toInsert);
  if (error) {
    console.warn(`[derive-taste] insert failed for ${userId.slice(0, 8)}: ${error.message}`);
    return 0;
  }

  await admin
    .from("profiles")
    .update({ derived_prefs_updated_at: new Date().toISOString() })
    .eq("id", userId)
    .then(undefined, () => undefined);

  return toInsert.length;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  // Protection minimale : le Bearer service_role doit être présent (appelé par pg_cron).
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.includes(SUPABASE_SERVICE_ROLE_KEY) && !auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const users = await listActiveUsers(admin);
  const startedAt = Date.now();
  let processed = 0;
  let inserted = 0;

  for (const u of users) {
    if (Date.now() - startedAt > 50_000) {
      console.warn(`[derive-taste] budget reached, stopping after ${processed}/${users.length}`);
      break;
    }
    const n = await deriveForUser(admin, u.id).catch((e) => {
      console.warn(`[derive-taste] user ${u.id.slice(0, 8)} threw: ${e instanceof Error ? e.message : e}`);
      return 0;
    });
    processed += 1;
    inserted += n;
  }

  console.log(
    `[derive-taste] done · users=${users.length} processed=${processed} inserted=${inserted}`,
  );
  return new Response(
    JSON.stringify({ status: "ok", users: users.length, processed, inserted }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});
