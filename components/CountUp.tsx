import { useEffect, useRef, useState } from "react";
import { Animated, type StyleProp, type TextStyle } from "react-native";
import { motion } from "../lib/theme";

interface Props {
  value: number | null;
  style?: StyleProp<TextStyle>;
  suffix?: string;
  fallback?: string;
  duration?: number;
}

/**
 * Anime un nombre de 0 → value en `duration` ms. Affiche `fallback` tant que
 * `value` est null. Effet "instrument de mesure".
 */
export function CountUp({
  value,
  style,
  suffix = "",
  fallback = "—",
  duration = motion.base,
}: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState<string>(fallback);
  const lastTarget = useRef<number | null>(null);

  useEffect(() => {
    if (value === null) {
      setDisplay(fallback);
      return;
    }
    const from = lastTarget.current ?? 0;
    anim.setValue(from);
    const id = anim.addListener(({ value: v }) => {
      setDisplay(`${Math.round(v)}${suffix}`);
    });
    Animated.timing(anim, {
      toValue: value,
      duration,
      easing: motion.easing,
      useNativeDriver: false,
    }).start(() => {
      lastTarget.current = value;
    });
    return () => anim.removeListener(id);
  }, [value, anim, suffix, fallback, duration]);

  return <Animated.Text style={style}>{display}</Animated.Text>;
}
