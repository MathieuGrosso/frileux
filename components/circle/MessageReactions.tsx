import { View, Text } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  REACTION_GLYPHS,
  type ReactionKey,
  type ReactionRow,
} from "@/hooks/useMessageReactions";

interface Props {
  rows: ReactionRow[];
  userId: string | null;
  onToggle: (key: ReactionKey) => void;
}

export function MessageReactions({ rows, userId, onToggle }: Props) {
  if (rows.length === 0) return null;

  const counts = new Map<ReactionKey, { count: number; mine: boolean }>();
  for (const r of rows) {
    const entry = counts.get(r.emoji_key) ?? { count: 0, mine: false };
    entry.count += 1;
    if (r.user_id === userId) entry.mine = true;
    counts.set(r.emoji_key, entry);
  }

  const entries = Array.from(counts.entries()).slice(0, 3);

  return (
    <View className="flex-row gap-1.5 mt-1.5">
      {entries.map(([key, { count, mine }]) => (
        <PressableScale
          key={key}
          onPress={() => onToggle(key)}
          className={`flex-row items-center px-2 py-0.5 border ${
            mine ? "bg-ink-900 border-ink-900" : "border-ink-100 bg-paper-100"
          }`}
        >
          <Text
            className={mine ? "text-paper-100" : "text-ink-900"}
            style={{ fontSize: 12 }}
          >
            {REACTION_GLYPHS[key]}
          </Text>
          <Text
            className={`font-body-semibold ml-1 ${mine ? "text-paper-100" : "text-ink-500"}`}
            style={{ fontSize: 10, letterSpacing: 0.5 }}
          >
            {count}
          </Text>
        </PressableScale>
      ))}
      {counts.size > 3 ? (
        <Text className="font-body text-ink-300 self-end" style={{ fontSize: 10 }}>
          +{counts.size - 3}
        </Text>
      ) : null}
    </View>
  );
}
