import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { generateOutfitCombos, generateMissingPieces } from "@/lib/gemini";
import { SwipeCard } from "@/components/SwipeCard";
import type {
  WardrobeItem,
  SwipeCardPayload,
  WardrobeItemType,
} from "@/lib/types";

const TYPE_LABELS: Record<WardrobeItemType, string> = {
  top: "Haut",
  bottom: "Bas",
  outerwear: "Manteau",
  shoes: "Chaussures",
  accessory: "Accessoire",
};

export default function OnboardingSwipe() {
  const router = useRouter();
  const [cards, setCards] = useState<SwipeCardPayload[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [prefsCount, setPrefsCount] = useState(0);

  useEffect(() => {
    AsyncStorage.setItem("@onboarding/last-step", "swipe");
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: items } = await supabase
        .from("wardrobe_items")
        .select("*")
        .eq("user_id", user.id);
      const wardrobe = (items as WardrobeItem[]) ?? [];

      const [combos, pieces] = await Promise.all([
        generateOutfitCombos(wardrobe).catch(() => []),
        generateMissingPieces(wardrobe).catch(() => []),
      ]);

      const comboCards: SwipeCardPayload[] = combos.map((combo) => ({
        kind: "combo" as const,
        combo,
        items: combo.item_ids
          .map((id) => wardrobe.find((w) => w.id === id))
          .filter((i): i is WardrobeItem => !!i),
      })).filter((c) => c.items.length > 0);

      const pieceCards: SwipeCardPayload[] = pieces.map((suggestion) => ({
        kind: "suggestion" as const,
        suggestion,
      }));

      const mixed = interleave(comboCards, pieceCards);
      setCards(mixed);
      if (mixed.length === 0) setLoadFailed(true);
    } catch (e) {
      setLoadFailed(true);
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de charger.");
    } finally {
      setLoading(false);
    }
  }

  function interleave<T>(a: T[], b: T[]): T[] {
    const out: T[] = [];
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      if (i < a.length) out.push(a[i]);
      if (i < b.length) out.push(b[i]);
    }
    return out;
  }

  async function handleSwipe(accepted: boolean) {
    const card = cards[cursor];
    if (!card) return;
    setCursor((c) => c + 1);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const { error } = await supabase.from("outfit_preferences").insert({
        user_id: user.id,
        kind: card.kind,
        payload: card.kind === "combo" ? card.combo : card.suggestion,
        accepted,
      });
      if (error) throw error;
      setPrefsCount((c) => c + 1);
    } catch {
      Alert.alert("Hors-ligne", "Cette préférence n'a pas pu être enregistrée.");
    }
  }

  async function finish(force = false) {
    if (!force && prefsCount === 0) {
      Alert.alert(
        "Aucune préférence enregistrée",
        "On n'a rien appris sur ton goût. Essaye de swiper, ou force le passage.",
        [
          { text: "Continuer à swiper", style: "cancel" },
          { text: "Forcer le passage", style: "destructive", onPress: () => finish(true) },
        ]
      );
      return;
    }
    setFinishing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
    }
    await AsyncStorage.removeItem("@onboarding/last-step");
    router.replace("/(tabs)");
  }

  async function backToVestiaire() {
    await AsyncStorage.setItem("@onboarding/last-step", "profile");
    router.replace("/onboarding");
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color="#637D8E" />
          <Text style={styles.loadingText}>Gemini compose tes tenues…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadFailed) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <View style={styles.progressWrap}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
          </View>
          <Pressable onPress={backToVestiaire} hitSlop={12}>
            <Text style={styles.backText}>← VESTIAIRE</Text>
          </Pressable>
        </View>
        <View style={styles.failedWrap}>
          <Text style={styles.kicker}>PROBLÈME</Text>
          <Text style={styles.failedTitle}>ON N'A PAS PU GÉNÉRER TES SUGGESTIONS.</Text>
          <Text style={styles.failedBody}>
            Réseau ou IA indispo. Réessaye, ou entre quand même — tu pourras affiner plus tard.
          </Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>RÉESSAYER</Text>
          </Pressable>
          <Pressable style={styles.skipBtn} onPress={() => finish(true)}>
            <Text style={styles.skipBtnText}>ENTRER QUAND MÊME</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const remaining = cards.slice(cursor);
  const done = remaining.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <View style={styles.progressWrap}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
        </View>
        <View style={styles.topBarRight}>
          <Pressable onPress={backToVestiaire} hitSlop={12}>
            <Text style={styles.backText}>← AJOUTER</Text>
          </Pressable>
          <Text style={styles.counter}>
            {Math.min(cursor + 1, cards.length)} / {cards.length}
          </Text>
        </View>
      </View>

      <View style={styles.header}>
        <Text style={styles.kicker}>ÉTAPE 03 / 03</Text>
        <Text style={styles.title}>TON ŒIL</Text>
        <Text style={styles.subtitle}>
          Swipe → garder · Swipe ← passer. On affine les suggestions à ton goût.
        </Text>
      </View>

      <View style={styles.stack}>
        {done ? (
          <View style={styles.doneCard}>
            <Text style={styles.doneKicker}>FINI</Text>
            <Text style={styles.doneTitle}>VESTIAIRE PRÊT</Text>
            <Text style={styles.doneBody}>
              On utilise ton style pour tes suggestions quotidiennes.
            </Text>
          </View>
        ) : (
          remaining
            .slice(0, 3)
            .reverse()
            .map((card, idxFromTop) => {
              const actualIdx = Math.min(3, remaining.length) - 1 - idxFromTop;
              return (
                <SwipeCard
                  key={`${cursor}-${actualIdx}`}
                  onSwipe={handleSwipe}
                  stackIndex={actualIdx}
                >
                  {renderCard(card)}
                </SwipeCard>
              );
            })
        )}
      </View>

      <View style={styles.bottomBar}>
        {done ? (
          <Pressable style={styles.finishBtn} onPress={() => finish()} disabled={finishing}>
            <Text style={styles.finishText}>
              {finishing ? "…" : "ENTRER DANS L'APP →"}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.manualRow}>
            <Pressable
              style={[styles.manualBtn, styles.manualReject]}
              onPress={() => handleSwipe(false)}
            >
              <Text style={styles.manualRejectText}>PASSER</Text>
            </Pressable>
            <Pressable
              style={[styles.manualBtn, styles.manualAccept]}
              onPress={() => handleSwipe(true)}
            >
              <Text style={styles.manualAcceptText}>GARDER</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function renderCard(card: SwipeCardPayload) {
  if (card.kind === "combo") {
    return (
      <View style={styles.cardInner}>
        <Text style={styles.cardKicker}>COMBINAISON</Text>
        <View style={styles.cardGrid}>
          {card.items.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.cardGridItem}>
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.cardImg} />
              ) : (
                <View style={[styles.cardImg, styles.cardPlaceholder]}>
                  <Text style={styles.cardPlaceholderText}>
                    {item.color?.slice(0, 2).toUpperCase() ?? "—"}
                  </Text>
                </View>
              )}
              <Text style={styles.cardImgLabel} numberOfLines={1}>
                {TYPE_LABELS[item.type]}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.cardRationale}>{card.combo.rationale}</Text>
      </View>
    );
  }
  return (
    <View style={styles.cardInner}>
      <Text style={styles.cardKicker}>PIÈCE À AJOUTER · {TYPE_LABELS[card.suggestion.type]}</Text>
      <View style={styles.suggestionBody}>
        <Text style={styles.suggestionDesc}>{card.suggestion.description}</Text>
      </View>
      <Text style={styles.cardRationale}>{card.suggestion.rationale}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontFamily: "Jost_400Regular", fontSize: 13, color: "#637D8E" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  progressWrap: { flexDirection: "row", gap: 6 },
  progressDot: { width: 24, height: 2, backgroundColor: "#E8E5DF" },
  progressDotActive: { backgroundColor: "#0F0F0D" },
  counter: { fontFamily: "Jost_500Medium", fontSize: 11, letterSpacing: 1.2, color: "#637D8E" },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  backText: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#637D8E",
  },
  failedWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    justifyContent: "center",
  },
  failedTitle: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 36,
    letterSpacing: -0.5,
    color: "#0F0F0D",
    lineHeight: 40,
    marginTop: 8,
  },
  failedBody: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#0F0F0D",
    marginTop: 16,
    marginBottom: 28,
  },
  retryBtn: {
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: "#0F0F0D",
    marginBottom: 8,
  },
  retryText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 16,
    letterSpacing: 1.4,
    color: "#FAFAF8",
  },
  skipBtn: {
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0F0F0D",
    backgroundColor: "#FFFFFF",
  },
  skipBtnText: {
    fontFamily: "BarlowCondensed_500Medium",
    fontSize: 13,
    letterSpacing: 1.2,
    color: "#0F0F0D",
  },
  header: { paddingHorizontal: 24, paddingBottom: 16 },
  kicker: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    letterSpacing: 1.6,
    color: "#637D8E",
    marginBottom: 8,
  },
  title: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 48,
    letterSpacing: -1,
    color: "#0F0F0D",
    lineHeight: 48,
  },
  subtitle: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "#0F0F0D",
    marginTop: 10,
  },
  stack: { flex: 1, marginHorizontal: 24, marginVertical: 12 },
  cardInner: { flex: 1, padding: 24, justifyContent: "space-between" },
  cardKicker: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    letterSpacing: 1.6,
    color: "#637D8E",
  },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginVertical: 12 },
  cardGridItem: { width: "50%", paddingHorizontal: 4, marginBottom: 12 },
  cardImg: { width: "100%", aspectRatio: 3 / 4, backgroundColor: "#E8E5DF" },
  cardPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardPlaceholderText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 32,
    color: "#637D8E",
    letterSpacing: 1,
  },
  cardImgLabel: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#637D8E",
    marginTop: 6,
  },
  cardRationale: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#0F0F0D",
    marginTop: 12,
  },
  suggestionBody: { flex: 1, justifyContent: "center" },
  suggestionDesc: {
    fontFamily: "BarlowCondensed_500Medium",
    fontSize: 36,
    lineHeight: 40,
    color: "#0F0F0D",
    letterSpacing: -0.5,
  },
  doneCard: {
    flex: 1,
    padding: 32,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0F0F0D",
  },
  doneKicker: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    letterSpacing: 1.6,
    color: "#637D8E",
    marginBottom: 8,
  },
  doneTitle: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 44,
    letterSpacing: -1,
    color: "#0F0F0D",
    lineHeight: 44,
  },
  doneBody: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#0F0F0D",
    marginTop: 12,
    lineHeight: 20,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#E8E5DF",
  },
  manualRow: { flexDirection: "row", gap: 8 },
  manualBtn: { flex: 1, paddingVertical: 16, alignItems: "center" },
  manualReject: { borderWidth: 1, borderColor: "#0F0F0D", backgroundColor: "#FFFFFF" },
  manualAccept: { backgroundColor: "#0F0F0D" },
  manualRejectText: {
    fontFamily: "BarlowCondensed_500Medium",
    fontSize: 14,
    letterSpacing: 1.4,
    color: "#0F0F0D",
  },
  manualAcceptText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 14,
    letterSpacing: 1.4,
    color: "#FAFAF8",
  },
  finishBtn: { paddingVertical: 18, alignItems: "center", backgroundColor: "#0F0F0D" },
  finishText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 18,
    letterSpacing: 1.4,
    color: "#FAFAF8",
  },
});
