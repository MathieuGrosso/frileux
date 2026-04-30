import { View, Text, ScrollView, Pressable } from "react-native";
import { colors } from "@/lib/theme";

export interface Recipe {
  command: string;
  label: string;
  hint?: string;
}

export const RECIPES: Recipe[] = [
  { command: "feedback", label: "Feedback garde-robe", hint: "audit complet" },
  { command: "coach", label: "Coach me", hint: "/coach <prénom>" },
  { command: "tenue", label: "Une tenue", hint: "propose maintenant" },
  { command: "effacer", label: "Effacer", hint: "nouveau thread" },
];

interface RecipeChipsProps {
  onPickRecipe: (recipe: Recipe) => void;
  onOpenAll: () => void;
}

export function RecipeChips({ onPickRecipe, onOpenAll }: RecipeChipsProps) {
  return (
    <View className="flex-row items-center gap-2 px-4 pb-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {RECIPES.slice(0, 3).map((r) => (
          <Pressable
            key={r.command}
            onPress={() => onPickRecipe(r)}
            className="flex-row items-center border border-ink-200 px-3 py-2 active:opacity-60"
            accessibilityLabel={`Insérer la commande /${r.command}`}
          >
            <View
              className="border border-ink-300 items-center justify-center mr-2"
              style={{ width: 18, height: 18 }}
            >
              <Text
                className="font-body-medium"
                style={{ fontSize: 11, color: colors.ink[700], lineHeight: 14 }}
              >
                /
              </Text>
            </View>
            <Text
              className="font-body-medium"
              style={{ fontSize: 12, letterSpacing: 0.4, color: colors.ink[700] }}
            >
              {r.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        onPress={onOpenAll}
        className="flex-row items-center border border-ink-200 px-3 py-2 active:opacity-60"
        style={{ borderRadius: 2 }}
        accessibilityLabel="Toutes les recipes"
      >
        <View className="flex-row mr-2" style={{ width: 14, height: 14 }}>
          <View
            style={{
              width: 5,
              height: 5,
              backgroundColor: colors.ink[700],
              marginRight: 2,
              marginBottom: 2,
            }}
          />
          <View
            style={{
              width: 5,
              height: 5,
              backgroundColor: colors.ink[700],
              marginBottom: 2,
            }}
          />
          <View
            style={{
              width: 5,
              height: 5,
              backgroundColor: colors.ink[700],
              marginRight: 2,
              position: "absolute",
              top: 7,
              left: 0,
            }}
          />
          <View
            style={{
              width: 5,
              height: 5,
              backgroundColor: colors.ink[700],
              position: "absolute",
              top: 7,
              left: 7,
            }}
          />
        </View>
        <Text
          className="font-body-medium"
          style={{ fontSize: 12, letterSpacing: 0.4, color: colors.ink[700] }}
        >
          Toutes
        </Text>
      </Pressable>
    </View>
  );
}
