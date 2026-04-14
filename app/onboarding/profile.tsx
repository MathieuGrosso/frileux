import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { ColdnessLevel } from "@/lib/types";
import { colors } from "@/lib/theme";

const COLDNESS_LABELS: Record<ColdnessLevel, string> = {
  1: "Un peu frileuse",
  2: "Frileuse",
  3: "Très frileuse",
  4: "Ultra frileuse",
  5: "Je vis en doudoune",
};

type GeoStatus = "idle" | "asking" | "granted" | "denied";

export default function OnboardingProfile() {
  const router = useRouter();
  const [coldness, setColdness] = useState<ColdnessLevel | null>(null);
  const [geo, setGeo] = useState<GeoStatus>("idle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AsyncStorage.setItem("@onboarding/last-step", "profile");
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("coldness_level, last_latitude")
        .eq("id", user.id)
        .maybeSingle();
      if (!data) {
        const fallbackUsername = user.email?.split("@")[0] ?? "user";
        await supabase
          .from("profiles")
          .upsert({ id: user.id, username: fallbackUsername }, { onConflict: "id" });
        return;
      }
      if (data.coldness_level) setColdness(data.coldness_level as ColdnessLevel);
      if (data.last_latitude !== null && data.last_latitude !== undefined) {
        setGeo("granted");
      }
    })();
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
    <SafeAreaView className="flex-1 bg-paper" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-6 pt-2 pb-4">
        <View className="flex-row gap-1.5">
          <View className="h-[2px] w-6 bg-ink-900" />
          <View className="h-[2px] w-6 bg-ink-900" />
          <View className="h-[2px] w-6 bg-ink-900" />
          <View className="h-[2px] w-6 bg-paper-300" />
        </View>
        <PressableScale onPress={() => router.back()} hitSlop={12}>
          <Text className="font-body-medium text-eyebrow text-ice uppercase">← Goût</Text>
        </PressableScale>
      </View>

      <ScrollView
        contentContainerClassName="px-6 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-body-medium text-eyebrow text-ice uppercase mb-2">
          Étape 03 / 04
        </Text>
        <Text className="font-display text-display-xl text-ink-900">TOI</Text>
        <Text className="font-body text-body-sm text-ink-900 mt-3 mb-7">
          Deux infos pour t'habiller juste : ton seuil de froid, et où tu vis.
        </Text>

        <View className="flex-row items-baseline justify-between mb-1">
          <Text className="font-body-medium text-eyebrow text-ink-500 uppercase">
            Niveau de frilosité
          </Text>
          {coldness && (
            <Text className="font-display text-h3 text-ice">
              0{coldness}
            </Text>
          )}
        </View>
        <Text className="font-body text-caption text-ink-300 mb-5">
          Les suggestions seront adaptées à ton niveau.
        </Text>

        <View className="border-t border-paper-300 mb-8">
          {([1, 2, 3, 4, 5] as ColdnessLevel[]).map((level) => {
            const active = coldness === level;
            return (
              <PressableScale
                key={level}
                onPress={() => selectColdness(level)}
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
                {active && (
                  <Text className="font-body-medium text-body-sm text-ice">✓</Text>
                )}
              </PressableScale>
            );
          })}
        </View>

        <Text className="font-body-medium text-eyebrow text-ink-500 uppercase mb-2">
          Météo locale
        </Text>
        <Text className="font-body text-caption text-ink-300 mb-5">
          On utilise ta position pour la météo du matin. Pas de tracking.
        </Text>

        {geo === "granted" ? (
          <View className="border border-ice py-4 items-center">
            <Text className="font-display text-body-sm text-ice uppercase tracking-widest">
              ✓ Position captée
            </Text>
          </View>
        ) : (
          <PressableScale
            className={`border border-ink-900 py-4 items-center active:bg-paper-200 ${
              geo === "asking" ? "opacity-40" : ""
            }`}
            onPress={askLocation}
            disabled={geo === "asking"}
          >
            {geo === "asking" ? (
              <ActivityIndicator color={colors.ice[600]} size="small" />
            ) : (
              <Text className="font-display text-body-sm text-ink-900 uppercase tracking-widest">
                {geo === "denied" ? "Réessayer la position" : "Autoriser la position"}
              </Text>
            )}
          </PressableScale>
        )}
        {geo === "denied" && (
          <Text className="font-body text-caption text-ink-300 mt-2">
            Refusé. Tu pourras réessayer dans Réglages.
          </Text>
        )}
      </ScrollView>

      <View className="px-6 pt-3 pb-3 border-t border-paper-300 bg-paper">
        <PressableScale
          className={`py-4 items-center ${coldness ? "bg-ink-900 active:bg-ink-700" : "bg-paper-300"}`}
          onPress={goNext}
          disabled={!coldness || saving}
        >
          <Text
            className={`font-display text-body uppercase tracking-widest ${
              coldness ? "text-paper" : "text-ink-300"
            }`}
          >
            Continuer →
          </Text>
        </PressableScale>
        {!coldness && (
          <Text className="font-body text-caption text-ink-300 text-center mt-2">
            Choisis ton niveau pour continuer
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
