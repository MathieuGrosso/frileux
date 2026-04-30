import { View, Text } from "react-native";
import { colors } from "@/lib/theme";

interface CommandChipProps {
  command: string;
  arg?: string | null;
}

export function CommandChip({ command, arg }: CommandChipProps) {
  return (
    <View className="flex-row items-center mb-1">
      <Text
        className="font-body-medium"
        style={{ fontSize: 11, letterSpacing: 0.6, color: colors.ice[600] }}
      >
        /{command}
        {arg ? (
          <Text style={{ color: colors.ink[300], letterSpacing: 0.6 }}> {arg}</Text>
        ) : null}
      </Text>
    </View>
  );
}
