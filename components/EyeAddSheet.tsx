import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { PressableScale } from "@/components/ui/PressableScale";
import { EyeKindChips } from "@/components/EyeKindChips";
import { enterFadeUp } from "@/lib/animations";
import { colors } from "@/lib/theme";
import type { InspirationKind, OgPreview, UserInspiration } from "@/lib/types";
import { useEyeAdd } from "@/hooks/useEyeAdd";

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdded?: (item: UserInspiration) => void;
}

type Route = "menu" | "photo" | "link" | "text";

const URL_INPUT_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

export default function EyeAddSheet({ visible, onClose, onAdded }: Props) {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const [route, setRoute] = useState<Route>("menu");
  const [kind, setKind] = useState<InspirationKind>("piece");
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [urlPreview, setUrlPreview] = useState<OgPreview | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const { analyzing, pendingPhoto, pickPhoto, cancelPending, submitPhoto, submitText, previewUrl, submitUrl } =
    useEyeAdd({ onAdded: (item) => {
      reset();
      onClose();
      onAdded?.(item);
    }});

  function reset() {
    setRoute("menu");
    setKind("piece");
    setNote("");
    setDescription("");
    setUrl("");
    setUrlPreview(null);
    setUrlError(null);
    cancelPending();
  }

  useEffect(() => {
    if (!visible) reset();

  }, [visible]);

  const previewStep = useMemo(() => {
    if (route === "photo" && pendingPhoto) return "preview";
    if (route === "link" && urlPreview) return "preview";
    return null;
  }, [route, pendingPhoto, urlPreview]);

  async function onFetchUrl() {
    const trimmed = url.trim();
    setUrlError(null);
    if (!/^https?:\/\//i.test(trimmed)) {
      setUrlError("URL invalide — commence par http:// ou https://");
      return;
    }
    const preview = await previewUrl(trimmed);
    if (!preview.ok || !preview.image) {
      setUrlError("Pas d'image trouvée. Utilise PHOTO avec une capture.");
      return;
    }
    setUrlPreview(preview);
  }

  async function onConfirm() {
    if (route === "photo") await submitPhoto(kind, note.trim() || undefined);
    else if (route === "text") await submitText(kind, description, note.trim() || undefined);
    else if (route === "link" && urlPreview) await submitUrl(kind, url.trim(), urlPreview, note.trim() || undefined);
  }

  const menuDisabled = analyzing;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-ink-900/30 justify-end"
      >
        <PressableScale
          onPress={onClose}
          scaleTo={1}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: height * 0.2 }}
          accessibilityLabel="Fermer"
        />
        <View className="bg-paper border-t border-paper-300" style={{ maxHeight: height * 0.9 }}>
          <SafeAreaView edges={["bottom"]}>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28 }}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View entering={enterFadeUp(0, reducedMotion ?? false)}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <Text
                      className="font-body-medium text-ice-600"
                      style={{ fontSize: 10, letterSpacing: 2 }}
                    >
                      L'ŒIL / +
                    </Text>
                    <Text
                      className="font-display text-ink-900 mt-1"
                      style={{ fontSize: 40, letterSpacing: -0.6, lineHeight: 42 }}
                    >
                      {previewStep ? "VALIDER" : "DÉPOSER"}
                    </Text>
                  </View>
                  <PressableScale onPress={onClose} hitSlop={12}>
                    <Text
                      className="font-body-medium text-ink-500"
                      style={{ fontSize: 10, letterSpacing: 2 }}
                    >
                      FERMER
                    </Text>
                  </PressableScale>
                </View>
              </Animated.View>

              <View className="h-px bg-paper-300 my-6" />

              {route === "menu" && (
                <View className="gap-2">
                  <Animated.View entering={enterFadeUp(1, reducedMotion ?? false)}>
                    <PressableScale
                      disabled={menuDisabled}
                      onPress={() => setRoute("photo")}
                      className="bg-ink-900 px-5 py-5"
                      style={{ opacity: menuDisabled ? 0.4 : 1 }}
                    >
                      <View className="flex-row items-end justify-between">
                        <Text className="font-display text-paper" style={{ fontSize: 22, letterSpacing: 0.4 }}>
                          PHOTO
                        </Text>
                        <Text className="font-body text-ink-300" style={{ fontSize: 11, letterSpacing: 1.2 }}>
                          CAPTURE OU GALERIE
                        </Text>
                      </View>
                    </PressableScale>
                  </Animated.View>

                  <Animated.View entering={enterFadeUp(2, reducedMotion ?? false)}>
                    <PressableScale
                      disabled={menuDisabled}
                      onPress={() => setRoute("link")}
                      className="border border-ink-900 bg-paper-50 px-5 py-5"
                      style={{ opacity: menuDisabled ? 0.4 : 1 }}
                    >
                      <View className="flex-row items-end justify-between">
                        <Text className="font-display text-ink-900" style={{ fontSize: 22, letterSpacing: 0.4 }}>
                          LIEN
                        </Text>
                        <Text className="font-body text-ice-600" style={{ fontSize: 11, letterSpacing: 1.2 }}>
                          COLLE UNE URL
                        </Text>
                      </View>
                    </PressableScale>
                  </Animated.View>

                  <Animated.View entering={enterFadeUp(3, reducedMotion ?? false)}>
                    <PressableScale
                      disabled={menuDisabled}
                      onPress={() => setRoute("text")}
                      className="border border-paper-300 bg-paper-50 px-5 py-4"
                      style={{ opacity: menuDisabled ? 0.4 : 1 }}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="font-body-medium text-ink-900" style={{ fontSize: 13, letterSpacing: 1.4 }}>
                          + DÉCRIRE EN TEXTE
                        </Text>
                        <Text className="font-body text-ink-300" style={{ fontSize: 10, letterSpacing: 1.6 }}>
                          GEMINI LIT
                        </Text>
                      </View>
                    </PressableScale>
                  </Animated.View>
                </View>
              )}

              {route === "photo" && !pendingPhoto && (
                <View className="gap-2">
                  <PressableScale
                    disabled={analyzing}
                    onPress={() => pickPhoto(true)}
                    className="bg-ink-900 px-5 py-5"
                    style={{ opacity: analyzing ? 0.4 : 1 }}
                  >
                    <View className="flex-row items-end justify-between">
                      <Text className="font-display text-paper" style={{ fontSize: 22, letterSpacing: 0.4 }}>
                        CAMÉRA
                      </Text>
                      <Text className="font-body text-ink-300" style={{ fontSize: 11, letterSpacing: 1.2 }}>
                        PRENDS LA PHOTO
                      </Text>
                    </View>
                  </PressableScale>
                  <PressableScale
                    disabled={analyzing}
                    onPress={() => pickPhoto(false)}
                    className="border border-ink-900 bg-paper-50 px-5 py-5"
                    style={{ opacity: analyzing ? 0.4 : 1 }}
                  >
                    <View className="flex-row items-end justify-between">
                      <Text className="font-display text-ink-900" style={{ fontSize: 22, letterSpacing: 0.4 }}>
                        GALERIE
                      </Text>
                      <Text className="font-body text-ice-600" style={{ fontSize: 11, letterSpacing: 1.2 }}>
                        DEPUIS TES PHOTOS
                      </Text>
                    </View>
                  </PressableScale>
                  <PressableScale onPress={() => setRoute("menu")} className="py-3 items-center">
                    <Text className="font-body-medium text-ink-500" style={{ fontSize: 11, letterSpacing: 1.6 }}>
                      RETOUR
                    </Text>
                  </PressableScale>
                </View>
              )}

              {route === "photo" && pendingPhoto && (
                <View className="gap-3">
                  <Image
                    source={{ uri: pendingPhoto.uri }}
                    style={{ width: "100%", height: 280, backgroundColor: colors.paper[300] }}
                  />
                  <EyeKindChips value={kind} onChange={setKind} disabled={analyzing} />
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    multiline
                    placeholder="Une note ? Pourquoi tu l'as retenue ?"
                    placeholderTextColor={colors.ink[300]}
                    className="border border-paper-300 bg-paper-50 p-4 font-body text-ink-900"
                    style={{ minHeight: 72, fontSize: 14, textAlignVertical: "top" }}
                  />
                </View>
              )}

              {route === "link" && !urlPreview && (
                <View className="gap-3">
                  <TextInput
                    value={url}
                    onChangeText={(v) => { setUrl(v); setUrlError(null); }}
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    placeholder="https://"
                    placeholderTextColor={colors.ink[300]}
                    className="border border-ink-900 bg-paper-50 px-4 py-4 text-ink-900"
                    style={{ fontFamily: URL_INPUT_FONT, fontSize: 13 }}
                  />
                  {urlError && (
                    <Text className="font-body text-error" style={{ fontSize: 12 }}>
                      {urlError}
                    </Text>
                  )}
                  <PressableScale
                    disabled={analyzing || !url.trim()}
                    onPress={onFetchUrl}
                    className="bg-ink-900 py-4 items-center"
                    style={{ opacity: analyzing || !url.trim() ? 0.4 : 1 }}
                  >
                    <Text className="font-display text-paper" style={{ fontSize: 16, letterSpacing: 1.2 }}>
                      LIRE
                    </Text>
                  </PressableScale>
                  <PressableScale onPress={() => setRoute("menu")} className="py-3 items-center">
                    <Text className="font-body-medium text-ink-500" style={{ fontSize: 11, letterSpacing: 1.6 }}>
                      RETOUR
                    </Text>
                  </PressableScale>
                </View>
              )}

              {route === "link" && urlPreview && (
                <View className="gap-3">
                  {urlPreview.image && (
                    <Image
                      source={{ uri: urlPreview.image }}
                      style={{ width: "100%", height: 240, backgroundColor: colors.paper[300] }}
                    />
                  )}
                  <View>
                    <Text className="font-body-medium text-ice-600" style={{ fontSize: 10, letterSpacing: 2 }}>
                      {urlPreview.site_name ?? "SOURCE"}
                    </Text>
                    <Text className="font-display text-ink-900 mt-1" style={{ fontSize: 20, letterSpacing: -0.2 }}>
                      {urlPreview.title ?? "sans titre"}
                    </Text>
                  </View>
                  <EyeKindChips value={kind} onChange={setKind} disabled={analyzing} />
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    multiline
                    placeholder="Une note ?"
                    placeholderTextColor={colors.ink[300]}
                    className="border border-paper-300 bg-paper-50 p-4 font-body text-ink-900"
                    style={{ minHeight: 72, fontSize: 14, textAlignVertical: "top" }}
                  />
                </View>
              )}

              {route === "text" && (
                <View className="gap-3">
                  <Text className="font-body text-ink-500" style={{ fontSize: 12 }}>
                    Décris la pièce, l'adresse ou la planche.
                  </Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    autoFocus
                    placeholder="Une veste laine, coupe un peu ample, ton camel — vue chez Document."
                    placeholderTextColor={colors.ink[300]}
                    className="border border-ink-900 bg-paper-50 p-4 font-body text-ink-900"
                    style={{ minHeight: 120, fontSize: 15, textAlignVertical: "top" }}
                  />
                  <EyeKindChips value={kind} onChange={setKind} disabled={analyzing} />
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    multiline
                    placeholder="Une note ?"
                    placeholderTextColor={colors.ink[300]}
                    className="border border-paper-300 bg-paper-50 p-4 font-body text-ink-900"
                    style={{ minHeight: 60, fontSize: 14, textAlignVertical: "top" }}
                  />
                </View>
              )}

              {(previewStep || route === "text") && (
                <View className="gap-2 mt-5">
                  <PressableScale
                    disabled={analyzing || (route === "text" && !description.trim())}
                    onPress={onConfirm}
                    className="bg-ink-900 py-4 items-center"
                    style={{ opacity: analyzing || (route === "text" && !description.trim()) ? 0.4 : 1 }}
                  >
                    <Text className="font-display text-paper" style={{ fontSize: 16, letterSpacing: 1.2 }}>
                      DÉPOSER
                    </Text>
                  </PressableScale>
                  <PressableScale onPress={reset} className="py-3 items-center">
                    <Text className="font-body-medium text-ink-500" style={{ fontSize: 11, letterSpacing: 1.6 }}>
                      RECOMMENCER
                    </Text>
                  </PressableScale>
                </View>
              )}

              {analyzing && (
                <View className="flex-row items-center gap-2 mt-5">
                  <ActivityIndicator color={colors.ice[600]} size="small" />
                  <Text className="font-body text-ice-600" style={{ fontSize: 11, letterSpacing: 1.2 }}>
                    ANALYSE
                  </Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
