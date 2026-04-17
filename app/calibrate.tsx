import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CalibrationGauge } from "@/components/CalibrationGauge";
import { TasteDuel } from "@/components/TasteDuel";
import {
  CALIBRATION_TARGET,
  getJudgedCount,
  requestBatch,
  submitProbeChoice,
  type TasteProbe,
} from "@/lib/tasteProbes";

type Phase = "loading" | "duels" | "done" | "error";

export default function CalibrateScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [probes, setProbes] = useState<TasteProbe[]>([]);
  const [cursor, setCursor] = useState(0);
  const [judgedTotal, setJudgedTotal] = useState(0);
  const [sessionJudged, setSessionJudged] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      const [batch, total] = await Promise.all([requestBatch(), getJudgedCount()]);
      setProbes(batch.probes);
      setCursor(0);
      setJudgedTotal(total);
      setSessionJudged(0);
      setPhase(batch.probes.length > 0 ? "duels" : "error");
    } catch (e) {
      if (__DEV__) {
        console.warn("calibrate load:", e);
        const ctx = (e as { context?: Response }).context;
        if (ctx && typeof ctx.text === "function") {
          ctx.text().then((body) => console.warn("daily-taste-probe response body:", body)).catch(() => {});
        }
      }
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    void load();
  }, [load]);

  async function handleChoose(choice: "a" | "b" | "none") {
    if (submitting) return;
    const probe = probes[cursor];
    if (!probe) return;
    setSubmitting(true);
    try {
      await submitProbeChoice(probe.id, choice);
      setJudgedTotal((n) => n + 1);
      setSessionJudged((n) => n + 1);
      if (cursor + 1 >= probes.length) {
        setPhase("done");
      } else {
        setCursor(cursor + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function goToday() {
    router.replace("/(tabs)");
  }

  if (phase === "loading") {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color="#0F0F0D" />
        <Text className="font-body text-body-sm text-ink-400 mt-4">
          Préparation des duels…
        </Text>
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 px-6 pt-20">
          <Text className="font-display text-display-xl text-ink-900 tracking-tight mb-4">
            Calibrage indisponible.
          </Text>
          <Text className="font-body text-body-sm text-ink-500 mb-10 leading-snug">
            Un souci côté IA — réessaie dans quelques minutes. Ta journée commence
            quand même : la suggestion du jour t'attend.
          </Text>
          <Pressable onPress={goToday} hitSlop={8}>
            <Text className="font-body-medium text-eyebrow text-ink-900 uppercase tracking-widest">
              Aller à Aujourd'hui →
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "done") {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 px-6 pt-20">
          <View className="mb-12">
            <CalibrationGauge current={judgedTotal} target={CALIBRATION_TARGET} />
          </View>
          <Text className="font-display text-display-xl text-ink-900 tracking-tight mb-5">
            Vu.{"\n"}Ton goût est mieux cerné.
          </Text>
          <Text className="font-body text-body-sm text-ink-500 mb-12 leading-snug">
            {sessionJudged} duel{sessionJudged > 1 ? "s" : ""} jugé{sessionJudged > 1 ? "s" : ""} sur
            cette session. Chaque nouveau retour affine les suggestions du matin.
          </Text>
          <Pressable onPress={goToday} hitSlop={8}>
            <Text className="font-body-medium text-eyebrow text-ink-900 uppercase tracking-widest">
              Voir la suggestion du jour →
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const current = probes[cursor];

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top", "bottom"]}>
      <View className="flex-1 px-6 pt-6 pb-6">
        <CalibrationGauge current={judgedTotal} target={CALIBRATION_TARGET} />

        <View className="mt-8 mb-8">
          <Text className="font-display text-display-2xl text-ink-900 tracking-tight leading-[0.95]">
            Hello.{"\n"}Dis-moi ce que tu aimes.
          </Text>
          <Text className="font-body text-micro text-ice uppercase tracking-widest mt-4">
            {probes.length} duels · {probes.length * 8} secondes
          </Text>
        </View>

        <View className="flex-1 justify-center">
          <Text className="font-body text-micro text-ink-400 uppercase tracking-widest mb-2">
            Duel {String(cursor + 1).padStart(2, "0")} / {String(probes.length).padStart(2, "0")}
          </Text>
          {current && (
            <TasteDuel
              probe={current}
              onChoose={handleChoose}
              disabled={submitting}
            />
          )}
        </View>

        <View className="flex-row justify-end pt-4">
          <Pressable onPress={goToday} hitSlop={10}>
            <Text className="font-body text-micro text-ink-400 uppercase tracking-widest">
              Plus tard →
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
