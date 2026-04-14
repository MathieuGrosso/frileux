import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import { BRAND_CATALOG, type BrandEntry } from "@/lib/brands/catalog";

const MIN_SELECTION = 3;
const MAX_SELECTION = 10;
const SIZES: Record<number, number> = { 0: 72, 1: 88, 2: 108 };
const SCREEN_W = Dimensions.get("window").width;

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Laid {
  brand: BrandEntry;
  x: number;
  y: number;
  size: number;
  delay: number;
  phase: number;
}

function layoutBubbles(brands: BrandEntry[], width: number): { laid: Laid[]; height: number } {
  const padding = 8;
  const colCount = 3;
  const colWidth = width / colCount;
  const cursorY: number[] = Array(colCount).fill(12);
  const laid: Laid[] = [];

  brands.forEach((brand, idx) => {
    const size = SIZES[brand.weight] ?? 88;
    const seed = hash(brand.slug);
    const col = idx % colCount;
    const jitterX = ((seed >> 3) % 24) - 12;
    const jitterY = ((seed >> 7) % 22) - 8;
    const x = col * colWidth + (colWidth - size) / 2 + jitterX;
    const y = cursorY[col] + jitterY;
    cursorY[col] = y + size + padding + 12;
    laid.push({
      brand,
      x: Math.max(4, Math.min(x, width - size - 4)),
      y: Math.max(4, y),
      size,
      delay: idx * 35,
      phase: (seed % 1000) / 1000,
    });
  });

  const height = Math.max(...cursorY) + 24;
  return { laid, height };
}

interface BubbleProps {
  laid: Laid;
  selected: boolean;
  canSelectMore: boolean;
  onPress: () => void;
}

function Bubble({ laid, selected, canSelectMore, onPress }: BubbleProps) {
  const scale = useSharedValue(0);
  const float = useSharedValue(0);
  const pressSv = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      laid.delay,
      withSpring(1, { damping: 14, stiffness: 180, mass: 0.8 })
    );
    float.value = withDelay(
      laid.delay + 400 + laid.phase * 600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.cubic) })
        ),
        -1,
        true
      )
    );
  }, [scale, float, laid.delay, laid.phase]);

  const animStyle = useAnimatedStyle(() => {
    const floatY = interpolate(float.value, [0, 1], [-3, 3], Extrapolation.CLAMP);
    const baseScale = interpolate(scale.value, [0, 1], [0.3, 1], Extrapolation.CLAMP);
    const opacity = interpolate(scale.value, [0, 1], [0, 1], Extrapolation.CLAMP);
    const pressScale = interpolate(pressSv.value, [0, 1], [1, 1.1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [
        { translateY: floatY },
        { scale: baseScale * pressScale },
      ],
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: selected ? 1 : 0,
    transform: [{ scale: selected ? 1 : 0.8 }],
  }));

  function handlePress() {
    if (!selected && !canSelectMore) return;
    pressSv.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withSpring(0, { damping: 12, stiffness: 220 })
    );
    onPress();
  }

  const initials = getInitials(laid.brand.name);

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: laid.x,
          top: laid.y,
          width: laid.size,
          height: laid.size,
        },
        animStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        style={{ width: "100%", height: "100%" }}
        hitSlop={4}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              inset: -6,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: "#0F0F0D",
            },
            ringStyle,
          ]}
        />
        <View
          style={[
            styles.bubble,
            {
              width: laid.size,
              height: laid.size,
              backgroundColor: selected ? "#0F0F0D" : "#FFFFFF",
            },
          ]}
        >
          <Text
            style={[
              styles.initials,
              {
                fontSize: laid.size * 0.28,
                color: selected ? "#FAFAF8" : "#0F0F0D",
              },
            ]}
            numberOfLines={1}
          >
            {initials}
          </Text>
          <Text
            style={[
              styles.brandName,
              {
                color: selected ? "#A8A49F" : "#637D8E",
                fontSize: laid.size < 80 ? 8 : 9,
              },
            ]}
            numberOfLines={1}
          >
            {laid.brand.name.toUpperCase()}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function getInitials(name: string): string {
  const cleaned = name.replace(/\b(the|and|de|du)\b/gi, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function OnboardingBrands() {
  const router = useRouter();
  const params = useLocalSearchParams<{ upgrade?: string }>();
  const isUpgrade = params.upgrade === "1";
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isUpgrade) AsyncStorage.setItem("@onboarding/last-step", "brands");
    supabase
      .from("profiles")
      .select("favorite_brands")
      .single()
      .then(({ data }) => {
        if (Array.isArray(data?.favorite_brands)) {
          setSelected(
            data.favorite_brands.filter((n: string) =>
              BRAND_CATALOG.some((b) => b.name === n)
            )
          );
        }
        setLoading(false);
      });
  }, [isUpgrade]);

  const { laid, height } = useMemo(
    () => layoutBubbles(BRAND_CATALOG, SCREEN_W - 32),
    []
  );

  const toggle = (name: string) => {
    setSelected((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : prev.length >= MAX_SELECTION
        ? prev
        : [...prev, name]
    );
  };

  const canContinue = selected.length >= MIN_SELECTION;

  async function saveAndContinue() {
    if (!canContinue) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ favorite_brands: selected })
        .eq("id", user.id);
      if (error) throw error;
      if (isUpgrade) {
        router.replace("/(tabs)");
      } else {
        await AsyncStorage.setItem("@onboarding/last-step", "profile");
        router.push("/onboarding/profile");
      }
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Sauvegarde impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator color="#0F0F0D" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <View style={styles.progressWrap}>
          {isUpgrade ? (
            <View style={[styles.progressDot, styles.progressDotActive, { width: 80 }]} />
          ) : (
            <>
              <View style={[styles.progressDot, styles.progressDotActive]} />
              <View style={[styles.progressDot, styles.progressDotActive]} />
              <View style={[styles.progressDot, styles.progressDotActive]} />
              <View style={styles.progressDot} />
            </>
          )}
        </View>
        {!isUpgrade && (
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backText}>← GOÛT</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.header}>
        <Text style={styles.kicker}>
          {isUpgrade ? "MISE À JOUR · MARQUES" : "ÉTAPE 03 / 04 · MARQUES"}
        </Text>
        <Text style={styles.title}>CHOISIS TES{"\n"}RÉFÉRENCES.</Text>
        <Text style={styles.subtitle}>
          Tape pour sélectionner. Les suggestions quotidiennes s&apos;inspireront de leur
          vocabulaire, silhouettes et palettes.
        </Text>
        <Text style={styles.counter}>
          {selected.length} / {MAX_SELECTION} · MIN {MIN_SELECTION}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height, position: "relative" }}>
          {laid.map((b) => (
            <Bubble
              key={b.brand.slug}
              laid={b}
              selected={selected.includes(b.brand.name)}
              canSelectMore={selected.length < MAX_SELECTION}
              onPress={() => toggle(b.brand.name)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={saveAndContinue}
          disabled={!canContinue || saving}
        >
          {saving ? (
            <ActivityIndicator color="#FAFAF8" size="small" />
          ) : (
            <Text
              style={[
                styles.continueText,
                !canContinue && styles.continueTextDisabled,
              ]}
            >
              {canContinue
                ? isUpgrade
                  ? "TERMINER →"
                  : "CONTINUER →"
                : `ENCORE ${MIN_SELECTION - selected.length}`}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
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
    fontSize: 44,
    letterSpacing: -0.8,
    color: "#0F0F0D",
    lineHeight: 44,
  },
  subtitle: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "#0F0F0D",
    marginTop: 10,
  },
  counter: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    letterSpacing: 1.4,
    color: "#637D8E",
    marginTop: 14,
  },
  bubble: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#0F0F0D",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  initials: {
    fontFamily: "BarlowCondensed_600SemiBold",
    letterSpacing: 1,
    marginBottom: 2,
  },
  brandName: {
    fontFamily: "Jost_500Medium",
    letterSpacing: 1.2,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#E8E5DF",
    backgroundColor: "#FAFAF8",
  },
  continueBtn: {
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: "#0F0F0D",
  },
  continueBtnDisabled: { backgroundColor: "#E8E5DF" },
  continueText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 18,
    letterSpacing: 1.4,
    color: "#FAFAF8",
  },
  continueTextDisabled: { color: "#A8A49F" },
});
