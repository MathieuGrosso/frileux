import { FlatList, Text, View, RefreshControl, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { usePublicFeed } from "@/hooks/usePublicFeed";
import { PressableScale } from "@/components/ui/PressableScale";

const { width } = Dimensions.get("window");
const COL_WIDTH = (width - 3) / 2;

export default function PublicFeedScreen() {
  const { items, loading, refreshing, refresh, loadMore } = usePublicFeed();

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-6 pt-2 pb-5 border-b border-ink-100">
        <View className="flex-row items-center justify-between mb-4">
          <PressableScale onPress={() => router.back()}>
            <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
              ← RETOUR
            </Text>
          </PressableScale>
          <PressableScale onPress={() => router.replace("/circle/discover")}>
            <Text
              className="font-body-medium text-ink-300"
              style={{ fontSize: 11, letterSpacing: 2 }}
            >
              CERCLES →
            </Text>
          </PressableScale>
        </View>
        <Text className="font-display text-ink-900" style={{ fontSize: 56, letterSpacing: -1, lineHeight: 56 }}>
          POUR TOI
        </Text>
        <Text className="font-body text-ink-500 mt-2" style={{ fontSize: 13, letterSpacing: 1 }}>
          tenues des cercles publics
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#637D8E" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 3 }}
          contentContainerStyle={{ padding: 3, gap: 3 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#637D8E" />
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push({ pathname: "/profile/[id]", params: { id: item.user_id } })}
              style={{ width: COL_WIDTH }}
              scaleTo={0.98}
            >
              <View>
                <Image
                  source={{ uri: item.photo_url }}
                  style={{ width: COL_WIDTH, height: COL_WIDTH * 1.3, backgroundColor: "#E5E3DC" }}
                  contentFit="cover"
                />
                <View className="flex-row items-center justify-between mt-1 px-1">
                  <Text
                    className="font-body text-ink-500"
                    style={{ fontSize: 10, letterSpacing: 1 }}
                    numberOfLines={1}
                  >
                    {item.profile?.username?.toUpperCase() ?? "—"}
                  </Text>
                  {typeof item.weather_data?.temp === "number" ? (
                    <Text className="font-display text-ink-300" style={{ fontSize: 11 }}>
                      {item.weather_data.temp}°
                    </Text>
                  ) : null}
                </View>
              </View>
            </PressableScale>
          )}
          onEndReachedThreshold={0.5}
          onEndReached={() => { void loadMore(); }}
          ListEmptyComponent={
            <View className="py-20 items-center px-6">
              <Text className="font-display text-ink-300" style={{ fontSize: 28 }}>
                PAS DE TENUE
              </Text>
              <Text className="font-body text-ink-500 mt-2 text-center" style={{ fontSize: 13 }}>
                Personne n&apos;a encore partagé dans un cercle public.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
