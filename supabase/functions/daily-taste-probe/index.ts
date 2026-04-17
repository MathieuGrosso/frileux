// Supabase Edge Function: daily-taste-probe
// Génère un batch de duels A/B pour calibrer le goût de l'utilisatrice.
//
// Pattern robuste (aligné avec critique-outfit) :
// - SDK Anthropic officiel (maxRetries: 4, backoff exp sur 429/529/5xx).
// - tool_use forcé → JSON garanti par schéma, plus de parse regex artisanal.
// - Zod valide côté serveur. En cas d'échec partiel (certaines probes
//   invalides), on garde les valides plutôt que de tout perdre.
// - Erreur applicative renvoyée en HTTP 200 avec { status: "failed", error,
//   detail } pour que supabase-js ne masque pas le détail.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@^0.32";
import { z } from "npm:zod@^3.23";
import { enforceQuota, recordTokens } from "../_shared/quota.ts";
import { sanitizeUserInput } from "../_shared/sanitize.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "claude-sonnet-4-6";
const TOOL_NAME = "record_probes";
const BATCH_SIZE = 5;

type GenderPresentation = "menswear" | "womenswear" | "both" | null;

const ProbeOptionSchema = z.object({
  text: z.string().min(1).max(280),
  tags: z.array(z.string().max(40)).max(4),
});

const ProbeSchema = z.object({
  axis: z.string().min(1).max(40),
  axis_label_fr: z.string().min(1).max(40),
  option_a: ProbeOptionSchema,
  option_b: ProbeOptionSchema,
});
type Probe = z.infer<typeof ProbeSchema>;

const ProbeBatchSchema = z.object({
  probes: z.array(ProbeSchema).min(1).max(BATCH_SIZE + 2),
});

const probesTool = {
  name: TOOL_NAME,
  description:
    "Enregistre les duels A/B de calibrage. Appelle cet outil exactement une fois avec 5 probes, axes différents.",
  input_schema: {
    type: "object",
    required: ["probes"],
    properties: {
      probes: {
        type: "array",
        minItems: BATCH_SIZE,
        maxItems: BATCH_SIZE,
        items: {
          type: "object",
          required: ["axis", "axis_label_fr", "option_a", "option_b"],
          properties: {
            axis: {
              type: "string",
              enum: ["silhouette", "palette", "texture", "registre", "proportion"],
            },
            axis_label_fr: { type: "string", maxLength: 40 },
            option_a: {
              type: "object",
              required: ["text", "tags"],
              properties: {
                text: { type: "string", maxLength: 280 },
                tags: { type: "array", items: { type: "string", maxLength: 40 }, maxItems: 4 },
              },
              additionalProperties: false,
            },
            option_b: {
              type: "object",
              required: ["text", "tags"],
              properties: {
                text: { type: "string", maxLength: 280 },
                tags: { type: "array", items: { type: "string", maxLength: 40 }, maxItems: 4 },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
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

function cleanProbe(p: Probe): Probe {
  return {
    axis: sanitizeUserInput(p.axis, 40),
    axis_label_fr: sanitizeUserInput(p.axis_label_fr, 40),
    option_a: {
      text: sanitizeUserInput(p.option_a.text, 280),
      tags: p.option_a.tags.map((t) => sanitizeUserInput(t, 40)).filter((t) => t.length > 0),
    },
    option_b: {
      text: sanitizeUserInput(p.option_b.text, 280),
      tags: p.option_b.tags.map((t) => sanitizeUserInput(t, 40)).filter((t) => t.length > 0),
    },
  };
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function failResponse(
  cors: Record<string, string>,
  error: string,
  detail: string,
): Response {
  // HTTP 200 + status:"failed" pour que supabase-js ne réécrive pas le body en "non-2xx" générique.
  console.error(`[daily-taste-probe] ${error} :: ${detail.slice(0, 400)}`);
  return jsonResponse({ status: "failed", error, detail: detail.slice(0, 400) }, 200, cors);
}

async function buildPastBlock(admin: SupabaseClient, userId: string): Promise<string> {
  const { data: pastProbes } = await admin
    .from("taste_probes")
    .select("axis, option_a_text, option_a_tags, option_b_text, option_b_tags, chosen")
    .eq("user_id", userId)
    .not("judged_at", "is", null)
    .order("judged_at", { ascending: false })
    .limit(30);
  const pastLines = (pastProbes ?? []).map((p: Record<string, unknown>) => {
    const chosenLabel = p.chosen === "a" ? "A" : p.chosen === "b" ? "B" : "aucune";
    const aTags = Array.isArray(p.option_a_tags) ? (p.option_a_tags as string[]).join(", ") : "";
    const bTags = Array.isArray(p.option_b_tags) ? (p.option_b_tags as string[]).join(", ") : "";
    return `- [${p.axis}] A=${p.option_a_text} (${aTags}) vs B=${p.option_b_text} (${bTags}) → choisi ${chosenLabel}`;
  });
  return pastLines.length > 0
    ? `\n\nJugements passés (NE REFAIS PAS les mêmes duels, déplace l'axe ou change le contraste) :\n${pastLines.slice(0, 20).join("\n")}`
    : "";
}

function buildPrompt(args: {
  profile: Record<string, unknown> | null;
  pastBlock: string;
}): string {
  const { profile, pastBlock } = args;
  const genderPresentation = (profile?.gender_presentation as GenderPresentation) ?? null;
  const genderHint = genderPresentation === "menswear"
    ? "menswear uniquement"
    : genderPresentation === "womenswear"
    ? "womenswear uniquement"
    : "mix menswear + womenswear (pioche librement, alterne d'un duel à l'autre)";

  const universes = Array.isArray(profile?.style_universes)
    ? (profile?.style_universes as string[]).slice(0, 4).join(", ")
    : "";
  const brands = Array.isArray(profile?.favorite_brands)
    ? (profile?.favorite_brands as string[]).slice(0, 5).join(", ")
    : "";
  const profileLines: string[] = [];
  profileLines.push(`- Présentation : ${genderHint}`);
  if (universes) profileLines.push(`- Univers déclarés : ${universes}`);
  if (brands) profileLines.push(`- Marques d'inspiration (vocabulaire, jamais nommer) : ${brands}`);
  if (profile?.fit_preference) profileLines.push(`- Coupe préférée : ${profile.fit_preference}`);
  const avoidTags = Array.isArray(profile?.avoid_tags)
    ? (profile?.avoid_tags as string[]).slice(0, 5).join(", ")
    : "";
  if (avoidTags) profileLines.push(`- À éviter : ${avoidTags}`);

  return `Tu construis un calibrage de goût pour une utilisatrice qui prend son style au sérieux. Niveau de goût cible : éditorial (Ssense, Highsnobiety, System Magazine, Muji).

Profil :
${profileLines.join("\n")}

Tu dois générer ${BATCH_SIZE} duels A/B de tenues complètes. Chaque duel teste UN axe de goût avec un contraste NET. Les ${BATCH_SIZE} axes (un par duel, ne répète pas) :
1. silhouette — tailored vs ample / fluide
2. palette — neutres monochromes vs couleur affirmée ou contrastée
3. texture — matières lisses/techniques vs matières brutes/textiles marqués
4. registre — habillé / tailoring vs streetwear / workwear
5. proportion — pièces près du corps vs volumes exagérés

Règles dures :
- Chaque option = 1 phrase en français, 4-6 pièces séparées par virgules, matières nommées (ex : "pull laine côtelée anthracite, pantalon tailoring écru, mocassins cuir noir, trench poplin beige, écharpe cachemire crème").
- Chaque option ≤ 280 caractères. Si tu dépasses, coupe — concis vaut mieux que complet.
- Les 2 options d'un duel doivent être aussi désirables l'une que l'autre pour quelqu'un qui ne sait pas encore — le contraste est sur l'axe, pas sur la qualité.
- Pas de "basique", "classique", "joli". Parti-pris sur chaque pièce.
- Chaque option a 2-4 tags courts (ex : ["tailored","slim"] ou ["oversize","workwear"]).
${pastBlock}

Tu DOIS appeler l'outil ${TOOL_NAME} exactement une fois avec les ${BATCH_SIZE} probes. Ne produis aucun texte en dehors de l'appel.`;
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
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return failResponse(corsHeaders, "config_missing", "ANTHROPIC_API_KEY not configured");
  }

  try {
    const guard = await enforceQuota(userId, "daily-taste-probe");
    if (!guard.ok) return guard.response(corsHeaders);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [{ data: profile }, pastBlock] = await Promise.all([
      admin
        .from("profiles")
        .select(
          "coldness_level, gender_presentation, style_universes, favorite_brands, avoid_tags, fit_preference",
        )
        .eq("id", userId)
        .single(),
      buildPastBlock(admin, userId),
    ]);

    const prompt = buildPrompt({ profile, pastBlock });

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, maxRetries: 4 });

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tools: [probesTool],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: prompt }],
    });

    recordTokens(
      userId,
      "daily-taste-probe",
      msg.usage?.input_tokens ?? 0,
      msg.usage?.output_tokens ?? 0,
    ).catch(() => {});

    const toolBlock = msg.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
    );
    if (!toolBlock) {
      return failResponse(
        corsHeaders,
        "llm_refused",
        `no tool_use block, stop_reason=${msg.stop_reason}, types=${msg.content.map((b) => b.type).join(",")}`,
      );
    }

    const parsed = ProbeBatchSchema.safeParse(toolBlock.input);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}:${i.code}`)
        .join("|");
      return failResponse(
        corsHeaders,
        "schema_mismatch",
        `${issues} :: raw=${JSON.stringify(toolBlock.input).slice(0, 300)}`,
      );
    }

    const seenAxes = new Set<string>();
    const probes: Probe[] = [];
    for (const p of parsed.data.probes) {
      const clean = cleanProbe(p);
      if (!clean.axis || !clean.axis_label_fr || !clean.option_a.text || !clean.option_b.text) continue;
      if (seenAxes.has(clean.axis)) continue;
      seenAxes.add(clean.axis);
      probes.push(clean);
      if (probes.length >= BATCH_SIZE) break;
    }
    if (probes.length === 0) {
      return failResponse(corsHeaders, "empty_batch", "no valid probes after sanitize");
    }

    const batchId = crypto.randomUUID();
    const rows = probes.map((p) => ({
      user_id: userId,
      batch_id: batchId,
      axis: p.axis,
      axis_label_fr: p.axis_label_fr,
      option_a_text: p.option_a.text,
      option_a_tags: p.option_a.tags,
      option_b_text: p.option_b.text,
      option_b_tags: p.option_b.tags,
    }));

    const { data: inserted, error: insertErr } = await admin
      .from("taste_probes")
      .insert(rows)
      .select(
        "id, axis, axis_label_fr, option_a_text, option_a_tags, option_b_text, option_b_tags",
      );
    if (insertErr) {
      return failResponse(corsHeaders, "db_insert_failed", insertErr.message);
    }

    return jsonResponse(
      { status: "done", batch_id: batchId, probes: inserted },
      200,
      corsHeaders,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failResponse(corsHeaders, "llm_error", message);
  }
});
