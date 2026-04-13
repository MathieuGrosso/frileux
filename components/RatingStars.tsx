import { View, Pressable } from "react-native";

interface RatingStarsProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: "small" | "default";
}

export function RatingStars({ rating, onRate, size = "default" }: RatingStarsProps) {
  const dim = size === "small" ? "w-[7px] h-[7px]" : "w-[11px] h-[11px]";
  const gap = size === "small" ? 5 : 9;

  return (
    <View className="flex-row items-center" style={{ gap }}>
      {[1, 2, 3, 4, 5].map((dot) => {
        const filled = dot <= rating;
        return (
          <Pressable
            key={dot}
            onPress={() => onRate?.(dot)}
            disabled={!onRate}
            hitSlop={10}
            className={`${dim} border ${filled ? "bg-ink-900 border-ink-900" : "border-ink-200"}`}
          />
        );
      })}
    </View>
  );
}
