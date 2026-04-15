import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
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
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: height * 0.25 }}
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
                      className="font-display text-ink-900 mt-1"
                      style={{ fontSize: 44, letterSpacing: -0.8, lineHeight: 44 }}
                    >
                      AJOUTER{"\n"}UNE PIÈCE
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

              <Animated.View entering={enterFadeUp(1, reducedMotion ?? false)}>
                <PressableScale
                  disabled={analyzing}
                  onPress={() => pickPhoto(true)}
                  className="bg-ink-900 px-5 py-5"
                  style={{ opacity: analyzing ? 0.4 : 1 }}
                >
                  <View className="flex-row items-end justify-between">
                    <Text
                      className="font-display text-paper"
                      style={{ fontSize: 22, letterSpacing: 0.4 }}
                    >
                      CAMÉRA
                    </Text>
                    <Text
                      className="font-body text-ink-300"
                      style={{ fontSize: 11, letterSpacing: 1.2 }}
                    >
                      PRENDS LA PHOTO
                    </Text>
                  </View>
                </PressableScale>
              </Animated.View>

              <Animated.View
                entering={enterFadeUp(2, reducedMotion ?? false)}
                className="mt-2"
              >
                <PressableScale
                  disabled={analyzing}
                  onPress={() => pickPhoto(false)}
                  className="border border-ink-900 bg-paper-50 px-5 py-5"
                  style={{ opacity: analyzing ? 0.4 : 1 }}
                >
                  <View className="flex-row items-end justify-between">
                    <Text
                      className="font-display text-ink-900"
                      style={{ fontSize: 22, letterSpacing: 0.4 }}
                    >
                      GALERIE
                    </Text>
                    <Text
                      className="font-body text-ice-600"
                      style={{ fontSize: 11, letterSpacing: 1.2 }}
                    >
                      DEPUIS TES PHOTOS
                    </Text>
                  </View>
                </PressableScale>
              </Animated.View>

              <Animated.View
                entering={enterFadeUp(3, reducedMotion ?? false)}
                className="mt-2"
              >
                <PressableScale
                  disabled={analyzing}
                  onPress={() => setTextOpen(true)}
                  className="border border-paper-300 bg-paper-50 px-5 py-4"
                  style={{ opacity: analyzing ? 0.4 : 1 }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="font-body-medium text-ink-900"
                      style={{ fontSize: 13, letterSpacing: 1.4 }}
                    >
                      + DÉCRIRE EN TEXTE
                    </Text>
                    <Text
                      className="font-body text-ink-300"
                      style={{ fontSize: 10, letterSpacing: 1.6 }}
                    >
                      GEMINI GÉNÈRE
                    </Text>
                  </View>
                </PressableScale>
              </Animated.View>

              {analyzing && (
                <Animated.View
                  entering={enterFadeUp(0, reducedMotion ?? false)}
                  className="flex-row items-center gap-2 mt-5"
                >
                  <ActivityIndicator color={colors.ice[600]} size="small" />
                  <Text
                    className="font-body text-ice-600"
                    style={{ fontSize: 11, letterSpacing: 1.2 }}
                  >
                    GEMINI ANALYSE…
                  </Text>
                </Animated.View>
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
        <View className="flex-1 bg-ink-900/60 justify-end">
          <View className="bg-paper px-6 pt-6 pb-10">
            <Text
              className="font-body-medium text-ice-600"
              style={{ fontSize: 10, letterSpacing: 2 }}
            >
              CETTE PHOTO
            </Text>
            {pendingPhoto && (
              <Image
                source={{ uri: pendingPhoto.uri }}
                style={{ width: "100%", height: 220, marginTop: 12, backgroundColor: colors.paper[300] }}
              />
            )}
            <Text
              className="font-body text-ink-500 mt-3"
              style={{ fontSize: 12 }}
            >
              Une seule pièce, ou plusieurs à extraire ?
            </Text>
            <View className="mt-4 gap-2">
              <PressableScale
                onPress={confirmPendingAsSingle}
                className="border border-ink-900 bg-paper-50 px-5 py-4"
              >
                <Text
                  className="font-display text-ink-900"
                  style={{ fontSize: 18, letterSpacing: 0.4 }}
                >
                  UNE PIÈCE
                </Text>
                <Text className="font-body text-ink-500 mt-0.5" style={{ fontSize: 11 }}>
                  une photo, une entrée
                </Text>
              </PressableScale>
              <PressableScale
                onPress={confirmPendingAsMulti}
                className="bg-ink-900 px-5 py-4"
              >
                <Text
                  className="font-display text-paper"
                  style={{ fontSize: 18, letterSpacing: 0.4 }}
                >
                  EXTRAIRE LES PIÈCES
                </Text>
                <Text className="font-body text-ink-300 mt-0.5" style={{ fontSize: 11 }}>
                  Gemini sépare chaque vêtement
                </Text>
              </PressableScale>
              <PressableScale
                onPress={cancelPending}
                className="px-5 py-3 items-center"
              >
                <Text
                  className="font-body-medium text-ink-500"
                  style={{ fontSize: 11, letterSpacing: 1.6 }}
                >
                  ANNULER
                </Text>
              </PressableScale>
            </View>
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
          <View className="bg-paper px-6 pt-6 pb-10">
            <Text
              className="font-body-medium text-ice-600"
              style={{ fontSize: 10, letterSpacing: 2 }}
            >
              DÉCRIS LA PIÈCE
            </Text>
            <Text
              className="font-body text-ink-500 mt-2"
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
            <View className="flex-row gap-2 mt-4">
              <PressableScale
                onPress={() => setTextOpen(false)}
                className="flex-1 border border-ink-900 bg-paper-50 py-4 items-center"
              >
                <Text
                  className="font-display-medium text-ink-900"
                  style={{ fontSize: 14, letterSpacing: 1.2 }}
                >
                  ANNULER
                </Text>
              </PressableScale>
              <PressableScale
                onPress={onSubmitText}
                disabled={!textInput.trim()}
                className="flex-1 bg-ink-900 py-4 items-center"
                style={{ opacity: textInput.trim() ? 1 : 0.4 }}
              >
                <Text
                  className="font-display text-paper"
                  style={{ fontSize: 14, letterSpacing: 1.4 }}
                >
                  ANALYSER
                </Text>
              </PressableScale>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}
