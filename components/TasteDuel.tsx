import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import type { TasteProbe, TastePiece } from "@/lib/tasteProbes";

interface Props {
  probe: TasteProbe;
  onChoose: (choice: "a" | "b") => void;
  disabled?: boolean;
}

const TYPE_LABEL: Record<TastePiece["type"], string> = {
  top: "HAUT",
  bottom: "BAS",
  outerwear: "MANTEAU",
  shoes: "CHAUSSURES",
  accessory: "ACCESSOIRE",
};

function pieceLine(p: TastePiece): string {
  const material = p.material && p.material !== "mixte" ? p.material : null;
  const parts = [p.color, material].filter(Boolean) as string[];
  const suffix = parts.length > 0 ? ` · ${parts.join(", ")}` : "";
  const base = `${p.description}${suffix}`;
  return base.length > 60 ? `${base.slice(0, 57)}…` : base;
}

interface SideProps {
  label: "A" | "B";
  text: string;
  tags: string[];
  pieces: TastePiece[] | null;
  pressed: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function Side({ label, text, tags, pieces, pressed, disabled, onPress }: SideProps) {
  const shownPieces = pieces ? pieces.slice(0, 4) : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-1 p-4 border ${pressed ? "border-ink-900 border-2 bg-ice/10" : "border-paper-300 bg-paper"}`}
      style={{ minHeight: 260 }}
    >
      <Text className="font-body-medium text-caption text-ink-300 uppercase tracking-widest mb-4">
        Option {label}
      </Text>

      {shownPieces ? (
        <View className="flex-1" style={{ gap: 10 }}>
          {shownPieces.map((p, i) => (
            <View key={i}>
              <Text className="font-body text-micro text-ink-400 uppercase tracking-widest mb-0.5">
                {TYPE_LABEL[p.type] ?? p.type.toUpperCase()}
              </Text>
              <Text className="font-display text-body-sm text-ink-900 leading-snug">
                {pieceLine(p)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text
          className="font-display text-body-sm text-ink-900 leading-snug flex-1"
          numberOfLines={6}
        >
          {text}
        </Text>
      )}

      {tags.length > 0 && (
        <Text className="font-body-medium text-micro text-ice uppercase tracking-widest mt-4">
          {tags.slice(0, 3).join(" · ")}
        </Text>
      )}
    </Pressable>
  );
}

export function TasteDuel({ probe, onChoose, disabled }: Props) {
  const [pressed, setPressed] = useState<"a" | "b" | null>(null);

  function handle(choice: "a" | "b") {
    if (disabled) return;
    setPressed(choice);
    Haptics.selectionAsync().catch(() => {});
    onChoose(choice);
  }

  return (
    <View className="flex-row items-stretch">
      <Side
        label="A"
        text={probe.option_a_text}
        tags={probe.option_a_tags}
        pieces={probe.option_a_pieces}
        pressed={pressed === "a"}
        disabled={disabled}
        onPress={() => handle("a")}
      />
      <View className="w-px bg-paper-300" />
      <Side
        label="B"
        text={probe.option_b_text}
        tags={probe.option_b_tags}
        pieces={probe.option_b_pieces}
        pressed={pressed === "b"}
        disabled={disabled}
        onPress={() => handle("b")}
      />
    </View>
  );
}
