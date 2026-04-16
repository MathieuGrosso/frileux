import { View, Text } from "react-native";

interface Props {
  current: number;
  target: number;
}

export function CalibrationGauge({ current, target }: Props) {
  const clamped = Math.max(0, Math.min(current, target));
  const ratio = target > 0 ? clamped / target : 0;
  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-body-medium text-micro text-ink-500 uppercase tracking-widest">
          Calibrage
        </Text>
        <Text className="font-body-medium text-micro text-ink-500 uppercase tracking-widest">
          {clamped.toString().padStart(2, "0")} / {target.toString().padStart(2, "0")}
        </Text>
      </View>
      <View className="h-[2px] w-full bg-paper-300">
        <View
          style={{ width: `${Math.round(ratio * 100)}%` }}
          className="h-full bg-ink-900"
        />
      </View>
    </View>
  );
}
