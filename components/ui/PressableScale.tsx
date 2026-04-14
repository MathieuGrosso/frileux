import { forwardRef } from "react";
import { Pressable, type PressableProps, type View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";

import { motion } from "@/lib/theme";
import { PRESS_DURATION, PRESS_SCALE } from "@/lib/animations";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends PressableProps {
  scaleTo?: number;
  pressDuration?: number;
}

export const PressableScale = forwardRef<View, PressableScaleProps>(
  function PressableScale(
    {
      scaleTo = PRESS_SCALE,
      pressDuration = PRESS_DURATION,
      onPressIn,
      onPressOut,
      children,
      style,
      ...rest
    },
    ref,
  ) {
    const reducedMotion = useReducedMotion();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <AnimatedPressable
        ref={ref}
        style={[animatedStyle, style]}
        onPressIn={(e) => {
          if (!reducedMotion) {
            scale.value = withTiming(scaleTo, {
              duration: pressDuration,
              easing: motion.easing,
            });
          }
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          if (!reducedMotion) {
            scale.value = withTiming(1, {
              duration: pressDuration + 20,
              easing: motion.easing,
            });
          }
          onPressOut?.(e);
        }}
        {...rest}
      >
        {children as React.ReactNode}
      </AnimatedPressable>
    );
  },
);
