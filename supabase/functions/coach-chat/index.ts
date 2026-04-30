// Supabase Edge Function: coach-chat
// Conversational stylist powered by Claude Sonnet 4.6.
// Slash commands route to specialized prompts:
//   - /feedback : audit complet de la garde-robe (format VERDICT/COMPOSITION/SIGNAL/MANQUE/PROCHAIN GESTE)
//   - /coach <prénom> : coaching ouvert, ton observationnel
//   - /tenue : raccourci suggest-outfit dans le contexte chat
//   - (aucune commande) : free chat, tone clinique
// Pattern aligné sur supabase/functions/suggest-outfit/index.ts.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { enforceQuota, recordTokens } from "../_shared/quota.ts";
import { sanitizeUserInput, scrubModelOutput } from "../_shared/sanitize.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_JWT") ?? "";

const MAX_MESSAGE_LEN = 1000;
const MAX_HISTORY = 5;
const MAX_REPLY_TOKENS = 600;
const MODEL = "claude-sonnet-4-6";

type Command = "feedback" | "coach" | "tenue" | "effacer";

interface HistoryItem {
  role: "user" | "assistant";
  body: string;
}

interface RequestBody {
  message: string;
  command?: Command | null;
  command_arg?: string | null;
  history?: HistoryItem[];
}

interface WardrobeRow {
  id: string;
  type: string | null;
  color: string | null;
  material: string | null;
  description: string | null;
  style_tags: string[] | null;
  created_at: string;
}

interface TasteRow {
  gender_presentation: string | null;
  style_universes: string[] | null;
  favorite_brands: string[] | null;
  fit_preference: string | null;
  build: string | null;
}

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (!_admin) _admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  return _admin;
}

async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function validate(raw: unknown): RequestBody {
  if (!raw || typeof raw !== "object") throw new Error("invalid body");
  const b = raw as Record<string, unknown>;
  if (!isString(b.message) || b.message.length === 0 || b.message.length > MAX_MESSAGE_LEN) {
    throw new Error("message must be a non-empty string ≤ 1000 chars");
  }
  if (b.command !== undefined && b.command !== null) {
    if (!isString(b.command) || !["feedback", "coach", "tenue", "effacer"].includes(b.command)) {
      throw new Error("command invalid");
    }
  }
  if (b.command_arg !== undefined && b.command_arg !== null) {
    if (!isString(b.command_arg) || b.command_arg.length > 80) {
      throw new Error("command_arg invalid");
    }
  }
  if (b.history !== undefined) {
    if (!Array.isArray(b.history) || b.history.length > 50) throw new Error("history invalid");
    for (const item of b.history) {
      if (!item || typeof item !== "object") throw new Error("history entry invalid");
      const it = item as Record<string, unknown>;
      if (it.role !== "user" && it.role !== "assistant") throw new Error("history.role invalid");
      if (!isString(it.body) || it.body.length > MAX_MESSAGE_LEN) throw new Error("history.body invalid");
    }
  }
  return raw as RequestBody;
}

function aggregateWardrobe(items: WardrobeRow[]) {
  const total = items.length;
  const byType: Record<string, number> = {};
  const byColor: Record<string, number> = {};
  const byMaterial: Record<string, number> = {};
  const byTag: Record<string, number> = {};
  let neutralCount = 0;
  const NEUTRALS = new Set([
    "noir", "blanc", "écru", "ecru", "gris", "anthracite", "crème", "creme",
    "beige", "camel", "ivoire", "charcoal", "marine", "navy",
  ]);
  for (const it of items) {
    if (it.type) byType[it.type] = (byType[it.type] ?? 0) + 1;
    if (it.color) {
      const c = it.color.toLowerCase();
      byColor[c] = (byColor[c] ?? 0) + 1;
      if (NEUTRALS.has(c)) neutralCount += 1;
    }
    if (it.material) {
      const m = it.material.toLowerCase();
      byMaterial[m] = (byMaterial[m] ?? 0) + 1;
    }
    for (const tag of it.style_tags ?? []) {
      byTag[tag] = (byTag[tag] ?? 0) + 1;
    }
  }
  const sortDesc = (rec: Record<string, number>) =>
    Object.entries(rec).sort((a, b) => b[1] - a[1]);
  return {
    total,
    neutralCount,
    neutralPct: total > 0 ? Math.round((neutralCount / total) * 100) : 0,
    types: sortDesc(byType),
    colors: sortDesc(byColor),
    materials: sortDesc(byMaterial),
    tags: sortDesc(byTag),
    firstUploadAt: items.length > 0 ? items[items.length - 1].created_at : null,
    lastUploadAt: items.length > 0 ? items[0].created_at : null,
  };
}

function buildWardrobeSnapshot(items: WardrobeRow[]): string {
  if (items.length === 0) return "Aucun item dans la garde-robe.";
  const byType: Record<string, string[]> = {};
  for (const it of items) {
    const type = sanitizeUserInput(it.type ?? "piece", 40) || "piece";
    const desc = sanitizeUserInput(it.description ?? "", 200);
    if (!desc) continue;
    const color = sanitizeUserInput(it.color ?? "", 40);
    const material = sanitizeUserInput(it.material ?? "", 40);
    const tags = (it.style_tags ?? []).slice(0, 3).map((t) => sanitizeUserInput(t, 30)).filter(Boolean);
    const meta = [color, material, ...tags].filter(Boolean).join(", ");
    const line = meta ? `${desc} (${meta})` : desc;
    (byType[type] ??= []).push(line);
  }
  return Object.entries(byType)
    .map(([type, lines]) => `- ${type} : ${lines.slice(0, 20).join(" | ")}`)
    .join("\n");
}

function buildTasteSnippet(t: TasteRow | null): string {
  if (!t) return "";
  const lines: string[] = [];
  if (t.gender_presentation) lines.push(`présentation ${t.gender_presentation}`);
  if (t.fit_preference) lines.push(`coupe ${t.fit_preference}`);
  if (t.build) lines.push(`carrure ${t.build}`);
  if (t.style_universes?.length) lines.push(`univers ${t.style_universes.slice(0, 4).join(", ")}`);
  if (t.favorite_brands?.length) lines.push(`marques de référence ${t.favorite_brands.slice(0, 6).join(", ")}`);
  return lines.length > 0 ? `\nProfil : ${lines.join(" · ")}.` : "";
}

const SYSTEM_BASE = `Tu es le coach style de Frileux — clinique, tranchant, précis.
Tu n'es pas chaleureux. Tu n'encourages pas. Tu observes la garde-robe au troisième personne, jamais l'utilisateur au deuxième.
Ton vocabulaire est éditorial : silhouette, matière, registre, proportion. Vocabulaire interdit : "joli", "mignon", "sympa", "passe-partout", "classique intemporel".
Phrases courtes, déclaratives. Pas d'emoji. Pas de markdown sauf si le format le demande explicitement.`;

function buildFeedbackPrompt(
  agg: ReturnType<typeof aggregateWardrobe>,
  snapshot: string,
  taste: string,
): string {
  const topColors = agg.colors.slice(0, 5).map(([c, n]) => `${c} (${n})`).join(", ");
  const topMaterials = agg.materials.slice(0, 4).map(([m, n]) => `${m} (${n})`).join(", ");
  const topTags = agg.tags.slice(0, 6).map(([t, n]) => `${t} (${n})`).join(", ");
  const topTypes = agg.types.map(([t, n]) => `${t} (${n})`).join(", ");

  return `${SYSTEM_BASE}

Tu reçois la totalité de la garde-robe d'une utilisatrice. Tu dois produire un audit éditorial structuré.

Données agrégées :
- Total items : ${agg.total}
- Répartition par type : ${topTypes || "—"}
- Couleurs dominantes : ${topColors || "—"}
- Neutres : ${agg.neutralPct}% (${agg.neutralCount} pièces)
- Matières dominantes : ${topMaterials || "—"}
- Style tags récurrents : ${topTags || "—"}${taste}

Détail de la garde-robe :
${snapshot}

Format strict de la réponse — respect millimétrique :

VERDICT
[1 phrase. Le registre dominant nommé, sans hedge.]

COMPOSITION
— [%] neutres ([liste les neutres dominants])
— [matière dominante avec %]
— [N] pièces structurées / [N] pièces fluides
— [si une marque ressort, la nommer ; sinon retire cette ligne]

SIGNAL
— [thème 1, observation factuelle sur la garde-robe]
— [thème 2]
— [thème 3 si pertinent, sinon retire]

MANQUE
[1–2 absences nommées au niveau pièce, jamais catégorie générique. Précise matière et registre.]

PROCHAIN GESTE
[1 acquisition ou édition. Singulier. Précise (matière, ton, registre).]

Contraintes :
- < 120 mots total.
- MAJUSCULES uniquement pour les section headers (VERDICT, COMPOSITION, SIGNAL, MANQUE, PROCHAIN GESTE).
- Pas de "tu", pas de "vous". Sujet grammatical = la garde-robe.
- Pas d'emoji. Pas de score chiffré global. Pas de question rhétorique.
- Pas d'introduction ni conclusion. Commence directement par "VERDICT".`;
}

function buildCoachPrompt(prenom: string, message: string, snapshot: string, taste: string, history: HistoryItem[]): string {
  const cleanPrenom = sanitizeUserInput(prenom, 40);
  const intro = cleanPrenom
    ? `Tu coaches ${cleanPrenom}. Cite son prénom une seule fois en ouverture, ensuite n'en abuse pas.`
    : "Coaching ouvert.";
  const histBlock = history.length > 0
    ? `\n\nÉchanges récents :\n${history.map((h) => `${h.role === "user" ? "elle" : "toi"} : ${h.body}`).join("\n")}`
    : "";
  return `${SYSTEM_BASE}

${intro} La conversation porte sur le style et la garde-robe. Réponds de façon observationnelle, courte (< 80 mots), au présent.${taste}

Garde-robe (résumé) :
${snapshot}${histBlock}

Message actuel : ${message}`;
}

function buildTenuePrompt(message: string, snapshot: string, taste: string): string {
  return `${SYSTEM_BASE}

Tu proposes une tenue à composer avec la garde-robe ci-dessous. Format : 1 phrase, 4 à 6 pièces séparées par virgules, ordre haut → bas.${taste}

Garde-robe :
${snapshot}

Demande : ${message}

Réponse : 1 phrase, pas d'introduction, pas de markdown.`;
}

function buildFreePrompt(message: string, snapshot: string, taste: string, history: HistoryItem[]): string {
  const histBlock = history.length > 0
    ? `\n\nÉchanges récents :\n${history.map((h) => `${h.role === "user" ? "elle" : "toi"} : ${h.body}`).join("\n")}`
    : "";
  return `${SYSTEM_BASE}

Conversation libre sur le style. Réponse courte (< 80 mots), observationnelle, au présent.${taste}

Garde-robe (résumé) :
${snapshot}${histBlock}

Message : ${message}`;
}

async function callClaude(prompt: string, maxTokens: number): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    console.error(`[coach-chat] anthropic ${response.status} :: ${bodyText.slice(0, 500)}`);
    throw new Error(`Anthropic error ${response.status}`);
  }
  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";
  const tokensIn = data?.usage?.input_tokens ?? 0;
  const tokensOut = data?.usage?.output_tokens ?? 0;
  return { text, tokensIn, tokensOut };
}

async function loadContext(userId: string): Promise<{ items: WardrobeRow[]; taste: TasteRow | null }> {
  const [{ data: items }, { data: taste }] = await Promise.all([
    admin()
      .from("wardrobe_items")
      .select("id, type, color, material, description, style_tags, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(150),
    admin()
      .from("profiles")
      .select("gender_presentation, style_universes, favorite_brands, fit_preference, build")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  return {
    items: (items as WardrobeRow[] | null) ?? [],
    taste: (taste as TasteRow | null) ?? null,
  };
}

async function persistMessages(
  userId: string,
  userMessage: string,
  command: Command | null,
  commandArg: string | null,
  reply: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const rows = [
    {
      user_id: userId,
      role: "user" as const,
      body: userMessage,
      command,
      command_arg: commandArg,
      metadata: {},
    },
    {
      user_id: userId,
      role: "assistant" as const,
      body: reply,
      command: null,
      command_arg: null,
      metadata,
    },
  ];
  const { error } = await admin().from("coach_messages").insert(rows);
  if (error) {
    console.error("[coach-chat] persist failed:", error.message);
    throw new Error("persist failed");
  }
}

async function clearThread(userId: string): Promise<void> {
  const { error } = await admin().from("coach_messages").delete().eq("user_id", userId);
  if (error) {
    console.error("[coach-chat] clear failed:", error.message);
    throw new Error("clear failed");
  }
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
    const raw = await req.json();
    const { message, command, command_arg, history } = validate(raw);

    // /effacer : court-circuit, on vide le thread sans appeler Claude.
    if (command === "effacer") {
      await clearThread(userId);
      return new Response(JSON.stringify({ reply: "Thread effacé.", cleared: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const guard = await enforceQuota(userId, "coach-chat");
    if (!guard.ok) return guard.response(corsHeaders);

    const cleanMessage = sanitizeUserInput(message, MAX_MESSAGE_LEN);
    if (!cleanMessage) {
      return new Response(JSON.stringify({ error: "message empty after sanitization" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const trimmedHistory = (history ?? []).slice(-MAX_HISTORY).map((h) => ({
      role: h.role,
      body: sanitizeUserInput(h.body, MAX_MESSAGE_LEN),
    })).filter((h) => h.body.length > 0);

    const { items, taste } = await loadContext(userId);
    const snapshot = buildWardrobeSnapshot(items);
    const tasteSnippet = buildTasteSnippet(taste);

    let prompt: string;
    let metadata: Record<string, unknown> = { command: command ?? null };

    if (command === "feedback") {
      const agg = aggregateWardrobe(items);
      prompt = buildFeedbackPrompt(agg, snapshot, tasteSnippet);
      metadata = {
        ...metadata,
        audit: {
          total: agg.total,
          neutralPct: agg.neutralPct,
          topColors: agg.colors.slice(0, 5),
          topMaterials: agg.materials.slice(0, 4),
          topTags: agg.tags.slice(0, 6),
        },
      };
    } else if (command === "coach") {
      prompt = buildCoachPrompt(command_arg ?? "", cleanMessage, snapshot, tasteSnippet, trimmedHistory);
    } else if (command === "tenue") {
      prompt = buildTenuePrompt(cleanMessage, snapshot, tasteSnippet);
    } else {
      prompt = buildFreePrompt(cleanMessage, snapshot, tasteSnippet, trimmedHistory);
    }

    const { text, tokensIn, tokensOut } = await callClaude(prompt, MAX_REPLY_TOKENS);
    const reply = scrubModelOutput(text) ?? "Réponse indisponible.";

    recordTokens(userId, "coach-chat", tokensIn, tokensOut).catch(() => {});

    await persistMessages(userId, cleanMessage, command ?? null, command_arg ?? null, reply, metadata);

    return new Response(JSON.stringify({ reply, metadata }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[coach-chat] fatal:", message, stack);
    const status = message.includes("must be") || message.includes("required") || message.includes("invalid") ? 400 : 500;
    return new Response(
      JSON.stringify({ error: "Erreur lors du chat coach.", detail: message.slice(0, 300) }),
      {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
