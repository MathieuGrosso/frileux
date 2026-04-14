import { forwardRef, useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from "react-native";
import { colors } from "@/lib/theme";
import type { CircleMemberLite } from "@/hooks/useCircleMembers";

export interface MentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  members: CircleMemberLite[];
  mentionedUserIds: string[];
  onMentionedUserIdsChange: (ids: string[]) => void;
}

function extractMentionedIds(body: string, members: CircleMemberLite[]): string[] {
  const matches = body.match(/@([a-zA-Z0-9_.-]+)/g) ?? [];
  const ids = new Set<string>();
  for (const raw of matches) {
    const username = raw.slice(1).toLowerCase();
    const m = members.find((x) => x.username.toLowerCase() === username);
    if (m) ids.add(m.user_id);
  }
  return Array.from(ids);
}

export const MentionInput = forwardRef<TextInput, MentionInputProps>(
  function MentionInput(
    {
      value,
      onChangeText,
      placeholder,
      maxLength,
      members,
      mentionedUserIds,
      onMentionedUserIdsChange,
    },
    ref,
  ) {
    const [caret, setCaret] = useState(0);

    const query = useMemo<string | null>(() => {
      const before = value.slice(0, caret);
      const match = before.match(/@([a-zA-Z0-9_.-]*)$/);
      return match ? match[1] : null;
    }, [value, caret]);

    const suggestions = useMemo<CircleMemberLite[]>(() => {
      if (query === null) return [];
      const q = query.toLowerCase();
      return members
        .filter((m) => m.username.toLowerCase().startsWith(q))
        .slice(0, 6);
    }, [members, query]);

    const handleChange = useCallback(
      (text: string) => {
        onChangeText(text);
        onMentionedUserIdsChange(extractMentionedIds(text, members));
      },
      [onChangeText, onMentionedUserIdsChange, members],
    );

    const handleSelectionChange = useCallback(
      (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        setCaret(e.nativeEvent.selection.end);
      },
      [],
    );

    const selectMember = useCallback(
      (m: CircleMemberLite) => {
        if (query === null) return;
        const before = value.slice(0, caret);
        const after = value.slice(caret);
        const replaced = before.replace(/@([a-zA-Z0-9_.-]*)$/, `@${m.username} `);
        const next = replaced + after;
        const nextCaret = replaced.length;
        onChangeText(next);
        onMentionedUserIdsChange(
          Array.from(new Set([...mentionedUserIds, m.user_id])),
        );
        setCaret(nextCaret);
      },
      [query, value, caret, onChangeText, mentionedUserIds, onMentionedUserIdsChange],
    );

    const showSuggestions = query !== null && suggestions.length > 0;

    return (
      <View className="flex-1">
        {showSuggestions && (
          <View className="absolute bottom-full left-0 right-0 mb-2 border border-paper-300 bg-paper-50">
            <ScrollView keyboardShouldPersistTaps="handled">
              {suggestions.map((m) => (
                <Pressable
                  key={m.user_id}
                  onPress={() => selectMember(m)}
                  className="px-3 py-2 active:bg-ice-100 border-b border-paper-200"
                >
                  <Text className="font-body text-ink-900 text-[14px]">
                    <Text className="text-ice-600">@</Text>
                    {m.username}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={handleChange}
          onSelectionChange={handleSelectionChange}
          placeholder={placeholder}
          placeholderTextColor={colors.ink[300]}
          selectionColor={colors.ice[600]}
          multiline
          maxLength={maxLength}
          className="border border-paper-300 bg-paper-200 px-3 py-2 font-body text-ink-900 text-[14px]"
          style={{ maxHeight: 96 }}
        />
      </View>
    );
  },
);
