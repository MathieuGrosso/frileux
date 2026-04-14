import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { SafeAreaView } from "react-native-safe-area-context";
import { REJECTION_REASONS, type RejectionReason } from "@/lib/rejections";
import { colors } from "@/lib/theme";

interface Props {
  visible: boolean;
  refining: boolean;
  favoriteBrands: string[];
  steerText: string;
  steerBrands: string[];
  onSteerTextChange: (value: string) => void;
  onToggleBrand: (brand: string) => void;
  onRefine: (opts: {
    reason?: RejectionReason | null;
    steerText?: string;
    steerBrands?: string[];
  }) => void;
  onClose: () => void;
}

export function RefineSheet({
  visible,
  refining,
  favoriteBrands,
  steerText,
  steerBrands,
  onSteerTextChange,
  onToggleBrand,
  onRefine,
  onClose,
}: Props) {
  const canSubmit = !refining && (steerText.trim().length > 0 || steerBrands.length > 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-paper">
        <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View className="flex-row justify-between items-center px-6 pt-2 pb-4 border-b border-paper-300">
              <Text className="font-body-medium text-eyebrow text-ink-900">RAFFINER</Text>
              <PressableScale onPress={onClose} hitSlop={12}>
                <Text className="font-body-medium text-eyebrow text-ice">FERMER</Text>
              </PressableScale>
            </View>

            <ScrollView
              contentContainerClassName="px-6 pt-6 pb-8"
              keyboardShouldPersistTaps="handled"
            >
              <Text className="font-body-medium text-micro text-ink-300 mb-4">
                POURQUOI PAS CELLE-CI
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {REJECTION_REASONS.filter((r) => r.value !== "autre").map((opt) => (
                  <PressableScale
                    key={opt.value}
                    onPress={() => onRefine({ reason: opt.value })}
                    disabled={refining}
                    className={`py-2 px-3 border border-paper-300 bg-paper-50 ${refining ? "opacity-50" : "active:bg-paper-200"}`}
                  >
                    <Text className="font-body text-xs text-ink-900">{opt.label}</Text>
                  </PressableScale>
                ))}
              </View>

              {favoriteBrands.length > 0 && (
                <>
                  <Text className="font-body-medium text-micro text-ink-300 mt-8 mb-4">
                    DANS L'ESPRIT DE
                  </Text>
                  <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                    {favoriteBrands.map((brand) => {
                      const active = steerBrands.includes(brand);
                      return (
                        <PressableScale
                          key={brand}
                          onPress={() => onToggleBrand(brand)}
                          disabled={refining}
                          className={`py-2 px-3 border ${active ? "bg-ink-900 border-ink-900" : "bg-paper-50 border-paper-300"}`}
                        >
                          <Text className={`font-body text-xs ${active ? "text-paper" : "text-ink-900"}`}>
                            {brand}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                </>
              )}

              <Text className="font-body-medium text-micro text-ink-300 mt-8 mb-4">
                AUTREMENT
              </Text>
              <TextInput
                value={steerText}
                onChangeText={onSteerTextChange}
                placeholder="plus cozy, superposé, tonalité terre…"
                placeholderTextColor={colors.ink[300]}
                className="border border-paper-300 bg-paper-50 p-3 font-body text-body-sm text-ink-900"
                style={{ minHeight: 72, textAlignVertical: "top" }}
                multiline
                editable={!refining}
              />
            </ScrollView>

            <View className="px-6 pt-3 pb-4 border-t border-paper-300 bg-paper">
              <PressableScale
                onPress={() =>
                  onRefine({ reason: null, steerText, steerBrands })
                }
                disabled={!canSubmit}
                className={`py-[18px] items-center ${
                  !canSubmit ? "bg-ink-200" : "bg-ink-900 active:bg-ink-700"
                }`}
              >
                <Text className="font-body-semibold text-eyebrow text-paper">
                  {refining ? "…" : "RAFFINER"}
                </Text>
              </PressableScale>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
