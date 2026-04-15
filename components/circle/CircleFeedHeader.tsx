import { View, Text, Share } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { useRouter } from "expo-router";
import type { Circle } from "@/lib/types";
import { useCircleUnread } from "@/hooks/useCircleUnread";

interface Props {
  circle: Circle;
  circleCount?: number;
}

export function CircleFeedHeader({ circle, circleCount = 1 }: Props) {
  const router = useRouter();
  const { unread } = useCircleUnread(circle.id);

  function handleShare() {
    if (!circle.invite_code) return;
    void Share.share({
      message: `Rejoins mon cercle Frileux — code : ${circle.invite_code}`,
    });
  }

  return (
    <View className="border-b border-ink-100">
      <View className="px-6 pt-3 pb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <PressableScale
            onPress={() => router.push("/circle/mine")}
            hitSlop={6}
            className="flex-row items-center gap-2"
          >
            <Text
              className="font-display text-ink-900"
              style={{ fontSize: 28, letterSpacing: -0.5, lineHeight: 30 }}
              numberOfLines={1}
            >
              {circle.name.toUpperCase()}
            </Text>
            {circleCount > 1 ? (
              <Text
                className="font-body-semibold text-ice-600"
                style={{ fontSize: 10, letterSpacing: 1.5 }}
              >
                ↕
              </Text>
            ) : null}
          </PressableScale>
          <PressableScale onPress={handleShare} hitSlop={6}>
            <Text
              className="font-body text-ink-300 mt-0.5"
              style={{ fontSize: 11, letterSpacing: 1.5 }}
            >
              CODE · {circle.invite_code}  ↗
            </Text>
          </PressableScale>
        </View>
      </View>

      <View className="flex-row border-t border-ink-100">
        <HeaderAction
          label="CHAT"
          badge={unread > 0 ? (unread > 99 ? "99+" : String(unread)) : null}
          onPress={() => router.push({ pathname: "/circle/chat", params: { id: circle.id } })}
          border
        />
        <HeaderAction
          label="MP"
          onPress={() => router.push("/dm")}
          border
        />
        <HeaderAction
          label="EXPLORER"
          onPress={() => router.push("/circle/discover")}
          border
          accent
        />
        <HeaderAction
          label="RÉGLAGES"
          onPress={() => router.push("/circle/settings")}
        />
      </View>
    </View>
  );
}

interface ActionProps {
  label: string;
  onPress: () => void;
  border?: boolean;
  badge?: string | null;
  accent?: boolean;
}

function HeaderAction({ label, onPress, border, badge, accent }: ActionProps) {
  return (
    <PressableScale
      onPress={onPress}
      className={`flex-1 py-3 items-center flex-row justify-center gap-1 ${border ? "border-r border-ink-100" : ""}`}
      scaleTo={0.98}
    >
      <Text
        className={`font-body-semibold ${accent ? "text-ice-600" : "text-ink-900"}`}
        style={{ fontSize: 11, letterSpacing: 2.5 }}
      >
        {label}
      </Text>
      {badge ? (
        <Text
          className="font-body-semibold text-ice-600"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          · {badge}
        </Text>
      ) : null}
    </PressableScale>
  );
}
