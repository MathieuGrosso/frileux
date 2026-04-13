import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { Brand, Build, FitPreference, GenderPresentation } from "@/lib/types";

const STYLE_UNIVERSES = [
  "minimal",
  "workwear",
  "streetwear",
  "techwear",
  "preppy",
  "archive",
  "gorpcore",
  "tailoring",
  "y2k",
  "quiet luxury",
  "heritage",
] as const;

const AVOID_OPTIONS = [
  "logos visibles",
  "couleurs vives",
  "slim fit",
  "synthétiques",
  "talons",
  "imprimés",
] as const;

const GENDER_OPTIONS: { value: GenderPresentation; label: string; sub: string }[] = [
  { value: "menswear", label: "MENSWEAR", sub: "Coupe & rayons homme" },
  { value: "womenswear", label: "WOMENSWEAR", sub: "Coupe & rayons femme" },
  { value: "both", label: "LES DEUX", sub: "Pas de filtre genre" },
];

const FIT_OPTIONS: { value: FitPreference; label: string }[] = [
  { value: "relaxed", label: "RELAXED" },
  { value: "regular", label: "REGULAR" },
  { value: "slim", label: "SLIM" },
];

const BUILD_OPTIONS: { value: Build; label: string; sub: string }[] = [
  { value: "petite", label: "PETITE", sub: "Carrure fine, < 1m65" },
  { value: "slim", label: "SLIM", sub: "Élancé, peu de masse" },
  { value: "athletic", label: "ATHLÉTIQUE", sub: "Carrure travaillée" },
  { value: "curvy", label: "CURVY", sub: "Silhouette en sablier" },
  { value: "strong", label: "STRONG", sub: "Carrure marquée" },
  { value: "tall", label: "TALL", sub: "Grand·e, > 1m85" },
];

export default function OnboardingTaste() {
  const router = useRouter();
  const params = useLocalSearchParams<{ upgrade?: string }>();
  const isUpgrade = params.upgrade === "1";

  const [gender, setGender] = useState<GenderPresentation | null>(null);
  const [universes, setUniverses] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [fit, setFit] = useState<FitPreference | null>(null);
  const [build, setBuild] = useState<Build | null>(null);
  const [heightStr, setHeightStr] = useState("");
  const [shoeStr, setShoeStr] = useState("");

  const [brandQuery, setBrandQuery] = useState("");
  const [brandResults, setBrandResults] = useState<Brand[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isUpgrade) AsyncStorage.setItem("@onboarding/last-step", "taste");
    supabase
      .from("profiles")
      .select("gender_presentation, style_universes, favorite_brands, avoid_tags, fit_preference, build, height_cm, shoe_size_eu")
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.gender_presentation) setGender(data.gender_presentation as GenderPresentation);
        if (Array.isArray(data.style_universes)) setUniverses(data.style_universes);
        if (Array.isArray(data.favorite_brands)) setBrands(data.favorite_brands);
        if (Array.isArray(data.avoid_tags)) setAvoid(data.avoid_tags);
        if (data.fit_preference) setFit(data.fit_preference as FitPreference);
        if (data.build) setBuild(data.build as Build);
        if (data.height_cm) setHeightStr(String(data.height_cm));
        if (data.shoe_size_eu) setShoeStr(String(data.shoe_size_eu));
      });
  }, [isUpgrade]);

  useEffect(() => {
    const q = brandQuery.trim();
    if (q.length < 2) {
      setBrandResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("brands")
        .select("id, name, slug, universe, tier")
        .ilike("name", `%${q}%`)
        .order("name")
        .limit(8);
      if (!cancelled) {
        setBrandResults((data as Brand[]) ?? []);
        setSearching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [brandQuery]);

  const toggleUniverse = (u: string) =>
    setUniverses((prev) =>
      prev.includes(u) ? prev.filter((x) => x !== u) : prev.length >= 5 ? prev : [...prev, u]
    );

  const toggleAvoid = (a: string) =>
    setAvoid((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const addBrand = (name: string) => {
    if (brands.includes(name) || brands.length >= 10) return;
    setBrands((prev) => [...prev, name]);
    setBrandQuery("");
    setBrandResults([]);
  };

  const removeBrand = (name: string) =>
    setBrands((prev) => prev.filter((b) => b !== name));

  async function saveAndContinue() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");
      const heightNum = heightStr ? Math.round(Number(heightStr)) : null;
      const shoeNum = shoeStr ? Math.round(Number(shoeStr)) : null;
      const { error } = await supabase
        .from("profiles")
        .update({
          gender_presentation: gender,
          style_universes: universes,
          favorite_brands: brands,
          avoid_tags: avoid,
          fit_preference: fit,
          build,
          height_cm: heightNum && heightNum >= 120 && heightNum <= 230 ? heightNum : null,
          shoe_size_eu: shoeNum && shoeNum >= 30 && shoeNum <= 50 ? shoeNum : null,
          taste_completed: true,
        })
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

  const filteredResults = useMemo(
    () => brandResults.filter((b) => !brands.includes(b.name)),
    [brandResults, brands]
  );

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
              <View style={styles.progressDot} />
              <View style={styles.progressDot} />
            </>
          )}
        </View>
        {!isUpgrade && (
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backText}>← VESTIAIRE</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isUpgrade && (
          <View style={styles.upgradeBanner}>
            <Text style={styles.upgradeKicker}>NOUVEAU</Text>
            <Text style={styles.upgradeTitle}>ON A AMÉLIORÉ ÇA POUR TOI</Text>
            <Text style={styles.upgradeBody}>
              Une étape de plus pour caler les suggestions sur ton goût : marques, univers, coupe.
              Une minute, et c'est fait.
            </Text>
          </View>
        )}

        <Text style={styles.kicker}>{isUpgrade ? "MISE À JOUR · GOÛT" : "ÉTAPE 02 / 04 · GOÛT"}</Text>
        <Text style={styles.title}>QU'EST-CE QUI{"\n"}TE RESSEMBLE</Text>
        <Text style={styles.subtitle}>
          Quelques choix pour calibrer le ton, les marques de référence, les silhouettes.
        </Text>

        <Text style={styles.sectionLabel}>PRÉSENTATION</Text>
        <View style={styles.tilesCol}>
          {GENDER_OPTIONS.map((opt) => {
            const active = gender === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setGender(opt.value)}
                style={[styles.tile, active && styles.tileActive]}
              >
                <Text style={[styles.tileLabel, active && styles.tileLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[styles.tileSub, active && styles.tileSubActive]}>{opt.sub}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionGap]}>
          UNIVERS · {universes.length}/5
        </Text>
        <View style={styles.tagsRow}>
          {STYLE_UNIVERSES.map((u) => {
            const active = universes.includes(u);
            return (
              <Pressable
                key={u}
                onPress={() => toggleUniverse(u)}
                style={[styles.tag, active && styles.tagActive]}
              >
                <Text style={[styles.tagText, active && styles.tagTextActive]}>{u}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionGap]}>
          MARQUES DE RÉFÉRENCE · {brands.length}/10
        </Text>
        <Text style={styles.helper}>Tape pour rechercher (Margiela, Lemaire, Arc'teryx…)</Text>
        <View style={styles.searchWrap}>
          <TextInput
            value={brandQuery}
            onChangeText={setBrandQuery}
            placeholder="Chercher une marque"
            placeholderTextColor="#A8A49F"
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searching && (
            <ActivityIndicator size="small" color="#637D8E" style={styles.searchSpinner} />
          )}
        </View>
        {filteredResults.length > 0 && (
          <View style={styles.results}>
            {filteredResults.map((b) => (
              <Pressable key={b.id} style={styles.resultRow} onPress={() => addBrand(b.name)}>
                <Text style={styles.resultName}>{b.name}</Text>
                {b.tier && <Text style={styles.resultTier}>{b.tier.toUpperCase()}</Text>}
              </Pressable>
            ))}
          </View>
        )}
        {brands.length > 0 && (
          <View style={styles.tagsRow}>
            {brands.map((b) => (
              <Pressable
                key={b}
                onPress={() => removeBrand(b)}
                style={[styles.tag, styles.tagActive]}
              >
                <Text style={[styles.tagText, styles.tagTextActive]}>{b}  ×</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={[styles.sectionLabel, styles.sectionGap]}>COUPE PRÉFÉRÉE</Text>
        <View style={styles.fitRow}>
          {FIT_OPTIONS.map((opt) => {
            const active = fit === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setFit(active ? null : opt.value)}
                style={[styles.fitTile, active && styles.fitTileActive]}
              >
                <Text style={[styles.fitText, active && styles.fitTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionGap]}>À ÉVITER</Text>
        <View style={styles.tagsRow}>
          {AVOID_OPTIONS.map((a) => {
            const active = avoid.includes(a);
            return (
              <Pressable
                key={a}
                onPress={() => toggleAvoid(a)}
                style={[styles.tag, active && styles.tagActive]}
              >
                <Text style={[styles.tagText, active && styles.tagTextActive]}>{a}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionGap]}>MORPHOLOGIE</Text>
        <Text style={styles.helper}>
          Pour ajuster les coupes et proportions. Optionnel — modifiable plus tard.
        </Text>
        <View style={styles.tilesCol}>
          {BUILD_OPTIONS.map((opt) => {
            const active = build === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setBuild(active ? null : opt.value)}
                style={[styles.tile, active && styles.tileActive]}
              >
                <Text style={[styles.tileLabel, active && styles.tileLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[styles.tileSub, active && styles.tileSubActive]}>{opt.sub}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.measureRow}>
          <View style={styles.measureCol}>
            <Text style={styles.measureLabel}>TAILLE (CM)</Text>
            <TextInput
              value={heightStr}
              onChangeText={(v) => setHeightStr(v.replace(/[^0-9]/g, "").slice(0, 3))}
              keyboardType="number-pad"
              placeholder="172"
              placeholderTextColor="#A8A49F"
              style={styles.measureInput}
              maxLength={3}
            />
          </View>
          <View style={styles.measureCol}>
            <Text style={styles.measureLabel}>POINTURE (EU)</Text>
            <TextInput
              value={shoeStr}
              onChangeText={(v) => setShoeStr(v.replace(/[^0-9]/g, "").slice(0, 2))}
              keyboardType="number-pad"
              placeholder="42"
              placeholderTextColor="#A8A49F"
              style={styles.measureInput}
              maxLength={2}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.continueBtn} onPress={saveAndContinue} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#FAFAF8" size="small" />
          ) : (
            <Text style={styles.continueText}>
              {isUpgrade ? "TERMINER →" : "CONTINUER →"}
            </Text>
          )}
        </Pressable>
        {!gender && (
          <Text style={styles.bottomHint}>Tout est optionnel — tu peux passer.</Text>
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
  backText: { fontFamily: "Jost_500Medium", fontSize: 11, letterSpacing: 1.2, color: "#637D8E" },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  upgradeBanner: {
    backgroundColor: "#0F0F0D",
    padding: 20,
    marginBottom: 28,
  },
  upgradeKicker: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    letterSpacing: 1.6,
    color: "#637D8E",
    marginBottom: 6,
  },
  upgradeTitle: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 24,
    letterSpacing: 0.5,
    color: "#FAFAF8",
    marginBottom: 8,
  },
  upgradeBody: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "#A8A49F",
  },
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
  sectionGap: { marginTop: 28 },
  helper: { fontFamily: "Jost_400Regular", fontSize: 12, color: "#A8A49F", marginBottom: 10 },
  tilesCol: { gap: 8 },
  tile: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#0F0F0D",
    backgroundColor: "#FFFFFF",
  },
  tileActive: { backgroundColor: "#0F0F0D" },
  tileLabel: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 18,
    letterSpacing: 1.2,
    color: "#0F0F0D",
  },
  tileLabelActive: { color: "#FAFAF8" },
  tileSub: {
    fontFamily: "Jost_400Regular",
    fontSize: 11,
    color: "#637D8E",
    marginTop: 2,
  },
  tileSubActive: { color: "#A8A49F" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#0F0F0D",
    backgroundColor: "#FAFAF8",
  },
  tagActive: { backgroundColor: "#0F0F0D" },
  tagText: {
    fontFamily: "Jost_500Medium",
    fontSize: 12,
    letterSpacing: 0.5,
    color: "#0F0F0D",
  },
  tagTextActive: { color: "#FAFAF8" },
  searchWrap: { position: "relative" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#0F0F0D",
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#0F0F0D",
    backgroundColor: "#FFFFFF",
  },
  searchSpinner: { position: "absolute", right: 12, top: 14 },
  results: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#0F0F0D",
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "#E8E5DF",
  },
  resultName: { fontFamily: "Jost_500Medium", fontSize: 14, color: "#0F0F0D" },
  resultTier: {
    fontFamily: "Jost_400Regular",
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#A8A49F",
  },
  fitRow: { flexDirection: "row", gap: 8 },
  fitTile: {
    flex: 1,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0F0F0D",
    backgroundColor: "#FFFFFF",
  },
  fitTileActive: { backgroundColor: "#0F0F0D" },
  fitText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 14,
    letterSpacing: 1.4,
    color: "#0F0F0D",
  },
  fitTextActive: { color: "#FAFAF8" },
  measureRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  measureCol: { flex: 1 },
  measureLabel: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    letterSpacing: 1.4,
    color: "#637D8E",
    marginBottom: 6,
  },
  measureInput: {
    borderWidth: 1,
    borderColor: "#0F0F0D",
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 22,
    color: "#0F0F0D",
    backgroundColor: "#FFFFFF",
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
