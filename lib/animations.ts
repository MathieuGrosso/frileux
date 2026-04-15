import { Easing, FadeIn, FadeInDown } from "react-native-reanimated";

import { motion } from "./theme";

export const STAGGER_STEP = 50;
export const STAGGER_MAX_INDEX = 6;

export function staggerDelay(
  index: number,
  step: number = STAGGER_STEP,
  maxIndex: number = STAGGER_MAX_INDEX,
): number {
  if (index <= 0) return 0;
  return Math.min(index, maxIndex) * step;
}

export function enterFadeUp(index: number = 0, reducedMotion: boolean = false) {
  const delay = reducedMotion ? 0 : staggerDelay(index);
  if (reducedMotion) {
    return FadeIn.duration(motion.fast).delay(delay);
  }
  return FadeInDown.duration(motion.base)
    .delay(delay)
    .easing(Easing.out(Easing.cubic));
}

export function enterFade(index: number = 0, reducedMotion: boolean = false) {
  const delay = reducedMotion ? 0 : staggerDelay(index);
  return FadeIn.duration(motion.fast).delay(delay);
}

export const PRESS_DURATION = 140;
export const PRESS_SCALE = 0.97;
