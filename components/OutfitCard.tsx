import { View, Text, Image, Pressable } from "react-native";
import type { Outfit } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";
import { RatingStars } from "./RatingStars";

interface OutfitCardProps {
  outfit: Outfit;
  onPress?: () => void;
}

export function OutfitCard({ outfit, onPress }: OutfitCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-midnight-500 rounded-2xl overflow-hidden active:opacity-80"
    >
      <Image
        source={{ uri: outfit.photo_url }}
        className="w-full h-64"
        resizeMode="cover"
      />
      <View className="p-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-cream-200 text-sm">
            {new Date(outfit.date).toLocaleDateString("fr-FR", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </Text>
          {outfit.weather_data && (
            <View className="flex-row items-center gap-2">
              <Text className="text-lg">
                {weatherEmoji(outfit.weather_data.icon)}
              </Text>
              <Text className="text-cream-300 text-sm">
                {outfit.weather_data.temp}°C
              </Text>
            </View>
          )}
        </View>
        {outfit.rating && (
          <View className="mt-2">
            <RatingStars rating={outfit.rating} size="small" />
          </View>
        )}
      </View>
    </Pressable>
  );
}
