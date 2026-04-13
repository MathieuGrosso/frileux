import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
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

type GeoStatus = "idle" | "asking" | "granted" | "denied";

export default function OnboardingProfile() {
  const router = useRouter();
  const [coldness, setColdness] = useState<ColdnessLevel | null>(null);
  const [geo, setGeo] = useState<GeoStatus>("idle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AsyncStorage.setItem("@onboarding/last-step", "profile");
    supabase
      .from("profiles")
      .select("coldness_level, last_latitude")
      .single()
      .then(({ data }) => {
        if (data?.coldness_level) setColdness(data.coldness_level as ColdnessLevel);
        if (data?.last_latitude !== null && data?.last_latitude !== undefined) {
          setGeo("granted");
        }
      });
  }, []);

  async function selectColdness(level: ColdnessLevel) {
    setColdness(level);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ coldness_level: level })
      .eq("id", user.id);
  }

  async function askLocation() {
    setGeo("asking");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setGeo("denied");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("profiles")
        .update({
          last_latitude: pos.coords.latitude,
          last_longitude: pos.coords.longitude,
        })
        .eq("id", user.id);
      setGeo("granted");
    } catch (e) {
      setGeo("denied");
      Alert.alert("Position", e instanceof Error ? e.message : "Impossible de récupérer la position.");
    }
  }

  async function goNext() {
    if (!coldness) return;
    setSaving(true);
    await AsyncStorage.setItem("@onboarding/last-step", "swipe");
    router.push("/onboarding/swipe");
    setSaving(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <View style={styles.progressWrap}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>← VESTIAIRE</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>ÉTAPE 02 / 03</Text>
        <Text style={styles.title}>TOI</Text>
        <Text style={styles.subtitle}>
          Deux infos pour t'habiller juste : ton seuil de froid, et où tu vis.
        </Text>

        <Text style={styles.sectionLabel}>NIVEAU DE FRILOSITÉ</Text>
        {([1, 2, 3, 4, 5] as ColdnessLevel[]).map((level) => (
          <Pressable
            key={level}
            onPress={() => selectColdness(level)}
            style={[styles.row, coldness === level && styles.rowActive]}
          >
            <Text style={styles.rowEmoji}>{COLDNESS_EMOJIS[level]}</Text>
            <Text style={[styles.rowLabel, coldness === level && styles.rowLabelActive]}>
              {COLDNESS_LABELS[level]}
            </Text>
            {coldness === level && <Text style={styles.rowCheck}>✓</Text>}
          </Pressable>
        ))}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>MÉTÉO LOCALE</Text>
        <Text style={styles.geoHint}>
          On utilise ta position pour la météo du matin. Pas de tracking.
        </Text>

        {geo === "granted" ? (
          <View style={[styles.geoBtn, styles.geoBtnGranted]}>
            <Text style={styles.geoBtnGrantedText}>✓ POSITION CAPTÉE</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.geoBtn, geo === "asking" && styles.geoBtnDisabled]}
            onPress={askLocation}
            disabled={geo === "asking"}
          >
            {geo === "asking" ? (
              <ActivityIndicator color="#637D8E" size="small" />
            ) : (
              <Text style={styles.geoBtnText}>
                {geo === "denied" ? "RÉESSAYER LA POSITION" : "AUTORISER LA POSITION"}
              </Text>
            )}
          </Pressable>
        )}
        {geo === "denied" && (
          <Text style={styles.geoDenied}>
            Refusé. Tu pourras réessayer dans Réglages.
          </Text>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.continueBtn, !coldness && styles.continueBtnDisabled]}
          onPress={goNext}
          disabled={!coldness || saving}
        >
          <Text style={[styles.continueText, !coldness && styles.continueTextDisabled]}>
            CONTINUER →
          </Text>
        </Pressable>
        {!coldness && (
          <Text style={styles.bottomHint}>Choisis ton niveau pour continuer</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  progressWrap: { flexDirection: "row", gap: 6 },
  progressDot: { width: 24, height: 2, backgroundColor: "#E8E5DF" },
  progressDotActive: { backgroundColor: "#0F0F0D" },
  backText: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#637D8E",
  },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  kicker: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    letterSpacing: 1.6,
    color: "#637D8E",
    marginBottom: 8,
  },
  title: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 56,
    letterSpacing: -1,
    color: "#0F0F0D",
    lineHeight: 56,
  },
  subtitle: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#0F0F0D",
    marginTop: 12,
    marginBottom: 28,
  },
  sectionLabel: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.4,
    color: "#637D8E",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 6,
    backgroundColor: "#FFFFFF",
  },
  rowActive: {
    backgroundColor: "#E8F1F6",
    borderColor: "#637D8E",
  },
  rowEmoji: { fontSize: 20 },
  rowLabel: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#0F0F0D",
    flex: 1,
  },
  rowLabelActive: {
    fontFamily: "Jost_500Medium",
    color: "#0F0F0D",
  },
  rowCheck: {
    fontFamily: "Jost_500Medium",
    fontSize: 14,
    color: "#637D8E",
  },
  divider: { height: 1, backgroundColor: "#E8E5DF", marginTop: 32, marginBottom: 24 },
  geoHint: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#0F0F0D",
    marginBottom: 14,
  },
  geoBtn: {
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0F0F0D",
    backgroundColor: "#FFFFFF",
  },
  geoBtnDisabled: { opacity: 0.4 },
  geoBtnGranted: {
    borderColor: "#637D8E",
    backgroundColor: "#E8F1F6",
  },
  geoBtnText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 14,
    letterSpacing: 1.4,
    color: "#0F0F0D",
  },
  geoBtnGrantedText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 14,
    letterSpacing: 1.4,
    color: "#637D8E",
  },
  geoDenied: {
    fontFamily: "Jost_400Regular",
    fontSize: 12,
    color: "#A8A49F",
    marginTop: 8,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#E8E5DF",
    backgroundColor: "#FAFAF8",
  },
  continueBtn: { paddingVertical: 18, alignItems: "center", backgroundColor: "#0F0F0D" },
  continueBtnDisabled: { backgroundColor: "#E8E5DF" },
  continueText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 18,
    letterSpacing: 1.4,
    color: "#FAFAF8",
  },
  continueTextDisabled: { color: "#A8A49F" },
  bottomHint: {
    fontFamily: "Jost_400Regular",
    fontSize: 11,
    color: "#A8A49F",
    textAlign: "center",
    marginTop: 8,
  },
});
