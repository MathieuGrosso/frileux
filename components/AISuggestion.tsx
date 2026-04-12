import { View, Text, ActivityIndicator } from "react-native";

interface AISuggestionProps {
  suggestion: string | null;
  loading: boolean;
}

export function AISuggestion({ suggestion, loading }: AISuggestionProps) {
  if (loading) {
    return null;
  }

  return (
    <View className="bg-cream-500/10 rounded-2xl p-5 mt-4">
      <View className="flex-row items-center gap-2 mb-3">
        <Text className="text-lg">✨</Text>
        <Text className="text-cream-500 font-sans-semibold">
          Suggestion du jour
        </Text>
      </View>

      {suggestion ? (
        <Text className="text-cream-200 text-base leading-6">
          {suggestion}
        </Text>
      ) : (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color="#FFC94D" />
          <Text className="text-cream-300 text-sm">
            L'IA prépare ta suggestion...
          </Text>
        </View>
      )}
    </View>
  );
}
