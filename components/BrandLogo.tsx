import { View, Text } from "react-native";
import { colors } from "@/lib/theme";

type Size = "sm" | "md" | "lg";

const SCALE: Record<Size, number> = { sm: 0.6, md: 1, lg: 1.4 };

const SEG_LEN = Math.sqrt(16 * 16 + 36 * 36);
const SEG_ANGLE_DEG = (Math.atan2(36, 16) * 180) / Math.PI;

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
    <View className="flex-row items-center">
      <View
        className="relative overflow-visible"
        style={{ width: vWidth, height: vHeight }}
      >
        <View
          style={{
            position: "absolute",
            width: segLen,
            height: stroke,
            backgroundColor: colors.ink[900],
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
            backgroundColor: colors.ink[900],
            left: (vWidth * 3) / 4 - segLen / 2,
            top: vHeight / 2 - stroke / 2,
            transform: [{ rotate: `${SEG_ANGLE_DEG}deg` }],
          }}
        />
      </View>

      {showWordmark && (
        <Text
          className="font-body text-ink-900"
          style={{
            fontSize: 24 * s,
            letterSpacing: 7 * s,
            marginLeft: 18 * s,
          }}
        >
          frileuse
        </Text>
      )}
    </View>
  );
}
