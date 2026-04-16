import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { onboardingProposal } from "@/lib/onboardingProposal";
import type { SwipeCardPayload, WardrobeItemType } from "@/lib/types";
import { colors } from "@/lib/theme";

const TYPE_LABELS: Record<WardrobeItemType, string> = {
  top: "Haut",
  bottom: "Bas",
  outerwear: "Manteau",
  shoes: "Chaussures",
  accessory: "Accessoire",
};

export default function ProposalExpandScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [payload] = useState<SwipeCardPayload | null>(() => onboardingProposal.get());

  useEffect(() => {
    if (!payload) router.back();
  }, [payload, router]);

  const colWidth = useMemo(() => {
    const horizontalPadding = 24 * 2;
    const gap = 12;
    return Math.floor((width - horizontalPadding - gap) / 2);
  }, [width]);

  if (!payload || payload.kind !== "combo") {
    return <SafeAreaView style={styles.container} />;
  }

  const { items, combo } = payload;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Text style={styles.kicker}>COMBINAISON</Text>
        <Pressable onPress={() => router.back()} hitSlop={16}>
          <Text style={styles.closeText}>FERMER ×</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {items.map((item) => (
            <View
              key={item.id}
              style={[styles.cell, { width: colWidth }]}
            >
              {item.photo_url ? (
                <Image
                  source={{ uri: item.photo_url }}
                  style={[styles.img, { width: colWidth, height: colWidth * (4 / 3) }]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={120}
                />
              ) : (
                <View
                  style={[
                    styles.img,
                    styles.placeholder,
                    { width: colWidth, height: colWidth * (4 / 3) },
                  ]}
                >
                  <Text style={styles.placeholderText}>
                    {item.color?.slice(0, 2).toUpperCase() ?? "—"}
                  </Text>
                </View>
              )}
              <Text style={styles.caption} numberOfLines={1}>
                {TYPE_LABELS[item.type].toUpperCase()}
                {item.color ? ` · ${item.color.toUpperCase()}` : ""}
              </Text>
            </View>
          ))}
        </View>

        {combo.rationale ? (
          <Text style={styles.rationale}>{combo.rationale}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper[100] },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.paper[300],
  },
  kicker: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.ice[600],
  },
  closeText: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.ink[900],
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cell: {
    gap: 8,
  },
  img: {
    backgroundColor: colors.paper[200],
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 40,
    letterSpacing: 2,
    color: colors.ink[500],
  },
  caption: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.ink[700],
  },
  rationale: {
    marginTop: 28,
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: colors.ink[900],
  },
});
