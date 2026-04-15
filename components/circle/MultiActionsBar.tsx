import { View, Text } from "react-native";
import { router } from "expo-router";
import { PressableScale } from "@/components/ui/PressableScale";

export function MultiActionsBar() {
  return (
    <View className="flex-row border-t border-b border-ink-100 bg-paper-100">
      <PressableScale
        onPress={() => router.push("/dm")}
        className="flex-1 py-3 items-center border-r border-ink-100"
      >
        <Text
          className="font-body-semibold text-ink-900"
          style={{ fontSize: 11, letterSpacing: 2.5 }}
        >
          MESSAGES
        </Text>
      </PressableScale>
      <PressableScale
        onPress={() => router.push("/circle/discover")}
        className="flex-1 py-3 items-center"
      >
        <Text
          className="font-body-semibold text-ice-600"
          style={{ fontSize: 11, letterSpacing: 2.5 }}
        >
          EXPLORER
        </Text>
      </PressableScale>
    </View>
  );
}
