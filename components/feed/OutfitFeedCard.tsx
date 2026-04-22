import { useState } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { OutfitWithProfile } from "@/lib/types";
import { MemberAvatar } from "@/components/MemberAvatar";

interface Props {
  outfit: OutfitWithProfile;
  onOpenPhoto: (photoUrl: string) => void;
}

const FEED_PADDING_X = 24;
const MAX_CARD_WIDTH = 560;
const VIEWPORT_HEIGHT_RATIO = 0.78;
const DEFAULT_RATIO = 4 / 5;

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

  const username = outfit.profile?.username ?? "Anonyme";
  const temp = outfit.weather_data?.temp;

  const cardWidth = Math.min(screenWidth - FEED_PADDING_X * 2, MAX_CARD_WIDTH);
  const naturalHeight = cardWidth / ratio;
  const photoHeight = Math.min(naturalHeight, screenHeight * VIEWPORT_HEIGHT_RATIO);

  function goToDetail() {
    router.push(`/outfit/${outfit.id}`);
  }

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
      <Pressable
        onPress={() => onOpenPhoto(outfit.photo_url)}
        accessibilityLabel="Voir la photo en plein écran"
      >
        <View
          className="bg-paper-200"
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
        </View>
      </Pressable>
    </View>
  );
}
