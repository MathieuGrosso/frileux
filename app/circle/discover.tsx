import { FlatList, RefreshControl, Text, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { usePublicCircles } from "@/hooks/usePublicCircles";
import { PublicCircleRow } from "@/components/circle/PublicCircleRow";
import { PressableScale } from "@/components/ui/PressableScale";

export default function DiscoverScreen() {
  const { circles, loading, refreshing, refresh, loadMore, hasMore } = usePublicCircles();

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-6 pt-2 pb-6 border-b border-ink-100">
        <View className="flex-row items-center mb-4">
          <PressableScale onPress={() => router.back()}>
            <Text
              className="font-body-medium text-ink-900"
              style={{ fontSize: 12, letterSpacing: 2 }}
            >
              ← RETOUR
            </Text>
          </PressableScale>
        </View>
        <Text
          className="font-display text-ink-900"
          style={{ fontSize: 56, letterSpacing: -1, lineHeight: 56 }}
        >
          EXPLORER
        </Text>
        <Text
          className="font-body text-ink-500 mt-2"
          style={{ fontSize: 13, letterSpacing: 1 }}
        >
          cercles publics · rejoignables en un tap
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#637D8E" />
        </View>
      ) : (
        <FlatList
          data={circles.filter((c) => !c.is_featured).concat()}
          ListHeaderComponent={() => {
            const featured = circles.filter((c) => c.is_featured);
            if (featured.length === 0) return null;
            return (
              <View className="pb-2">
                <Text
                  className="font-body-medium text-ice-600 px-5 pt-5 pb-3"
                  style={{ fontSize: 10, letterSpacing: 3 }}
                >
                  CURATED · SÉLECTION
                </Text>
                {featured.map((c) => (
                  <PublicCircleRow
                    key={c.id}
                    circle={c}
                    onPress={() => router.push({ pathname: "/circle/preview/[id]", params: { id: c.id } })}
                  />
                ))}
                <Text
                  className="font-body-medium text-ink-300 px-5 pt-6 pb-3"
                  style={{ fontSize: 10, letterSpacing: 3 }}
                >
                  TOUS LES CERCLES
                </Text>
              </View>
            );
          }}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <PublicCircleRow
              circle={item}
              onPress={() => router.push({ pathname: "/circle/preview/[id]", params: { id: item.id } })}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#637D8E" />
          }
          onEndReached={() => { void loadMore(); }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View className="px-6 py-20 items-center">
              <Text
                className="font-display text-ink-300"
                style={{ fontSize: 28, letterSpacing: -0.5 }}
              >
                PAS DE CERCLE PUBLIC
              </Text>
              <Text className="font-body text-ink-500 mt-2 text-center" style={{ fontSize: 13 }}>
                Sois le premier à en créer un.
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore && circles.length > 0 ? (
              <View className="py-6 items-center">
                <ActivityIndicator color="#637D8E" />
              </View>
            ) : null
          }
        />
      )}

      <View className="absolute bottom-8 right-6">
        <PressableScale
          onPress={() => router.push("/circle/new")}
          className="bg-ink-900 active:bg-ink-700 px-5 py-4"
        >
          <Text
            className="font-body-semibold text-paper-100"
            style={{ fontSize: 12, letterSpacing: 2.5 }}
          >
            + CRÉER UN CERCLE
          </Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}
