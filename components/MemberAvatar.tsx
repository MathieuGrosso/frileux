import { View, Text } from "react-native";
import { Image } from "expo-image";

interface Props {
  username: string | null | undefined;
  avatarUrl: string | null | undefined;
  size?: number;
}

export function MemberAvatar({ username, avatarUrl, size = 28 }: Props) {
  const initial = username?.[0]?.toUpperCase() ?? "?";
  const fontSize = size <= 28 ? 11 : size <= 40 ? 14 : 18;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View
      className="bg-ice-100 border border-ice-200 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Text
        className="font-body-semibold text-ice-600"
        style={{ fontSize }}
      >
        {initial}
      </Text>
    </View>
  );
}
