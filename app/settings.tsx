import { useState, useEffect } from "react";
import { View, Text, Pressable, Alert, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { ColdnessLevel } from "@/lib/types";

const COLDNESS_OPTIONS: { level: ColdnessLevel; emoji: string; label: string; sub: string }[] = [
  { level: 1, emoji: "🌤️", label: "Pas frileuse", sub: "Le froid ne m'affecte pas" },
  { level: 2, emoji: "🧥", label: "Un peu frileuse", sub: "Je sens le froid sans en souffrir" },
  { level: 3, emoji: "🧣", label: "Frileuse", sub: "Je superpose facilement" },
  { level: 4, emoji: "🧤", label: "Très frileuse", sub: "Je me couvre toujours bien" },
  { level: 5, emoji: "🥶", label: "Frileuse extrême", sub: "Je vis en doudoune" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const [coldnessLevel, setColdnessLevel] = useState<ColdnessLevel>(3);
  const [username, setUsername] = useState("");

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("coldness_level, username")
      .single();
    if (data) {
      setColdnessLevel(data.coldness_level as ColdnessLevel);
      setUsername(data.username);
    }
  }

  async function updateColdness(level: ColdnessLevel) {
    setColdnessLevel(level);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ coldness_level: level }).eq("id", user.id);
    }
  }

  async function handleLogout() {
    Alert.alert("Déconnexion", "Tu veux te déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Déconnexion", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  const initial = username?.[0]?.toUpperCase() ?? "?";

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1C1917", "#292524", "#1C1917"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Réglages</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Profile card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarRing}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Text style={styles.profileName}>{username}</Text>
            <Text style={styles.profileSub}>Membre frileux</Text>
          </View>

          {/* Coldness section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NIVEAU DE FRILOSITÉ</Text>
            <Text style={styles.sectionSub}>Les suggestions s'adaptent à ton profil</Text>

            <View style={styles.optionsList}>
              {COLDNESS_OPTIONS.map((opt) => {
                const active = coldnessLevel === opt.level;
                return (
                  <Pressable
                    key={opt.level}
                    onPress={() => updateColdness(opt.level)}
                    style={({ pressed }) => [
                      styles.option,
                      active && styles.optionActive,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.optionSub}>{opt.sub}</Text>
                    </View>
                    {active && (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Logout */}
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
          >
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1C1917" },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 8 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#292524",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#44403C",
  },
  backText: { fontFamily: "DMSans_500Medium", fontSize: 18, color: "#D6D3D1" },
  headerTitle: {
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    color: "#A8A29E",
    letterSpacing: 0.5,
  },

  profileCard: {
    backgroundColor: "#292524",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#312E2B",
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(245,158,11,0.35)",
    marginBottom: 14,
  },
  avatarText: {
    fontFamily: "Cormorant_600SemiBold",
    fontSize: 30,
    color: "#F59E0B",
    lineHeight: 36,
  },
  profileName: {
    fontFamily: "Cormorant_600SemiBold",
    fontSize: 26,
    color: "#FAFAF9",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profileSub: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#57534E",
    letterSpacing: 0.5,
  },

  section: { marginBottom: 32 },
  sectionLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 10,
    color: "#57534E",
    letterSpacing: 2,
    marginBottom: 4,
  },
  sectionSub: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: "#44403C",
    marginBottom: 16,
  },

  optionsList: { gap: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#292524",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#312E2B",
  },
  optionActive: {
    backgroundColor: "rgba(245,158,11,0.06)",
    borderColor: "rgba(245,158,11,0.35)",
  },
  optionPressed: { opacity: 0.8 },
  optionEmoji: { fontSize: 22 },
  optionText: { flex: 1 },
  optionLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: "#A8A29E",
    marginBottom: 2,
  },
  optionLabelActive: { color: "#F59E0B" },
  optionSub: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#44403C",
  },
  checkmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: "#1C1917" },

  logoutBtn: {
    borderWidth: 1,
    borderColor: "#292524",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutBtnPressed: { backgroundColor: "#292524" },
  logoutText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: "#57534E",
  },
});
