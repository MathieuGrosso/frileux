import { View, Text, Image } from "react-native";
import type { OutfitWithProfile } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";

interface Props {
  outfit: OutfitWithProfile;
}

export function CircleOutfitCard({ outfit }: Props) {
  const initial = outfit.profile?.username?.[0]?.toUpperCase() ?? "?";
  const username = outfit.profile?.username ?? "Anonyme";
  const temp = outfit.weather_data?.temp;
  const icon = outfit.weather_data?.icon ?? "01d";

  return (
    <View className="mb-8">
      <View className="flex-row items-center gap-2.5 mb-3">
        <View className="w-7 h-7 bg-ice-100 border border-ice-200 items-center justify-center">
          <Text className="font-body-semibold text-ice-600 text-[11px]">
            {initial}
          </Text>
        </View>
        <Text className="font-body-medium text-ink-900 text-[13px] flex-1">
          {username}
        </Text>
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
    </View>
  );
}
