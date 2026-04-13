import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { analyzeClothingImage, analyzeClothingDescription } from "@/lib/gemini";
import type { WardrobeItem, ClothingAnalysis, WardrobeItemType } from "@/lib/types";
import RefineImageModal from "@/components/RefineImageModal";
import { BrandLogo } from "@/components/BrandLogo";

const MIN_ITEMS = 3;
const TYPE_LABELS: Record<WardrobeItemType, string> = {
  top: "Haut",
  bottom: "Bas",
  outerwear: "Manteau",
  shoes: "Chaussures",
  accessory: "Accessoire",
};

export default function OnboardingItems() {
  const router = useRouter();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [textModal, setTextModal] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [refineItem, setRefineItem] = useState<WardrobeItem | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("wardrobe_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const fetched = (data as WardrobeItem[]) ?? [];
    setItems(fetched);
    setLoading(false);

    // Resume to last step if user already progressed past étape 01
    if (fetched.length >= MIN_ITEMS) {
      const lastStep = await AsyncStorage.getItem("@onboarding/last-step");
      if (lastStep === "swipe") router.replace("/onboarding/swipe");
      else if (lastStep === "profile") router.replace("/onboarding/profile");
      else if (lastStep === "taste") router.replace("/onboarding/taste");
    }
  }

  async function handlePhoto(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85, base64: false })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          base64: false,
        });
    if (result.canceled) return;
    const uri = result.assets[0].uri;

    setAnalyzing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const analysis = await analyzeClothingImage(base64);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("wardrobe")
        .upload(fileName, decode(base64), { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(fileName);

      await insertItem({ ...analysis, photo_url: urlData.publicUrl });
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDescribe() {
    if (!textInput.trim()) return;
    setAnalyzing(true);
    setTextModal(false);
    try {
      const analysis = await analyzeClothingDescription(textInput.trim());
      await insertItem({ ...analysis, photo_url: analysis.photo_url ?? null });
      setTextInput("");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function insertItem(data: ClothingAnalysis & { photo_url: string | null }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: inserted, error } = await supabase
      .from("wardrobe_items")
      .insert({
        user_id: user.id,
        photo_url: data.photo_url,
        type: data.type,
        color: data.color,
        material: data.material,
        style_tags: data.style_tags,
        description: data.description,
      })
      .select()
      .single();
    if (error) throw error;
    setItems((prev) => [inserted as WardrobeItem, ...prev]);
  }

  async function removeItem(id: string) {
    await supabase.from("wardrobe_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function skipOnboarding() {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Passer l'onboarding ?",
        "On ne pourra pas personnaliser tes suggestions. Tu pourras le refaire depuis Réglages.",
        [
          { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
          { text: "Passer quand même", style: "destructive", onPress: () => resolve(true) },
        ]
      );
    });
    if (!confirmed) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
    await AsyncStorage.removeItem("@onboarding/last-step");
    router.replace("/(tabs)");
  }

  async function goToTaste() {
    await AsyncStorage.setItem("@onboarding/last-step", "taste");
    router.push("/onboarding/taste");
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#637D8E" />
      </View>
    );
  }

  const canContinue = items.length >= MIN_ITEMS;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.brandRow}>
        <BrandLogo size="sm" showWordmark={false} />
      </View>
      <View style={styles.topBar}>
        <View style={styles.progressWrap}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
        </View>
        <Pressable onPress={skipOnboarding} hitSlop={12}>
          <Text style={styles.skipText}>PASSER</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>ÉTAPE 01 / 04</Text>
        <Text style={styles.title}>VESTIAIRE</Text>
        <Text style={styles.subtitle}>
          Ajoute au moins {MIN_ITEMS} pièces. On apprend ton style à partir de ce que tu portes.
        </Text>

        <View style={styles.ctaRow}>
          <Pressable
            style={[styles.cta, styles.ctaPrimary, analyzing && styles.ctaDisabled]}
            onPress={() => handlePhoto(true)}
            disabled={analyzing}
          >
            <Text style={styles.ctaPrimaryText}>PHOTO</Text>
            <Text style={styles.ctaPrimarySub}>Caméra</Text>
          </Pressable>
          <Pressable
            style={[styles.cta, styles.ctaSecondary, analyzing && styles.ctaDisabled]}
            onPress={() => handlePhoto(false)}
            disabled={analyzing}
          >
            <Text style={styles.ctaSecondaryText}>GALERIE</Text>
            <Text style={styles.ctaSecondarySub}>Import</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.ctaFull, analyzing && styles.ctaDisabled]}
          onPress={() => setTextModal(true)}
          disabled={analyzing}
        >
          <Text style={styles.ctaFullText}>DÉCRIRE EN TEXTE</Text>
        </Pressable>

        {analyzing && (
          <View style={styles.analyzingRow}>
            <ActivityIndicator color="#637D8E" size="small" />
            <Text style={styles.analyzingText}>Gemini analyse la pièce…</Text>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>
          {items.length} PIÈCE{items.length !== 1 ? "S" : ""}
        </Text>

        {items.length === 0 ? (
          <Text style={styles.emptyText}>Aucune pièce. Commence par en ajouter une.</Text>
        ) : (
          <View style={styles.grid}>
            {items.map((item) => (
              <View key={item.id} style={styles.gridItem}>
                <Pressable
                  onPress={() => item.photo_url && setRefineItem(item)}
                  disabled={!item.photo_url}
                >
                  {item.photo_url ? (
                    <Image source={{ uri: item.photo_url }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Text style={styles.thumbPlaceholderText}>
                        {item.color?.slice(0, 2).toUpperCase() ?? "—"}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Text style={styles.itemType}>{TYPE_LABELS[item.type]}</Text>
                <Text style={styles.itemDesc} numberOfLines={2}>
                  {item.description}
                </Text>
                <View style={styles.itemActions}>
                  {item.photo_url && (
                    <Pressable onPress={() => setRefineItem(item)} hitSlop={8}>
                      <Text style={styles.refineLink}>Raffiner</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                    <Text style={styles.removeText}>Retirer</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={goToTaste}
          disabled={!canContinue}
        >
          <Text style={[styles.continueText, !canContinue && styles.continueTextDisabled]}>
            CONTINUER →
          </Text>
        </Pressable>
        {!canContinue && (
          <Text style={styles.bottomHint}>
            Encore {MIN_ITEMS - items.length} pour continuer
          </Text>
        )}
      </View>

      <Modal visible={textModal} animationType="slide" transparent onRequestClose={() => setTextModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>DÉCRIRE UNE PIÈCE</Text>
            <Text style={styles.modalHint}>
              Ex: « pull oversize beige en laine » ou « jean noir droit taille haute »
            </Text>
            <TextInput
              value={textInput}
              onChangeText={setTextInput}
              multiline
              autoFocus
              placeholder="Décris ta pièce…"
              placeholderTextColor="#A8A49F"
              style={styles.modalInput}
            />
            <View style={styles.modalRow}>
              <Pressable style={styles.modalCancel} onPress={() => setTextModal(false)}>
                <Text style={styles.modalCancelText}>ANNULER</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={handleDescribe}>
                <Text style={styles.modalSubmitText}>ANALYSER</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <RefineImageModal
        visible={!!refineItem}
        itemId={refineItem?.id ?? null}
        initialPhotoUrl={refineItem?.photo_url ?? null}
        description={refineItem?.description ?? ""}
        onClose={() => setRefineItem(null)}
        onSaved={(id, newUrl) =>
          setItems((prev) => prev.map((i) => (i.id === id ? { ...i, photo_url: newUrl } : i)))
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAF8" },
  brandRow: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
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
  skipText: { fontFamily: "Jost_500Medium", fontSize: 11, letterSpacing: 1.2, color: "#637D8E" },
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
  ctaRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  cta: { flex: 1, paddingVertical: 18, paddingHorizontal: 16 },
  ctaPrimary: { backgroundColor: "#0F0F0D" },
  ctaSecondary: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#0F0F0D" },
  ctaDisabled: { opacity: 0.4 },
  ctaPrimaryText: { fontFamily: "BarlowCondensed_600SemiBold", fontSize: 18, letterSpacing: 1, color: "#FAFAF8" },
  ctaPrimarySub: { fontFamily: "Jost_400Regular", fontSize: 11, color: "#A8A49F", marginTop: 2 },
  ctaSecondaryText: { fontFamily: "BarlowCondensed_600SemiBold", fontSize: 18, letterSpacing: 1, color: "#0F0F0D" },
  ctaSecondarySub: { fontFamily: "Jost_400Regular", fontSize: 11, color: "#637D8E", marginTop: 2 },
  ctaFull: {
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8E5DF",
    backgroundColor: "#FFFFFF",
  },
  ctaFullText: { fontFamily: "BarlowCondensed_500Medium", fontSize: 14, letterSpacing: 1.4, color: "#0F0F0D" },
  analyzingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  analyzingText: { fontFamily: "Jost_400Regular", fontSize: 12, color: "#637D8E" },
  divider: { height: 1, backgroundColor: "#E8E5DF", marginTop: 32, marginBottom: 20 },
  sectionLabel: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.4,
    color: "#637D8E",
    marginBottom: 16,
  },
  emptyText: { fontFamily: "Jost_400Regular", fontSize: 13, color: "#A8A49F" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  gridItem: { width: "50%", paddingHorizontal: 4, marginBottom: 20 },
  thumb: { width: "100%", aspectRatio: 3 / 4, backgroundColor: "#E8E5DF" },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  thumbPlaceholderText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 36,
    letterSpacing: 1,
    color: "#637D8E",
  },
  itemType: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#637D8E",
    marginTop: 8,
  },
  itemDesc: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    color: "#0F0F0D",
    marginTop: 2,
    lineHeight: 17,
  },
  itemActions: { flexDirection: "row", gap: 14, marginTop: 6 },
  refineLink: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    color: "#637D8E",
    textDecorationLine: "underline",
  },
  removeText: {
    fontFamily: "Jost_400Regular",
    fontSize: 11,
    color: "#A8A49F",
    textDecorationLine: "underline",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,15,13,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: { backgroundColor: "#FAFAF8", padding: 24, paddingBottom: 36 },
  modalTitle: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 22,
    letterSpacing: 0.5,
    color: "#0F0F0D",
  },
  modalHint: {
    fontFamily: "Jost_400Regular",
    fontSize: 12,
    color: "#637D8E",
    marginTop: 4,
    marginBottom: 16,
  },
  modalInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: "#0F0F0D",
    padding: 14,
    fontFamily: "Jost_400Regular",
    fontSize: 15,
    color: "#0F0F0D",
    textAlignVertical: "top",
    backgroundColor: "#FFFFFF",
  },
  modalRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  modalCancel: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0F0F0D",
    backgroundColor: "#FFFFFF",
  },
  modalCancelText: {
    fontFamily: "BarlowCondensed_500Medium",
    fontSize: 14,
    letterSpacing: 1.2,
    color: "#0F0F0D",
  },
  modalSubmit: { flex: 1, paddingVertical: 16, alignItems: "center", backgroundColor: "#0F0F0D" },
  modalSubmitText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 14,
    letterSpacing: 1.4,
    color: "#FAFAF8",
  },
});
