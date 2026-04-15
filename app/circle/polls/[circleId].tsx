import { View, Text, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { usePolls } from "@/hooks/usePolls";
import { PollCard } from "@/components/circle/PollCard";
import { PressableScale } from "@/components/ui/PressableScale";

export default function CirclePollsScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const { polls, loading, vote, reload } = usePolls(circleId ?? null);

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-6 pt-2 pb-5 border-b border-ink-100 flex-row items-end justify-between">
        <View>
          <PressableScale onPress={() => router.back()} className="mb-2">
            <Text
              className="font-body-medium text-ink-900"
              style={{ fontSize: 12, letterSpacing: 2 }}
            >
              ← CHAT
            </Text>
          </PressableScale>
          <Text
            className="font-display text-ink-900"
            style={{ fontSize: 44, letterSpacing: -0.7, lineHeight: 46 }}
          >
            SONDAGES
          </Text>
        </View>
        <PressableScale
          onPress={() =>
            router.push({ pathname: "/circle/poll/new", params: { circleId: circleId ?? "" } })
          }
          className="bg-ink-900 px-4 py-2"
        >
          <Text
            className="font-body-semibold text-paper-100"
            style={{ fontSize: 11, letterSpacing: 2 }}
          >
            + NOUVEAU
          </Text>
        </PressableScale>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#637D8E" />
        </View>
      ) : (
        <FlatList
          data={polls}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor="#637D8E" />}
          renderItem={({ item }) => (
            <PollCard poll={item} onVote={(optId) => void vote(item.id, optId)} />
          )}
          ListEmptyComponent={
            <View className="py-16 items-center px-6">
              <Text className="font-display text-ink-300" style={{ fontSize: 28 }}>
                AUCUN SONDAGE
              </Text>
              <Text className="font-body text-ink-500 mt-2 text-center" style={{ fontSize: 13 }}>
                Crée le premier.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
