import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { OutfitWithProfile } from "@/lib/types";
import { MemberAvatar } from "@/components/MemberAvatar";

interface Props {
  outfit: OutfitWithProfile;
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("fr-FR", { month: "short" });
  return `${weekday.toUpperCase()} ${day} ${month.toUpperCase()}`;
}

export function OutfitFeedCard({ outfit }: Props) {
  const router = useRouter();
  const username = outfit.profile?.username ?? "Anonyme";
  const temp = outfit.weather_data?.temp;

  return (
    <Pressable
      onPress={() => router.push(`/outfit/${outfit.id}`)}
      className="mb-10 active:opacity-70"
    >
      <View className="flex-row items-center gap-2.5 mb-3">
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
      </View>
      <Image
        source={{ uri: outfit.photo_url }}
        style={{ width: "100%", height: 420 }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </Pressable>
  );
}
