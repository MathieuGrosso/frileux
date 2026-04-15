import { useState, useEffect } from "react";
import { View, Text, Pressable, Alert, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useOnboardingFlag } from "@/lib/onboarding-context";
import type { ColdnessLevel, ThermalFeeling } from "@/lib/types";
import { BrandLogo } from "@/components/BrandLogo";
import { suggestColdnessAdjustment, type CalibrationSuggestion } from "@/lib/coldness-calibration";

const COLDNESS_LABELS: Record<ColdnessLevel, string> = {
  1: "Un peu frileux",
  2: "Frileux",
  3: "Très frileux",
  4: "Ultra frileux",
  5: "Je vis en doudoune",
};

export default function SettingsScreen() {
  const router = useRouter();
  const { refresh: refreshOnboarding } = useOnboardingFlag();
  const [coldnessLevel, setColdnessLevel] = useState<ColdnessLevel>(3);
  const [username, setUsername] = useState("");
  const [calibration, setCalibration] = useState<CalibrationSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingLevel, setSavingLevel] = useState<ColdnessLevel | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expirée. Reconnecte-toi.");
      setLoading(false);
      return;
    }

    let { data, error: err } = await supabase
      .from("profiles")
      .select("coldness_level, username")
      .eq("id", user.id)
      .maybeSingle();

    if (err) {
      setError("Impossible de charger ton profil.");
      setLoading(false);
      return;
    }

    if (!data) {
      const fallbackUsername = user.email?.split("@")[0] ?? "user";
      const { data: created, error: upsertErr } = await supabase
        .from("profiles")
        .upsert(
          { id: user.id, username: fallbackUsername, coldness_level: 3 },
          { onConflict: "id" },
        )
        .select("coldness_level, username")
        .maybeSingle();
      if (upsertErr || !created) {
        setError("Impossible de charger ton profil.");
        setLoading(false);
        return;
      }
      data = created;
    }

    setColdnessLevel(data.coldness_level as ColdnessLevel);
    setUsername(data.username);
    void loadCalibration(data.coldness_level as ColdnessLevel);
    setLoading(false);
  }

  async function loadCalibration(current: ColdnessLevel) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const { data } = await supabase
      .from("outfits")
      .select("thermal_feeling")
      .eq("user_id", user.id)
      .gte("date", fourteenDaysAgo.toISOString().split("T")[0])
      .not("thermal_feeling", "is", null)
      .order("date", { ascending: false })
      .limit(10);
    const feedback = (data ?? [])
      .map((o) => ({ thermal: o.thermal_feeling as ThermalFeeling }))
      .filter((f) => !!f.thermal);
    setCalibration(suggestColdnessAdjustment(current, feedback));
  }

  async function acceptCalibration() {
    if (!calibration) return;
    await updateColdness(calibration.suggested);
    setCalibration(null);
  }

  async function updateColdness(level: ColdnessLevel) {
    const previous = coldnessLevel;
    setColdnessLevel(level);
    setSavingLevel(level);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setColdnessLevel(previous);
      setSavingLevel(null);
      setError("Session expirée. Reconnecte-toi.");
      return;
    }
    const { error: err } = await supabase
      .from("profiles")
      .update({ coldness_level: level })
      .eq("id", user.id);
    if (err) {
      setColdnessLevel(previous);
      setError("Impossible d'enregistrer. Réessaie.");
    }
    setSavingLevel(null);
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
      .update({ onboarding_completed: false, taste_completed: false })
      .eq("id", user.id);
    await AsyncStorage.removeItem("@onboarding/last-step");
    await refreshOnboarding();
    router.replace("/onboarding");
  }

  async function redoTaste() {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm("Refaire l'étape goût ? Tes autres réglages sont conservés.")
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Refaire l'étape goût",
              "On garde tout le reste — seulement les marques, univers et coupe.",
              [
                { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
                { text: "Refaire", onPress: () => resolve(true) },
              ]
            );
          });
    if (!confirmed) return;
    router.push("/onboarding/taste?upgrade=1");
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
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("signOut failed", e);
    }
    router.replace("/auth/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView
        contentContainerClassName="px-6 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View className="flex-row items-center justify-between pt-2 pb-10">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text className="font-body text-body-sm text-ink-500">← Retour</Text>
          </Pressable>
          {loading ? (
            <View className="h-3 w-24 bg-paper-200" />
          ) : username ? (
            <Text className="font-body-medium text-eyebrow text-ink-300 uppercase">
              @{username}
            </Text>
          ) : (
            <Text className="font-body-medium text-eyebrow text-ink-300 uppercase">—</Text>
          )}
        </View>

        {/* Page title */}
        <View className="mb-12">
          <Text className="font-body-medium text-eyebrow text-ink-300 uppercase mb-2">
            Compte
          </Text>
          <Text className="font-display text-h1 text-ink-900">Réglages</Text>
        </View>

        {/* Coldness */}
        <View className="mb-12">
          <View className="flex-row items-baseline justify-between mb-1">
            <Text className="font-body-medium text-eyebrow text-ink-500 uppercase">
              Niveau de frilosité
            </Text>
            <Text className="font-display text-h3 text-ice">
              0{coldnessLevel}
            </Text>
          </View>
          <Text className="font-body text-caption text-ink-300 mb-5">
            Les suggestions seront adaptées à ton niveau.
          </Text>

          {error && (
            <View className="border-l-2 border-error bg-paper-200 px-3 py-2 mb-4">
              <Text className="font-body text-body-sm text-error">{error}</Text>
            </View>
          )}

          {calibration && (
            <View className="bg-ice-100 border-l-2 border-ice p-4 mb-4">
              <Text className="font-body-medium text-micro text-ice-900 uppercase mb-1">
                {calibration.delta > 0
                  ? "Passer au niveau supérieur ?"
                  : "Passer au niveau inférieur ?"}
              </Text>
              <Text className="font-body text-body-sm text-ink-700 mb-3">
                {calibration.reason}
              </Text>
              <View className="flex-row items-center gap-4">
                <Pressable
                  onPress={acceptCalibration}
                  className="bg-ink-900 px-3.5 py-2"
                >
                  <Text className="font-body-medium text-micro text-paper uppercase">
                    Passer à 0{calibration.suggested}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setCalibration(null)} hitSlop={8}>
                  <Text className="font-body-medium text-micro text-ice uppercase underline">
                    Ignorer
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          <View className="border-t border-paper-300">
            {([1, 2, 3, 4, 5] as ColdnessLevel[]).map((level) => {
              const active = coldnessLevel === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => updateColdness(level)}
                  className="flex-row items-center py-4 border-b border-paper-300"
                >
                  <Text
                    className={`font-display text-body-sm w-10 ${
                      active ? "text-ice" : "text-ink-300"
                    }`}
                  >
                    0{level}
                  </Text>
                  <Text
                    className={`flex-1 ${
                      active
                        ? "font-body-medium text-body text-ink-900"
                        : "font-body text-body text-ink-500"
                    }`}
                  >
                    {COLDNESS_LABELS[level]}
                  </Text>
                  {savingLevel === level ? (
                    <Text className="font-body text-body-sm text-ink-300">…</Text>
                  ) : active ? (
                    <Text className="font-body-medium text-body-sm text-ice">✓</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Personnalisation */}
        <View className="mb-12">
          <Text className="font-body-medium text-eyebrow text-ink-500 uppercase mb-5">
            Personnalisation
          </Text>

          <Pressable
            onPress={redoTaste}
            className="bg-ink-900 py-4 items-center active:bg-ink-700"
          >
            <Text className="font-display text-body-sm text-paper uppercase tracking-widest">
              Mettre à jour mon goût
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/wardrobe")}
            className="border border-ink-900 py-4 items-center mt-2 active:bg-paper-200"
          >
            <Text className="font-display text-body-sm text-ink-900 uppercase tracking-widest">
              Ma garde-robe
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/brands-library")}
            className="border border-ink-900 py-4 items-center mt-2 active:bg-paper-200"
          >
            <Text className="font-display text-body-sm text-ink-900 uppercase tracking-widest">
              Bibliothèque de marques
            </Text>
          </Pressable>

          <Pressable
            onPress={resetOnboarding}
            className="border border-ink-900 py-4 items-center mt-2 active:bg-paper-200"
          >
            <Text className="font-display text-body-sm text-ink-900 uppercase tracking-widest">
              Recommencer l'onboarding
            </Text>
          </Pressable>
        </View>

        {/* Session */}
        <View className="border-t border-paper-300 pt-6">
          <Pressable
            onPress={handleLogout}
            accessibilityRole="button"
            className="self-start py-2 active:opacity-60"
          >
            <Text className="font-body text-body-sm text-error underline">
              Se déconnecter
            </Text>
          </Pressable>
        </View>

        <View className="items-center mt-20 opacity-30">
          <BrandLogo size="sm" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
