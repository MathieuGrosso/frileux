// Supabase Edge Function: daily-taste-probe
// Génère un batch de duels A/B pour calibrer le goût de l'utilisatrice.
// Utilise Opus 4.7 (diversité éditoriale critique) — appelé ≤ 3 fois/jour.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { enforceQuota, recordTokens } from "../_shared/quota.ts";
import { sanitizeUserInput } from "../_shared/sanitize.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 5;

type GenderPresentation = "menswear" | "womenswear" | "both" | null;

async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

interface ProbeOption {
  text: string;
  tags: string[];
}

interface Probe {
  axis: string;
  axis_label_fr: string;
  option_a: ProbeOption;
  option_b: ProbeOption;
}

function sanitizeOption(raw: unknown): ProbeOption | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const text = typeof o.text === "string" ? o.text.trim() : "";
  if (!text || text.length > 280) return null;
  const tags = Array.isArray(o.tags)
    ? o.tags
        .filter((t): t is string => typeof t === "string")
        .slice(0, 4)
        .map((t) => sanitizeUserInput(t, 40))
        .filter((t) => t.length > 0)
    : [];
  return { text: sanitizeUserInput(text, 280), tags };
}

function sanitizeProbe(raw: unknown): Probe | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const axis = typeof p.axis === "string" ? sanitizeUserInput(p.axis, 40) : "";
  const axis_label_fr = typeof p.axis_label_fr === "string"
    ? sanitizeUserInput(p.axis_label_fr, 40)
    : "";
  const a = sanitizeOption(p.option_a);
  const b = sanitizeOption(p.option_b);
  if (!axis || !axis_label_fr || !a || !b) return null;
  return { axis, axis_label_fr, option_a: a, option_b: b };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in model output");
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

    const guard = await enforceQuota(userId, "daily-taste-probe");
    if (!guard.ok) return guard.response(corsHeaders);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Profil minimal pour contextualiser la génération.
    const { data: profile } = await admin
      .from("profiles")
      .select(
        "coldness_level, gender_presentation, style_universes, favorite_brands, avoid_tags, fit_preference"
      )
      .eq("id", userId)
      .single();

    const genderPresentation = (profile?.gender_presentation as GenderPresentation) ?? null;
    const genderHint = genderPresentation === "menswear"
      ? "menswear uniquement"
      : genderPresentation === "womenswear"
      ? "womenswear uniquement"
      : "mix menswear + womenswear (pioche librement, alterne d'un duel à l'autre)";

    // Historique des derniers jugements pour éviter de reposer les mêmes questions.
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
    const pastBlock = pastLines.length > 0
      ? `\n\nJugements passés (NE REFAIS PAS les mêmes duels, déplace l'axe ou change le contraste) :\n${pastLines.slice(0, 20).join("\n")}`
      : "";

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

    const prompt = `Tu construis un calibrage de goût pour une utilisatrice qui prend son style au sérieux. Niveau de goût cible : éditorial (Ssense, Highsnobiety, System Magazine, Muji).

Profil :
${profileLines.join("\n")}

Tu dois générer ${BATCH_SIZE} duels A/B de tenues complètes. Chaque duel teste UN axe de goût avec un contraste NET. Les axes à couvrir (un par duel, ne répète pas) :
1. silhouette — tailored vs ample / fluide
2. palette — neutres monochromes vs couleur affirmée ou contrastée
3. texture — matières lisses/techniques vs matières brutes/textiles marqués
4. registre — habillé / tailoring vs streetwear / workwear
5. proportion — pièces près du corps vs volumes exagérés

Règles dures :
- Chaque option = 1 phrase en français, 4-6 pièces séparées par virgules, matières nommées (ex : "pull laine côtelée anthracite, pantalon tailoring écru, mocassins cuir noir, trench poplin beige, écharpe cachemire crème").
- Les 2 options d'un duel doivent être aussi désirables l'une que l'autre pour quelqu'un qui ne sait pas encore — le contraste est sur l'axe, pas sur la qualité.
- Pas de "basique", "classique", "joli". Parti-pris sur chaque pièce.
- Chaque option a 2-4 tags courts (ex : ["tailored","slim"] ou ["oversize","workwear"]).
${pastBlock}

Réponds STRICTEMENT en JSON, aucun texte autour, ce schéma exact :
{
  "probes": [
    {
      "axis": "silhouette",
      "axis_label_fr": "COUPE",
      "option_a": { "text": "...", "tags": ["tailored", "slim"] },
      "option_b": { "text": "...", "tags": ["oversize", "fluide"] }
    }
    // ... ${BATCH_SIZE} probes total, axes différents
  ]
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 1800,
        temperature: 0.9,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic error ${response.status}`);
    }

    const data = await response.json();
    const tokensIn = data?.usage?.input_tokens ?? 0;
    const tokensOut = data?.usage?.output_tokens ?? 0;
    recordTokens(userId, "daily-taste-probe", tokensIn, tokensOut).catch(() => {});

    const text: string = data.content?.[0]?.text ?? "";
    const parsed = extractJson(text) as { probes?: unknown };
    if (!parsed || !Array.isArray(parsed.probes)) {
      throw new Error("malformed model output (probes missing)");
    }

    const probes: Probe[] = [];
    const seenAxes = new Set<string>();
    for (const raw of parsed.probes) {
      const p = sanitizeProbe(raw);
      if (!p) continue;
      if (seenAxes.has(p.axis)) continue;
      seenAxes.add(p.axis);
      probes.push(p);
      if (probes.length >= BATCH_SIZE) break;
    }
    if (probes.length === 0) throw new Error("no valid probes produced");

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
      .select("id, axis, axis_label_fr, option_a_text, option_a_tags, option_b_text, option_b_tags");
    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({ batch_id: batchId, probes: inserted }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.warn("[daily-taste-probe]", message);
    const status = message.includes("unauthorized") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: "Impossible de générer les duels de calibrage." }),
      {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
