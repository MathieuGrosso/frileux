import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { supabase } from "@/lib/supabase";
import { BRAND_CATALOG } from "@/lib/brands/catalog";
import { confirmAction } from "@/lib/ui";

interface BrandProduct {
  id: string;
  brand_slug: string;
  name: string;
  image_url: string | null;
  product_url: string | null;
  source: "scrape" | "manual";
  scraped_at: string;
}

export default function BrandsLibrary() {
  const router = useRouter();
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profile }, { data: prods }] = await Promise.all([
      supabase.from("profiles").select("favorite_brands").single(),
      supabase
        .from("brand_products")
        .select("id, brand_slug, name, image_url, product_url, source, scraped_at")
        .order("scraped_at", { ascending: false })
        .limit(200),
    ]);
    setFavorites(
      Array.isArray(profile?.favorite_brands) ? profile.favorite_brands : []
    );
    setProducts((prods as BrandProduct[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const favoriteSlugs = BRAND_CATALOG.filter((b) => favorites.includes(b.name));

  async function removeProduct(id: string) {
    const { error } = await supabase.from("brand_products").delete().eq("id", id);
    if (error) return Alert.alert("Erreur", error.message);
    setProducts((prev) => prev.filter((p) => p.id !== id));
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
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>← RETOUR</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>BIBLIOTHÈQUE</Text>
        <Text style={styles.title}>TES MARQUES.</Text>
        <Text style={styles.subtitle}>
          Pièces récentes scrapées chaque semaine. Ajoute les tiennes pour nourrir
          les suggestions.
        </Text>

        {favoriteSlugs.length === 0 && (
          <Pressable
            style={styles.emptyBtn}
            onPress={() => router.push("/onboarding/brands?upgrade=1")}
          >
            <Text style={styles.emptyBtnText}>CHOISIR TES MARQUES →</Text>
          </Pressable>
        )}

        {favoriteSlugs.map((brand) => {
          const items = products.filter((p) => p.brand_slug === brand.slug);
          return (
            <View key={brand.slug} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.brandName}>{brand.name.toUpperCase()}</Text>
                <Pressable
                  hitSlop={10}
                  onPress={() => setAddOpen(brand.slug)}
                >
                  <Text style={styles.addBtn}>+ AJOUTER</Text>
                </Pressable>
              </View>
              {items.length === 0 ? (
                <Text style={styles.empty}>
                  Aucune pièce. Ajoute-en une manuellement.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 24 }}
                >
                  {items.map((p) => (
                    <Pressable
                      key={p.id}
                      onLongPress={async () => {
                        const ok = await confirmAction(p.name, "Supprimer cette pièce ?", "Supprimer", true);
                        if (ok) removeProduct(p.id);
                      }}
                      style={styles.card}
                    >
                      {p.image_url ? (
                        <Image
                          source={{ uri: p.image_url }}
                          style={styles.cardImage}
                          cachePolicy="memory-disk"
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.cardImage, styles.cardPlaceholder]} />
                      )}
                      <Text numberOfLines={2} style={styles.cardName}>
                        {p.name}
                      </Text>
                      {p.source === "manual" && (
                        <Text style={styles.cardBadge}>MANUEL</Text>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          );
        })}
      </ScrollView>

      <AddProductModal
        slug={addOpen}
        onClose={() => setAddOpen(null)}
        onAdded={(row) => {
          setProducts((prev) => [row, ...prev]);
          setAddOpen(null);
        }}
      />
    </SafeAreaView>
  );
}

function AddProductModal({
  slug,
  onClose,
  onAdded,
}: {
  slug: string | null;
  onClose: () => void;
  onAdded: (row: BrandProduct) => void;
}) {
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (slug) {
      setName("");
      setImageUrl("");
      setProductUrl("");
    }
  }, [slug]);

  async function save() {
    if (!slug || !name.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data, error } = await supabase
        .from("brand_products")
        .insert({
          brand_slug: slug,
          name: name.trim(),
          image_url: imageUrl.trim() || null,
          product_url: productUrl.trim() || null,
          source: "manual",
          added_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      onAdded(data as BrandProduct);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={!!slug}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>AJOUTER UNE PIÈCE</Text>
          <Text style={styles.modalSub}>{slug?.toUpperCase()}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nom (ex: Trench Uniform coton)"
            placeholderTextColor="#A8A49F"
            style={styles.input}
          />
          <TextInput
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="URL image (optionnel)"
            placeholderTextColor="#A8A49F"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <TextInput
            value={productUrl}
            onChangeText={setProductUrl}
            placeholder="URL produit (optionnel)"
            placeholderTextColor="#A8A49F"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalBtnGhost}>
              <Text style={styles.modalBtnGhostText}>ANNULER</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={!name.trim() || saving}
              style={[
                styles.modalBtn,
                (!name.trim() || saving) && styles.modalBtnDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FAFAF8" size="small" />
              ) : (
                <Text style={styles.modalBtnText}>AJOUTER</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
  backText: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#637D8E",
  },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
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
    marginBottom: 24,
  },
  emptyBtn: {
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0F0F0D",
  },
  emptyBtnText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 14,
    letterSpacing: 1.4,
    color: "#0F0F0D",
  },
  section: { marginTop: 28 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  brandName: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 20,
    letterSpacing: 1,
    color: "#0F0F0D",
  },
  addBtn: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#637D8E",
  },
  empty: {
    fontFamily: "Jost_400Regular",
    fontSize: 12,
    color: "#A8A49F",
  },
  card: { width: 140 },
  cardImage: {
    width: 140,
    height: 180,
    backgroundColor: "#F2F0EC",
    marginBottom: 6,
  },
  cardPlaceholder: { backgroundColor: "#E8E5DF" },
  cardName: {
    fontFamily: "Jost_400Regular",
    fontSize: 11,
    color: "#0F0F0D",
    lineHeight: 15,
  },
  cardBadge: {
    fontFamily: "Jost_500Medium",
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#637D8E",
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,15,13,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "#FAFAF8",
    padding: 24,
    borderWidth: 1,
    borderColor: "#0F0F0D",
  },
  modalTitle: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 22,
    letterSpacing: 1,
    color: "#0F0F0D",
  },
  modalSub: {
    fontFamily: "Jost_500Medium",
    fontSize: 10,
    letterSpacing: 1.4,
    color: "#637D8E",
    marginTop: 4,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#0F0F0D",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#0F0F0D",
    backgroundColor: "#FFFFFF",
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  modalBtnGhost: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0F0F0D",
  },
  modalBtnGhostText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 14,
    letterSpacing: 1.4,
    color: "#0F0F0D",
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#0F0F0D",
  },
  modalBtnDisabled: { backgroundColor: "#A8A49F" },
  modalBtnText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 14,
    letterSpacing: 1.4,
    color: "#FAFAF8",
  },
});
