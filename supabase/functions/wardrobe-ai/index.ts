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
const IMAGE_MODEL = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const IMAGE_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function callImageGen(parts: unknown[], userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${IMAGE_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
    if (!res.ok) {
      console.error("Gemini image gen failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);
    const b64: string | undefined = imagePart?.inlineData?.data;
    const mime: string = imagePart?.inlineData?.mimeType ?? "image/png";
    if (!b64) return null;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ext = mime.split("/")[1] ?? "png";
    const path = `${userId}/${Date.now()}-ai.${ext}`;
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/wardrobe/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": mime,
          "x-upsert": "true",
        },
        body: bytes,
      }
    );
    if (!uploadRes.ok) {
      console.error("Storage upload failed:", uploadRes.status, await uploadRes.text());
      return null;
    }
    return `${SUPABASE_URL}/storage/v1/object/public/wardrobe/${path}`;
  } catch (e) {
    console.error("callImageGen exception:", e);
    return null;
  }
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") ?? "image/png";
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return { data: btoa(binary), mime };
  } catch {
    return null;
  }
}

async function generateProductImage(description: string, userId: string): Promise<string | null> {
  const prompt = `Editorial fashion product photograph of: ${description}. Single clothing item centered on a clean light beige studio background. Soft diffused lighting, no model, no human, no text, no logo. Minimal Muji / Ssense product photography style. High detail fabric texture. Square composition.`;
  return callImageGen([{ text: prompt }], userId);
}

async function refineProductImage(
  currentUrl: string,
  refinement: string,
  description: string,
  userId: string
): Promise<string | null> {
  const img = await fetchImageAsBase64(currentUrl);
  if (!img) {
    console.error("Could not fetch current image for refinement");
    return generateProductImage(`${description}. ${refinement}`, userId);
  }
  const prompt = `Refine this product photograph of "${description}". Apply these adjustments: ${refinement}.
Keep the editorial product photography style: single clothing item, clean light beige studio background, soft diffused lighting, no model, no human, no text, no logo. Muji / Ssense aesthetic. Square composition. High detail fabric texture.`;
  return callImageGen(
    [
      { text: prompt },
      { inlineData: { mimeType: img.mime, data: img.data } },
    ],
    userId
  );
}

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
      const { text, user_id } = body;
      if (!text) throw new Error("text required");
      const analysis = (await callGemini([{ text: analyzeTextPrompt(text) }], ANALYSIS_SCHEMA)) as ClothingAnalysis;
      let photo_url: string | null = null;
      if (user_id) photo_url = await generateProductImage(analysis.description, user_id);
      result = { ...analysis, photo_url };
    } else if (action === "refine_image") {
      const { current_photo_url, refinement, description, user_id } = body;
      if (!user_id) throw new Error("user_id required");
      if (!current_photo_url) throw new Error("current_photo_url required");
      if (!refinement) throw new Error("refinement required");
      const photo_url = await refineProductImage(
        current_photo_url,
        refinement,
        description ?? "clothing item",
        user_id
      );
      result = { photo_url };
    } else if (action === "describe_worn") {
      const { image_base64, mime_type, suggestion } = body;
      if (!image_base64) throw new Error("image_base64 required");
      const prompt = `Tu regardes la photo d'une personne qui porte sa tenue du jour.
${suggestion ? `Ce matin, la styliste IA lui avait suggéré ceci :\n"${suggestion}"\n\n` : ""}Décris en français, en 2-3 phrases COURTES et éditoriales (ton Ssense/Muji, pas d'emoji, pas de jugement), ce qu'elle porte réellement sur la photo. Sois spécifique (matières, couleurs, type de pièce, silhouette).${suggestion ? " Si la tenue diffère nettement de la suggestion, termine par une phrase courte notant l'écart." : ""}
Réponds UNIQUEMENT avec la description, sans introduction.`;
      const parts = [
        { text: prompt },
        { inlineData: { mimeType: mime_type ?? "image/jpeg", data: image_base64 } },
      ];
      const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.6 },
        }),
      });
      if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const worn_description = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
      result = { worn_description };
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
