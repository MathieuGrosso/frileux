// Supabase Edge Function: wardrobe-ai
// Gemini-powered clothing analysis + outfit suggestions.
// Actions:
//   - analyze_image: { image_base64, mime_type } -> ClothingAnalysis
//   - analyze_text:  { text }                     -> ClothingAnalysis
//   - generate_combos:  { items }                 -> OutfitCombo[]
//   - generate_pieces:  { items }                 -> PieceSuggestion[]

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

type WardrobeItemType = "top" | "bottom" | "outerwear" | "shoes" | "accessory";

interface ClothingAnalysis {
  type: WardrobeItemType;
  color: string;
  material: string | null;
  style_tags: string[];
  description: string;
}

interface ItemLite {
  id: string;
  type: WardrobeItemType;
  color: string | null;
  description: string;
  style_tags: string[];
}

const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: ["top", "bottom", "outerwear", "shoes", "accessory"] },
    color: { type: "STRING" },
    material: { type: "STRING" },
    style_tags: { type: "ARRAY", items: { type: "STRING" } },
    description: { type: "STRING" },
  },
  required: ["type", "color", "style_tags", "description"],
};

const COMBOS_SCHEMA = {
  type: "OBJECT",
  properties: {
    combos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          item_ids: { type: "ARRAY", items: { type: "STRING" } },
          rationale: { type: "STRING" },
        },
        required: ["item_ids", "rationale"],
      },
    },
  },
  required: ["combos"],
};

const PIECES_SCHEMA = {
  type: "OBJECT",
  properties: {
    pieces: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["top", "bottom", "outerwear", "shoes", "accessory"] },
          description: { type: "STRING" },
          rationale: { type: "STRING" },
        },
        required: ["type", "description", "rationale"],
      },
    },
  },
  required: ["pieces"],
};

async function callGemini(parts: unknown[], responseSchema: unknown) {
  const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.7,
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text);
}

function analyzeImagePrompt(): string {
  return `Tu es un expert en vêtements. Analyse cette photo d'un vêtement et retourne un JSON strictement conforme au schéma.
- type: la catégorie (top, bottom, outerwear, shoes, accessory)
- color: la couleur principale en français (ex: "bleu marine", "beige")
- material: matière perçue si identifiable, sinon null
- style_tags: 2 à 4 tags en français (ex: "casual", "oversize", "laine épaisse", "minimaliste")
- description: une ligne concise en français décrivant le vêtement (ex: "Pull oversize beige en laine épaisse")`;
}

function analyzeTextPrompt(text: string): string {
  return `L'utilisateur décrit un vêtement qu'il possède : "${text}".
Structure cette description dans un JSON strict conforme au schéma.
- type: top, bottom, outerwear, shoes ou accessory
- color: couleur principale en français
- material: matière si mentionnée, sinon null
- style_tags: 2 à 4 tags en français
- description: une ligne concise et stylée en français`;
}

function combosPrompt(items: ItemLite[]): string {
  return `Tu es une styliste pour une personne frileuse au goût éditorial (Ssense, Muji, Hypebeast).
Voici les pièces du vestiaire :
${items.map((i) => `- [${i.id}] ${i.description} (${i.type}, ${i.color ?? "?"}, tags: ${i.style_tags.join(", ")})`).join("\n")}

Propose 4 combinaisons d'outfits cohérentes (2 à 4 pièces chacune) en utilisant UNIQUEMENT les IDs ci-dessus.
Pour chaque combo, donne un rationale court (1 phrase en français, ton éditorial, pas d'emoji).
Retourne un JSON strictement conforme au schéma: { combos: [{ item_ids: [...], rationale: "..." }] }`;
}

function piecesPrompt(items: ItemLite[]): string {
  return `Tu es une styliste pour une personne frileuse au goût éditorial.
Vestiaire actuel :
${items.map((i) => `- ${i.description} (${i.type}, ${i.color ?? "?"})`).join("\n")}

Propose 4 pièces MANQUANTES qui complèteraient ce vestiaire (avec cohérence stylistique).
Chaque pièce : type, description précise (ex: "Trench long beige taille oversize"), rationale (1 phrase en français).
Retourne un JSON strictement conforme au schéma: { pieces: [{ type, description, rationale }] }`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    const body = await req.json();
    const { action } = body;

    let result: unknown;

    if (action === "analyze_image") {
      const { image_base64, mime_type } = body;
      if (!image_base64) throw new Error("image_base64 required");
      const parts = [
        { text: analyzeImagePrompt() },
        { inlineData: { mimeType: mime_type ?? "image/jpeg", data: image_base64 } },
      ];
      result = (await callGemini(parts, ANALYSIS_SCHEMA)) as ClothingAnalysis;
    } else if (action === "analyze_text") {
      const { text } = body;
      if (!text) throw new Error("text required");
      result = (await callGemini([{ text: analyzeTextPrompt(text) }], ANALYSIS_SCHEMA)) as ClothingAnalysis;
    } else if (action === "generate_combos") {
      const { items } = body as { items: ItemLite[] };
      if (!items?.length) throw new Error("items required");
      result = await callGemini([{ text: combosPrompt(items) }], COMBOS_SCHEMA);
    } else if (action === "generate_pieces") {
      const { items } = body as { items: ItemLite[] };
      if (!items?.length) throw new Error("items required");
      result = await callGemini([{ text: piecesPrompt(items) }], PIECES_SCHEMA);
    } else {
      return new Response(JSON.stringify({ error: "unknown action" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
