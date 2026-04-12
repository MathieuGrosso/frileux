import { View, Pressable, StyleSheet } from "react-native";

interface RatingStarsProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: "small" | "default";
}

export function RatingStars({ rating, onRate, size = "default" }: RatingStarsProps) {
  const dotSize = size === "small" ? 7 : 11;
  const gap = size === "small" ? 5 : 9;

  return (
    <View style={[styles.row, { gap }]}>
      {[1, 2, 3, 4, 5].map((dot) => (
        <Pressable
          key={dot}
          onPress={() => onRate?.(dot)}
          disabled={!onRate}
          hitSlop={10}
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: dot <= rating ? "#0F0F0D" : "transparent",
              borderWidth: 1,
              borderColor: dot <= rating ? "#0F0F0D" : "#C4C0BC",
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  dot: {},
});
