import { FlatList, RefreshControl, View, Text, ActivityIndicator, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useFeed } from "@/hooks/useFeed";
import { OutfitFeedCard } from "@/components/feed/OutfitFeedCard";
import { EmptyState } from "@/components/EmptyState";
import { ChallengeBanner } from "@/components/ChallengeBanner";

export default function FeedScreen() {
  const { outfits, loading, refreshing, loadingMore, refresh, loadMore } = useFeed();

  return (
    <SafeAreaView className="flex-1 bg-paper-100">
      <View className="px-6 pt-2 pb-4 border-b border-paper-300 flex-row items-end justify-between">
        <View>
          <Text
            className="font-display text-ink-900"
            style={{ fontSize: 28, letterSpacing: -0.5 }}
          >
            FEED
          </Text>
          <Text
            className="font-body text-ink-500 text-eyebrow mt-1"
            style={{ letterSpacing: 1.2 }}
          >
            CE QUE LE MONDE PORTE
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/dm")}
          hitSlop={12}
          className="pb-1 active:opacity-60"
          accessibilityLabel="Messages"
        >
          <Feather name="message-circle" size={22} color="#0F0F0D" />
        </Pressable>
      </View>
      <ChallengeBanner />
      <FlatList
        data={outfits}
        renderItem={({ item }) => <OutfitFeedCard outfit={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#637D8E" />
        }
        onEndReached={() => { void loadMore(); }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title="Le feed est calme"
              subtitle="Personne n'a encore posté. Sois le premier depuis l'onglet Aujourd'hui."
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4 items-center">
              <ActivityIndicator color="#637D8E" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
