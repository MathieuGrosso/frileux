import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";

import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import { CommandChip } from "@/components/coach/CommandChip";
import { RecipeChips, type Recipe } from "@/components/coach/RecipeChips";
import { CommandPicker } from "@/components/coach/CommandPicker";
import {
  invokeCoach,
  loadCoachMessages,
  parseSlashCommand,
  readCachedFeedback,
  writeCachedFeedback,
  clearCachedFeedback,
  type CoachCommand,
  type CoachMessage,
} from "@/lib/coach";

const MAX_DRAFT_LEN = 1000;
const MAX_HISTORY_FOR_API = 5;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function CoachScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoaded(true);
      return;
    }
    setUserId(user.id);
    try {
      const msgs = await loadCoachMessages(user.id, 200);
      setMessages(msgs);
    } catch {
      // silencieux : si la table est vide ou erreur, on reste sur tableau vide
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !userId || sending) return;

    const parsed = parseSlashCommand(text);
    setSending(true);
    setDraft("");

    // Optimistic insert du message user pour ressenti immédiat.
    const optimisticUser: CoachMessage = {
      id: `opt-${Date.now()}`,
      user_id: userId,
      role: "user",
      body: parsed.body,
      command: parsed.command,
      command_arg: parsed.arg,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimisticUser, ...prev]);

    try {
      // Tentative de cache pour /feedback (TTL 7j, key = wardrobe count).
      if (parsed.command === "feedback") {
        const { count } = await supabase
          .from("wardrobe_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        const wardrobeCount = count ?? 0;
        const cached = await readCachedFeedback(userId, wardrobeCount);
        if (cached) {
          const optimisticAssistant: CoachMessage = {
            id: `opt-${Date.now() + 1}`,
            user_id: userId,
            role: "assistant",
            body: cached.reply,
            command: null,
            command_arg: null,
            metadata: { ...(cached.metadata ?? {}), cached: true },
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [optimisticAssistant, ...prev]);
          // Persist quand même côté DB pour garder l'historique cohérent.
          await invokeCoach({
            message: parsed.body,
            command: parsed.command,
            command_arg: parsed.arg,
          }).catch(() => {});
          return;
        }
      }

      const history = messages
        .slice(0, MAX_HISTORY_FOR_API)
        .reverse()
        .map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, body: m.body }));

      const result = await invokeCoach({
        message: parsed.body,
        command: parsed.command,
        command_arg: parsed.arg,
        history,
      });

      if (parsed.command === "effacer" || result.cleared) {
        setMessages([]);
        await clearCachedFeedback(userId);
        return;
      }

      // Cache feedback pour 7j si on en a un nouveau.
      if (parsed.command === "feedback") {
        const { count } = await supabase
          .from("wardrobe_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        await writeCachedFeedback(userId, count ?? 0, {
          reply: result.reply,
          metadata: result.metadata,
        });
      }

      // Recharge depuis la DB pour récupérer les vrais IDs.
      const fresh = await loadCoachMessages(userId, 200);
      setMessages(fresh);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue.";
      Alert.alert("Coach indisponible", message);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
    } finally {
      setSending(false);
    }
  }, [draft, userId, sending, messages]);

  const onPickRecipe = useCallback((recipe: Recipe) => {
    if (recipe.command === "coach") {
      setDraft("/coach ");
    } else if (recipe.command === "effacer") {
      Alert.alert("Effacer le thread ?", "L'historique sera supprimé.", [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: () => {
            setDraft("/effacer");
            void handleSend();
          },
        },
      ]);
    } else {
      setDraft(`/${recipe.command}`);
    }
  }, [handleSend]);

  const showPickerOnSlash = useCallback((value: string) => {
    setDraft(value);
    if (value === "/") setPickerOpen(true);
  }, []);

  const canSend = draft.trim().length > 0 && !sending;

  if (!loaded) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100 items-center justify-center" edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.ice[600]} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper-100" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-5 py-3 border-b border-ink-100 flex-row items-center">
        <PressableScale
          onPress={() => router.back()}
          className="mr-3"
          accessibilityLabel="Retour"
        >
          <Text className="font-body-medium text-ink-900" style={{ fontSize: 14, letterSpacing: 1.6 }}>
            ←
          </Text>
        </PressableScale>
        <View className="flex-1">
          <Text
            className="font-body-medium"
            style={{ fontSize: 10, letterSpacing: 2, color: colors.ink[300] }}
          >
            06 — STYLE FEEDBACK
          </Text>
          <Text
            className="font-display tracking-tight"
            style={{ fontSize: 24, lineHeight: 28, color: colors.ink[900] }}
          >
            COACH
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text
              className="font-body-medium text-center"
              style={{ fontSize: 11, letterSpacing: 2, color: colors.ink[300] }}
            >
              AUCUN ÉCHANGE
            </Text>
            <Text
              className="font-display tracking-tight text-center mt-2"
              style={{ fontSize: 32, lineHeight: 36, color: colors.ink[900] }}
            >
              DEMANDE,{"\n"}OU TAPE /
            </Text>
            <Text
              className="font-body text-center mt-4"
              style={{ fontSize: 13, lineHeight: 20, color: colors.ink[500] }}
            >
              Le coach observe la garde-robe au troisième personne. Court, direct, sans hedge.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            inverted
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 20 }}
            renderItem={({ item }) => {
              const mine = item.role === "user";
              return (
                <View className={`my-1.5 ${mine ? "items-end" : "items-start"}`}>
                  {mine && item.command ? (
                    <CommandChip command={item.command} arg={item.command_arg ?? undefined} />
                  ) : null}
                  <View
                    className={`max-w-[86%] px-4 py-2.5 ${mine ? "bg-ink-900" : "bg-paper-200 border border-ink-100"}`}
                  >
                    <Text
                      className={mine ? "text-paper-100" : "text-ink-900"}
                      style={{ fontSize: 14, lineHeight: 20 }}
                    >
                      {item.body}
                    </Text>
                  </View>
                  <Text
                    className="font-body mt-1"
                    style={{ fontSize: 10, letterSpacing: 0.5, color: colors.ink[300] }}
                  >
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {sending ? (
          <View className="px-5 pb-1">
            <Text
              className="font-body"
              style={{ fontSize: 12, letterSpacing: 0.5, color: colors.ink[300] }}
            >
              le coach observe…
            </Text>
          </View>
        ) : null}

        <View className="pt-2 border-t border-ink-100 bg-paper-100">
          <RecipeChips
            onPickRecipe={onPickRecipe}
            onOpenAll={() => setPickerOpen(true)}
          />
          <View className="px-4 pb-3 flex-row items-end gap-2">
            <View className="flex-1 border border-ink-200 px-3 py-2.5 bg-paper-50">
              <TextInput
                value={draft}
                onChangeText={showPickerOnSlash}
                placeholder="Demande, ou tape /"
                placeholderTextColor={colors.ink[300]}
                multiline
                maxLength={MAX_DRAFT_LEN}
                className="font-body text-ink-900"
                style={{ fontSize: 14, maxHeight: 120, minHeight: 22 }}
              />
              <View className="flex-row justify-end mt-1">
                <Text
                  className="font-body-medium"
                  style={{ fontSize: 9, letterSpacing: 1.4, color: colors.ink[300] }}
                >
                  SONNET 4.6
                </Text>
              </View>
            </View>
            <PressableScale
              onPress={handleSend}
              disabled={!canSend}
              style={{
                backgroundColor: canSend ? colors.ink[900] : colors.ink[200],
                paddingHorizontal: 18,
                paddingVertical: 14,
              }}
              accessibilityLabel="Envoyer"
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.paper[100]} />
              ) : (
                <Text
                  className="font-body-semibold"
                  style={{ fontSize: 11, letterSpacing: 2, color: colors.paper[100] }}
                >
                  ENVOYER
                </Text>
              )}
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>

      <CommandPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={onPickRecipe}
      />
    </SafeAreaView>
  );
}
