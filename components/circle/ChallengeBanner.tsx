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
      <View className="bg-ink-900 px-5 py-4 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text
            className="font-body-medium text-ice-600"
            style={{ fontSize: 10, letterSpacing: 3 }}
          >
            CHALLENGE DU JOUR
          </Text>
          <Text
            className="font-display text-paper-100 mt-0.5"
            style={{ fontSize: 22, letterSpacing: -0.3 }}
            numberOfLines={1}
          >
            {challenge.theme_fr}
          </Text>
          {challenge.prompt_fr ? (
            <Text
              className="font-body text-paper-300 mt-0.5"
              style={{ fontSize: 12 }}
              numberOfLines={1}
            >
              {challenge.prompt_fr}
            </Text>
          ) : null}
        </View>
        <Text
          className="font-body-semibold"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            color: submitted ? "#637D8E" : "#FAFAF8",
          }}
        >
          {submitted ? "POSTÉ ✓" : "PARTICIPER →"}
        </Text>
      </View>
    </PressableScale>
  );
}
