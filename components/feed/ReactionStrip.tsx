import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import {
  OUTFIT_REACTION_KINDS,
  OUTFIT_REACTION_LABELS,
  type OutfitReactionKind,
  type ReactionCounts,
} from "@/hooks/useOutfitReactions";

interface Props {
  counts: ReactionCounts;
  mine: Set<OutfitReactionKind>;
  onToggle: (kind: OutfitReactionKind) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function ReactionStrip({
  counts,
  mine,
  onToggle,
  disabled,
  size = "sm",
}: Props) {
  const labelClass =
    size === "md"
      ? "text-caption"
      : "text-micro";

  return (
    <View
      className="flex-row flex-wrap mt-3 -mx-2"
      accessibilityRole="toolbar"
    >
      {OUTFIT_REACTION_KINDS.map((kind) => {
        const active = mine.has(kind);
        const count = counts[kind] ?? 0;
        return (
          <Pressable
            key={kind}
            onPress={() => {
              if (disabled) return;
              void Haptics.selectionAsync();
              onToggle(kind);
            }}
            hitSlop={6}
            disabled={disabled}
            accessibilityLabel={`${OUTFIT_REACTION_LABELS[kind]} ${count}`}
            className="px-2 py-1 active:opacity-60"
          >
            <Text
              className={`font-body-medium ${labelClass} ${active ? "text-ink-900" : "text-ink-300"}`}
              style={{ letterSpacing: 1.6 }}
            >
              <Text
                style={{
                  textDecorationLine: active ? "underline" : "none",
                }}
              >
                {OUTFIT_REACTION_LABELS[kind]}
              </Text>
              <Text className={active ? "text-ink-500" : "text-ink-200"}>
                {"  ·  "}
              </Text>
              <Text className={active ? "text-ink-900" : "text-ink-300"}>
                {count}
              </Text>
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
