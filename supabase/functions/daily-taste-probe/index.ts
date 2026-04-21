// Supabase Edge Function: daily-taste-probe
// Génère 3 duels A/B pour affiner le goût de l'utilisatrice.
//
// Architecture 2 étapes :
//   1. Gemini 2.5-flash → pool de pièces fictives structurées (type, couleur,
//      matière, tags, description), schéma JSON forcé + retries.
//   2. Claude Sonnet 4.6 → compose ces pièces en 2 tenues contrastées sur un
//      axe de goût (silhouette / palette / texture / registre / proportion).
//      tool_use forcé + Zod → JSON garanti.
//
// Contrat client :
//   - Succès : { status: "ok", batch_id, probes: [...] }
//   - Échec  : HTTP 200 { status: "failed", error, detail } pour que
//     supabase-js ne masque pas la vraie cause.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@^3.23";
import { enforceQuota, recordTokens } from "../_shared/quota.ts";
import { callStructured, GeminiStructuredError } from "../_shared/gemini.ts";
import { callTool, AnthropicToolError, type AnthropicTool } from "../_shared/anthropic.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CLAUDE_MODEL = "claude-sonnet-4-6";
const GEMINI_MODEL = "gemini-2.5-flash";
const DUELS_TOOL_NAME = "emit_duels";
const BATCH_SIZE = 3;
const POOL_MIN = 12;
const POOL_MAX = 16;

type PieceType = "top" | "bottom" | "outerwear" | "shoes" | "accessory";

interface GeneratedPiece {
  piece_id: string;
  type: PieceType;
  color: string;
  material: string;
  style_tags: string[];
  description: string;
}

interface StoredPiece {
  type: PieceType;
  color: string;
  material: string | null;
  style_tags: string[];
  description: string;
}

const PIECES_SCHEMA = {
  type: "OBJECT",
  properties: {
    pieces: {
      type: "ARRAY",
      minItems: POOL_MIN,
      maxItems: POOL_MAX,
      items: {
        type: "OBJECT",
        properties: {
          piece_id: { type: "STRING" },
          type: {
            type: "STRING",
            enum: ["top", "bottom", "outerwear", "shoes", "accessory"],
          },
          color: { type: "STRING" },
          material: { type: "STRING" },
          style_tags: { type: "ARRAY", items: { type: "STRING" } },
          description: { type: "STRING" },
        },
        required: ["piece_id", "type", "color", "material", "style_tags", "description"],
      },
    },
  },
  required: ["pieces"],
};

const AXES = ["silhouette", "palette", "texture", "registre", "proportion"] as const;
type Axis = typeof AXES[number];

const DuelsSchema = z.object({
  duels: z
    .array(
      z.object({
        axis: z.enum(AXES),
        axis_label_fr: z.string().min(1).max(40),
        option_a_piece_ids: z.array(z.string()).min(3).max(6),
        option_a_tags: z.array(z.string()).min(1).max(4),
        option_a_text: z.string().min(1).max(280),
        option_b_piece_ids: z.array(z.string()).min(3).max(6),
        option_b_tags: z.array(z.string()).min(1).max(4),
        option_b_text: z.string().min(1).max(280),
      }),
    )
    .min(1)
    .max(BATCH_SIZE),
});

type DuelsPayload = z.infer<typeof DuelsSchema>;

const duelsTool: AnthropicTool = {
  name: DUELS_TOOL_NAME,
  description:
    "Compose les duels A/B à partir du pool de pièces fourni. Appelle cet outil EXACTEMENT une fois.",
  input_schema: {
    type: "object",
    required: ["duels"],
    properties: {
      duels: {
        type: "array",
        minItems: 1,
        maxItems: BATCH_SIZE,
        items: {
          type: "object",
          required: [
            "axis",
            "axis_label_fr",
            "option_a_piece_ids",
            "option_a_tags",
            "option_a_text",
            "option_b_piece_ids",
            "option_b_tags",
            "option_b_text",
          ],
          properties: {
            axis: { type: "string", enum: AXES as unknown as string[] },
            axis_label_fr: {
              type: "string",
              description: "Étiquette courte affichée à l'écran, ex. COUPE / PALETTE.",
            },
            option_a_piece_ids: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 6,
              description:
                "IDs des pièces du pool composant l'option A. 4-6 idéalement, jamais dupliqués.",
            },
            option_a_tags: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 4,
            },
            option_a_text: {
              type: "string",
              maxLength: 280,
              description:
                "Phrase FR unique listant les pièces de A séparées par virgules, matières nommées.",
            },
            option_b_piece_ids: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 6,
            },
            option_b_tags: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 4,
            },
            option_b_text: {
              type: "string",
              maxLength: 280,
            },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
};

async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

type FailCode =
  | "config_missing"
  | "gemini_down"
  | "claude_down"
  | "schema_mismatch"
  | "no_valid_duels"
  | "db_error"
  | "unknown";

type OkPayload = {
  status: "ok";
  batch_id: string;
  probes: Array<Record<string, unknown>>;
};
type FailPayload = { status: "failed"; error: FailCode; detail: string };

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function fail(code: FailCode, detail: string, cors: Record<string, string>): Response {
  console.error(`[daily-taste-probe] ${code}: ${detail}`);
  return jsonResponse(
    { status: "failed", error: code, detail: detail.slice(0, 300) } satisfies FailPayload,
    200,
    cors,
  );
}

function buildPiecesPrompt(profile: Record<string, unknown> | null): string {
  const genderPresentation = profile?.gender_presentation as string | null | undefined;
  const genderHint = genderPresentation === "menswear"
    ? "Toutes les pièces proviennent d'un vestiaire menswear."
    : genderPresentation === "womenswear"
    ? "Toutes les pièces proviennent d'un vestiaire womenswear."
    : "Mix menswear + womenswear, pioche librement, alterne d'une pièce à l'autre.";

  const universes = Array.isArray(profile?.style_universes)
    ? (profile?.style_universes as string[]).slice(0, 4).join(", ")
    : "";
  const brands = Array.isArray(profile?.favorite_brands)
    ? (profile?.favorite_brands as string[]).slice(0, 5).join(", ")
    : "";
  const avoid = Array.isArray(profile?.avoid_tags)
    ? (profile?.avoid_tags as string[]).slice(0, 5).join(", ")
    : "";

  return `Tu génères un pool de pièces de vêtement fictives pour calibrer le goût d'une utilisatrice éditoriale (références Ssense, System Magazine, Muji, Highsnobiety). Ces pièces serviront à composer des duels A/B.

Consignes de vestiaire :
- ${genderHint}
- Univers stylistiques à couvrir : ${universes || "large, varié, éditorial"}.
- Inspirations de vocabulaire (ne nomme jamais les marques) : ${brands || "—"}.
- À éviter : ${avoid || "le générique, le convenu, le bling"}.

Règles dures :
- Retourne entre ${POOL_MIN} et ${POOL_MAX} pièces, équilibrées par catégorie (vise ≈4 top, ≈3 bottom, ≈3 outerwear, ≈3 shoes, ≈2 accessory).
- Les pièces couvrent volontairement des contrastes nets sur 5 axes : silhouette (tailored vs ample), palette (neutres vs couleur affirmée), texture (lisse/technique vs brute), registre (habillé vs streetwear/workwear), proportion (près du corps vs oversize).
- piece_id : 3 caractères stables (ex. "p01", "p02", ...), unique dans le pool.
- type : "top" | "bottom" | "outerwear" | "shoes" | "accessory".
- color : couleur précise en français (ex. "camel", "anthracite chiné", "ivoire", "bleu ardoise").
- material : matière nommée en français (ex. "laine mérinos côtelée", "coton poplin", "cuir grainé", "cachemire", "nylon technique"). Jamais vide — si vraiment incertain, écris "mixte".
- style_tags : 2 à 4 tags courts FR (ex. "tailored","slim","workwear","oversize","sport-tech","minimal").
- description : une ligne FR concise, texture + coupe + palette (ex. "Pull laine mérinos côtelée anthracite, coupe oversize").
- Aucune mention de marque. Zéro adjectif mou (basique, joli, classique).

Réponds strictement conforme au schéma JSON (pas de texte hors JSON).`;
}

function buildDuelsPrompt(args: {
  profile: Record<string, unknown> | null;
  pool: GeneratedPiece[];
  pastAxes: Array<{ axis: string; chosen: string | null }>;
}): string {
  const { profile, pool, pastAxes } = args;

  const poolLines = pool.map((p) =>
    `- [${p.piece_id}] (${p.type}) ${p.description} · couleur ${p.color} · matière ${p.material} · tags ${p.style_tags.slice(0, 4).join("|")}`
  );

  const recentByAxis = pastAxes.slice(0, 15).map((p) =>
    `- ${p.axis}: ${p.chosen === "a" ? "A" : p.chosen === "b" ? "B" : "aucune"}`
  );
  const recentBlock = recentByAxis.length > 0
    ? `\n\nDerniers axes testés (évite de retomber tout de suite sur ceux déjà matraqués, cherche un déplacement) :\n${recentByAxis.join("\n")}`
    : "";

  const coldness = profile?.coldness_level ?? 3;
  const gender = (profile?.gender_presentation as string | undefined) ?? "both";

  return `Tu construis des duels A/B pour calibrer le goût d'une utilisatrice (${gender}, coldness ${coldness}/5). Tu disposes d'un POOL de pièces fictives (déjà généré). Tu dois composer EXACTEMENT ${BATCH_SIZE} duels, chacun testant UN axe différent parmi : silhouette, palette, texture, registre, proportion.

Règles dures :
- Chaque option = 4 à 6 pièces du pool, cohérentes entre elles (pas de shorts en hiver, pas de mocassins avec un short de sport).
- Les 2 options d'un duel partagent une occasion de port comparable et un niveau de soin équivalent : le contraste se joue UNIQUEMENT sur l'axe du duel.
- option_x_text : phrase FR unique qui liste les pièces séparées par des virgules, en conservant matière + couleur. Max 280 caractères.
- option_x_tags : 2-4 tags courts qui résument l'option (ex. "tailored","slim" vs "oversize","workwear").
- Axe différent pour chaque duel. axis_label_fr : étiquette courte all-caps-friendly (ex. "COUPE", "PALETTE", "MATIÈRE", "REGISTRE", "PROPORTION").
- Réutilisation possible d'une pièce entre 2 duels si cohérent, mais pas dans le même duel.

POOL :
${poolLines.join("\n")}${recentBlock}

Appelle l'outil ${DUELS_TOOL_NAME} une seule fois avec les ${BATCH_SIZE} duels. Ne produis aucun texte hors de l'appel.`;
}

function resolvePieces(ids: string[], pool: GeneratedPiece[]): StoredPiece[] {
  const byId = new Map(pool.map((p) => [p.piece_id, p]));
  const seen = new Set<string>();
  const out: StoredPiece[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const p = byId.get(id);
    if (!p) continue;
    seen.add(id);
    out.push({
      type: p.type,
      color: p.color,
      material: p.material && p.material !== "mixte" ? p.material : p.material || null,
      style_tags: p.style_tags.slice(0, 4),
      description: p.description,
    });
  }
  return out;
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

  if (!ANTHROPIC_API_KEY) return fail("config_missing", "ANTHROPIC_API_KEY", corsHeaders);
  if (!GEMINI_API_KEY) return fail("config_missing", "GEMINI_API_KEY", corsHeaders);

  try {
    const guard = await enforceQuota(userId, "daily-taste-probe");
    if (!guard.ok) return guard.response(corsHeaders);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [{ data: profile }, { data: pastProbes }] = await Promise.all([
      admin
        .from("profiles")
        .select(
          "coldness_level, gender_presentation, style_universes, favorite_brands, avoid_tags, fit_preference",
        )
        .eq("id", userId)
        .single(),
      admin
        .from("taste_probes")
        .select("axis, chosen")
        .eq("user_id", userId)
        .not("judged_at", "is", null)
        .order("judged_at", { ascending: false })
        .limit(20),
    ]);

    // Étape 1 — Gemini : pool de pièces.
    let pool: GeneratedPiece[];
    try {
      const res = await callStructured<{ pieces: GeneratedPiece[] }>({
        apiKey: GEMINI_API_KEY,
        model: GEMINI_MODEL,
        prompt: buildPiecesPrompt(profile as Record<string, unknown> | null),
        responseSchema: PIECES_SCHEMA,
        temperature: 0.9,
      });
      pool = res.data.pieces ?? [];
      recordTokens(userId, "daily-taste-probe:gemini", res.tokensIn, res.tokensOut).catch(() => {});
    } catch (e) {
      if (e instanceof GeminiStructuredError) {
        // "parse" = JSON malformé après retries → distinct du réseau pour faciliter le debug.
        const code: FailCode = e.code === "parse" ? "schema_mismatch" : "gemini_down";
        console.warn(`[daily-taste-probe] gemini ${e.code}: ${e.detail}`);
        return fail(code, `${e.code}:${e.detail}`, corsHeaders);
      }
      return fail("gemini_down", e instanceof Error ? e.message : "unknown", corsHeaders);
    }

    // Dédupe piece_id et filtre les pièces invalides.
    const seen = new Set<string>();
    pool = pool.filter((p) => {
      if (!p.piece_id || seen.has(p.piece_id)) return false;
      if (!p.type || !p.color || !Array.isArray(p.style_tags) || !p.description) return false;
      seen.add(p.piece_id);
      return true;
    });
    if (pool.length < 8) {
      return fail("gemini_down", `pool too small: ${pool.length}`, corsHeaders);
    }

    // Étape 2 — Claude tool_use : compose les duels.
    let duels: DuelsPayload;
    try {
      const res = await callTool<DuelsPayload>({
        apiKey: ANTHROPIC_API_KEY,
        model: CLAUDE_MODEL,
        tool: duelsTool,
        prompt: buildDuelsPrompt({
          profile: profile as Record<string, unknown> | null,
          pool,
          pastAxes: (pastProbes ?? []) as Array<{ axis: string; chosen: string | null }>,
        }),
        maxTokens: 1800,
        schema: DuelsSchema,
      });
      duels = res.data;
      recordTokens(userId, "daily-taste-probe:claude", res.tokensIn, res.tokensOut).catch(() => {});
    } catch (e) {
      if (e instanceof AnthropicToolError) {
        const code: FailCode = e.code === "schema_mismatch" ? "schema_mismatch" : "claude_down";
        return fail(code, e.detail, corsHeaders);
      }
      return fail("claude_down", e instanceof Error ? e.message : "unknown", corsHeaders);
    }

    // Résout piece_ids → pièces stockées, écarte les duels qui perdent trop de pièces.
    const usedAxes = new Set<Axis>();
    const rows: Array<Record<string, unknown>> = [];
    const batchId = crypto.randomUUID();

    for (const d of duels.duels) {
      if (usedAxes.has(d.axis)) continue;
      const piecesA = resolvePieces(d.option_a_piece_ids, pool);
      const piecesB = resolvePieces(d.option_b_piece_ids, pool);
      if (piecesA.length < 3 || piecesB.length < 3) continue;
      usedAxes.add(d.axis);
      rows.push({
        user_id: userId,
        batch_id: batchId,
        axis: d.axis,
        axis_label_fr: d.axis_label_fr,
        option_a_text: d.option_a_text,
        option_a_tags: d.option_a_tags,
        option_a_pieces: piecesA,
        option_b_text: d.option_b_text,
        option_b_tags: d.option_b_tags,
        option_b_pieces: piecesB,
      });
      if (rows.length >= BATCH_SIZE) break;
    }

    if (rows.length === 0) {
      return fail("no_valid_duels", "0 duels after piece resolution", corsHeaders);
    }

    const { data: inserted, error: insertErr } = await admin
      .from("taste_probes")
      .insert(rows)
      .select(
        "id, axis, axis_label_fr, option_a_text, option_a_tags, option_a_pieces, option_b_text, option_b_tags, option_b_pieces",
      );
    if (insertErr) {
      return fail("db_error", insertErr.message, corsHeaders);
    }

    return jsonResponse(
      { status: "ok", batch_id: batchId, probes: inserted } satisfies OkPayload,
      200,
      corsHeaders,
    );
  } catch (e) {
    return fail("unknown", e instanceof Error ? e.message : String(e), corsHeaders);
  }
});
