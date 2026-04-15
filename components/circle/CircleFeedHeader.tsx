import { View, Text, Pressable, Share } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { useRouter } from "expo-router";
import type { Circle } from "@/lib/types";
import { useCircleUnread } from "@/hooks/useCircleUnread";

interface Props {
  circle: Circle;
}

export function CircleFeedHeader({ circle }: Props) {
  const router = useRouter();
  const { unread } = useCircleUnread(circle.id);

  function handleShare() {
    if (!circle.invite_code) return;
    void Share.share({
      message: `Rejoins mon cercle Frileuse — code : ${circle.invite_code}`,
    });
  }

  return (
    <View className="px-6 pt-2 pb-5 border-b border-paper-300 mb-2 flex-row items-end justify-between">
      <View>
        <Text
          className="font-display text-ink-900 mb-0.5"
          style={{ fontSize: 36, letterSpacing: 1 }}
        >
          CERCLE
        </Text>
        <PressableScale onPress={handleShare}>
          <Text
            className="font-body text-ink-300 text-eyebrow"
            style={{ letterSpacing: 1 }}
          >
            Code : {circle.invite_code}  ↗
          </Text>
        </PressableScale>
      </View>
      <View className="flex-row items-end gap-5 pb-1">
        <PressableScale
          onPress={() => router.push({ pathname: "/circle/chat", params: { id: circle.id } })}
          hitSlop={8}
          className="flex-row items-center gap-1"
        >
          <Text
            className="font-body-semibold text-ink-900 text-eyebrow"
            style={{ letterSpacing: 2 }}
          >
            CHAT
          </Text>
          {unread > 0 && (
            <Text
              className="font-body-semibold text-ice text-eyebrow"
              style={{ letterSpacing: 1 }}
            >
              · {unread > 99 ? "99+" : unread}
            </Text>
          )}
        </PressableScale>
        <PressableScale
          onPress={() => router.push({ pathname: "/circle/polls/[circleId]", params: { circleId: circle.id } })}
          hitSlop={8}
        >
          <Text
            className="font-body-semibold text-ice-600 text-eyebrow"
            style={{ letterSpacing: 2 }}
          >
            SONDAGES
          </Text>
        </PressableScale>
        <PressableScale
          onPress={() => router.push("/circle/settings")}
          hitSlop={8}
        >
          <Text
            className="font-body-semibold text-ink-900 text-eyebrow"
            style={{ letterSpacing: 2 }}
          >
            RÉGLAGES
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}
