import { View, Text } from "react-native";
import { Image } from "expo-image";
import { PressableScale } from "@/components/ui/PressableScale";
import type { Poll } from "@/hooks/usePolls";

interface Props {
  poll: Poll;
  onVote: (optionId: string) => void;
}

export function PollCard({ poll, onVote }: Props) {
  const voted = poll.my_option_id !== null;
  const total = poll.total_votes;

  return (
    <View className="border border-ink-100 bg-paper-100 p-4 my-2">
      <Text
        className="font-display text-ink-900 mb-4"
        style={{ fontSize: 20, letterSpacing: -0.3, lineHeight: 24 }}
      >
        {poll.question}
      </Text>

      <View className="gap-2">
        {poll.options.map((o) => {
          const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
          const mine = poll.my_option_id === o.id;
          return (
            <PressableScale
              key={o.id}
              onPress={() => onVote(o.id)}
              disabled={poll.closed}
            >
              <View
                className={`border ${mine ? "border-ink-900" : "border-ink-100"} overflow-hidden`}
              >
                {o.image_url ? (
                  <Image
                    source={{ uri: o.image_url }}
                    style={{ width: "100%", aspectRatio: 1, backgroundColor: "#E5E3DC" }}
                    contentFit="cover"
                  />
                ) : null}
                <View className="flex-row items-center justify-between px-3 py-2 relative">
                  {voted && (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: `${pct}%`,
                        backgroundColor: mine ? "#0F0F0D" : "#E5E3DC",
                      }}
                    />
                  )}
                  <Text
                    className={`font-body-medium ${mine && voted ? "text-paper-100" : "text-ink-900"}`}
                    style={{ fontSize: 13 }}
                    numberOfLines={1}
                  >
                    {o.label ?? "Option"}
                  </Text>
                  {voted ? (
                    <Text
                      className={`font-display ${mine ? "text-paper-100" : "text-ink-500"}`}
                      style={{ fontSize: 16 }}
                    >
                      {pct}%
                    </Text>
                  ) : null}
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>

      <Text
        className="font-body text-ink-300 mt-3"
        style={{ fontSize: 10, letterSpacing: 1.5 }}
      >
        {total} VOTE{total > 1 ? "S" : ""}
        {poll.closed ? " · CLOS" : " · 24H"}
      </Text>
    </View>
  );
}
