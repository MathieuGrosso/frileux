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
import { SafeAreaView } from "react-native-safe-area-context";
import { REJECTION_REASONS, type RefinementChainItem, type RejectionReason } from "@/lib/rejections";
import { colors } from "@/lib/theme";

interface Props {
  visible: boolean;
  refining: boolean;
  favoriteBrands: string[];
  steerText: string;
  steerBrands: string[];
  refinementChain?: RefinementChainItem[];
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
  refinementChain,
  onSteerTextChange,
  onToggleBrand,
  onRefine,
  onClose,
}: Props) {
  const canSubmit = !refining && (steerText.trim().length > 0 || steerBrands.length > 0);
  const chain = refinementChain ?? [];
  const nextIteration = chain.length + 1;
  const previousAsks: string[] = [];
  for (const item of chain) {
    if (item.steer_text && item.steer_text.trim()) previousAsks.push(`« ${item.steer_text.trim().slice(0, 40)} »`);
    if (item.steer_brands && item.steer_brands.length) previousAsks.push(item.steer_brands.slice(0, 2).join(" · "));
  }

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
              <Text className="font-body-medium text-eyebrow text-ink-900">
                {chain.length > 0
                  ? `RAFFINER · ITÉRATION ${String(nextIteration).padStart(2, "0")}`
                  : "RAFFINER"}
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text className="font-body-medium text-eyebrow text-ice">FERMER</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerClassName="px-6 pt-6 pb-8"
              keyboardShouldPersistTaps="handled"
            >
              {chain.length > 0 && previousAsks.length > 0 && (
                <View className="mb-6 pb-6 border-b border-paper-300">
                  <Text className="font-body-medium text-micro text-ink-300 mb-2">
                    DÉJÀ DEMANDÉ AUJOURD'HUI
                  </Text>
                  <Text className="font-body text-body-sm text-ink-500 leading-snug">
                    {previousAsks.slice(-4).join("  ·  ")}
                  </Text>
                </View>
              )}
              <Text className="font-body-medium text-micro text-ink-300 mb-4">
                POURQUOI PAS CELLE-CI
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {REJECTION_REASONS.filter((r) => r.value !== "autre").map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => onRefine({ reason: opt.value })}
                    disabled={refining}
                    className={`py-2 px-3 border border-paper-300 bg-paper-50 ${refining ? "opacity-50" : "active:bg-paper-200"}`}
                  >
                    <Text className="font-body text-xs text-ink-900">{opt.label}</Text>
                  </Pressable>
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
                        <Pressable
                          key={brand}
                          onPress={() => onToggleBrand(brand)}
                          disabled={refining}
                          className={`py-2 px-3 border ${active ? "bg-ink-900 border-ink-900" : "bg-paper-50 border-paper-300"}`}
                        >
                          <Text className={`font-body text-xs ${active ? "text-paper" : "text-ink-900"}`}>
                            {brand}
                          </Text>
                        </Pressable>
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
              <Pressable
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
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
