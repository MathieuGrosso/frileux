import { useCallback, useState } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { OutfitWithProfile } from "@/lib/types";
import { MemberAvatar } from "@/components/MemberAvatar";
import { ReactionStrip } from "@/components/feed/ReactionStrip";
import { ReactionRadial } from "@/components/feed/ReactionRadial";
import {
  useOutfitReactions,
  type OutfitReactionKind,
} from "@/hooks/useOutfitReactions";
import { motion } from "@/lib/theme";

interface Props {
  outfit: OutfitWithProfile;
  onOpenPhoto: (photoUrl: string) => void;
}

const FEED_PADDING_X = 24;
const MAX_CARD_WIDTH = 560;
const VIEWPORT_HEIGHT_RATIO = 0.78;
const DEFAULT_RATIO = 4 / 5;
const DOUBLE_TAP_AXIS: OutfitReactionKind = "fit";

function formatDay(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("fr-FR", { month: "short" });
  return `${weekday.toUpperCase()} ${day} ${month.toUpperCase()}`;
}

export function OutfitFeedCard({ outfit, onOpenPhoto }: Props) {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [ratio, setRatio] = useState<number>(DEFAULT_RATIO);
  const [radialOpen, setRadialOpen] = useState(false);

  const { counts, mine, toggle } = useOutfitReactions(outfit.id);

  const pulse = useSharedValue(0);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const username = outfit.profile?.username ?? "Anonyme";
  const temp = outfit.weather_data?.temp;

  const cardWidth = Math.min(screenWidth - FEED_PADDING_X * 2, MAX_CARD_WIDTH);
  const naturalHeight = cardWidth / ratio;
  const photoHeight = Math.min(naturalHeight, screenHeight * VIEWPORT_HEIGHT_RATIO);

  const goToDetail = useCallback(() => {
    router.push(`/outfit/${outfit.id}`);
  }, [router, outfit.id]);

  const openLightbox = useCallback(() => {
    onOpenPhoto(outfit.photo_url);
  }, [onOpenPhoto, outfit.photo_url]);

  const triggerDoubleTap = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void toggle(DOUBLE_TAP_AXIS);
    pulse.value = withSequence(
      withTiming(1, { duration: motion.fast, easing: motion.easing }),
      withTiming(0, { duration: motion.base, easing: motion.easing }),
    );
  }, [toggle, pulse]);

  const openRadial = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRadialOpen(true);
  }, []);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd((_e, success) => {
      if (success) runOnJS(triggerDoubleTap)();
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .requireExternalGestureToFail(doubleTap)
    .onEnd((_e, success) => {
      if (success) runOnJS(openLightbox)();
    });

  const longPress = Gesture.LongPress()
    .minDuration(350)
    .onStart(() => {
      runOnJS(openRadial)();
    });

  const composed = Gesture.Exclusive(doubleTap, longPress, singleTap);

  return (
    <View className="mb-10" style={{ width: cardWidth, alignSelf: "center" }}>
      <Pressable
        onPress={goToDetail}
        hitSlop={4}
        className="flex-row items-center gap-2.5 mb-3 active:opacity-60"
        accessibilityLabel={`Ouvrir la tenue de ${username}`}
      >
        <MemberAvatar
          username={outfit.profile?.username}
          avatarUrl={outfit.profile?.avatar_url}
          size={28}
        />
        <View className="flex-1">
          <Text className="font-body-medium text-ink-900 text-body-sm">
            {username}
          </Text>
          <Text
            className="font-body text-ink-300 text-eyebrow"
            style={{ letterSpacing: 0.5 }}
          >
            {formatDay(outfit.created_at)}
          </Text>
        </View>
        {typeof temp === "number" && (
          <Text
            className="font-display text-ink-500 text-body-sm"
            style={{ letterSpacing: -0.2 }}
          >
            {temp}°
          </Text>
        )}
      </Pressable>
      <GestureDetector gesture={composed}>
        <View
          className="bg-paper-200 relative"
          style={{ width: cardWidth, height: photoHeight }}
        >
          <Image
            source={{ uri: outfit.photo_url }}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
            cachePolicy="memory-disk"
            onLoad={(e) => {
              const w = e.source?.width;
              const h = e.source?.height;
              if (w && h && h > 0) {
                const r = w / h;
                if (Math.abs(r - ratio) > 0.01) setRatio(r);
              }
            }}
          />
          <Animated.View
            pointerEvents="none"
            className="bg-ice"
            style={[
              { position: "absolute", top: 0, bottom: 0, left: 0, width: 2 },
              pulseStyle,
            ]}
          />
        </View>
      </GestureDetector>
      <ReactionStrip counts={counts} mine={mine} onToggle={toggle} />
      <ReactionRadial
        visible={radialOpen}
        mine={mine}
        onToggle={toggle}
        onClose={() => setRadialOpen(false)}
      />
    </View>
  );
}
