import { ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface Props {
  children: ReactNode;
  onSwipe: (accepted: boolean) => void;
  stackIndex: number; // 0 = top
}

const SWIPE_THRESHOLD = 120;

export function SwipeCard({ children, onSwipe, stackIndex }: Props) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .enabled(stackIndex === 0)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.4;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const accepted = e.translationX > 0;
        const direction = accepted ? 1 : -1;
        translateX.value = withTiming(direction * width * 1.3, { duration: 220 });
        translateY.value = withTiming(translateY.value + 40, { duration: 220 });
        runOnJS(onSwipe)(accepted);
      } else {
        translateX.value = withSpring(0, { damping: 18 });
        translateY.value = withSpring(0, { damping: 18 });
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(translateX.value, [-width, 0, width], [-12, 0, 12]);
    const scale = 1 - stackIndex * 0.04;
    const offsetY = stackIndex * 10;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + offsetY },
        { rotate: `${rotate}deg` },
        { scale },
      ],
      opacity: stackIndex > 2 ? 0 : 1,
      zIndex: 10 - stackIndex,
    };
  });

  const acceptBadge = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], "clamp"),
  }));
  const rejectBadge = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], "clamp"),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        {children}
        {stackIndex === 0 && (
          <>
            <Animated.View style={[styles.badge, styles.acceptBadge, acceptBadge]}>
              <View style={styles.badgeInner}>
                <Animated.Text style={styles.acceptText}>OUI</Animated.Text>
              </View>
            </Animated.View>
            <Animated.View style={[styles.badge, styles.rejectBadge, rejectBadge]}>
              <View style={styles.badgeInner}>
                <Animated.Text style={styles.rejectText}>NON</Animated.Text>
              </View>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0F0F0D",
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    top: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeInner: { borderWidth: 2, paddingHorizontal: 12, paddingVertical: 4 },
  acceptBadge: { right: 24, transform: [{ rotate: "-8deg" }] },
  rejectBadge: { left: 24, transform: [{ rotate: "8deg" }] },
  acceptText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 28,
    letterSpacing: 2,
    color: "#0F0F0D",
  },
  rejectText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 28,
    letterSpacing: 2,
    color: "#C0392B",
  },
});
