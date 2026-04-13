import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TextInput,
  Alert,
  Share,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { OutfitWithProfile, Circle } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";
import { EmptyState } from "@/components/EmptyState";

export default function CircleScreen() {
  const [circle, setCircle] = useState<Circle | null>(null);
  const [outfits, setOutfits] = useState<OutfitWithProfile[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCircle();
  }, []);

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

    const memberIds = members
      .map((m) => m.user_id)
      .filter((id) => id !== currentUserId);

    if (memberIds.length === 0) {
      setLoading(false);
      return;
    }

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

    if (error || !data) {
      Alert.alert("Erreur", "Impossible de créer le cercle.");
      return;
    }

    await supabase.from("circle_members").insert({ circle_id: data.id, user_id: user.id });
    setCircle(data);
    Alert.alert("Cercle créé", `Code d'invitation : ${code}`);
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

    if (!circleData) {
      Alert.alert("Erreur", "Code invalide.");
      return;
    }

    const { error } = await supabase.from("circle_members").insert({
      circle_id: circleData.id,
      user_id: user.id,
    });

    if (error) {
      Alert.alert("Erreur", "Tu fais peut-être déjà partie de ce cercle.");
      return;
    }

    setCircle(circleData);
    Alert.alert("Bienvenue", `Tu as rejoint "${circleData.name}".`);
  }

  if (!circle && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.onboardingInner}>
          <Text style={styles.onboardingTitle}>CERCLE PRIVÉ</Text>
          <Text style={styles.onboardingSubtitle}>
            Partage tes tenues avec tes proches
          </Text>

          <Pressable
            onPress={createCircle}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
          >
            <Text style={styles.primaryBtnText}>CRÉER UN CERCLE</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={styles.codeInput}
            placeholder="CODE D'INVITATION"
            placeholderTextColor="#9E9A96"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            maxLength={6}
            selectionColor="#637D8E"
          />

          <Pressable
            onPress={joinCircle}
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
          >
            <Text style={styles.ghostBtnText}>REJOINDRE</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  function renderOutfit({ item }: { item: OutfitWithProfile }) {
    return (
      <View style={styles.outfitCard}>
        <View style={styles.outfitHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {item.profile?.username?.[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <Text style={styles.outfitUsername}>
            {item.profile?.username ?? "Anonyme"}
          </Text>
          <View style={styles.outfitWeather}>
            <Text style={{ fontSize: 14 }}>{weatherEmoji(item.weather_data?.icon ?? "01d")}</Text>
            <Text style={styles.outfitTemp}>{item.weather_data?.temp}°</Text>
          </View>
        </View>
        <Image
          source={{ uri: item.photo_url }}
          style={styles.outfitPhoto}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CERCLE</Text>
        <Pressable
          onPress={() => {
            if (circle?.invite_code) {
              Share.share({ message: `Rejoins mon cercle Frileuse — code : ${circle.invite_code}` });
            }
          }}
        >
          <Text style={styles.inviteCode}>Code : {circle?.invite_code}  ↗</Text>
        </Pressable>
      </View>

      <FlatList
        data={outfits}
        renderItem={renderOutfit}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title="Personne aujourd'hui"
              subtitle="Aucun membre du cercle n'a encore partagé sa tenue. Sois la première."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },

  onboardingInner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  onboardingTitle: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 40,
    color: "#0F0F0D",
    letterSpacing: 2,
    marginBottom: 8,
  },
  onboardingSubtitle: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#9E9A96",
    marginBottom: 48,
  },
  primaryBtn: {
    backgroundColor: "#0F0F0D",
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 24,
  },
  primaryBtnPressed: { backgroundColor: "#3A3836" },
  primaryBtnText: {
    fontFamily: "Jost_600SemiBold",
    fontSize: 11,
    color: "#FAFAF8",
    letterSpacing: 2.5,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E8E5DF" },
  dividerText: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    color: "#9E9A96",
  },
  codeInput: {
    borderWidth: 1,
    borderColor: "#E8E5DF",
    backgroundColor: "#F2F0EC",
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 20,
    color: "#0F0F0D",
    textAlign: "center",
    letterSpacing: 6,
    marginBottom: 12,
  },
  ghostBtn: {
    borderWidth: 1,
    borderColor: "#0F0F0D",
    paddingVertical: 18,
    alignItems: "center",
  },
  ghostBtnPressed: { backgroundColor: "#F2F0EC" },
  ghostBtnText: {
    fontFamily: "Jost_600SemiBold",
    fontSize: 11,
    color: "#0F0F0D",
    letterSpacing: 2.5,
  },

  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DF",
    marginBottom: 8,
  },
  title: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 36,
    color: "#0F0F0D",
    letterSpacing: 1,
    marginBottom: 2,
  },
  inviteCode: {
    fontFamily: "Jost_400Regular",
    fontSize: 11,
    color: "#9E9A96",
    letterSpacing: 1,
  },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  outfitCard: { marginBottom: 32 },
  outfitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 0,
    backgroundColor: "#E8F1F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D5E4EE",
  },
  avatarInitial: {
    fontFamily: "Jost_600SemiBold",
    fontSize: 11,
    color: "#637D8E",
  },
  outfitUsername: {
    fontFamily: "Jost_500Medium",
    fontSize: 13,
    color: "#0F0F0D",
    flex: 1,
  },
  outfitWeather: { flexDirection: "row", alignItems: "center", gap: 4 },
  outfitTemp: {
    fontFamily: "Jost_400Regular",
    fontSize: 12,
    color: "#6B6A66",
  },
  outfitPhoto: { width: "100%", height: 320 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyText: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#9E9A96",
    textAlign: "center",
    lineHeight: 24,
  },
});
