import { View, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { motion } from "@/lib/theme";

interface RatingStarsProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: "small" | "default";
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface DotProps {
  dot: number;
  filled: boolean;
  dim: string;
  onRate?: (rating: number) => void;
}

function Dot({ dot, filled, dim, onRate }: DotProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        if (!reducedMotion) {
          scale.value = withSequence(
            withTiming(1.15, { duration: 120, easing: motion.easing }),
            withTiming(1, { duration: 140, easing: motion.easing }),
          );
        }
        onRate?.(dot);
      }}
      disabled={!onRate}
      hitSlop={10}
      style={animatedStyle}
      className={`${dim} border ${filled ? "bg-ink-900 border-ink-900" : "border-ink-200"}`}
    />
  );
}

export function RatingStars({ rating, onRate, size = "default" }: RatingStarsProps) {
  const dim = size === "small" ? "w-[7px] h-[7px]" : "w-[11px] h-[11px]";
  const gap = size === "small" ? 5 : 9;

  return (
    <View className="flex-row items-center" style={{ gap }}>
      {[1, 2, 3, 4, 5].map((dot) => (
        <Dot key={dot} dot={dot} filled={dot <= rating} dim={dim} onRate={onRate} />
      ))}
    </View>
  );
}
