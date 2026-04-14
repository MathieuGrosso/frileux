import { View, Text, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import type { OutfitWithProfile } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";
import { MemberAvatar } from "./MemberAvatar";

interface Props {
  outfit: OutfitWithProfile;
  isFirst?: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function CircleOutfitCard({ outfit, isFirst = false }: Props) {
  const router = useRouter();
  const username = outfit.profile?.username ?? "Anonyme";
  const temp = outfit.weather_data?.temp;
  const icon = outfit.weather_data?.icon ?? "01d";
  const time = formatTime(outfit.created_at);

  return (
    <Pressable
      onPress={() => router.push(`/outfit/${outfit.id}`)}
      className="mb-8 active:opacity-70"
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
        <View className="flex-row items-center gap-1">
          <Text style={{ fontSize: 14 }}>{weatherEmoji(icon)}</Text>
          {typeof temp === "number" && (
            <Text className="font-body text-ink-500 text-xs">{temp}°</Text>
          )}
        </View>
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
    </Pressable>
  );
}
