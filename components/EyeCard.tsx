import { View, Text } from "react-native";
import { Image } from "expo-image";

import { PressableScale } from "@/components/ui/PressableScale";
import { HatchedPlaceholder } from "@/components/HatchedPlaceholder";
import { KIND_LABEL_LOWER } from "@/lib/inspirations";
import type { UserInspiration } from "@/lib/types";

interface Props {
  item: UserInspiration;
  onPress: () => void;
  onLongPress?: () => void;
}

export function EyeCard({ item, onPress, onLongPress }: Props) {
  const label =
    (item.title && item.title.trim()) ||
    (item.extracted_description && item.extracted_description.split(",")[0].trim()) ||
    (item.site_name && item.site_name.trim()) ||
    "sans titre";
  const hasImage = !!item.image_url;

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      className="w-1/2 p-0.5"
    >
      <View className="aspect-square bg-paper-200">
        {hasImage ? (
          <Image
            source={{ uri: item.image_url as string }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <HatchedPlaceholder style={{ width: "100%", height: "100%" }} />
        )}
      </View>
      <View className="px-1 pt-2 pb-3">
        <Text
          numberOfLines={1}
          className="font-body-medium text-ink-900"
          style={{ fontSize: 12, lineHeight: 16 }}
        >
          {label}
        </Text>
        <Text
          className="font-body text-ink-500"
          style={{ fontSize: 11, lineHeight: 14 }}
        >
          {KIND_LABEL_LOWER[item.kind]}
        </Text>
      </View>
    </PressableScale>
  );
}
