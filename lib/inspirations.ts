import { decode } from "base64-arraybuffer";
import { supabase } from "./supabase";
import { analyzeClothingDescription, analyzeClothingImage } from "./gemini";
import type {
  ClothingAnalysis,
  CreateInspirationInput,
  InspirationKind,
  OgPreview,
  UserInspiration,
} from "./types";

export const KIND_LABEL: Record<InspirationKind, string> = {
  piece: "PIÈCE",
  shop: "ADRESSE",
  lookbook: "PLANCHE",
};

export const KIND_LABEL_LOWER: Record<InspirationKind, string> = {
  piece: "pièce",
  shop: "adresse",
  lookbook: "planche",
};

const INSPIRATION_COLUMNS =
  "id, user_id, kind, image_url, external_url, title, site_name, note, extracted_description, extracted_tags, extracted_color, extracted_material, approved, created_at, updated_at";

function rowToInspiration(row: Record<string, unknown>): UserInspiration {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    kind: row.kind as InspirationKind,
    image_url: (row.image_url as string | null) ?? null,
    external_url: (row.external_url as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    site_name: (row.site_name as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    extracted_description: (row.extracted_description as string | null) ?? null,
    extracted_tags: (row.extracted_tags as string[] | null) ?? [],
    extracted_color: (row.extracted_color as string | null) ?? null,
    extracted_material: (row.extracted_material as string | null) ?? null,
    approved: Boolean(row.approved),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function listInspirations(opts: { approvedOnly?: boolean; limit?: number } = {}): Promise<UserInspiration[]> {
  const { approvedOnly = false, limit = 100 } = opts;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  let query = supabase
    .from("user_inspirations")
    .select(INSPIRATION_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (approvedOnly) query = query.eq("approved", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToInspiration);
}

export async function getInspiration(id: string): Promise<UserInspiration | null> {
  const { data, error } = await supabase
    .from("user_inspirations")
    .select(INSPIRATION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToInspiration(data) : null;
}

export async function deleteInspiration(id: string): Promise<void> {
  const { error } = await supabase.from("user_inspirations").delete().eq("id", id);
  if (error) throw error;
}

async function uploadInspirationImage(base64: string, mime: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté");
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const path = `${user.id}/eye/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("wardrobe")
    .upload(path, decode(base64), { contentType: mime });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("wardrobe").getPublicUrl(path);
  return data.publicUrl;
}

function analysisApproved(analysis: ClothingAnalysis | null): boolean {
  if (!analysis) return false;
  const desc = analysis.description?.trim() ?? "";
  return desc.length >= 10;
}

export async function createInspiration(input: CreateInspirationInput): Promise<UserInspiration> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté");

  let imageUrl: string | null = null;
  let analysis: ClothingAnalysis | null = null;

  if (input.imageBase64) {
    const mime = input.mime ?? "image/jpeg";
    const [uploadedUrl, analyzed] = await Promise.all([
      uploadInspirationImage(input.imageBase64, mime),
      analyzeClothingImage(input.imageBase64, mime).catch((e) => {
        if (__DEV__) console.warn("analyzeClothingImage (inspiration):", e);
        return null;
      }),
    ]);
    imageUrl = uploadedUrl;
    analysis = analyzed;
  } else if (input.textDescription) {
    try {
      analysis = await analyzeClothingDescription(input.textDescription);
    } catch (e) {
      if (__DEV__) console.warn("analyzeClothingDescription (inspiration):", e);
      analysis = null;
    }
  }

  const payload = {
    user_id: user.id,
    kind: input.kind,
    image_url: imageUrl,
    external_url: input.externalUrl ?? null,
    title: input.title ?? null,
    site_name: input.siteName ?? null,
    note: input.note ?? null,
    extracted_description: analysis?.description ?? input.textDescription ?? null,
    extracted_tags: analysis?.style_tags ?? [],
    extracted_color: analysis?.color ?? null,
    extracted_material: analysis?.material ?? null,
    approved: analysisApproved(analysis) || input.kind !== "piece",
  };

  const { data, error } = await supabase
    .from("user_inspirations")
    .insert(payload)
    .select(INSPIRATION_COLUMNS)
    .single();
  if (error) throw error;
  return rowToInspiration(data);
}

export async function updateInspiration(
  id: string,
  patch: Partial<Pick<UserInspiration, "title" | "note" | "kind" | "extracted_tags">>
): Promise<UserInspiration> {
  const { data, error } = await supabase
    .from("user_inspirations")
    .update(patch)
    .eq("id", id)
    .select(INSPIRATION_COLUMNS)
    .single();
  if (error) throw error;
  return rowToInspiration(data);
}

export async function fetchOgPreview(url: string): Promise<OgPreview> {
  try {
    const { data, error } = await supabase.functions.invoke("og-scrape", { body: { url } });
    if (error) throw error;
    return data as OgPreview;
  } catch (e) {
    if (__DEV__) console.warn("fetchOgPreview:", e);
    return { ok: false, image: null, title: null, site_name: null, description: null };
  }
}

export function inspirationToDerivedPref(i: Pick<UserInspiration, "kind" | "extracted_description" | "extracted_tags" | "extracted_color" | "extracted_material" | "title" | "note">): string | null {
  const label = KIND_LABEL[i.kind];
  const core = (i.extracted_description ?? i.title ?? i.note ?? "").trim();
  if (!core) return null;
  const tags = (i.extracted_tags ?? []).filter(Boolean).slice(0, 6).join(", ");
  const mat = [i.extracted_color, i.extracted_material].filter(Boolean).join(" ");
  const bits = [
    `inspiration (${label}) : ${core.slice(0, 160)}`,
    mat ? `matière ${mat}` : null,
    tags ? `tags : ${tags}` : null,
  ].filter(Boolean);
  const full = bits.join(" — ");
  return full.length > 260 ? `${full.slice(0, 259)}…` : full;
}
