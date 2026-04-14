// Supabase Edge Function: suggest-outfit
// Generates AI-powered outfit suggestions based on weather and coldness level

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

interface TasteBody {
  gender_presentation?: "menswear" | "womenswear" | "both" | null;
  style_universes?: string[];
  favorite_brands?: string[];
  avoid_tags?: string[];
  fit_preference?: "relaxed" | "regular" | "slim" | null;
  build?: "petite" | "slim" | "athletic" | "curvy" | "strong" | "tall" | null;
  height_cm?: number | null;
  shoe_size_eu?: number | null;
}

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
  recent_feedback?: Array<{
    description: string;
    thermal: "too_cold" | "just_right" | "too_warm" | null;
    occasion: string | null;
    feels_like: number | null;
  }>;
  occasion?: string | null;
  taste?: TasteBody;
  avoid_reasons?: string[];
  steer_text?: string | null;
  steer_brands?: string[];
  liked_anchors?: string[];
  derived_prefs?: string[];
  wardrobe?: Array<{
    type: string;
    color: string | null;
    material: string | null;
    style_tags: string[];
    description: string;
  }>;
  wardrobe_mode?: "priority" | "strict";
}

const BRAND_AESTHETICS: Record<string, string> = {
  "Our Legacy": "workwear ample réinterprété, teintes sourdes gris-sable, jersey lourd",
  "Lemaire": "ligne fluide, camel écru noir, manches longues, drapé, tailoring déstructuré",
  "Acne Studios": "denim brut, silhouettes larges, cuir patiné, rose poudré, codes scandinaves",
  "Jacquemus": "épures méditerranéennes, écru terracotta, volumes courts, côté soleil",
  "Aimé Leon Dore": "preppy new-yorkais, polos, chinos, sneakers rétro, crème burgundy marine",
  "Stüssy": "streetwear Californien, tees graphiques, nylon, béton olive, 90s décontracté",
  "Carhartt WIP": "workwear duck canvas, ample, poches utilitaires, beige marron noir",
  "Kapital": "patchwork Japonais, indigo teint, boro, coupes étranges, folklore décalé",
  "Needles": "track pants papillon, velours, tailoring rétro, rayures, élégance dérangée",
  "Palace": "skateboarding UK, sportswear technique, logos discrets, tricolore",
  "Stone Island": "sportswear technique, teintures réactives, nylon, vert militaire stone",
  "Rick Owens": "drape sombre, cuir noir, asymétries, silhouettes longues, gothique",
  "Maison Margiela": "déconstruction, tabi, blanc cassé, anthracite, tailoring éclaté",
  "Auralee": "matières sublimes, coton fin, camel poudré, ligne pure, luxe silencieux",
  "Uniqlo U": "basiques sculptés, laine mélangée, minimalisme accessible, oversize contrôlé",
  "Arc'teryx": "outdoor technique, gore-tex, gris ardoise noir, gorpcore urbain",
  "Gramicci": "pantalons escalade, nylon léger, outdoor décontracté, tons terre",
  "Polo Ralph Lauren": "preppy Américain, oxford boutonné, tweed, marine ivoire bordeaux",
  "A.P.C.": "denim brut Japonais, tailoring minimaliste Parisien, marine écru noir",
  "Engineered Garments": "workwear hybride, poches multiples, tissus mixés, kaki moutarde",
  "Universal Works": "workwear Anglais, laine grise, cordons, tweed, tailoring décontracté",
  "Patta": "streetwear Amsterdam, sportswear saturé, motifs graphiques, culture sneaker",
  "Drake's": "tailoring Anglais relâché, tweed, laine, palette automne, Ivy revisité",
  "Beams Plus": "Ivy Japonais, madras, oxford, chinos, précision heritage, marine moutarde",
  "Marine Serre": "upcycling, lune imprimée, skintight mixé workwear, noir crème",
  "Bode": "textile vintage, quilt, broderies, Americana narratif, tons fanés",
  "JW Anderson": "silhouettes étranges, volumes exagérés, maille sculpturale, art conceptuel",
  "Junya Watanabe": "patchwork technique, denim déconstruit, Japonais expérimental",
  "Comme des Garçons": "noir avant-garde, tailoring asymétrique, textures mixtes, sculpté",
  "Noah": "preppy New-York rebelle, rugbies, tailoring marine, pop rock 60s",
};

function buildTasteBlock(t?: TasteBody): string {
  if (!t) return "";
  const lines: string[] = [];
  if (t.gender_presentation && t.gender_presentation !== "both") {
    lines.push(`- Présentation : ${t.gender_presentation}`);
  }
  if (t.style_universes?.length) {
    lines.push(`- Univers : ${t.style_universes.join(", ")}`);
  }
  if (t.favorite_brands?.length) {
    const inspirations = t.favorite_brands
      .map((name) => {
        const aes = BRAND_AESTHETICS[name];
        return aes ? `  · ${aes}` : null;
      })
      .filter(Boolean) as string[];
    if (inspirations.length) {
      lines.push(
        `- Inspirations esthétiques (utilise ce vocabulaire, ces silhouettes et palettes — ne nomme JAMAIS les marques) :\n${inspirations.join("\n")}`
      );
    } else {
      lines.push(
        `- Marques de référence (utilise leur vocabulaire — ne les nomme PAS) : ${t.favorite_brands.join(", ")}`
      );
    }
  }
  if (t.fit_preference) {
    lines.push(`- Coupe préférée : ${t.fit_preference}`);
  }
  if (t.avoid_tags?.length) {
    lines.push(`- À éviter : ${t.avoid_tags.join(", ")}`);
  }
  const morpho: string[] = [];
  if (t.build) morpho.push(`carrure ${t.build}`);
  if (t.height_cm) morpho.push(`${t.height_cm} cm`);
  if (t.shoe_size_eu) morpho.push(`pointure ${t.shoe_size_eu} EU`);
  if (morpho.length) lines.push(`- Morphologie : ${morpho.join(", ")}`);
  if (!lines.length) return "";
  return `\n\nProfil stylistique :\n${lines.join("\n")}\n\nLe vocabulaire doit refléter ce niveau de goût (éditorial, précis). Évite "joli", "mignon", "sympa". Pense silhouette, matière, proportion.`;
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
  const rf = b.recent_feedback;
  if (rf !== undefined) {
    if (!Array.isArray(rf) || rf.length > 14) throw new Error("recent_feedback invalid");
  }
  const oc = b.occasion;
  if (oc !== undefined && oc !== null && (typeof oc !== "string" || oc.length > 200)) {
    throw new Error("occasion invalid");
  }
  const t = b.taste;
  if (t !== undefined && (t === null || typeof t !== "object" || Array.isArray(t))) {
    throw new Error("taste invalid");
  }
  const ar = b.avoid_reasons;
  if (ar !== undefined) {
    if (!Array.isArray(ar) || ar.length > 10) throw new Error("avoid_reasons invalid");
    for (const item of ar) {
      if (typeof item !== "string" || item.length > 200) {
        throw new Error("avoid_reasons entry invalid");
      }
    }
  }
  const st = b.steer_text;
  if (st !== undefined && st !== null && (typeof st !== "string" || st.length > 400)) {
    throw new Error("steer_text invalid");
  }
  const sb = b.steer_brands;
  if (sb !== undefined) {
    if (!Array.isArray(sb) || sb.length > 5) throw new Error("steer_brands invalid");
    for (const item of sb) {
      if (typeof item !== "string" || item.length > 80) throw new Error("steer_brands entry invalid");
    }
  }
  const la = b.liked_anchors;
  if (la !== undefined) {
    if (!Array.isArray(la) || la.length > 5) throw new Error("liked_anchors invalid");
    for (const item of la) {
      if (typeof item !== "string" || item.length > 500) throw new Error("liked_anchors entry invalid");
    }
  }
  const wr = b.wardrobe;
  if (wr !== undefined) {
    if (!Array.isArray(wr) || wr.length > 120) throw new Error("wardrobe invalid");
    for (const item of wr) {
      if (!item || typeof item !== "object") throw new Error("wardrobe entry invalid");
      const it = item as Record<string, unknown>;
      if (typeof it.type !== "string") throw new Error("wardrobe.type invalid");
      if (typeof it.description !== "string" || it.description.length > 300) throw new Error("wardrobe.description invalid");
    }
  }
  const wm = b.wardrobe_mode;
  if (wm !== undefined && wm !== "priority" && wm !== "strict") {
    throw new Error("wardrobe_mode invalid");
  }
  const dp = b.derived_prefs;
  if (dp !== undefined) {
    if (!Array.isArray(dp) || dp.length > 10) throw new Error("derived_prefs invalid");
    for (const item of dp) {
      if (typeof item !== "string" || item.length > 300) throw new Error("derived_prefs entry invalid");
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

  const userId = await requireUser(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
    const raw = await req.json();
    const {
      weather, coldness_level, recent_worn, recent_feedback, occasion, taste,
      avoid_reasons, steer_text, steer_brands, liked_anchors, derived_prefs,
      wardrobe, wardrobe_mode,
    } = validate(raw);
    const tasteBlock = buildTasteBlock(taste);

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

    const thermalLabel: Record<string, string> = {
      too_cold: "elle a eu trop froid",
      just_right: "le ressenti était pile bien",
      too_warm: "elle a eu trop chaud",
    };

    const feedbackBlock = recent_feedback && recent_feedback.length > 0
      ? `\n\nFeedback récent (à utiliser pour calibrer le niveau de chaleur) :\n${recent_feedback
          .filter((f) => f.thermal)
          .slice(0, 5)
          .map((f) => `- ${f.description} (ressenti ${f.feels_like ?? "?"}°) → ${thermalLabel[f.thermal!] ?? "?"}`)
          .join("\n")}`
      : "";

    const avoidBlock = avoid_reasons && avoid_reasons.length > 0
      ? `\n\nContraintes négatives (STRICTES, à respecter en priorité) :\n${avoid_reasons.map((r) => `- ${r}`).join("\n")}`
      : "";

    const steerBrandLines = (steer_brands ?? [])
      .map((name) => {
        const aes = BRAND_AESTHETICS[name];
        return aes ? `- ${aes}` : `- vocabulaire ${name}`;
      });
    const steerBlock = (steer_text && steer_text.trim().length > 0) || steerBrandLines.length > 0
      ? `\n\nPilotage pour AUJOURD'HUI (oriente la silhouette sans nommer de marque) :${steer_text ? `\n- Intention : ${steer_text.trim()}` : ""}${steerBrandLines.length ? `\n${steerBrandLines.join("\n")}` : ""}`
      : "";

    const derivedBlock = derived_prefs && derived_prefs.length > 0
      ? `\n\nTendances des 30 derniers jours (ajuste la baseline, ne les mentionne pas) :\n${derived_prefs.map((p) => `- ${p}`).join("\n")}`
      : "";

    const anchorsBlock = liked_anchors && liked_anchors.length > 0
      ? `\n\nTenues adorées par l'utilisatrice (sers-t'en comme ancres de goût, varie les pièces mais garde l'esprit) :\n${liked_anchors.slice(0, 3).map((a, i) => `${i + 1}. ${a}`).join("\n")}`
      : "";

    const wardrobeBlock = wardrobe && wardrobe.length > 0
      ? (() => {
          const byType: Record<string, string[]> = {};
          for (const p of wardrobe) {
            const line = `${p.description}${p.color ? ` (${p.color}${p.material ? `, ${p.material}` : ""})` : p.material ? ` (${p.material})` : ""}`;
            (byType[p.type] ??= []).push(line);
          }
          const listed = Object.entries(byType)
            .map(([type, lines]) => `- ${type} : ${lines.slice(0, 12).join(" | ")}`)
            .join("\n");
          const header = wardrobe_mode === "strict"
            ? "Vestiaire de l'utilisatrice (compose UNIQUEMENT avec ces pièces) :"
            : "Vestiaire de l'utilisatrice (priorité à ces pièces, sinon suggère ce qu'il manquerait) :";
          return `\n\n${header}\n${listed}`;
        })()
      : "";

    const occasionBlock = occasion
      ? `\n\nContexte demandé pour aujourd'hui : ${occasion}. Adapte le code vestimentaire (ex: travail = un cran plus formel, sortie = plus expressif, sport = technique).`
      : "";

    const prompt = `Tu es une styliste personnelle pour une personne ${coldnessDescriptions[coldness_level] ?? "très frileuse"}.

Météo du jour :
- Température : ${weather.temp}°C (ressenti ${weather.feels_like}°C)
- Conditions : ${weather.description}
- Vent : ${weather.wind_speed} m/s
- Humidité : ${weather.humidity}%
${weather.rain ? "- Il pleut" : ""}
${weather.snow ? "- Il neige" : ""}${occasionBlock}${tasteBlock}${derivedBlock}${anchorsBlock}${wardrobeBlock}${recentBlock}${feedbackBlock}${steerBlock}${avoidBlock}

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
