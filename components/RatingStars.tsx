import { View, Text, Pressable, StyleSheet } from "react-native";

interface RatingStarsProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: "small" | "default";
}

export function RatingStars({ rating, onRate, size = "default" }: RatingStarsProps) {
  const starSize = size === "small" ? 16 : 26;

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => onRate?.(star)}
          disabled={!onRate}
          style={styles.star}
        >
          <Text style={[{ fontSize: starSize }, star <= rating ? styles.filled : styles.empty]}>
            {star <= rating ? "★" : "☆"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 4 },
  star: { padding: 2 },
  filled: { color: "#F59E0B" },
  empty: { color: "#44403C" },
});
