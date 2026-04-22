import { Modal, View, Pressable, useWindowDimensions, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, motion } from "@/lib/theme";

interface Props {
  photoUrl: string | null;
  onClose: () => void;
}

const MAX_SCALE = 4;
const DISMISS_THRESHOLD = 120;

export function PhotoLightbox({ photoUrl, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const open = !!photoUrl;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  function resetShared() {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }

  function dismiss() {
    resetShared();
    onClose();
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(
        MAX_SCALE,
        Math.max(1, savedScale.value * e.scale),
      );
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withTiming(1, { duration: motion.fast });
        savedScale.value = 1;
        translateX.value = withTiming(0, { duration: motion.fast });
        translateY.value = withTiming(0, { duration: motion.fast });
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1.05) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      } else {
        translateY.value = e.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value > 1.05) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
        return;
      }
      if (Math.abs(translateY.value) > DISMISS_THRESHOLD) {
        runOnJS(dismiss)();
      } else {
        translateY.value = withTiming(0, { duration: motion.fast });
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (scale.value <= 1.05) {
        runOnJS(dismiss)();
      }
    });

  const gestures = Gesture.Simultaneous(pinch, pan, singleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity:
      scale.value > 1.05
        ? 1
        : interpolate(
            Math.abs(translateY.value),
            [0, 220],
            [1, 0.2],
            Extrapolation.CLAMP,
          ),
  }));

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.ink[900] },
            backdropStyle,
          ]}
        />
        <GestureDetector gesture={gestures}>
          <Animated.View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View style={imageStyle}>
              <Image
                source={{ uri: photoUrl ?? undefined }}
                style={{ width, height }}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={120}
              />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
        <SafeAreaView
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, left: 0, right: 0 }}
        >
          <Pressable
            onPress={dismiss}
            hitSlop={16}
            accessibilityLabel="Fermer"
            style={{ padding: 18, alignSelf: "flex-start" }}
          >
            <Feather name="x" size={26} color={colors.paper[100]} />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
