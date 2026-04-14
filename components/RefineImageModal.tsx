import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { refineClothingImage } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

type QuestionKey = "color" | "fit" | "material" | "style";

const QUESTIONS: Record<QuestionKey, { label: string; options: { id: string; label: string; prompt: string }[] }> = {
  color: {
    label: "Couleur",
    options: [
      { id: "darker", label: "Plus sombre", prompt: "make the color noticeably darker / deeper" },
      { id: "lighter", label: "Plus claire", prompt: "make the color noticeably lighter / softer" },
      { id: "warmer", label: "Plus chaude", prompt: "shift the hue warmer (more beige / brown / ochre)" },
      { id: "cooler", label: "Plus froide", prompt: "shift the hue cooler (more grey / blue / stone)" },
      { id: "saturated", label: "Plus saturée", prompt: "increase color saturation slightly" },
      { id: "muted", label: "Plus mate", prompt: "desaturate / make the color more muted and matte" },
    ],
  },
  fit: {
    label: "Coupe",
    options: [
      { id: "oversize", label: "Plus oversize", prompt: "make the garment more oversize and relaxed" },
      { id: "fitted", label: "Plus ajustée", prompt: "make the garment more fitted / slim" },
      { id: "longer", label: "Plus long", prompt: "make the garment longer" },
      { id: "cropped", label: "Plus court", prompt: "make the garment shorter / cropped" },
      { id: "structured", label: "Plus structurée", prompt: "make the silhouette more structured / sharp" },
      { id: "flowy", label: "Plus fluide", prompt: "make the silhouette more flowy / soft drape" },
    ],
  },
  material: {
    label: "Matière",
    options: [
      { id: "thicker", label: "Plus épaisse", prompt: "make the fabric look thicker and heavier" },
      { id: "thinner", label: "Plus fine", prompt: "make the fabric look thinner and lighter" },
      { id: "knit", label: "Plus maille", prompt: "show a more pronounced knit / wool texture" },
      { id: "smooth", label: "Plus lisse", prompt: "make the fabric smoother / less textured" },
      { id: "worn", label: "Aspect vintage", prompt: "add a subtle worn / vintage patina to the fabric" },
      { id: "new", label: "Aspect neuf", prompt: "make the fabric look crisp and brand new" },
    ],
  },
  style: {
    label: "Style",
    options: [
      { id: "editorial", label: "Plus éditorial", prompt: "push the composition more editorial / magazine" },
      { id: "minimal", label: "Plus minimal", prompt: "strip the composition to pure minimalism / Muji" },
      { id: "street", label: "Plus streetwear", prompt: "add subtle streetwear / Hypebeast energy" },
      { id: "luxury", label: "Plus luxe", prompt: "elevate to luxury / high-end fashion rendering" },
      { id: "raw", label: "Plus brut", prompt: "make the presentation rawer / more brutalist" },
    ],
  },
};

interface Props {
  visible: boolean;
  itemId: string | null;
  initialPhotoUrl: string | null;
  description: string;
  onClose: () => void;
  onSaved: (itemId: string, newUrl: string) => void;
}

export default function RefineImageModal({
  visible,
  itemId,
  initialPhotoUrl,
  description,
  onClose,
  onSaved,
}: Props) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(initialPhotoUrl);
  const [selected, setSelected] = useState<Record<QuestionKey, string | null>>({
    color: null,
    fit: null,
    material: null,
    style: null,
  });
  const [freeText, setFreeText] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (visible) setCurrentUrl(initialPhotoUrl);
  }, [visible, initialPhotoUrl]);

  function reset() {
    setSelected({ color: null, fit: null, material: null, style: null });
    setFreeText("");
  }

  function buildRefinementPrompt(): string | null {
    const parts: string[] = [];
    (Object.keys(QUESTIONS) as QuestionKey[]).forEach((k) => {
      const sel = selected[k];
      if (!sel) return;
      const opt = QUESTIONS[k].options.find((o) => o.id === sel);
      if (opt) parts.push(opt.prompt);
    });
    if (freeText.trim()) parts.push(freeText.trim());
    return parts.length > 0 ? parts.join(". ") : null;
  }

  async function handleRefine() {
    if (!itemId) {
      Alert.alert("Impossible", "Pièce non identifiée.");
      return;
    }
    if (!currentUrl) {
      Alert.alert("Impossible", "Aucune image à raffiner.");
      return;
    }
    const prompt = buildRefinementPrompt();
    if (!prompt) {
      Alert.alert("Sélectionne au moins un raffinement", "Choisis une couleur, coupe, matière ou style avant de régénérer.");
      return;
    }
    setWorking(true);
    try {
      const newUrl = await refineClothingImage(currentUrl, prompt, description);
      if (newUrl) {
        setCurrentUrl(newUrl);
        reset();
      } else {
        Alert.alert("Régénération échouée", "Gemini n'a pas renvoyé d'image. Réessaye dans un instant.");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      if (__DEV__) console.error("refine_image error:", e);
      Alert.alert("Régénération échouée", message);
    } finally {
      setWorking(false);
    }
  }

  async function handleValidate() {
    if (!itemId || !currentUrl) return;
    setWorking(true);
    try {
      if (currentUrl !== initialPhotoUrl) {
        const { error } = await supabase
          .from("wardrobe_items")
          .update({ photo_url: currentUrl })
          .eq("id", itemId);
        if (error) throw error;
        onSaved(itemId, currentUrl);
      }
      onClose();
      reset();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      if (__DEV__) console.error("validate error:", e);
      Alert.alert("Sauvegarde échouée", message);
    } finally {
      setWorking(false);
    }
  }

  function handleClose() {
    onClose();
    reset();
    setCurrentUrl(initialPhotoUrl);
  }

  const hasChanges = currentUrl !== initialPhotoUrl;
  const canRefine = !working && !!buildRefinementPrompt();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.topBar}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={styles.topAction}>FERMER</Text>
          </Pressable>
          <Text style={styles.topTitle}>RAFFINER</Text>
          <Pressable onPress={handleValidate} hitSlop={12} disabled={working || !hasChanges}>
            <Text style={[styles.topAction, (!hasChanges || working) && styles.topActionDisabled]}>
              VALIDER
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.imageWrap}>
            {currentUrl ? (
              <Image source={{ uri: currentUrl }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder} />
            )}
            {working && (
              <View style={styles.imageOverlay}>
                <ActivityIndicator color={colors.paper[100]} />
                <Text style={styles.overlayText}>Gemini régénère…</Text>
              </View>
            )}
          </View>

          <Text style={styles.caption}>{description}</Text>

          {(Object.keys(QUESTIONS) as QuestionKey[]).map((key) => (
            <View key={key} style={styles.question}>
              <Text style={styles.questionLabel}>{QUESTIONS[key].label.toUpperCase()}</Text>
              <View style={styles.options}>
                {QUESTIONS[key].options.map((opt) => {
                  const active = selected[key] === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [key]: active ? null : opt.id,
                        }))
                      }
                      style={[styles.option, active && styles.optionActive]}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          <View style={styles.question}>
            <Text style={styles.questionLabel}>AUTRE DÉTAIL</Text>
            <TextInput
              value={freeText}
              onChangeText={setFreeText}
              placeholder="Ex: col roulé, boutons dorés, manches raglan…"
              placeholderTextColor={colors.ink[300]}
              style={styles.freeText}
              multiline
            />
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <Pressable
            style={[styles.refineBtn, !canRefine && styles.refineBtnDisabled]}
            onPress={handleRefine}
            disabled={!canRefine}
          >
            <Text style={[styles.refineText, !canRefine && styles.refineTextDisabled]}>
              {working ? "EN COURS…" : "RÉGÉNÉRER"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DF",
  },
  topTitle: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 14,
    letterSpacing: 1.6,
    color: "#0F0F0D",
  },
  topAction: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#637D8E",
  },
  topActionDisabled: { color: "#C8C3BB" },
  scroll: { padding: 24, paddingBottom: 40 },
  imageWrap: {
    aspectRatio: 1,
    backgroundColor: "#EFEBE5",
    marginBottom: 16,
    position: "relative",
  },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: { flex: 1, backgroundColor: "#EFEBE5" },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,13,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  overlayText: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#FAFAF8",
  },
  caption: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#0F0F0D",
    marginBottom: 28,
  },
  question: { marginBottom: 24 },
  questionLabel: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    letterSpacing: 1.6,
    color: "#637D8E",
    marginBottom: 10,
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    backgroundColor: "#FFFFFF",
  },
  optionActive: { backgroundColor: "#0F0F0D", borderColor: "#0F0F0D" },
  optionText: {
    fontFamily: "Jost_400Regular",
    fontSize: 12,
    color: "#0F0F0D",
  },
  optionTextActive: { color: "#FAFAF8" },
  freeText: {
    borderWidth: 1,
    borderColor: "#E8E5DF",
    backgroundColor: "#FFFFFF",
    padding: 12,
    minHeight: 64,
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    color: "#0F0F0D",
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E8E5DF",
    backgroundColor: "#FAFAF8",
  },
  refineBtn: {
    backgroundColor: "#0F0F0D",
    paddingVertical: 16,
    alignItems: "center",
  },
  refineBtnDisabled: { backgroundColor: "#E8E5DF" },
  refineText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 16,
    letterSpacing: 1.2,
    color: "#FAFAF8",
  },
  refineTextDisabled: { color: "#A8A49F" },
});
