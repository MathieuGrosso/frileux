import { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { colors, fonts, motion } from "../lib/theme";

export type LoaderStep = 1 | 2 | 3;

interface Props {
  step: LoaderStep;
}

const STEPS: { id: LoaderStep; label: string }[] = [
  { id: 1, label: "LECTURE MÉTÉO" },
  { id: 2, label: "ANALYSE GARDE-ROBE" },
  { id: 3, label: "CHOIX DE LA TENUE" },
];

/**
 * Loader éditorial Frileux : barre fine ice qui balaye + ticker numéroté.
 * Inspiré Muji / signage combini. Aucun spinner, aucun bounce.
 */
export function TodayLoader({ step }: Props) {
  const slide = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (width === 0) return;
    slide.setValue(0);
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: motion.loop,
        easing: motion.easingInOut,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [slide, width]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const barWidth = Math.max(60, width * 0.25);
  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-barWidth, width],
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.track} onLayout={onLayout}>
        <Animated.View
          style={[
            styles.bar,
            { width: barWidth, transform: [{ translateX }] },
          ]}
        />
      </View>
      <View style={styles.ticker}>
        {STEPS.map((s) => (
          <TickerLine key={s.id} active={s.id === step} index={s.id} label={s.label} />
        ))}
      </View>
    </View>
  );
}

function TickerLine({
  active,
  index,
  label,
}: {
  active: boolean;
  index: LoaderStep;
  label: string;
}) {
  const opacity = useRef(new Animated.Value(active ? 1 : 0.35)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: active ? 1 : 0.35,
      duration: motion.fast,
      easing: motion.easing,
      useNativeDriver: true,
    }).start();
  }, [active, opacity]);
  return (
    <Animated.Text
      style={[
        styles.line,
        { color: active ? colors.ink[900] : colors.ink[300], opacity },
      ]}
    >
      {String(index).padStart(2, "0")} · {label}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  track: {
    height: 1,
    backgroundColor: colors.ink[200],
    overflow: "hidden",
  },
  bar: {
    height: 1,
    backgroundColor: colors.ice[600],
  },
  ticker: { marginTop: 16, gap: 4 },
  line: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.4,
  },
});
