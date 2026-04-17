import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CalibrationGauge } from "@/components/CalibrationGauge";
import { TasteDuel } from "@/components/TasteDuel";
import {
  CalibrateError,
  CALIBRATION_TARGET,
  getJudgedCount,
  requestBatch,
  submitProbeChoice,
  type TasteProbe,
} from "@/lib/tasteProbes";

type Phase = "loading" | "duels" | "done" | "error";

const ERROR_COPY: Record<string, string> = {
  network: "Connexion perdue.",
  config_missing: "Service IA indisponible.",
  llm_error: "Le styliste est indisponible un instant.",
  llm_refused: "L'IA n'a pas généré de duels.",
  schema_mismatch: "Réponse incohérente reçue.",
  empty_batch: "Aucun duel exploitable généré.",
  empty_response: "Pas de réponse reçue.",
  invalid_payload: "Réponse incomplète.",
  db_insert_failed: "Impossible d'enregistrer les duels.",
};

export default function CalibrateScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [probes, setProbes] = useState<TasteProbe[]>([]);
  const [cursor, setCursor] = useState(0);
  const [judgedTotal, setJudgedTotal] = useState(0);
  const [sessionJudged, setSessionJudged] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setErrorCode(null);
    setErrorDetail(null);
    try {
      const [batch, total] = await Promise.all([requestBatch(), getJudgedCount()]);
      setProbes(batch.probes);
      setCursor(0);
      setJudgedTotal(total);
      setSessionJudged(0);
      setPhase(batch.probes.length > 0 ? "duels" : "error");
    } catch (e) {
      if (e instanceof CalibrateError) {
        setErrorCode(e.code);
        setErrorDetail(e.detail);
        if (__DEV__) console.warn(`calibrate ${e.code}:`, e.detail);
      } else {
        setErrorCode("unknown");
        setErrorDetail(e instanceof Error ? e.message : String(e));
        if (__DEV__) console.warn("calibrate load:", e);
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
    const headline = errorCode ? (ERROR_COPY[errorCode] ?? "Calibrage indisponible.") : "Calibrage indisponible.";
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 px-6 pt-20">
          <Text className="font-display text-display-xl text-ink-900 tracking-tight mb-4">
            {headline}
          </Text>
          <Text className="font-body text-body-sm text-ink-500 mb-6 leading-snug">
            Un souci côté IA — tu peux retenter ou passer à la suggestion du jour.
          </Text>
          {__DEV__ && errorCode && (
            <Text className="font-body text-micro text-ink-300 mb-10 uppercase tracking-widest">
              {errorCode}
              {errorDetail ? ` · ${errorDetail.slice(0, 80)}` : ""}
            </Text>
          )}
          <View className="flex-row" style={{ gap: 24 }}>
            <Pressable onPress={load} hitSlop={8}>
              <Text className="font-body-medium text-eyebrow text-ink-900 uppercase tracking-widest">
                Retenter →
              </Text>
            </Pressable>
            <Pressable onPress={goToday} hitSlop={8}>
              <Text className="font-body-medium text-eyebrow text-ink-300 uppercase tracking-widest">
                Aller à Aujourd'hui
              </Text>
            </Pressable>
          </View>
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
