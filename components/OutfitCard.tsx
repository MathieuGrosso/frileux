import { View, Text, Image } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import type { Outfit } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";
import { enterFadeUp } from "@/lib/animations";
import { RatingStars } from "./RatingStars";
import { PressableScale } from "./ui/PressableScale";

interface OutfitCardProps {
  outfit: Outfit;
  onPress?: () => void;
  index?: number;
}

export function OutfitCard({ outfit, onPress, index = 0 }: OutfitCardProps) {
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View entering={enterFadeUp(index, reducedMotion)}>
    <PressableScale
      onPress={onPress}
      className="bg-paper-200 overflow-hidden"
    >
      <Image
        source={{ uri: outfit.photo_url }}
        className="w-full h-64"
        resizeMode="cover"
      />
      <View className="p-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-ink-700 text-body-sm font-body">
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
              <Text className="text-ink-500 text-body-sm font-body">
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
    </PressableScale>
    </Animated.View>
  );
}
