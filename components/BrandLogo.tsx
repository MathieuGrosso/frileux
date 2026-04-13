import { View, Text, StyleSheet } from "react-native";

type Size = "sm" | "md" | "lg";

const SCALE: Record<Size, number> = { sm: 0.6, md: 1, lg: 1.4 };
const INK = "#0F0F0D";

// V-mark geometry (apex top, in a 32×36 box):
//   left foot (0,36) → apex (16,0) → right foot (32,36)
// Each segment: dx=16, dy=36, length = √(16²+36²) ≈ 39.40, angle = atan(16/36) from vertical
const SEG_LEN = Math.sqrt(16 * 16 + 36 * 36);
const SEG_ANGLE_DEG = (Math.atan2(36, 16) * 180) / Math.PI; // ≈ 66.04°, from +x axis

interface Props {
  size?: Size;
  showWordmark?: boolean;
}

export function BrandLogo({ size = "md", showWordmark = true }: Props) {
  const s = SCALE[size];
  const vWidth = 32 * s;
  const vHeight = 36 * s;
  const stroke = 2 * s;
  const segLen = SEG_LEN * s;

  return (
    <View style={styles.row}>
      <View style={[styles.vMark, { width: vWidth, height: vHeight }]}>
        <View
          style={{
            position: "absolute",
            width: segLen,
            height: stroke,
            backgroundColor: INK,
            left: vWidth / 4 - segLen / 2,
            top: vHeight / 2 - stroke / 2,
            transform: [{ rotate: `${-SEG_ANGLE_DEG}deg` }],
          }}
        />
        <View
          style={{
            position: "absolute",
            width: segLen,
            height: stroke,
            backgroundColor: INK,
            left: (vWidth * 3) / 4 - segLen / 2,
            top: vHeight / 2 - stroke / 2,
            transform: [{ rotate: `${SEG_ANGLE_DEG}deg` }],
          }}
        />
      </View>

      {showWordmark && (
        <Text
          style={{
            fontFamily: "Jost_300Light",
            fontSize: 24 * s,
            letterSpacing: 7 * s,
            color: INK,
            marginLeft: 18 * s,
          }}
        >
          frileuse
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  vMark: { position: "relative", overflow: "visible" },
});
