import { useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import {
  analyzeClothingImage,
  analyzeClothingImageMulti,
  analyzeClothingDescription,
} from "@/lib/gemini";
import type { ClothingAnalysis, WardrobeItem } from "@/lib/types";

type PendingPhoto = { uri: string; base64: string };

type UseWardrobeAddOptions = {
  onItemAdded?: (item: WardrobeItem) => void;
};

async function readBase64(uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const r = reader.result as string;
        const comma = r.indexOf(",");
        resolve(comma >= 0 ? r.slice(comma + 1) : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function uploadBase64(base64: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const fileName = `${user.id}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("wardrobe")
    .upload(fileName, decode(base64), { contentType: "image/jpeg" });
  if (upErr) throw upErr;
  const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(fileName);
  return urlData.publicUrl;
}

export function useWardrobeAdd(options: UseWardrobeAddOptions = {}) {
  const { onItemAdded } = options;
  const [analyzing, setAnalyzing] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);

  async function insertItem(data: ClothingAnalysis & { photo_url: string | null }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data: inserted, error } = await supabase
      .from("wardrobe_items")
      .insert({
        user_id: user.id,
        photo_url: data.photo_url,
        type: data.type,
        color: data.color,
        material: data.material,
        style_tags: data.style_tags,
        description: data.description,
      })
      .select()
      .single();
    if (error) throw error;
    const item = inserted as WardrobeItem;
    onItemAdded?.(item);
    return item;
  }

  async function pickPhoto(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert(
        "Permission refusée",
        "Active l'accès à " + (fromCamera ? "la caméra" : "la galerie") + " dans les réglages."
      );
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          quality: 0.85,
          base64: true,
          allowsEditing: true,
          aspect: [1, 1],
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          base64: true,
          allowsEditing: true,
          aspect: [1, 1],
        });
    if (result.canceled) return;
    const asset = result.assets[0];
    let base64 = asset.base64 ?? null;
    if (!base64) base64 = await readBase64(asset.uri);
    if (!base64) {
      Alert.alert(
        "Image illisible",
        "Impossible de lire cette photo (format non supporté). Essaie avec une autre image."
      );
      return;
    }
    setPendingPhoto({ uri: asset.uri, base64 });
  }

  function cancelPending() {
    setPendingPhoto(null);
  }

  async function confirmPendingAsSingle() {
    if (!pendingPhoto) return;
    const { base64 } = pendingPhoto;
    setPendingPhoto(null);
    setAnalyzing(true);
    try {
      const photoUrl = await uploadBase64(base64);
      const analysis = await analyzeClothingImage(base64);
      await insertItem({ ...analysis, photo_url: photoUrl });
    } catch (e) {
      if (__DEV__) console.warn("confirmPendingAsSingle:", e);
      Alert.alert("Erreur", e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function confirmPendingAsMulti() {
    if (!pendingPhoto) return;
    const { base64 } = pendingPhoto;
    setPendingPhoto(null);
    setAnalyzing(true);
    try {
      const photoUrl = await uploadBase64(base64);
      let analyses: ClothingAnalysis[] = [];
      try {
        analyses = await analyzeClothingImageMulti(base64);
      } catch (e) {
        if (__DEV__) console.warn("analyzeClothingImageMulti:", e);
      }
      if (analyses.length === 0) {
        try {
          const single = await analyzeClothingImage(base64);
          analyses = [single];
        } catch (e) {
          if (__DEV__) console.warn("fallback analyzeClothingImage:", e);
          Alert.alert("Rien trouvé", "Aucune pièce détectée sur la photo. Essaie une autre image.");
          return;
        }
      }
      let ok = 0;
      const failures: string[] = [];
      for (const analysis of analyses) {
        try {
          await insertItem({ ...analysis, photo_url: photoUrl });
          ok += 1;
        } catch (e) {
          if (__DEV__) console.warn("insertItem failed:", e);
          failures.push(analysis.description ?? analysis.type);
        }
      }
      if (ok === 0) {
        Alert.alert("Échec", "Aucune pièce n'a pu être ajoutée. Réessaie.");
      } else if (failures.length > 0) {
        Alert.alert(
          "Partiellement ajouté",
          `${ok}/${analyses.length} pièces ajoutées. Échec : ${failures.join(", ")}.`
        );
      }
    } catch (e) {
      if (__DEV__) console.warn("confirmPendingAsMulti:", e);
      Alert.alert("Erreur", e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAnalyzing(true);
    try {
      const analysis = await analyzeClothingDescription(trimmed);
      await insertItem({ ...analysis, photo_url: analysis.photo_url ?? null });
    } catch (e) {
      if (__DEV__) console.warn("submitText:", e);
      Alert.alert("Erreur", e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setAnalyzing(false);
    }
  }

  return {
    analyzing,
    pendingPhoto,
    pickPhoto,
    cancelPending,
    confirmPendingAsSingle,
    confirmPendingAsMulti,
    submitText,
  };
}
