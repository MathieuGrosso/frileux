import { View, Text, Image } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { PressableScale } from "@/components/ui/PressableScale";
import { useRouter } from "expo-router";
import type { OutfitWithProfile } from "@/lib/types";
import { enterFadeUp } from "@/lib/animations";
import { MemberAvatar } from "./MemberAvatar";

interface Props {
  outfit: OutfitWithProfile;
  isFirst?: boolean;
  index?: number;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function CircleOutfitCard({ outfit, isFirst = false, index = 0 }: Props) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const username = outfit.profile?.username ?? "Anonyme";
  const temp = outfit.weather_data?.temp;
  const time = formatTime(outfit.created_at);

  return (
    <Animated.View entering={enterFadeUp(index, reducedMotion)}>
    <PressableScale
      onPress={() => router.push(`/outfit/${outfit.id}`)}
      className="mb-8"
    >
      <View className="flex-row items-center gap-2.5 mb-3">
        <PressableScale
          onPress={(e) => {
            e.stopPropagation?.();
            router.push({ pathname: "/profile/[id]", params: { id: outfit.user_id } });
          }}
        >
          <MemberAvatar
            username={outfit.profile?.username}
            avatarUrl={outfit.profile?.avatar_url}
            size={28}
          />
        </PressableScale>
        <View className="flex-1">
          <Text className="font-body-medium text-ink-900 text-body-sm">
            {username}
          </Text>
          <Text
            className="font-body text-ink-300 text-eyebrow"
            style={{ letterSpacing: 0.5 }}
          >
            {time}
          </Text>
        </View>
        {isFirst && (
          <View className="bg-ink-900 px-1.5 py-0.5">
            <Text
              className="font-body-semibold text-paper-100 text-micro"
              style={{ letterSpacing: 1.5 }}
            >
              PREMIÈRE
            </Text>
          </View>
        )}
        {typeof temp === "number" && (
          <Text
            className="font-display text-ink-500 text-body-sm"
            style={{ letterSpacing: -0.2 }}
          >
            {temp}°
          </Text>
        )}
      </View>
      <Image
        source={{ uri: outfit.photo_url }}
        style={{ width: "100%", height: 320 }}
        resizeMode="cover"
      />
      {typeof outfit.notes_count === "number" && outfit.notes_count > 0 && (
        <Text
          className="font-body text-ink-300 text-eyebrow mt-2"
          style={{ letterSpacing: 0.5 }}
        >
          {outfit.notes_count} {outfit.notes_count > 1 ? "notes" : "note"}
        </Text>
      )}
    </PressableScale>
    </Animated.View>
  );
}
