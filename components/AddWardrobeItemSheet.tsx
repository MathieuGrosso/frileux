import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { PressableScale } from "@/components/ui/PressableScale";
import { enterFadeUp } from "@/lib/animations";
import { colors } from "@/lib/theme";
import type { WardrobeItem } from "@/lib/types";
import { useWardrobeAdd } from "@/hooks/useWardrobeAdd";

interface Props {
  visible: boolean;
  onClose: () => void;
  onItemAdded?: (item: WardrobeItem) => void;
}

export default function AddWardrobeItemSheet({ visible, onClose, onItemAdded }: Props) {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const [textOpen, setTextOpen] = useState(false);
  const [textInput, setTextInput] = useState("");

  const {
    analyzing,
    pendingPhoto,
    pickPhoto,
    cancelPending,
    confirmPendingAsSingle,
    confirmPendingAsMulti,
    submitText,
  } = useWardrobeAdd({ onItemAdded });

  useEffect(() => {
    if (!visible) {
      setTextOpen(false);
      setTextInput("");
    }
  }, [visible]);

  async function onSubmitText() {
    const value = textInput;
    setTextInput("");
    setTextOpen(false);
    await submitText(value);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 bg-ink-900/30 justify-end">
        <PressableScale
          onPress={onClose}
          scaleTo={1}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: height * 0.2 }}
          accessibilityLabel="Fermer"
        />
        <View className="bg-paper border-t border-paper-300">
          <SafeAreaView edges={["bottom"]}>
            <View className="px-6 pt-6 pb-7">
              <Animated.View entering={enterFadeUp(0, reducedMotion ?? false)}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <Text
                      className="font-body-medium text-ice-600"
                      style={{ fontSize: 10, letterSpacing: 2 }}
                    >
                      VESTIAIRE / +
                    </Text>
                    <Text
                      className="font-display text-ink-900 mt-2"
                      style={{ fontSize: 36, letterSpacing: -0.6, lineHeight: 38 }}
                    >
                      AJOUTER UNE PIÈCE
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

              <View className="h-px bg-paper-300 mt-5 mb-4" />

              <Animated.View entering={enterFadeUp(1, reducedMotion ?? false)}>
                <ActionRow
                  label="CAMÉRA"
                  caption="prends la photo"
                  variant="primary"
                  disabled={analyzing}
                  onPress={() => pickPhoto(true)}
                />
              </Animated.View>

              <Animated.View
                entering={enterFadeUp(2, reducedMotion ?? false)}
                className="mt-2"
              >
                <ActionRow
                  label="GALERIE"
                  caption="depuis tes photos"
                  variant="secondary"
                  disabled={analyzing}
                  onPress={() => pickPhoto(false)}
                />
              </Animated.View>

              <Animated.View
                entering={enterFadeUp(3, reducedMotion ?? false)}
                className="mt-2"
              >
                <ActionRow
                  label="TEXTE"
                  caption="gemini génère l'image"
                  variant="secondary"
                  disabled={analyzing}
                  onPress={() => setTextOpen(true)}
                />
              </Animated.View>

              {analyzing && (
                <View className="flex-row items-center gap-2 mt-5">
                  <ActivityIndicator color={colors.ice[600]} size="small" />
                  <Text
                    className="font-body text-ice-600"
                    style={{ fontSize: 11, letterSpacing: 1.2 }}
                  >
                    GEMINI ANALYSE…
                  </Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </View>

      <Modal
        visible={!!pendingPhoto}
        animationType="fade"
        transparent
        onRequestClose={cancelPending}
        statusBarTranslucent
      >
        <View className="flex-1 bg-ink-900/70 justify-end">
          <View className="bg-paper">
            <SafeAreaView edges={["bottom"]}>
              <View className="px-6 pt-6 pb-6">
                <View className="flex-row items-center justify-between">
                  <Text
                    className="font-body-medium text-ice-600"
                    style={{ fontSize: 10, letterSpacing: 2 }}
                  >
                    CETTE PHOTO
                  </Text>
                  <PressableScale onPress={cancelPending} hitSlop={12}>
                    <Text
                      className="font-body-medium text-ink-500"
                      style={{ fontSize: 10, letterSpacing: 2 }}
                    >
                      ANNULER
                    </Text>
                  </PressableScale>
                </View>

                {pendingPhoto && (
                  <View className="mt-4 bg-paper-300" style={{ aspectRatio: 1 }}>
                    <Image
                      source={{ uri: pendingPhoto.uri }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </View>
                )}

                <Text
                  className="font-body text-ink-500 mt-4"
                  style={{ fontSize: 12, letterSpacing: 0.2 }}
                >
                  Une pièce, ou plusieurs à extraire ?
                </Text>

                <View className="mt-3">
                  <ActionRow
                    label="UNE PIÈCE"
                    caption="une photo, une entrée"
                    variant="primary"
                    onPress={confirmPendingAsSingle}
                  />
                </View>
                <View className="mt-2">
                  <ActionRow
                    label="PLUSIEURS"
                    caption="gemini sépare les vêtements"
                    variant="secondary"
                    onPress={confirmPendingAsMulti}
                  />
                </View>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={textOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setTextOpen(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 bg-ink-900/60 justify-end"
        >
          <View className="bg-paper">
            <SafeAreaView edges={["bottom"]}>
              <View className="px-6 pt-6 pb-6">
                <View className="flex-row items-center justify-between">
                  <Text
                    className="font-body-medium text-ice-600"
                    style={{ fontSize: 10, letterSpacing: 2 }}
                  >
                    DÉCRIS LA PIÈCE
                  </Text>
                  <PressableScale onPress={() => setTextOpen(false)} hitSlop={12}>
                    <Text
                      className="font-body-medium text-ink-500"
                      style={{ fontSize: 10, letterSpacing: 2 }}
                    >
                      FERMER
                    </Text>
                  </PressableScale>
                </View>
                <Text
                  className="font-body text-ink-500 mt-3"
                  style={{ fontSize: 12 }}
                >
                  Ex : « pull oversize beige en laine », « jean noir droit taille haute »
                </Text>
                <TextInput
                  value={textInput}
                  onChangeText={setTextInput}
                  multiline
                  autoFocus
                  placeholder="Ta pièce…"
                  placeholderTextColor={colors.ink[300]}
                  className="mt-4 border border-ink-900 bg-paper-50 p-4 font-body text-ink-900"
                  style={{ minHeight: 88, fontSize: 15, textAlignVertical: "top" }}
                />
                <View className="mt-3">
                  <ActionRow
                    label="ANALYSER"
                    caption="gemini lit et génère"
                    variant="primary"
                    disabled={!textInput.trim()}
                    onPress={onSubmitText}
                  />
                </View>
              </View>
            </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}

interface ActionRowProps {
  label: string;
  caption: string;
  variant: "primary" | "secondary";
  disabled?: boolean;
  onPress: () => void;
}

function ActionRow({ label, caption, variant, disabled, onPress }: ActionRowProps) {
  const isPrimary = variant === "primary";
  const containerClass = isPrimary
    ? "bg-ink-900 px-5 py-4"
    : "border border-ink-900 bg-paper-50 px-5 py-4";
  const labelClass = isPrimary ? "text-paper" : "text-ink-900";
  const captionClass = isPrimary ? "text-ink-300" : "text-ice-600";

  return (
    <PressableScale
      disabled={disabled}
      onPress={onPress}
      className={containerClass}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <View className="flex-row items-baseline justify-between">
        <Text
          className={`font-display ${labelClass}`}
          style={{ fontSize: 20, letterSpacing: 0.4 }}
        >
          {label}
        </Text>
        <Text
          className={`font-body ${captionClass}`}
          style={{ fontSize: 11, letterSpacing: 1.2 }}
        >
          {caption.toUpperCase()}
        </Text>
      </View>
    </PressableScale>
  );
}
