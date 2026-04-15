import { FlatList, Text, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useDMThreads } from "@/hooks/useDMThreads";
import { PressableScale } from "@/components/ui/PressableScale";
import { MemberAvatar } from "@/components/circle/MemberAvatar";
import { PresenceDot } from "@/components/PresenceDot";

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "maintenant";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function DMListScreen() {
  const { threads, loading } = useDMThreads();

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-6 pt-2 pb-6 border-b border-ink-100">
        <PressableScale onPress={() => router.back()} className="mb-4">
          <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
            ← RETOUR
          </Text>
        </PressableScale>
        <Text className="font-display text-ink-900" style={{ fontSize: 56, letterSpacing: -1, lineHeight: 56 }}>
          MESSAGES
        </Text>
        <Text className="font-body text-ink-500 mt-2" style={{ fontSize: 13, letterSpacing: 1 }}>
          privés · 1 à 1
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#637D8E" />
        </View>
      ) : threads.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text
            className="font-display text-ink-300"
            style={{ fontSize: 32, letterSpacing: -0.5 }}
          >
            AUCUN MESSAGE
          </Text>
          <Text className="font-body text-ink-500 mt-3 text-center" style={{ fontSize: 13 }}>
            Ouvre le profil d&apos;un membre de tes cercles pour commencer.
          </Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push({ pathname: "/dm/[id]", params: { id: item.id } })}
              scaleTo={0.99}
            >
              <View className="flex-row items-center px-5 py-4 border-b border-ink-100">
                <MemberAvatar
                  username={item.peer.username}
                  avatarUrl={item.peer.avatar_url}
                  size={44}
                />
                <View className="flex-1 ml-4">
                  <View className="flex-row items-center gap-1.5 mb-0.5">
                    <Text
                      className="font-body-semibold text-ink-900"
                      style={{ fontSize: 15 }}
                      numberOfLines={1}
                    >
                      {item.peer.username}
                    </Text>
                    <PresenceDot userId={item.peer.id} />
                    <View style={{ flex: 1 }} />
                    <Text
                      className="font-body text-ink-300"
                      style={{ fontSize: 10, letterSpacing: 1 }}
                    >
                      {relTime(item.last_message_at).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    className="font-body text-ink-500"
                    style={{ fontSize: 13 }}
                    numberOfLines={1}
                  >
                    {item.last_message_preview ?? "—"}
                  </Text>
                </View>
              </View>
            </PressableScale>
          )}
        />
      )}
    </SafeAreaView>
  );
}
