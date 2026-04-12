import { View, Text, Pressable } from "react-native";

interface RatingStarsProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: "small" | "default";
}

export function RatingStars({
  rating,
  onRate,
  size = "default",
}: RatingStarsProps) {
  const starSize = size === "small" ? "text-lg" : "text-2xl";

  return (
    <View className="flex-row gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => onRate?.(star)}
          disabled={!onRate}
        >
          <Text className={`${starSize} ${star <= rating ? "" : "opacity-30"}`}>
            {star <= rating ? "⭐" : "☆"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
