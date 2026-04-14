import { View, Text, ActivityIndicator } from "react-native";
import { colors } from "@/lib/theme";

interface AISuggestionProps {
  suggestion: string | null;
  loading: boolean;
}

export function AISuggestion({ suggestion, loading }: AISuggestionProps) {
  if (loading) {
    return null;
  }

  return (
    <View className="bg-paper-300 p-5 mt-4">
      <Text className="text-ice-700 text-eyebrow font-body-semibold uppercase mb-3">
        Suggestion du jour
      </Text>

      {suggestion ? (
        <Text className="text-ink-900 text-body font-body">
          {suggestion}
        </Text>
      ) : (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color={colors.ice[600]} />
          <Text className="text-ink-500 text-body-sm font-body">
            L&apos;IA prépare ta suggestion...
          </Text>
        </View>
      )}
    </View>
  );
}
