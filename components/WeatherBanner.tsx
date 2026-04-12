import { View, Text, ActivityIndicator } from "react-native";
import type { WeatherData } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";

interface WeatherBannerProps {
  weather: WeatherData | null;
  loading: boolean;
}

export function WeatherBanner({ weather, loading }: WeatherBannerProps) {
  if (loading) {
    return (
      <View className="bg-midnight-500 rounded-2xl p-6 items-center">
        <ActivityIndicator color="#FFC94D" />
        <Text className="text-cream-300 text-sm mt-2">
          Chargement météo...
        </Text>
      </View>
    );
  }

  if (!weather) {
    return (
      <View className="bg-midnight-500 rounded-2xl p-6 items-center">
        <Text className="text-cream-300">Météo indisponible</Text>
      </View>
    );
  }

  return (
    <View className="bg-midnight-500 rounded-2xl p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Text className="text-5xl">{weatherEmoji(weather.icon)}</Text>
          <View>
            <Text className="text-cream-50 text-3xl font-sans-bold">
              {weather.temp}°C
            </Text>
            <Text className="text-cream-300 text-sm capitalize">
              {weather.description}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-cream-300 text-xs">
            Ressenti {weather.feels_like}°C
          </Text>
          <Text className="text-cream-300 text-xs">
            Vent {weather.wind_speed} m/s
          </Text>
          {weather.rain && (
            <Text className="text-frost-300 text-xs mt-1">🌧️ Pluie</Text>
          )}
          {weather.snow && (
            <Text className="text-frost-200 text-xs mt-1">❄️ Neige</Text>
          )}
        </View>
      </View>
    </View>
  );
}
