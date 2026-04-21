import { useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { createInspiration, fetchOgPreview } from "@/lib/inspirations";
import type {
  CreateInspirationInput,
  InspirationKind,
  OgPreview,
  UserInspiration,
} from "@/lib/types";

type PendingPhoto = { uri: string; base64: string; mime: string };

type UseEyeAddOptions = {
  onAdded?: (item: UserInspiration) => void;
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

export function useEyeAdd(options: UseEyeAddOptions = {}) {
  const { onAdded } = options;
  const [analyzing, setAnalyzing] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);

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
      ? await ImagePicker.launchCameraAsync({ quality: 0.85, base64: true })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          base64: true,
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
    const mime = asset.mimeType ?? "image/jpeg";
    setPendingPhoto({ uri: asset.uri, base64, mime });
  }

  function cancelPending() {
    setPendingPhoto(null);
  }

  async function submit(input: Omit<CreateInspirationInput, "imageBase64" | "mime">): Promise<UserInspiration | null> {
    setAnalyzing(true);
    try {
      const payload: CreateInspirationInput = {
        ...input,
        imageBase64: pendingPhoto?.base64,
        mime: pendingPhoto?.mime,
      };
      const item = await createInspiration(payload);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      setPendingPhoto(null);
      onAdded?.(item);
      return item;
    } catch (e) {
      if (__DEV__) console.warn("createInspiration:", e);
      Alert.alert("Erreur", e instanceof Error ? e.message : "Dépôt impossible.");
      return null;
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitPhoto(kind: InspirationKind, note?: string): Promise<UserInspiration | null> {
    if (!pendingPhoto) return null;
    return submit({ kind, note });
  }

  async function submitText(kind: InspirationKind, description: string, note?: string): Promise<UserInspiration | null> {
    const trimmed = description.trim();
    if (!trimmed) return null;
    return submit({ kind, textDescription: trimmed, note });
  }

  async function previewUrl(url: string): Promise<OgPreview> {
    setAnalyzing(true);
    try {
      return await fetchOgPreview(url);
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitUrl(
    kind: InspirationKind,
    url: string,
    preview: OgPreview,
    note?: string
  ): Promise<UserInspiration | null> {
    return submit({
      kind,
      externalUrl: url,
      title: preview.title ?? undefined,
      siteName: preview.site_name ?? undefined,
      textDescription: preview.description ?? undefined,
      note,
    });
  }

  return {
    analyzing,
    pendingPhoto,
    pickPhoto,
    cancelPending,
    submitPhoto,
    submitText,
    previewUrl,
    submitUrl,
  };
}
