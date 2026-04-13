import { View, Text, Pressable, Share } from "react-native";
import { useRouter } from "expo-router";
import type { Circle } from "@/lib/types";

interface Props {
  circle: Circle;
}

export function CircleFeedHeader({ circle }: Props) {
  const router = useRouter();

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
        <Pressable onPress={handleShare}>
          <Text
            className="font-body text-ink-300 text-[11px]"
            style={{ letterSpacing: 1 }}
          >
            Code : {circle.invite_code}  ↗
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push("/circle/settings")}
        className="active:opacity-50 pb-1"
      >
        <Text
          className="font-body-semibold text-ink-900 text-[11px]"
          style={{ letterSpacing: 2 }}
        >
          RÉGLAGES
        </Text>
      </Pressable>
    </View>
  );
}
