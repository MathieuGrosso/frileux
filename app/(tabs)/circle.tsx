import { useMemo } from "react";
import { SectionList, FlatList, RefreshControl, Share, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCircle } from "@/hooks/useCircle";
import type { OutfitWithProfile } from "@/lib/types";
import { CircleOnboarding } from "@/components/circle/CircleOnboarding";
import { CircleFeedHeader } from "@/components/circle/CircleFeedHeader";
import { CircleOutfitCard } from "@/components/circle/CircleOutfitCard";
import { CircleFeedSkeleton } from "@/components/circle/CircleFeedSkeleton";
import { ViewModeToggle } from "@/components/circle/ViewModeToggle";
import { StoriesBar } from "@/components/stories/StoriesBar";
import { ChallengeBanner } from "@/components/circle/ChallengeBanner";
import { ShareTodayAction } from "@/components/circle/ShareTodayAction";
import { EmptyState } from "@/components/EmptyState";

function formatDayHeader(dateIso: string): string {
  const d = new Date(dateIso);
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("fr-FR", { month: "short" });
  return `${weekday.toUpperCase()} ${day} ${month.toUpperCase()}`;
}

export default function CircleScreen() {
  const {
    circles,
    circle,
    outfits,
    memberCount,
    loading,
    refreshing,
    refresh,
    viewMode,
    setViewMode,
    setActiveCircleId,
    createCircle,
    joinCircle,
    userId,
  } = useCircle();

  const sections = useMemo(() => {
    if (viewMode !== "week") return null;
    const byDate = new Map<string, OutfitWithProfile[]>();
    for (const o of outfits) {
      const arr = byDate.get(o.date) ?? [];
      arr.push(o);
      byDate.set(o.date, arr);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, data]) => ({ title: date, data }));
  }, [outfits, viewMode]);

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

  const isAlone = memberCount <= 1;
  const inviteCode = circle?.invite_code ?? "";
  const shareInvite = () => {
    if (!inviteCode) return;
    void Share.share({
      message: `Rejoins mon cercle Frileuse — code : ${inviteCode}`,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-paper-100">
      {circle && <CircleFeedHeader circle={circle} />}
      <ChallengeBanner />
      {circle && <StoriesBar circleId={circle.id} circleName={circle.name} />}
      <ViewModeToggle
        mode={viewMode}
        onChange={(m) => { void setViewMode(m); }}
      />
      {viewMode === "today" && circle && userId && (
        <ShareTodayAction circleId={circle.id} userId={userId} onShared={refresh} />
      )}
      {viewMode === "today" ? (
        <FlatList
          data={outfits}
          renderItem={({ item, index }) => (
            <CircleOutfitCard
              outfit={item}
              isFirst={index === outfits.length - 1 && outfits.length > 1}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#637D8E" />
          }
          ListEmptyComponent={
            isAlone ? (
              <EmptyState
                title="Cercle vide"
                subtitle={`Personne d'autre ici. Partage le code ${inviteCode} pour inviter quelqu'un.`}
                cta={{ label: "Partager le code", onPress: shareInvite }}
              />
            ) : (
              <EmptyState
                title="Rien partagé aujourd'hui"
                subtitle="Les autres membres n'ont pas encore posté leur tenue."
              />
            )
          }
        />
      ) : (
        <SectionList
          sections={sections ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#637D8E" />
          }
          renderSectionHeader={({ section }) => (
            <View className="bg-paper-100 py-3 border-b border-paper-300">
              <Text
                className="font-display text-ink-900"
                style={{ fontSize: 20, letterSpacing: 1.5 }}
              >
                {formatDayHeader(section.title)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View className="pt-4">
              <CircleOutfitCard outfit={item} />
            </View>
          )}
          ListEmptyComponent={
            isAlone ? (
              <EmptyState
                title="Cercle vide"
                subtitle={`Personne d'autre ici. Partage le code ${inviteCode} pour inviter quelqu'un.`}
                cta={{ label: "Partager le code", onPress: shareInvite }}
              />
            ) : (
              <EmptyState
                title="Rien cette semaine"
                subtitle="Aucune tenue partagée ces 7 derniers jours."
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
