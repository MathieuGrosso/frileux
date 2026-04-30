import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CalibrationGauge } from "@/components/CalibrationGauge";
import { TasteDuel } from "@/components/TasteDuel";
import {
  CALIBRATION_TARGET,
  CalibrateError,
  type CalibrateErrorCode,
  getJudgedCount,
  requestBatch,
  submitProbeChoice,
  type TasteProbe,
} from "@/lib/tasteProbes";
import { colors } from "@/lib/theme";

type Phase = "loading" | "duels" | "done" | "error";

const ERROR_COPY: Record<CalibrateErrorCode, string> = {
  config_missing: "Service de calibrage non configuré.",
  gemini_down: "Le générateur de pièces n'a pas répondu.",
  claude_down: "Le compositeur de tenues n'a pas répondu.",
  schema_mismatch: "Réponse IA inexploitable — on retente.",
  no_valid_duels: "Aucun duel exploitable cette fois.",
  db_error: "Écriture en base impossible.",
  unauthorized: "Session expirée. Reconnecte-toi.",
  invalid_payload: "Réponse inattendue du service.",
  network: "Réseau instable.",
  unknown: "Calibrage indisponible.",
};

const AXIS_QUESTION: Record<string, string> = {
  silhouette: "Quelle coupe ?",
  palette: "Quelle palette ?",
  texture: "Quelle matière ?",
  registre: "Quel registre ?",
  proportion: "Quelle proportion ?",
};

export default function CalibrateScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [probes, setProbes] = useState<TasteProbe[]>([]);
  const [cursor, setCursor] = useState(0);
  const [judgedTotal, setJudgedTotal] = useState(0);
  const [sessionJudged, setSessionJudged] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<CalibrateErrorCode>("unknown");
  const [errorDetail, setErrorDetail] = useState<string>("");
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const [batch, total] = await Promise.all([requestBatch(), getJudgedCount()]);
      setProbes(batch.probes);
      setCursor(0);
      setJudgedTotal(total);
      setSessionJudged(0);
      setPhase(batch.probes.length > 0 ? "duels" : "error");
      if (batch.probes.length === 0) {
        setErrorCode("no_valid_duels");
        setErrorDetail("0 probes returned");
      }
    } catch (e) {
      if (e instanceof CalibrateError) {
        setErrorCode(e.code);
        setErrorDetail(e.detail);
        if (__DEV__) console.warn(`calibrate: ${e.code} · ${e.detail}`);
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

  function handleSkip() {
    if (submitting) return;
    if (!probes[cursor]) return;
    if (cursor + 1 >= probes.length) {
      setPhase("done");
    } else {
      setCursor(cursor + 1);
    }
  }

  function goToday() {
    router.replace("/(tabs)");
  }

  if (phase === "loading") {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color={colors.ink[900]} />
        <Text className="font-body text-body-sm text-ink-400 mt-4">
          Préparation des duels…
        </Text>
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    const copy = ERROR_COPY[errorCode] ?? ERROR_COPY.unknown;
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 px-6 pt-20">
          <Text className="font-display text-display-xl text-ink-900 tracking-tight mb-4">
            {copy}
          </Text>
          <Text className="font-body text-body-sm text-ink-500 mb-10 leading-snug">
            Ta journée commence quand même : la suggestion du matin t'attend.
            Tu peux retenter dans un instant.
          </Text>
          {__DEV__ && errorDetail ? (
            <Text className="font-body text-micro text-ink-300 uppercase tracking-widest mb-8">
              {errorCode} · {errorDetail.slice(0, 80)}
            </Text>
          ) : null}
          <View className="flex-row">
            <Pressable onPress={load} hitSlop={8} className="mr-8">
              <Text className="font-body-medium text-eyebrow text-ink-900 uppercase tracking-widest">
                Retenter →
              </Text>
            </Pressable>
            <Pressable onPress={goToday} hitSlop={8}>
              <Text className="font-body-medium text-eyebrow text-ink-400 uppercase tracking-widest">
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
  const axisQuestion = current
    ? (AXIS_QUESTION[current.axis] ?? "Lequel te ressemble ?")
    : "";

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top", "bottom"]}>
      <View className="flex-1 px-6 pt-4 pb-10">
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-1 mr-6">
            <CalibrationGauge current={judgedTotal} target={CALIBRATION_TARGET} />
          </View>
          <Text className="font-body-medium text-eyebrow text-ink-300 uppercase tracking-widest">
            Duel {String(cursor + 1).padStart(2, "0")} / {String(probes.length).padStart(2, "0")}
          </Text>
        </View>

        <View className="mb-8">
          {current && (
            <Text className="font-body-medium text-micro text-ice uppercase tracking-widest mb-2">
              {current.axis_label_fr}
            </Text>
          )}
          <Text className="font-display text-h1 text-ink-900 tracking-tight">
            {axisQuestion}
          </Text>
        </View>

        <View className="flex-1">
          {current && (
            <TasteDuel
              probe={current}
              onChoose={handleChoose}
              disabled={submitting}
            />
          )}
        </View>

        <View className="flex-row justify-between items-center pt-6">
          <Pressable
            onPress={() => handleChoose("none")}
            disabled={submitting}
            hitSlop={10}
          >
            <Text className="font-body text-micro text-ink-400 uppercase tracking-widest">
              Ni l'un ni l'autre
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSkip}
            disabled={submitting}
            hitSlop={10}
          >
            <Text className="font-body text-micro text-ink-400 uppercase tracking-widest">
              Passer →
            </Text>
          </Pressable>
          <Pressable onPress={goToday} hitSlop={10}>
            <Text className="font-body text-micro text-ink-300 uppercase tracking-widest">
              Plus tard
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
