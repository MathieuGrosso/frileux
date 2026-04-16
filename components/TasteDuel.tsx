import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import type { TasteProbe } from "@/lib/tasteProbes";

interface Props {
  probe: TasteProbe;
  onChoose: (choice: "a" | "b" | "none") => void;
  disabled?: boolean;
}

export function TasteDuel({ probe, onChoose, disabled }: Props) {
  const [pressed, setPressed] = useState<"a" | "b" | null>(null);

  function handle(choice: "a" | "b" | "none") {
    if (disabled) return;
    if (choice !== "none") setPressed(choice);
    onChoose(choice);
  }

  return (
    <View>
      <Text className="font-body text-micro text-ice uppercase tracking-widest mb-3">
        {probe.axis_label_fr}
      </Text>

      <View className="flex-row">
        <Pressable
          onPress={() => handle("a")}
          disabled={disabled}
          className={`flex-1 p-5 border ${pressed === "a" ? "border-ink-900 bg-ice/5" : "border-paper-300 bg-paper"}`}
        >
          <Text className="font-body text-micro text-ink-300 uppercase tracking-widest mb-3">
            Option A
          </Text>
          <Text className="font-display text-body text-ink-900 leading-snug mb-4">
            {probe.option_a_text}
          </Text>
          {probe.option_a_tags.length > 0 && (
            <Text className="font-body text-micro text-ink-400 uppercase tracking-widest">
              {probe.option_a_tags.slice(0, 3).join(" · ")}
            </Text>
          )}
        </Pressable>

        <View className="w-px bg-paper-300" />

        <Pressable
          onPress={() => handle("b")}
          disabled={disabled}
          className={`flex-1 p-5 border ${pressed === "b" ? "border-ink-900 bg-ice/5" : "border-paper-300 bg-paper"}`}
        >
          <Text className="font-body text-micro text-ink-300 uppercase tracking-widest mb-3">
            Option B
          </Text>
          <Text className="font-display text-body text-ink-900 leading-snug mb-4">
            {probe.option_b_text}
          </Text>
          {probe.option_b_tags.length > 0 && (
            <Text className="font-body text-micro text-ink-400 uppercase tracking-widest">
              {probe.option_b_tags.slice(0, 3).join(" · ")}
            </Text>
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={() => handle("none")}
        disabled={disabled}
        className="mt-3 pt-3 border-t border-paper-300 items-center"
      >
        <Text className="font-body text-micro text-ink-400 uppercase tracking-widest">
          — Ni l'un ni l'autre —
        </Text>
      </Pressable>
    </View>
  );
}
