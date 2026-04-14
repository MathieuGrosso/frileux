import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { joinPublicCircle } from "@/hooks/usePublicCircles";
import { PressableScale } from "@/components/ui/PressableScale";
import { MemberAvatar } from "@/components/circle/MemberAvatar";
import type { Circle, Profile } from "@/lib/types";

interface MemberPreview extends Pick<Profile, "id" | "username" | "avatar_url"> {}

interface OutfitPreview {
  id: string;
  photo_url: string;
}

export default function CirclePreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<MemberPreview[]>([]);
  const [outfits, setOutfits] = useState<OutfitPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: c }, { data: m }] = await Promise.all([
        supabase.from("circles").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("circle_members")
          .select("user_id, profiles!inner(id, username, avatar_url)")
          .eq("circle_id", id)
          .limit(8),
      ]);
      setCircle(c as Circle | null);
      const memberList = ((m ?? []) as unknown as { profiles: MemberPreview }[])
        .map((row) => row.profiles)
        .filter(Boolean);
      setMembers(memberList);

      if (memberList.length > 0) {
        const { data: o } = await supabase
          .from("outfits")
          .select("id, photo_url")
          .in("user_id", memberList.map((p) => p.id))
          .order("created_at", { ascending: false })
          .limit(6);
        setOutfits((o as OutfitPreview[]) ?? []);
      }
      setLoading(false);
    })();
  }, [id]);

  async function handleJoin() {
    if (!circle) return;
    setJoining(true);
    const joined = await joinPublicCircle(circle.id);
    setJoining(false);
    if (!joined) {
      Alert.alert("Erreur", "Impossible de rejoindre ce cercle.");
      return;
    }
    router.replace("/circle");
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100 items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#637D8E" />
      </SafeAreaView>
    );
  }

  if (!circle) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100 items-center justify-center px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="font-display text-ink-900" style={{ fontSize: 28 }}>
          CERCLE INTROUVABLE
        </Text>
        <PressableScale onPress={() => router.back()} className="mt-8">
          <Text
            className="font-body-medium text-ice-600"
            style={{ fontSize: 12, letterSpacing: 2 }}
          >
            ← RETOUR
          </Text>
        </PressableScale>
      </SafeAreaView>
    );
  }

  const count = circle.member_count ?? members.length;

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="px-6 pt-4 pb-8">
          <PressableScale onPress={() => router.back()} className="mb-8">
            <Text
              className="font-body-medium text-ink-900"
              style={{ fontSize: 12, letterSpacing: 2 }}
            >
              ← RETOUR
            </Text>
          </PressableScale>

          <Text
            className="font-body-medium text-ice-600 mb-3"
            style={{ fontSize: 10, letterSpacing: 3 }}
          >
            PUBLIC{circle.is_featured ? " · CURATED" : ""}
          </Text>
          <Text
            className="font-display text-ink-900"
            style={{ fontSize: 60, letterSpacing: -1.2, lineHeight: 60 }}
          >
            {circle.name.toUpperCase()}
          </Text>

          {circle.description ? (
            <Text
              className="font-body text-ink-700 mt-5"
              style={{ fontSize: 15, lineHeight: 22 }}
            >
              {circle.description}
            </Text>
          ) : null}

          <View className="flex-row items-center mt-8 gap-3">
            <View className="flex-row -space-x-3">
              {members.slice(0, 5).map((m) => (
                <View key={m.id} style={{ marginLeft: -8 }}>
                  <MemberAvatar username={m.username} avatarUrl={m.avatar_url} size={32} />
                </View>
              ))}
            </View>
            <Text
              className="font-body text-ink-500"
              style={{ fontSize: 12, letterSpacing: 1.5 }}
            >
              {count} MEMBRE{count > 1 ? "S" : ""}
            </Text>
          </View>
        </View>

        {outfits.length > 0 ? (
          <View className="border-t border-ink-100 pt-6 px-6">
            <Text
              className="font-body-medium text-ink-900 mb-4"
              style={{ fontSize: 11, letterSpacing: 2.5 }}
            >
              APERÇU
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
        ) : null}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-paper-100 border-t border-ink-100 p-6">
        <PressableScale
          onPress={handleJoin}
          disabled={joining}
          className="bg-ink-900 active:bg-ink-700 py-5 items-center"
          style={{ opacity: joining ? 0.6 : 1 }}
        >
          <Text
            className="font-body-semibold text-paper-100"
            style={{ fontSize: 13, letterSpacing: 3 }}
          >
            {joining ? "…" : "REJOINDRE CE CERCLE"}
          </Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}
