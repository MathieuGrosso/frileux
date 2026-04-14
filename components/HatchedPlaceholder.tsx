import { View, type StyleProp, type ViewStyle } from "react-native";

interface Props {
  style?: StyleProp<ViewStyle>;
  spacing?: number;
}

export function HatchedPlaceholder({ style, spacing = 10 }: Props) {
  const lines = Array.from({ length: 80 });
  return (
    <View
      className="bg-paper-100 border border-ink-200 overflow-hidden"
      style={style}
    >
      <View
        pointerEvents="none"
        className="absolute"
        style={{
          left: -200,
          right: -200,
          top: -200,
          bottom: -200,
          transform: [{ rotate: "-30deg" }],
        }}
      >
        {lines.map((_, i) => (
          <View
            key={i}
            className="absolute left-0 right-0 h-px bg-ice-200"
            style={{ top: i * spacing }}
          />
        ))}
      </View>
    </View>
  );
}
