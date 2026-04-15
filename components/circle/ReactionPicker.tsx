import { Modal, View, Text, Pressable } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  REACTION_KEYS,
  REACTION_GLYPHS,
  type ReactionKey,
} from "@/hooks/useMessageReactions";

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (key: ReactionKey) => void;
  onDelete?: () => void;
}

export function ReactionPicker({ visible, onClose, onPick, onDelete }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(15,15,13,0.45)" }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-paper-100 border-t border-ink-100 px-6 py-8"
        >
          <Text
            className="font-body-medium text-ink-500 mb-6"
            style={{ fontSize: 10, letterSpacing: 3 }}
          >
            RÉAGIR
          </Text>
          <View className="flex-row justify-between mb-6">
            {REACTION_KEYS.map((k) => (
              <PressableScale
                key={k}
                onPress={() => {
                  onPick(k);
                  onClose();
                }}
                className="items-center justify-center"
                style={{ width: 56, height: 56, borderWidth: 1, borderColor: "#0F0F0D" }}
              >
                <Text className="text-ink-900" style={{ fontSize: 24 }}>
                  {REACTION_GLYPHS[k]}
                </Text>
              </PressableScale>
            ))}
          </View>

          {onDelete && (
            <PressableScale
              onPress={() => {
                onDelete();
                onClose();
              }}
              className="border border-error py-3 items-center"
            >
              <Text
                className="font-body-semibold text-error"
                style={{ fontSize: 11, letterSpacing: 2.5 }}
              >
                SUPPRIMER LE MESSAGE
              </Text>
            </PressableScale>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
