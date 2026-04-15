import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/EmptyState";

interface MemoryFact {
  id: string;
  fact: string;
  kind: "strength" | "avoid" | "pattern";
  created_at: string;
}

const KIND_LABELS: Record<MemoryFact["kind"], string> = {
  strength: "Fonctionne bien",
  avoid: "À éviter",
  pattern: "Pattern",
};

const KIND_ORDER: MemoryFact["kind"][] = ["strength", "avoid", "pattern"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function MemoryScreen() {
  const router = useRouter();
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setFacts([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("style_memory")
      .select("id, fact, kind, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setFacts((data ?? []) as MemoryFact[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function deleteFact(id: string) {
    const previous = facts;
    setFacts(facts.filter((f) => f.id !== id));
    const { error } = await supabase.from("style_memory").delete().eq("id", id);
    if (error) setFacts(previous);
  }

  const grouped: Record<MemoryFact["kind"], MemoryFact[]> = {
    strength: [],
    avoid: [],
    pattern: [],
  };
  for (const f of facts) grouped[f.kind].push(f);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color="#0F0F0D" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-4 pb-6 border-b border-paper-300">
          <View className="flex-row items-center justify-between mb-6">
            <Pressable onPress={() => router.back()} className="py-1">
              <Text className="font-body text-caption text-ink-500 uppercase tracking-widest">
                Retour
              </Text>
            </Pressable>
            <Text className="font-body text-caption text-ink-500 uppercase tracking-widest">
              {facts.length} fait{facts.length > 1 ? "s" : ""}
            </Text>
          </View>
          <Text className="font-display text-display-xl text-ink-900 tracking-tight">
            Ce que Frileux sait de toi
          </Text>
          <Text className="font-body text-body-sm text-ink-500 mt-3">
            Appris à partir des critiques de tes tenues. Supprime ce qui ne colle pas.
          </Text>
        </View>

        {facts.length === 0 ? (
          <View className="px-6 pt-12">
            <EmptyState
              title="Rien appris pour l'instant."
              subtitle="Logue quelques tenues et laisse Frileux noter ce qui fonctionne."
            />
          </View>
        ) : (
          <View className="pt-6">
            {KIND_ORDER.map((kind) => {
              const list = grouped[kind];
              if (list.length === 0) return null;
              return (
                <View key={kind} className="mb-8 px-6">
                  <Text className="font-body-medium text-eyebrow text-ink-500 uppercase mb-3">
                    {KIND_LABELS[kind]} · {list.length}
                  </Text>
                  {list.map((f) => (
                    <View
                      key={f.id}
                      className="border border-paper-300 bg-paper px-4 py-3 mb-2 flex-row items-start justify-between"
                    >
                      <View className="flex-1 pr-3">
                        <Text className="font-body text-body-sm text-ink-900">
                          {f.fact}
                        </Text>
                        <Text className="font-body text-caption text-ink-400 mt-1">
                          {formatDate(f.created_at)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => deleteFact(f.id)}
                        className="py-1 px-2 active:opacity-60"
                      >
                        <Text className="font-body text-caption text-ink-500 uppercase tracking-widest">
                          Suppr.
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
