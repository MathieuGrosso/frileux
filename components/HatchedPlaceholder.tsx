import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../lib/theme";

interface Props {
  style?: StyleProp<ViewStyle>;
  spacing?: number;
}

/**
 * Placeholder image avec hachures diagonales 1 px ice sur paper.
 * Statique, lit comme un emplacement réservé imprimé.
 */
export function HatchedPlaceholder({ style, spacing = 10 }: Props) {
  const lines = Array.from({ length: 80 });
  return (
    <View style={[styles.frame, style]}>
      <View style={styles.rotor} pointerEvents="none">
        {lines.map((_, i) => (
          <View
            key={i}
            style={[styles.line, { top: i * spacing }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.paper[100],
    borderWidth: 1,
    borderColor: colors.ink[200],
    overflow: "hidden",
  },
  rotor: {
    position: "absolute",
    left: -200,
    right: -200,
    top: -200,
    bottom: -200,
    transform: [{ rotate: "-30deg" }],
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.ice[200],
  },
});
