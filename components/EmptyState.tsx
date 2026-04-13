import { View, Text, Pressable, StyleSheet } from "react-native";

interface Props {
  title: string;
  subtitle?: string;
  cta?: { label: string; onPress: () => void };
}

export function EmptyState({ title, subtitle, cta }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {cta ? (
        <Pressable onPress={cta.onPress} hitSlop={12}>
          <Text style={styles.cta}>{cta.label.toUpperCase()}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingTop: 96, paddingHorizontal: 32, gap: 12 },
  title: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 28,
    letterSpacing: -0.5,
    color: "#0F0F0D",
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#6B6A66",
    textAlign: "center",
  },
  cta: {
    fontFamily: "Jost_500Medium",
    fontSize: 11,
    letterSpacing: 1.6,
    color: "#637D8E",
    textDecorationLine: "underline",
    marginTop: 8,
  },
});
