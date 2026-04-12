import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/lib/supabase";
import type { OutfitWithProfile, Circle } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";

export default function CircleScreen() {
  const [circle, setCircle] = useState<Circle | null>(null);
  const [outfits, setOutfits] = useState<OutfitWithProfile[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCircle(); }, []);

  async function loadCircle() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("circle_members")
      .select("circle_id, circles(*)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membership?.circles) {
      const c = membership.circles as unknown as Circle;
      setCircle(c);
      loadCircleOutfits(c.id, user.id);
    } else {
      setLoading(false);
    }
  }

  async function loadCircleOutfits(circleId: string, currentUserId: string) {
    const { data: members } = await supabase
      .from("circle_members")
      .select("user_id")
      .eq("circle_id", circleId);

    if (!members) return;

    const memberIds = members.map((m) => m.user_id).filter((id) => id !== currentUserId);
    if (memberIds.length === 0) { setLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("outfits")
      .select("*, profile:profiles(username, avatar_url)")
      .in("user_id", memberIds)
      .eq("date", today)
      .order("created_at", { ascending: false });

    setOutfits((data as unknown as OutfitWithProfile[]) ?? []);
    setLoading(false);
  }

  async function createCircle() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data, error } = await supabase
      .from("circles")
      .insert({ name: "Mon cercle", invite_code: code, created_by: user.id })
      .select()
      .single();

    if (error || !data) { Alert.alert("Erreur", "Impossible de créer le cercle."); return; }
    await supabase.from("circle_members").insert({ circle_id: data.id, user_id: user.id });
    setCircle(data);
    Alert.alert("Cercle créé !", `Partage ce code avec tes amis : ${code}`);
  }

  async function joinCircle() {
    if (!inviteCode.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: circleData } = await supabase
      .from("circles")
      .select()
      .eq("invite_code", inviteCode.toUpperCase())
      .single();

    if (!circleData) { Alert.alert("Erreur", "Code invalide."); return; }

    const { error } = await supabase
      .from("circle_members")
      .insert({ circle_id: circleData.id, user_id: user.id });

    if (error) { Alert.alert("Erreur", "Tu fais peut-être déjà partie de ce cercle."); return; }
    setCircle(circleData);
    Alert.alert("Bienvenue !", `Tu as rejoint "${circleData.name}".`);
  }

  // --- Empty state: no circle ---
  if (!circle && !loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#1C1917", "#292524"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.onboarding}>
            <Text style={styles.onboardingEmoji}>👯</Text>
            <Text style={styles.onboardingTitle}>Cercle privé</Text>
            <Text style={styles.onboardingText}>
              Partage tes tenues avec tes proches et vois les leurs.
            </Text>

            <Pressable
              onPress={createCircle}
              style={({ pressed }) => [styles.createBtn, pressed && styles.createBtnPressed]}
            >
              <Text style={styles.createBtnText}>Créer un cercle</Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <TextInput
              style={styles.codeInput}
              placeholder="CODE D'INVITATION"
              placeholderTextColor="#57534E"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              maxLength={6}
              selectionColor="#F59E0B"
            />

            <Pressable
              onPress={joinCircle}
              style={({ pressed }) => [styles.joinBtn, pressed && styles.joinBtnPressed]}
            >
              <Text style={styles.joinBtnText}>Rejoindre</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  function renderOutfit({ item }: { item: OutfitWithProfile }) {
    const initial = item.profile?.username?.[0]?.toUpperCase() ?? "?";
    return (
      <View style={styles.feedCard}>
        <View style={styles.feedCardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.feedUsername}>{item.profile?.username ?? "Anonyme"}</Text>
          <View style={styles.feedWeather}>
            <Text style={{ fontSize: 14 }}>{weatherEmoji(item.weather_data?.icon ?? "01d")}</Text>
            <Text style={styles.feedTemp}>{item.weather_data?.temp}°</Text>
          </View>
        </View>
        <Image source={{ uri: item.photo_url }} style={styles.feedPhoto} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1C1917", "#1C1917"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Cercle</Text>
            <Text style={styles.inviteCode}>Code : {circle?.invite_code}</Text>
          </View>
        </View>

        <FlatList
          data={outfits}
          renderItem={renderOutfit}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🌅</Text>
              <Text style={styles.emptyTitle}>Aucune tenue aujourd'hui</Text>
              <Text style={styles.emptyText}>
                Personne n'a encore posté.{"\n"}Sois la première !
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1C1917" },
  safe: { flex: 1 },

  // Onboarding
  onboarding: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  onboardingEmoji: { fontSize: 52, textAlign: "center", marginBottom: 20 },
  onboardingTitle: {
    fontFamily: "Cormorant_600SemiBold",
    fontSize: 42,
    color: "#FAFAF9",
    textAlign: "center",
    letterSpacing: -1,
    marginBottom: 10,
  },
  onboardingText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#57534E",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 36,
  },
  createBtn: {
    backgroundColor: "#F59E0B",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 24,
  },
  createBtnPressed: { backgroundColor: "#D97706" },
  createBtnText: { fontFamily: "DMSans_700Bold", fontSize: 15, color: "#1C1917" },

  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#292524" },
  dividerText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: "#57534E" },

  codeInput: {
    backgroundColor: "#292524",
    borderWidth: 1,
    borderColor: "#44403C",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: "DMSans_500Medium",
    fontSize: 16,
    color: "#E7E5E4",
    textAlign: "center",
    letterSpacing: 6,
    marginBottom: 12,
  },
  joinBtn: {
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  joinBtnPressed: { backgroundColor: "rgba(245,158,11,0.08)" },
  joinBtnText: { fontFamily: "DMSans_700Bold", fontSize: 15, color: "#F59E0B" },

  // Main view
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  title: {
    fontFamily: "Cormorant_600SemiBold",
    fontSize: 42,
    color: "#FAFAF9",
    letterSpacing: -1,
  },
  inviteCode: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#57534E",
    marginTop: 2,
    letterSpacing: 1,
  },

  feedList: { paddingHorizontal: 24, paddingBottom: 32, gap: 20 },
  feedCard: {
    backgroundColor: "#292524",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#312E2B",
  },
  feedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
  },
  avatarText: { fontFamily: "DMSans_700Bold", fontSize: 13, color: "#F59E0B" },
  feedUsername: { fontFamily: "DMSans_500Medium", fontSize: 14, color: "#D6D3D1", flex: 1 },
  feedWeather: { flexDirection: "row", alignItems: "center", gap: 4 },
  feedTemp: { fontFamily: "DMSans_400Regular", fontSize: 13, color: "#78716C" },
  feedPhoto: { width: "100%", height: 360 },

  empty: { alignItems: "center", paddingTop: 80 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: {
    fontFamily: "Cormorant_600SemiBold",
    fontSize: 26,
    color: "#FAFAF9",
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#57534E",
    textAlign: "center",
    lineHeight: 22,
  },
});
