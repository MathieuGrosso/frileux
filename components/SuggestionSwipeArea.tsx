import { ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface Props {
  children: ReactNode;
  onPass: () => void;
  onKeep: () => void;
  disabled?: boolean;
}

const THRESHOLD = 100;
const EXIT_DURATION = 180;

export function SuggestionSwipeArea({ children, onPass, onKeep, disabled }: Props) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);

  const reset = () => {
    translateX.value = withSpring(0, { damping: 22, stiffness: 180 });
  };

  const exit = (direction: 1 | -1, cb: () => void) => {
    translateX.value = withTiming(
      direction * width,
      { duration: EXIT_DURATION, easing: Easing.out(Easing.cubic) },
      () => {
        runOnJS(cb)();
        translateX.value = 0;
      }
    );
  };

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -THRESHOLD) {
        exit(-1, onPass);
      } else if (e.translationX > THRESHOLD) {
        exit(1, onKeep);
      } else {
        reset();
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-THRESHOLD, -20, 0], [1, 0, 0], "clamp"),
  }));

  const keepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 20, THRESHOLD], [0, 0, 1], "clamp"),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 4,
              top: 8,
              paddingVertical: 4,
              paddingHorizontal: 8,
              borderLeftWidth: 2,
              borderLeftColor: "#0F0F0D",
              zIndex: 1,
            },
            passStyle,
          ]}
        >
          <Animated.Text
            style={{
              fontFamily: "BarlowCondensed_600SemiBold",
              fontSize: 12,
              letterSpacing: 1.6,
              color: "#0F0F0D",
            }}
          >
            PASSER
          </Animated.Text>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              right: 4,
              top: 8,
              paddingVertical: 4,
              paddingHorizontal: 8,
              borderRightWidth: 2,
              borderRightColor: "#637D8E",
              zIndex: 1,
            },
            keepStyle,
          ]}
        >
          <Animated.Text
            style={{
              fontFamily: "BarlowCondensed_600SemiBold",
              fontSize: 12,
              letterSpacing: 1.6,
              color: "#637D8E",
            }}
          >
            GARDER
          </Animated.Text>
        </Animated.View>

        <Animated.View style={cardStyle}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
