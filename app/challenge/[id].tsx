import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Dimensions, Modal, Pressable, Alert } from "react-native";
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

interface RecentOutfit {
  id: string;
  photo_url: string;
  date: string;
}

const { width } = Dimensions.get("window");
const COL = (width - 6) / 2;
const PICKER_COL = (width - 48) / 3;

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recent, setRecent] = useState<RecentOutfit[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user?.id ?? null);
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
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const iParticipated = useMemo(
    () => !!me && entries.some((e) => e.user_id === me),
    [entries, me],
  );

  async function openPicker() {
    let userId = me;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
      setMe(userId);
    }
    if (!userId) {
      Alert.alert("Erreur", "Session expirée, reconnecte-toi.");
      return;
    }
    const from = new Date();
    from.setDate(from.getDate() - 6);
    const { data } = await supabase
      .from("outfits")
      .select("id, photo_url, date")
      .eq("user_id", userId)
      .gte("date", from.toISOString().slice(0, 10))
      .order("created_at", { ascending: false })
      .limit(15);
    const entryIds = new Set(entries.filter((e) => e.user_id === userId).map((e) => e.outfit_id));
    const list = ((data as RecentOutfit[]) ?? []).filter((o) => !entryIds.has(o.id));
    setRecent(list);
    setPickerOpen(true);
  }

  async function submitOutfit(outfitId: string) {
    if (!id || !me || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("challenge_entries").insert({
      outfit_id: outfitId,
      challenge_id: id,
      user_id: me,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }
    setPickerOpen(false);
    await load();
  }

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

        {!loading && (
          <PressableScale
            onPress={openPicker}
            disabled={iParticipated}
            className={`mt-6 py-4 items-center ${iParticipated ? "border border-ink-100 bg-paper-200" : "bg-ink-900 active:bg-ink-700"}`}
          >
            <Text
              className="font-body-semibold"
              style={{
                fontSize: 12,
                letterSpacing: 2.5,
                color: iParticipated ? "#637D8E" : "#FAFAF8",
              }}
            >
              {iParticipated ? "TU PARTICIPES ✓" : "TAGGER UNE TENUE"}
            </Text>
          </PressableScale>
        )}
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
            <View className="py-16 items-center px-8">
              <Text className="font-display text-ink-300 text-center" style={{ fontSize: 28, lineHeight: 32 }}>
                LANCE LE THÈME
              </Text>
              <Text className="font-body text-ink-500 mt-3 text-center" style={{ fontSize: 13 }}>
                Tagge une de tes tenues récentes pour lancer le challenge.
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
          <View className="px-6 pt-2 pb-4 flex-row items-center justify-between border-b border-ink-100">
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
              <Text className="font-body-medium text-ink-900" style={{ fontSize: 12, letterSpacing: 2 }}>
                × FERMER
              </Text>
            </Pressable>
            <Text
              className="font-body-medium text-ink-500"
              style={{ fontSize: 10, letterSpacing: 2 }}
            >
              7 DERNIERS JOURS
            </Text>
          </View>

          <View className="px-6 pt-6 pb-4">
            <Text
              className="font-display text-ink-900"
              style={{ fontSize: 36, letterSpacing: -0.5, lineHeight: 38 }}
            >
              CHOISIS UNE TENUE
            </Text>
            <Text
              className="font-body text-ink-500 mt-2"
              style={{ fontSize: 13 }}
            >
              à tagger au thème <Text className="font-body-semibold">{challenge?.theme_fr}</Text>.
            </Text>
          </View>

          {recent.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text
                className="font-display text-ink-300 text-center"
                style={{ fontSize: 24, letterSpacing: -0.3, lineHeight: 28 }}
              >
                AUCUNE TENUE RÉCENTE
              </Text>
              <Text
                className="font-body text-ink-500 mt-3 text-center"
                style={{ fontSize: 13, lineHeight: 18 }}
              >
                Poste ta tenue du jour depuis l&apos;onglet AUJOURD&apos;HUI, puis reviens la tagger.
              </Text>
              <PressableScale
                onPress={() => {
                  setPickerOpen(false);
                  router.replace("/");
                }}
                className="mt-6 bg-ink-900 active:bg-ink-700 px-6 py-3"
              >
                <Text
                  className="font-body-semibold text-paper-100"
                  style={{ fontSize: 11, letterSpacing: 2.5 }}
                >
                  POSTER UNE TENUE
                </Text>
              </PressableScale>
            </View>
          ) : (
            <FlatList
              data={recent}
              keyExtractor={(o) => o.id}
              numColumns={3}
              columnWrapperStyle={{ gap: 4 }}
              contentContainerStyle={{ padding: 12, gap: 4 }}
              renderItem={({ item }) => (
                <PressableScale
                  onPress={() => void submitOutfit(item.id)}
                  disabled={submitting}
                  style={{ width: PICKER_COL, opacity: submitting ? 0.5 : 1 }}
                  scaleTo={0.96}
                >
                  <Image
                    source={{ uri: item.photo_url }}
                    style={{
                      width: PICKER_COL,
                      height: PICKER_COL * 1.25,
                      backgroundColor: "#E5E3DC",
                    }}
                    contentFit="cover"
                  />
                  <Text
                    className="font-body text-ink-300 mt-1"
                    style={{ fontSize: 10, letterSpacing: 1 }}
                  >
                    {item.date}
                  </Text>
                </PressableScale>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
