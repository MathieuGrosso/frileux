import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { PressableScale } from "@/components/ui/PressableScale";

interface Entry {
  outfit_id: string;
  user_id: string;
  outfit: { id: string; photo_url: string; user_id: string };
  profile: { username: string; avatar_url: string | null };
}

interface Challenge {
  id: string;
  theme_fr: string;
  prompt_fr: string | null;
  date: string;
}

const { width } = Dimensions.get("window");
const COL = (width - 6) / 2;

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: c }, { data: e }] = await Promise.all([
        supabase.from("daily_challenges").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("challenge_entries")
          .select("outfit_id, user_id, outfit:outfits(id, photo_url, user_id), profile:profiles(username, avatar_url)")
          .eq("challenge_id", id)
          .order("submitted_at", { ascending: false })
          .limit(60),
      ]);
      setChallenge(c as Challenge | null);
      setEntries((e as unknown as Entry[]) ?? []);
      setLoading(false);
    })();
  }, [id]);

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-6 pt-2 pb-5 border-b border-ink-100">
        <PressableScale onPress={() => router.back()} className="mb-4">
          <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
            ← RETOUR
          </Text>
        </PressableScale>
        <Text
          className="font-body-medium text-ice-600 mb-1"
          style={{ fontSize: 10, letterSpacing: 3 }}
        >
          CHALLENGE · {challenge?.date ?? "—"}
        </Text>
        <Text
          className="font-display text-ink-900"
          style={{ fontSize: 56, letterSpacing: -1, lineHeight: 56 }}
        >
          {challenge?.theme_fr ?? "…"}
        </Text>
        {challenge?.prompt_fr ? (
          <Text
            className="font-body text-ink-500 mt-3"
            style={{ fontSize: 14, lineHeight: 20 }}
          >
            {challenge.prompt_fr}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#637D8E" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.outfit_id}
          numColumns={2}
          columnWrapperStyle={{ gap: 3 }}
          contentContainerStyle={{ padding: 3, gap: 3 }}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() =>
                router.push({ pathname: "/profile/[id]", params: { id: item.outfit.user_id } })
              }
              style={{ width: COL }}
              scaleTo={0.98}
            >
              <Image
                source={{ uri: item.outfit.photo_url }}
                style={{ width: COL, height: COL * 1.25, backgroundColor: "#E5E3DC" }}
                contentFit="cover"
              />
              <Text
                className="font-body text-ink-500 mt-1 px-1"
                style={{ fontSize: 10, letterSpacing: 1 }}
                numberOfLines={1}
              >
                {item.profile?.username?.toUpperCase() ?? "—"}
              </Text>
            </PressableScale>
          )}
          ListEmptyComponent={
            <View className="py-20 items-center px-6">
              <Text className="font-display text-ink-300" style={{ fontSize: 28 }}>
                SOIS LE PREMIER
              </Text>
              <Text className="font-body text-ink-500 mt-2 text-center" style={{ fontSize: 13 }}>
                Personne n&apos;a encore participé.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
