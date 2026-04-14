import { View, Text, Pressable } from "react-native";

interface Props {
  title: string;
  subtitle?: string;
  cta?: { label: string; onPress: () => void };
}

export function EmptyState({ title, subtitle, cta }: Props) {
  return (
    <View className="items-center pt-24 px-8 gap-3">
      <Text className="font-display text-h2 tracking-tight text-ink-900 text-center">
        {title}
      </Text>
      {subtitle ? (
        <Text className="font-body text-body-sm text-ink-500 text-center">
          {subtitle}
        </Text>
      ) : null}
      {cta ? (
        <Pressable onPress={cta.onPress} hitSlop={12}>
          <Text className="font-body-medium text-eyebrow text-ice uppercase underline mt-2">
            {cta.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
