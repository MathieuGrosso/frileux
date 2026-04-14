import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { router } from "expo-router";
import { PressableScale } from "@/components/ui/PressableScale";
import { MemberAvatar } from "@/components/circle/MemberAvatar";
import { useDailyPosts } from "@/hooks/useDailyPosts";

interface UserGroup {
  userId: string;
  username: string;
  avatarUrl: string | null;
  allSeen: boolean;
  postIds: string[];
  mine: boolean;
}

interface Props {
  circleId: string | null;
}

export function StoriesBar({ circleId }: Props) {
  const { posts, userId } = useDailyPosts(circleId);

  const groups = useMemo<UserGroup[]>(() => {
    const byUser = new Map<string, UserGroup>();
    for (const p of posts) {
      const existing = byUser.get(p.user_id);
      if (existing) {
        existing.postIds.push(p.id);
        existing.allSeen = existing.allSeen && p.seen;
      } else {
        byUser.set(p.user_id, {
          userId: p.user_id,
          username: p.profile?.username ?? "—",
          avatarUrl: p.profile?.avatar_url ?? null,
          allSeen: p.seen,
          postIds: [p.id],
          mine: p.user_id === userId,
        });
      }
    }
    const arr = Array.from(byUser.values());
    arr.sort((a, b) => {
      if (a.mine && !b.mine) return -1;
      if (!a.mine && b.mine) return 1;
      if (a.allSeen !== b.allSeen) return a.allSeen ? 1 : -1;
      return 0;
    });
    return arr;
  }, [posts, userId]);

  const myGroup = groups.find((g) => g.mine);
  const others = groups.filter((g) => !g.mine);

  return (
    <View className="border-b border-ink-100 bg-paper-100">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 14, gap: 16 }}
      >
        <PressableScale
          onPress={() =>
            router.push({
              pathname: "/circle/story/compose",
              params: { circleId: circleId ?? "" },
            })
          }
          className="items-center"
        >
          <View
            className="items-center justify-center border border-ink-900"
            style={{ width: 58, height: 58 }}
          >
            {myGroup ? (
              <MemberAvatar
                username={myGroup.username}
                avatarUrl={myGroup.avatarUrl}
                size={54}
              />
            ) : (
              <Text className="font-display text-ink-900" style={{ fontSize: 28 }}>
                +
              </Text>
            )}
          </View>
          <Text
            className="font-body text-ink-900 mt-2"
            style={{ fontSize: 10, letterSpacing: 1.2 }}
            numberOfLines={1}
          >
            {myGroup ? "TOI" : "POSTER"}
          </Text>
        </PressableScale>

        {others.map((g) => (
          <PressableScale
            key={g.userId}
            onPress={() =>
              router.push({
                pathname: "/circle/story/viewer",
                params: { userId: g.userId, circleId: circleId ?? "" },
              })
            }
            className="items-center"
          >
            <View
              style={{
                width: 58,
                height: 58,
                padding: 2,
                borderWidth: 1,
                borderColor: g.allSeen ? "#C7C4BB" : "#637D8E",
              }}
              className="items-center justify-center"
            >
              <MemberAvatar username={g.username} avatarUrl={g.avatarUrl} size={52} />
            </View>
            <Text
              className="font-body text-ink-700 mt-2"
              style={{ fontSize: 10, letterSpacing: 1 }}
              numberOfLines={1}
            >
              {g.username.toUpperCase()}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}
