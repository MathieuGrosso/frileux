import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Image, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { PressableScale } from "@/components/ui/PressableScale";
import { MemberAvatar } from "@/components/circle/MemberAvatar";
import { openDMThread } from "@/hooks/useDMThreads";
import { useFollow } from "@/hooks/useFollow";

interface PublicProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

interface OutfitThumb {
  id: string;
  photo_url: string;
}

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [outfits, setOutfits] = useState<OutfitThumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const { stats, toggle: toggleFollow } = useFollow(id ?? null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user?.id ?? null);
      const [{ data: p }, { data: o }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, avatar_url, created_at")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("outfits")
          .select("id, photo_url")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(9),
      ]);
      setProfile(p as PublicProfile | null);
      setOutfits((o as OutfitThumb[]) ?? []);

      const { data: s } = await supabase
        .from("user_statuses")
        .select("text, expires_at")
        .eq("user_id", id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      setStatus((s as { text: string } | null)?.text ?? null);

      setLoading(false);
    })();
  }, [id]);

  async function handleDM() {
    if (!profile) return;
    setOpening(true);
    const threadId = await openDMThread(profile.id);
    setOpening(false);
    if (threadId) {
      router.push({ pathname: "/dm/[id]", params: { id: threadId } });
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100 items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#637D8E" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100 items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="font-display text-ink-900" style={{ fontSize: 28 }}>
          PROFIL INACCESSIBLE
        </Text>
        <PressableScale onPress={() => router.back()} className="mt-6">
          <Text className="font-body-medium text-ice-600" style={{ fontSize: 12, letterSpacing: 2 }}>
            ← RETOUR
          </Text>
        </PressableScale>
      </SafeAreaView>
    );
  }

  const isMe = me === profile.id;

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-4">
          <PressableScale onPress={() => router.back()} className="mb-8">
            <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
              ← RETOUR
            </Text>
          </PressableScale>

          <View className="items-center mb-6">
            <MemberAvatar username={profile.username} avatarUrl={profile.avatar_url} size={96} />
          </View>
          <Text
            className="font-display text-ink-900 text-center"
            style={{ fontSize: 44, letterSpacing: -0.5 }}
          >
            {profile.username.toUpperCase()}
          </Text>
          <Text
            className="font-body text-ink-300 text-center mt-2"
            style={{ fontSize: 11, letterSpacing: 1.5 }}
          >
            MEMBRE DEPUIS{" "}
            {new Date(profile.created_at)
              .toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
              .toUpperCase()}
          </Text>

          {status ? (
            <Text
              className="font-body text-ice-600 text-center mt-3 italic"
              style={{ fontSize: 13 }}
            >
              « {status} »
            </Text>
          ) : null}

          <View className="flex-row justify-center gap-10 mt-6">
            <View className="items-center">
              <Text className="font-display text-ink-900" style={{ fontSize: 24 }}>
                {stats.followers}
              </Text>
              <Text
                className="font-body text-ink-300 mt-0.5"
                style={{ fontSize: 10, letterSpacing: 1.5 }}
              >
                FOLLOWERS
              </Text>
            </View>
            <View className="items-center">
              <Text className="font-display text-ink-900" style={{ fontSize: 24 }}>
                {stats.following}
              </Text>
              <Text
                className="font-body text-ink-300 mt-0.5"
                style={{ fontSize: 10, letterSpacing: 1.5 }}
              >
                SUIVIS
              </Text>
            </View>
          </View>

          {!isMe && (
            <PressableScale
              onPress={toggleFollow}
              className={`py-3 items-center mt-6 border ${stats.iFollow ? "border-ink-900" : "border-ice-600 bg-ice-100"}`}
            >
              <Text
                className={`font-body-semibold ${stats.iFollow ? "text-ink-900" : "text-ice-600"}`}
                style={{ fontSize: 11, letterSpacing: 2.5 }}
              >
                {stats.iFollow ? "SUIVI ✓" : "SUIVRE"}
              </Text>
            </PressableScale>
          )}

          {!isMe && (
            <PressableScale
              onPress={handleDM}
              disabled={opening}
              className="bg-ink-900 active:bg-ink-700 py-4 items-center mt-8"
              style={{ opacity: opening ? 0.6 : 1 }}
            >
              <Text
                className="font-body-semibold text-paper-100"
                style={{ fontSize: 12, letterSpacing: 2.5 }}
              >
                {opening ? "…" : "ENVOYER UN MESSAGE"}
              </Text>
            </PressableScale>
          )}
        </View>

        {outfits.length > 0 && (
          <View className="mt-10 border-t border-ink-100 pt-6 px-6">
            <Text
              className="font-body-medium text-ink-900 mb-4"
              style={{ fontSize: 11, letterSpacing: 2.5 }}
            >
              TENUES
            </Text>
            <View className="flex-row flex-wrap -mx-0.5">
              {outfits.map((o) => (
                <View key={o.id} className="w-1/3 p-0.5">
                  <Image
                    source={{ uri: o.photo_url }}
                    style={{ width: "100%", aspectRatio: 1, backgroundColor: "#E5E3DC" }}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
