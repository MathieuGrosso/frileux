import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { PressableScale } from "@/components/ui/PressableScale";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { confirmAction } from "@/lib/ui";

interface Stats {
  inspirations: number;
  probes: number;
  memoryFacts: number;
  brands: number;
}

const EMPTY: Stats = { inspirations: 0, probes: 0, memoryFacts: 0, brands: 0 };

export default function GoutHub() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStats(EMPTY);
      setLoading(false);
      return;
    }
    const [inspirationsRes, probesRes, memoryRes, profileRes] = await Promise.all([
      supabase
        .from("user_inspirations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("approved", true),
      supabase
        .from("taste_probes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("judged_at", "is", null),
      supabase
        .from("style_memory")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("favorite_brands")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    setStats({
      inspirations: inspirationsRes.count ?? 0,
      probes: probesRes.count ?? 0,
      memoryFacts: memoryRes.count ?? 0,
      brands: (profileRes.data?.favorite_brands as string[] | null)?.length ?? 0,
    });
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function redoSwipes() {
    const ok = await confirmAction(
      "Refaire mes swipes ?",
      "Les préférences actuelles restent. Tu pourras itérer dessus.",
      "Refaire",
      false
    );
    if (!ok) return;
    router.push("/onboarding/taste?upgrade=1" as const);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color={colors.ice[600]} />
      </SafeAreaView>
    );
  }

  const sections: Array<{
    num: string;
    title: string;
    stat: string;
    description: string;
    onPress: () => void;
    primary?: boolean;
  }> = [
    {
      num: "01",
      title: "L'ŒIL",
      stat: stats.inspirations > 0 ? `${stats.inspirations} épinglé${stats.inspirations > 1 ? "s" : ""}` : "rien encore",
      description: "Pièces, adresses, planches que tu retiens ailleurs.",
      onPress: () => router.push("/eye"),
      primary: true,
    },
    {
      num: "02",
      title: "AFFINER",
      stat: stats.probes > 0 ? `${stats.probes} duel${stats.probes > 1 ? "s" : ""} jugé${stats.probes > 1 ? "s" : ""}` : "jamais calibré",
      description: "Duels A/B pour serrer le modèle sur tes axes.",
      onPress: () => router.push("/calibrate"),
    },
    {
      num: "03",
      title: "MÉMOIRE",
      stat: stats.memoryFacts > 0 ? `${stats.memoryFacts} fait${stats.memoryFacts > 1 ? "s" : ""}` : "rien appris",
      description: "Ce que Frileux a retenu de tes critiques.",
      onPress: () => router.push("/memory"),
    },
    {
      num: "04",
      title: "MARQUES",
      stat: stats.brands > 0 ? `${stats.brands} favorite${stats.brands > 1 ? "s" : ""}` : "aucune",
      description: "Bibliothèque de marques — ancre les suggestions.",
      onPress: () => router.push("/brands-library"),
    },
    {
      num: "05",
      title: "REFAIRE LES SWIPES",
      stat: "reset goût",
      description: "Recommencer l'onboarding taste — pour pivoter.",
      onPress: redoSwipes,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="px-6 pt-6 pb-6 border-b border-paper-300">
          <Text
            className="font-body-medium text-ink-300"
            style={{ fontSize: 10, letterSpacing: 2 }}
          >
            TON MODÈLE
          </Text>
          <Text
            className="font-display text-ink-900 tracking-tight mt-1"
            style={{ fontSize: 48, lineHeight: 52 }}
          >
            GOÛT
          </Text>
          <Text
            className="font-body text-ink-500 mt-3"
            style={{ fontSize: 14, lineHeight: 20 }}
          >
            Les outils qui nourrissent l'algo. Plus tu les utilises, plus les
            suggestions t'appartiennent.
          </Text>
        </View>

        <View className="px-6 pt-6">
          {sections.map((s, idx) => (
            <PressableScale
              key={s.num}
              onPress={s.onPress}
              className={
                "mb-3 p-5 " +
                (s.primary
                  ? "bg-ink-900"
                  : "bg-paper-50 border border-paper-300")
              }
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <Text
                    className={
                      "font-body-medium " +
                      (s.primary ? "text-ice-200" : "text-ink-300")
                    }
                    style={{ fontSize: 10, letterSpacing: 2 }}
                  >
                    {s.num}
                  </Text>
                  <Text
                    className={
                      "font-display tracking-tight mt-1 " +
                      (s.primary ? "text-paper" : "text-ink-900")
                    }
                    style={{ fontSize: 28, lineHeight: 32 }}
                  >
                    {s.title}
                  </Text>
                  <Text
                    className={
                      "font-body mt-2 " +
                      (s.primary ? "text-ink-300" : "text-ink-500")
                    }
                    style={{ fontSize: 13, lineHeight: 18 }}
                  >
                    {s.description}
                  </Text>
                </View>
                <Text
                  className={
                    "font-body-medium " +
                    (s.primary ? "text-ice-200" : "text-ice-600")
                  }
                  style={{ fontSize: 10, letterSpacing: 1.6 }}
                >
                  {s.stat.toUpperCase()}
                </Text>
              </View>
              <View className="mt-3 flex-row justify-end">
                <Text
                  className={
                    "font-body " + (s.primary ? "text-paper" : "text-ink-900")
                  }
                  style={{ fontSize: 14 }}
                >
                  →
                </Text>
              </View>
            </PressableScale>
          ))}
          <Text
            className="font-body text-ink-300 text-center mt-4"
            style={{ fontSize: 11, letterSpacing: 1.4 }}
          >
            CHAQUE SIGNAL NOURRIT LA PROCHAINE SUGGESTION.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
