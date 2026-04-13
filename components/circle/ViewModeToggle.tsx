import { View, Text, Pressable } from "react-native";
import type { CircleViewMode } from "@/hooks/useCircle";

interface Props {
  mode: CircleViewMode;
  onChange: (mode: CircleViewMode) => void;
}

const ITEMS: { value: CircleViewMode; label: string }[] = [
  { value: "today", label: "AUJOURD'HUI" },
  { value: "week", label: "CETTE SEMAINE" },
];

export function ViewModeToggle({ mode, onChange }: Props) {
  return (
    <View className="flex-row gap-5 px-6 py-3">
      {ITEMS.map((it) => {
        const active = it.value === mode;
        return (
          <Pressable key={it.value} onPress={() => onChange(it.value)}>
            <Text
              className={`font-body-semibold text-[11px] ${active ? "text-ink-900" : "text-ink-300"}`}
              style={{ letterSpacing: 2 }}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
