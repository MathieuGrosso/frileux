import { Text, View } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import type { Circle } from "@/lib/types";

interface Props {
  circle: Circle;
  onPress: () => void;
}

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `il y a ${days} j`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `il y a ${weeks} sem`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function hueToHsl(hue: number | null | undefined): string {
  if (hue == null) return "#637D8E";
  return `hsl(${hue}, 35%, 45%)`;
}

export function PublicCircleRow({ circle, onPress }: Props) {
  const count = circle.member_count ?? 1;
  return (
    <PressableScale onPress={onPress} scaleTo={0.99}>
      <View
        className="flex-row items-stretch border-b border-ink-100"
        style={{ backgroundColor: "#FAFAF8" }}
      >
        <View style={{ width: 2, backgroundColor: hueToHsl(circle.accent_hue) }} />
        <View className="flex-1 py-5 px-5">
          <View className="flex-row items-baseline justify-between">
            <Text
              className="font-display text-ink-900"
              style={{ fontSize: 26, letterSpacing: -0.4 }}
              numberOfLines={1}
            >
              {circle.name.toUpperCase()}
            </Text>
            {circle.is_featured ? (
              <Text
                className="font-body-medium text-ice-600"
                style={{ fontSize: 10, letterSpacing: 2 }}
              >
                CURATED
              </Text>
            ) : null}
          </View>
          {circle.description ? (
            <Text className="font-body text-ink-500 mt-1" style={{ fontSize: 13 }} numberOfLines={1}>
              {circle.description}
            </Text>
          ) : null}
          <Text
            className="font-body text-ink-300 mt-2"
            style={{ fontSize: 11, letterSpacing: 1.2 }}
          >
            {count} MEMBRE{count > 1 ? "S" : ""} · ACTIF {relativeTime(circle.last_activity_at).toUpperCase()}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}
