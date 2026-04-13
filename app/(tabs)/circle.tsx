import { FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCircle } from "@/hooks/useCircle";
import { CircleOnboarding } from "@/components/circle/CircleOnboarding";
import { CircleFeedHeader } from "@/components/circle/CircleFeedHeader";
import { CircleOutfitCard } from "@/components/circle/CircleOutfitCard";
import { CircleFeedSkeleton } from "@/components/circle/CircleFeedSkeleton";
import { EmptyState } from "@/components/EmptyState";

export default function CircleScreen() {
  const {
    circle,
    outfits,
    loading,
    refreshing,
    refresh,
    createCircle,
    joinCircle,
  } = useCircle();

  if (!circle && !loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100">
        <CircleOnboarding onCreate={createCircle} onJoin={joinCircle} />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100">
        {circle && <CircleFeedHeader circle={circle} />}
        <CircleFeedSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper-100">
      {circle && <CircleFeedHeader circle={circle} />}
      <FlatList
        data={outfits}
        renderItem={({ item }) => <CircleOutfitCard outfit={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#637D8E"
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Personne aujourd'hui"
            subtitle="Aucun membre du cercle n'a encore partagé sa tenue. Sois la première."
          />
        }
      />
    </SafeAreaView>
  );
}
