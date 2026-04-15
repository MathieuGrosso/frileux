import { View, Text } from "react-native";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { PressableScale } from "@/components/ui/PressableScale";
import { router } from "expo-router";

export function ChallengeBanner() {
  const { challenge, myEntryOutfitId } = useDailyChallenge();
  if (!challenge) return null;

  const submitted = myEntryOutfitId !== null;

  return (
    <PressableScale
      onPress={() => router.push({ pathname: "/challenge/[id]", params: { id: challenge.id } })}
      scaleTo={0.99}
    >
      <View className="bg-paper-200 border-b border-ink-100 px-5 py-2.5 flex-row items-center">
        <Text
          className="font-body-medium text-ice-600"
          style={{ fontSize: 10, letterSpacing: 2.5 }}
        >
          AUJ.
        </Text>
        <Text
          className="font-display text-ink-900 mx-2"
          style={{ fontSize: 15, letterSpacing: 0 }}
        >
          ·
        </Text>
        <Text
          className="font-display text-ink-900 flex-1"
          style={{ fontSize: 15, letterSpacing: -0.2 }}
          numberOfLines={1}
        >
          {challenge.theme_fr}
        </Text>
        <Text
          className="font-body-semibold"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            color: submitted ? "#637D8E" : "#0F0F0D",
          }}
        >
          {submitted ? "POSTÉ ✓" : "PARTICIPER →"}
        </Text>
      </View>
    </PressableScale>
  );
}
