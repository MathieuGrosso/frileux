import { View } from "react-native";
import { usePresence } from "@/hooks/usePresence";

interface Props {
  userId: string;
  size?: number;
}

export function PresenceDot({ userId, size = 6 }: Props) {
  const { isOnline } = usePresence();
  if (!isOnline(userId)) return null;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#637D8E",
      }}
    />
  );
}
