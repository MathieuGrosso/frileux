import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, fonts } from "../lib/theme";

interface Props {
  style?: StyleProp<ViewStyle>;
}

const HATCH_SPACING = 10;
const HATCH_COUNT = 80;
const TICK_LENGTH = 10;
const TICK_INSET = 8;
const SWEEP_RATIO = 0.28;
const SWEEP_DURATION = 2200;
const COUNTER_INTERVAL_MS = 120;

export function OutfitImageLoader({ style }: Props) {
  const sweep = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [counter, setCounter] = useState(1);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: SWEEP_DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  useEffect(() => {
    const id = setInterval(() => {
      setCounter((n) => (n % 999) + 1);
    }, COUNTER_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const sweepWidth = Math.max(width * SWEEP_RATIO, 1);
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-sweepWidth, width],
  });

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const counterLabel = counter.toString().padStart(3, "0");

  return (
    <View style={[styles.frame, style]} onLayout={onLayout}>
      <View style={styles.rotor} pointerEvents="none">
        {Array.from({ length: HATCH_COUNT }).map((_, i) => (
          <View key={i} style={[styles.line, { top: i * HATCH_SPACING }]} />
        ))}
      </View>

      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweep,
            { width: sweepWidth, transform: [{ translateX }] },
          ]}
        />
      )}

      <CornerTick style={styles.tickTL} orientation="tl" />
      <CornerTick style={styles.tickTR} orientation="tr" />
      <CornerTick style={styles.tickBL} orientation="bl" />
      <CornerTick style={styles.tickBR} orientation="br" />

      <View style={styles.labelTL} pointerEvents="none">
        <Text style={styles.labelText}>GÉNÉRATION · {counterLabel}</Text>
      </View>
      <View style={styles.labelBR} pointerEvents="none">
        <Text style={styles.labelText}>CLAUDE · GEMINI</Text>
      </View>
    </View>
  );
}

interface TickProps {
  style: StyleProp<ViewStyle>;
  orientation: "tl" | "tr" | "bl" | "br";
}

function CornerTick({ style, orientation }: TickProps) {
  const horiz: ViewStyle = { width: TICK_LENGTH, height: 1 };
  const vert: ViewStyle = { width: 1, height: TICK_LENGTH };
  const horizAlign: ViewStyle =
    orientation === "tl" || orientation === "bl"
      ? { left: 0 }
      : { right: 0 };
  const vertAlign: ViewStyle =
    orientation === "tl" || orientation === "tr"
      ? { top: 0 }
      : { bottom: 0 };
  return (
    <View style={[styles.tick, style]} pointerEvents="none">
      <View
        style={[
          styles.tickBar,
          horiz,
          horizAlign,
          orientation === "tl" || orientation === "tr"
            ? { top: 0 }
            : { bottom: 0 },
        ]}
      />
      <View
        style={[
          styles.tickBar,
          vert,
          vertAlign,
          orientation === "tl" || orientation === "bl"
            ? { left: 0 }
            : { right: 0 },
        ]}
      />
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
  sweep: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.ice[400],
    opacity: 0.18,
  },
  tick: {
    position: "absolute",
    width: TICK_LENGTH,
    height: TICK_LENGTH,
  },
  tickBar: {
    position: "absolute",
    backgroundColor: colors.ink[900],
  },
  tickTL: { top: TICK_INSET, left: TICK_INSET },
  tickTR: { top: TICK_INSET, right: TICK_INSET },
  tickBL: { bottom: TICK_INSET, left: TICK_INSET },
  tickBR: { bottom: TICK_INSET, right: TICK_INSET },
  labelTL: {
    position: "absolute",
    top: TICK_INSET + TICK_LENGTH + 6,
    left: TICK_INSET,
  },
  labelBR: {
    position: "absolute",
    bottom: TICK_INSET + TICK_LENGTH + 6,
    right: TICK_INSET,
  },
  labelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.ice[700],
  },
});
