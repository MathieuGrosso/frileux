import { View, Text, Share } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { useRouter } from "expo-router";
import type { Circle } from "@/lib/types";
import { useCircleUnread } from "@/hooks/useCircleUnread";

interface Props {
  circle: Circle;
}

function hueToHsl(hue: number | null | undefined): string {
  if (hue == null) return "#0F0F0D";
  return `hsl(${hue}, 28%, 28%)`;
}

export function CircleFeedHeader({ circle }: Props) {
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
      <View className="px-5 pt-3 pb-2 flex-row items-center">
        <PressableScale
          onPress={() => router.push("/circle/mine")}
          hitSlop={6}
          className="flex-row items-center flex-1"
          scaleTo={0.98}
        >
          <View
            style={{
              width: 36,
              height: 36,
              backgroundColor: hueToHsl(circle.accent_hue),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              className="font-display text-paper-100"
              style={{ fontSize: 18, letterSpacing: 0 }}
            >
              {circle.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1 ml-3">
            <Text
              className="font-display text-ink-900"
              style={{ fontSize: 22, letterSpacing: -0.3, lineHeight: 24 }}
              numberOfLines={1}
            >
              {circle.name.toUpperCase()}
            </Text>
            <Text
              className="font-body text-ink-300"
              style={{ fontSize: 10, letterSpacing: 1.5 }}
            >
              {circle.visibility === "public" ? "PUBLIC" : "PRIVÉ"} · {circle.member_count ?? "—"} MEMBRE{(circle.member_count ?? 1) > 1 ? "S" : ""}
            </Text>
          </View>
        </PressableScale>
        <PressableScale onPress={handleShare} hitSlop={6} className="ml-2">
          <Text
            className="font-body-medium text-ink-500"
            style={{ fontSize: 10, letterSpacing: 2 }}
          >
            ↗
          </Text>
        </PressableScale>
      </View>

      <View className="flex-row border-t border-ink-100 w-full">
        <HeaderAction
          label="CHAT"
          badge={unread > 0 ? (unread > 99 ? "99+" : String(unread)) : null}
          onPress={() => router.push({ pathname: "/circle/chat", params: { id: circle.id } })}
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
