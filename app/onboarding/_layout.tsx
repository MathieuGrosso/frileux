import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FAFAF8" },
        animation: "fade",
      }}
    >
      <Stack.Screen
        name="proposal-expand"
        options={{ presentation: "fullScreenModal", animation: "fade" }}
      />
    </Stack>
  );
}
