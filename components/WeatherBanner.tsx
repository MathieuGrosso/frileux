import { View, Text, ActivityIndicator } from "react-native";
import type { WeatherData } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";
import { colors } from "@/lib/theme";

interface WeatherBannerProps {
  weather: WeatherData | null;
  loading: boolean;
}

export function WeatherBanner({ weather, loading }: WeatherBannerProps) {
  if (loading) {
    return (
      <View className="bg-ice-100 p-6 items-center">
        <ActivityIndicator color={colors.ice[600]} />
        <Text className="text-ink-500 text-body-sm mt-2 font-body">
          Chargement météo...
        </Text>
      </View>
    );
  }

  if (!weather) {
    return (
      <View className="bg-ice-100 p-6 items-center">
        <Text className="text-ink-500 text-body-sm font-body">
          Météo indisponible
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-ice-100 p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Text className="text-5xl">{weatherEmoji(weather.icon)}</Text>
          <View>
            <Text className="text-ink-900 text-h1 font-display tracking-tight">
              {weather.temp}°C
            </Text>
            <Text className="text-ink-500 text-body-sm capitalize font-body">
              {weather.description}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-ink-500 text-caption font-body">
            Ressenti {weather.feels_like}°C
          </Text>
          <Text className="text-ink-500 text-caption font-body">
            Vent {weather.wind_speed} m/s
          </Text>
          {weather.rain && (
            <Text className="text-ice-700 text-caption mt-1 font-body">
              Pluie
            </Text>
          )}
          {weather.snow && (
            <Text className="text-ice-700 text-caption mt-1 font-body">
              Neige
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
