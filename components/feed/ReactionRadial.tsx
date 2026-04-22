import { Modal, View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import {
  OUTFIT_REACTION_KINDS,
  OUTFIT_REACTION_LABELS,
  type OutfitReactionKind,
} from "@/hooks/useOutfitReactions";

interface Props {
  visible: boolean;
  mine: Set<OutfitReactionKind>;
  onToggle: (kind: OutfitReactionKind) => void;
  onClose: () => void;
}

export function ReactionRadial({ visible, mine, onToggle, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-ink-900/70"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-paper-100 border border-paper-300 px-10 py-8"
          style={{ minWidth: 220 }}
        >
          <Text
            className="font-body-medium text-micro text-ink-300 mb-5 text-center"
            style={{ letterSpacing: 1.8 }}
          >
            NOTER
          </Text>
          {OUTFIT_REACTION_KINDS.map((kind) => {
            const active = mine.has(kind);
            return (
              <Pressable
                key={kind}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onToggle(kind);
                  onClose();
                }}
                hitSlop={10}
                className="py-3 active:opacity-50"
              >
                <Text
                  className={`font-display text-center ${active ? "text-ink-900" : "text-ink-500"}`}
                  style={{
                    fontSize: 28,
                    letterSpacing: -0.3,
                    textDecorationLine: active ? "underline" : "none",
                  }}
                >
                  {OUTFIT_REACTION_LABELS[kind]}
                </Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
