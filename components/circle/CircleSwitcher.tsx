import { View, Text, Pressable, ScrollView } from "react-native";
import type { Circle } from "@/lib/types";

interface Props {
  circles: Circle[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function CircleSwitcher({ circles, activeId, onSelect }: Props) {
  if (circles.length <= 1) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12, gap: 8 }}
      className="border-b border-paper-300"
    >
      {circles.map((c) => {
        const active = c.id === activeId;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            className={`border px-3 py-1.5 ${active ? "border-ink-900 bg-ink-900" : "border-paper-300 bg-paper-100"}`}
          >
            <Text
              className={`font-body-semibold text-eyebrow ${active ? "text-paper-100" : "text-ink-500"}`}
              style={{ letterSpacing: 1.5 }}
            >
              {c.name.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
