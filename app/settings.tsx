import { useState, useEffect } from "react";
import { View, Text, Pressable, Alert, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useOnboardingFlag } from "@/lib/onboarding-context";
import type { ColdnessLevel } from "@/lib/types";

const COLDNESS_LABELS: Record<ColdnessLevel, string> = {
  1: "Un peu frileuse",
  2: "Frileuse",
  3: "Très frileuse",
  4: "Ultra frileuse",
  5: "Je vis en doudoune",
};

const COLDNESS_EMOJIS: Record<ColdnessLevel, string> = {
  1: "🌤️",
  2: "🧥",
  3: "🧣",
  4: "🧤",
  5: "🥶",
};

export default function SettingsScreen() {
  const router = useRouter();
  const { refresh: refreshOnboarding } = useOnboardingFlag();
  const [coldnessLevel, setColdnessLevel] = useState<ColdnessLevel>(3);
  const [username, setUsername] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

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
    await supabase
      .from("profiles")
      .update({ coldness_level: level })
      .eq("id", (await supabase.auth.getUser()).data.user?.id);
  }

  async function resetOnboarding() {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm("Recommencer l'onboarding ? Tes pièces et préférences sont conservées.")
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Recommencer l'onboarding",
              "Tes pièces et préférences sont conservées.",
              [
                { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
                { text: "Recommencer", onPress: () => resolve(true) },
              ]
            );
          });
    if (!confirmed) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ onboarding_completed: false })
      .eq("id", user.id);
    await AsyncStorage.removeItem("@onboarding/last-step");
    await refreshOnboarding();
    router.replace("/onboarding");
  }

  async function handleLogout() {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm("Tu veux te déconnecter ?")
        : await new Promise<boolean>((resolve) => {
            Alert.alert("Déconnexion", "Tu veux te déconnecter ?", [
              { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
              { text: "Déconnexion", style: "destructive", onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backText}>← Retour</Text>
          </Pressable>
          <Text style={styles.headerTitle}>RÉGLAGES</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitial}>
              {username?.[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <Text style={styles.profileName}>{username}</Text>
        </View>

        <View style={styles.divider} />

        {/* Coldness Level */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NIVEAU DE FRILOSITÉ</Text>
          <Text style={styles.sectionHint}>
            Les suggestions seront adaptées à ton niveau
          </Text>

          {([1, 2, 3, 4, 5] as ColdnessLevel[]).map((level) => (
            <Pressable
              key={level}
              onPress={() => updateColdness(level)}
              style={[
                styles.coldnessRow,
                coldnessLevel === level && styles.coldnessRowActive,
              ]}
            >
              <Text style={styles.coldnessEmoji}>{COLDNESS_EMOJIS[level]}</Text>
              <Text style={[
                styles.coldnessLabel,
                coldnessLevel === level && styles.coldnessLabelActive,
              ]}>
                {COLDNESS_LABELS[level]}
              </Text>
              {coldnessLevel === level && (
                <Text style={styles.coldnessCheck}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Reset onboarding */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DÉVELOPPEMENT</Text>
          <Pressable onPress={resetOnboarding} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>RECOMMENCER L'ONBOARDING</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
        >
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  inner: { paddingHorizontal: 24, paddingTop: 8 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  backText: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#9E9A96",
  },
  headerTitle: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 16,
    color: "#0F0F0D",
    letterSpacing: 2,
  },

  profileCard: {
    alignItems: "center",
    paddingVertical: 24,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 0,
    backgroundColor: "#E8F1F6",
    borderWidth: 1,
    borderColor: "#D5E4EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  profileInitial: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 22,
    color: "#637D8E",
  },
  profileName: {
    fontFamily: "Jost_500Medium",
    fontSize: 16,
    color: "#0F0F0D",
  },

  divider: { height: 1, backgroundColor: "#E8E5DF", marginBottom: 28 },

  section: { marginBottom: 28 },
  sectionLabel: {
    fontFamily: "Jost_500Medium",
    fontSize: 9,
    color: "#9E9A96",
    letterSpacing: 2,
    marginBottom: 4,
  },
  sectionHint: {
    fontFamily: "Jost_400Regular",
    fontSize: 12,
    color: "#9E9A96",
    marginBottom: 16,
  },

  coldnessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 6,
    backgroundColor: "#FAFAF8",
  },
  coldnessRowActive: {
    backgroundColor: "#E8F1F6",
    borderColor: "#D5E4EE",
  },
  coldnessEmoji: { fontSize: 20 },
  coldnessLabel: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#6B6A66",
    flex: 1,
  },
  coldnessLabelActive: {
    fontFamily: "Jost_500Medium",
    color: "#637D8E",
  },
  coldnessCheck: {
    fontFamily: "Jost_500Medium",
    fontSize: 14,
    color: "#637D8E",
  },

  resetBtn: {
    borderWidth: 1,
    borderColor: "#0F0F0D",
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  resetBtnText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 13,
    letterSpacing: 1.4,
    color: "#0F0F0D",
  },

  logoutBtn: {
    borderWidth: 1,
    borderColor: "#C0392B",
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutBtnPressed: { backgroundColor: "#FDF2F1" },
  logoutText: {
    fontFamily: "Jost_500Medium",
    fontSize: 13,
    color: "#C0392B",
    letterSpacing: 0.5,
  },
});
