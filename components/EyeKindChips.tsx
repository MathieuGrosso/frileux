import { View, Text } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { KIND_LABEL } from "@/lib/inspirations";
import type { InspirationKind } from "@/lib/types";

interface Props {
  value: InspirationKind;
  onChange: (kind: InspirationKind) => void;
  disabled?: boolean;
}

const KINDS: InspirationKind[] = ["piece", "shop", "lookbook"];

export function EyeKindChips({ value, onChange, disabled }: Props) {
  return (
    <View className="flex-row gap-2">
      {KINDS.map((kind) => {
        const active = kind === value;
        return (
          <PressableScale
            key={kind}
            disabled={disabled}
            onPress={() => onChange(kind)}
            className={
              "flex-1 py-3 border " +
              (active ? "bg-ink-900 border-ink-900" : "bg-paper-50 border-ink-900")
            }
            style={{ opacity: disabled ? 0.4 : 1 }}
          >
            <Text
              className={
                "font-display text-center " + (active ? "text-paper" : "text-ink-900")
              }
              style={{ fontSize: 15, letterSpacing: 1.2 }}
            >
              {KIND_LABEL[kind]}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
