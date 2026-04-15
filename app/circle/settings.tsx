import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { Circle, Profile } from "@/lib/types";
import { MemberAvatar } from "@/components/circle/MemberAvatar";
import { colors } from "@/lib/theme";

interface MemberRow {
  user_id: string;
  joined_at: string;
  profile: Pick<Profile, "username" | "avatar_url"> | null;
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function CircleSettingsScreen() {
  const router = useRouter();
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: membership } = await supabase
      .from("circle_members")
      .select("circle_id, circles(*)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership?.circles) {
      setLoading(false);
      return;
    }
    const c = membership.circles as unknown as Circle;
    setCircle(c);
    setNameDraft(c.name);
    setDescDraft(c.description ?? "");

    const { data: rows } = await supabase
      .from("circle_members")
      .select("user_id, joined_at, profile:profiles(username, avatar_url)")
      .eq("circle_id", c.id)
      .order("joined_at", { ascending: true });
    setMembers((rows as unknown as MemberRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const isOwner = !!circle && !!currentUserId && circle.created_by === currentUserId;

  async function saveName() {
    if (!circle) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === circle.name) {
      setRenaming(false);
      setNameDraft(circle.name);
      return;
    }
    const { error } = await supabase
      .from("circles")
      .update({ name: trimmed })
      .eq("id", circle.id);
    if (error) {
      Alert.alert("Erreur", "Impossible de renommer.");
      return;
    }
    setCircle({ ...circle, name: trimmed });
    setRenaming(false);
  }

  async function setVisibility(next: "private" | "public") {
    if (!circle || !isOwner) return;
    setSavingVisibility(true);
    const { data, error } = await supabase.rpc("set_circle_visibility", {
      target_circle_id: circle.id,
      new_visibility: next,
      new_description: descDraft.trim() ? descDraft.trim().slice(0, 280) : null,
      new_slug: null,
      new_accent_hue: null,
    });
    setSavingVisibility(false);
    if (error || !data) {
      Alert.alert("Erreur", error?.message ?? "Impossible de modifier la visibilité.");
      return;
    }
    setCircle(data as Circle);
    setEditingDesc(false);
  }

  async function saveDescription() {
    if (!circle || !isOwner) return;
    const clean = descDraft.trim().slice(0, 280);
    const { data, error } = await supabase.rpc("set_circle_visibility", {
      target_circle_id: circle.id,
      new_visibility: circle.visibility ?? "private",
      new_description: clean,
      new_slug: null,
      new_accent_hue: null,
    });
    if (error || !data) {
      Alert.alert("Erreur", error?.message ?? "Impossible d'enregistrer.");
      return;
    }
    setCircle(data as Circle);
    setEditingDesc(false);
  }

  async function regenerateCode() {
    if (!circle) return;
    Alert.alert(
      "Régénérer le code ?",
      "L'ancien code ne sera plus valide.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Régénérer",
          style: "destructive",
          onPress: async () => {
            const code = generateInviteCode();
            const { error } = await supabase
              .from("circles")
              .update({ invite_code: code })
              .eq("id", circle.id);
            if (error) {
              Alert.alert("Erreur", "Impossible de régénérer.");
              return;
            }
            setCircle({ ...circle, invite_code: code });
          },
        },
      ]
    );
  }

  async function kick(userId: string, username: string) {
    if (!circle) return;
    Alert.alert(
      "Retirer du cercle ?",
      `${username} sera retiré.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("circle_members")
              .delete()
              .eq("circle_id", circle.id)
              .eq("user_id", userId);
            if (error) {
              Alert.alert("Erreur", "Action refusée.");
              return;
            }
            setMembers((prev) => prev.filter((m) => m.user_id !== userId));
          },
        },
      ]
    );
  }

  async function leave() {
    if (!circle || !currentUserId) return;
    Alert.alert(
      "Quitter ce cercle ?",
      "Tu ne verras plus les tenues des membres.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("circle_members")
              .delete()
              .eq("circle_id", circle.id)
              .eq("user_id", currentUserId);
            if (error) {
              Alert.alert("Erreur", "Impossible de quitter.");
              return;
            }
            router.back();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100 items-center justify-center">
        <ActivityIndicator color={colors.ice[600]} />
      </SafeAreaView>
    );
  }

  if (!circle) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100 px-6 pt-4">
        <Text className="font-body text-ink-500">Aucun cercle.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper-100">
      <View className="px-6 pt-2 pb-4 border-b border-paper-300 flex-row items-center">
        <Pressable onPress={() => router.back()} className="pr-4 py-1">
          <Text className="font-body text-ink-900 text-lg">←</Text>
        </Pressable>
        <Text
          className="font-display text-ink-900"
          style={{ fontSize: 28, letterSpacing: 1 }}
        >
          RÉGLAGES
        </Text>
      </View>

      <FlatList
        data={members}
        keyExtractor={(m) => m.user_id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="px-6 pt-6">
            <Text
              className="font-body-semibold text-ink-300 text-eyebrow mb-2"
              style={{ letterSpacing: 1.5 }}
            >
              NOM
            </Text>
            {isOwner && renaming ? (
              <View className="flex-row items-center gap-2 mb-6">
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  className="flex-1 border border-paper-300 bg-paper-200 px-3 py-2 font-body text-ink-900"
                  placeholderTextColor={colors.ink[300]}
                  selectionColor={colors.ice[600]}
                  autoFocus
                  onSubmitEditing={saveName}
                />
                <Pressable onPress={saveName} className="bg-ink-900 active:bg-ink-700 px-4 py-2">
                  <Text
                    className="font-body-semibold text-paper-100 text-eyebrow"
                    style={{ letterSpacing: 1.5 }}
                  >
                    OK
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => isOwner && setRenaming(true)}
                className="mb-6"
              >
                <Text className="font-body text-ink-900 text-base">
                  {circle.name}
                  {isOwner && (
                    <Text className="font-body text-ink-300 text-xs"> (modifier)</Text>
                  )}
                </Text>
              </Pressable>
            )}

            <Text
              className="font-body-semibold text-ink-300 text-eyebrow mb-2"
              style={{ letterSpacing: 1.5 }}
            >
              CODE D'INVITATION
            </Text>
            <View className="flex-row items-center justify-between mb-6">
              <Text
                className="font-display text-ink-900"
                style={{ fontSize: 24, letterSpacing: 4 }}
              >
                {circle.invite_code}
              </Text>
              {isOwner && (
                <Pressable onPress={regenerateCode} className="border border-ink-900 active:bg-paper-200 px-3 py-2">
                  <Text
                    className="font-body-semibold text-ink-900 text-eyebrow"
                    style={{ letterSpacing: 1.5 }}
                  >
                    RÉGÉNÉRER
                  </Text>
                </Pressable>
              )}
            </View>

            <Text
              className="font-body-semibold text-ink-300 text-eyebrow mb-2"
              style={{ letterSpacing: 1.5 }}
            >
              VISIBILITÉ
            </Text>
            {isOwner ? (
              <View className="flex-row border border-ink-900 mb-3">
                <Pressable
                  onPress={() => setVisibility("private")}
                  disabled={savingVisibility}
                  className={`flex-1 py-3 items-center ${(circle.visibility ?? "private") === "private" ? "bg-ink-900" : ""}`}
                >
                  <Text
                    className="font-body-semibold"
                    style={{
                      fontSize: 11,
                      letterSpacing: 2.5,
                      color: (circle.visibility ?? "private") === "private" ? "#FAFAF8" : "#0F0F0D",
                    }}
                  >
                    PRIVÉ
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setVisibility("public")}
                  disabled={savingVisibility}
                  className={`flex-1 py-3 items-center ${circle.visibility === "public" ? "bg-ink-900" : ""}`}
                >
                  <Text
                    className="font-body-semibold"
                    style={{
                      fontSize: 11,
                      letterSpacing: 2.5,
                      color: circle.visibility === "public" ? "#FAFAF8" : "#0F0F0D",
                    }}
                  >
                    PUBLIC
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text className="font-body text-ink-500 mb-3" style={{ fontSize: 13 }}>
                {circle.visibility === "public" ? "Cercle public" : "Cercle privé"}
              </Text>
            )}
            <Text className="font-body text-ink-300 mb-6" style={{ fontSize: 11, letterSpacing: 1 }}>
              {circle.visibility === "public"
                ? "Visible dans Explorer · rejoignable sans code."
                : "Rejoignable uniquement via le code d'invitation."}
            </Text>

            {isOwner && circle.visibility === "public" && (
              <View className="mb-6">
                <Text
                  className="font-body-semibold text-ink-300 text-eyebrow mb-2"
                  style={{ letterSpacing: 1.5 }}
                >
                  DESCRIPTION · {280 - descDraft.length} CAR.
                </Text>
                {editingDesc ? (
                  <View>
                    <TextInput
                      value={descDraft}
                      onChangeText={(t) => setDescDraft(t.slice(0, 280))}
                      multiline
                      placeholder="Pour quoi ce cercle existe ?"
                      placeholderTextColor={colors.ink[300]}
                      className="border border-paper-300 bg-paper-200 px-3 py-2 font-body text-ink-900 mb-2"
                      style={{ fontSize: 14, minHeight: 80, textAlignVertical: "top" }}
                      autoFocus
                    />
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={saveDescription}
                        className="bg-ink-900 active:bg-ink-700 px-4 py-2"
                      >
                        <Text
                          className="font-body-semibold text-paper-100 text-eyebrow"
                          style={{ letterSpacing: 1.5 }}
                        >
                          ENREGISTRER
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setDescDraft(circle.description ?? "");
                          setEditingDesc(false);
                        }}
                        className="border border-ink-900 px-4 py-2"
                      >
                        <Text
                          className="font-body-semibold text-ink-900 text-eyebrow"
                          style={{ letterSpacing: 1.5 }}
                        >
                          ANNULER
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => setEditingDesc(true)}>
                    <Text className="font-body text-ink-900" style={{ fontSize: 14 }}>
                      {circle.description ?? (
                        <Text className="font-body text-ink-300">Aucune description (modifier)</Text>
                      )}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            <Text
              className="font-body-semibold text-ink-300 text-eyebrow mb-3"
              style={{ letterSpacing: 1.5 }}
            >
              MEMBRES ({members.length})
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelf = item.user_id === currentUserId;
          const isCreator = item.user_id === circle.created_by;
          const username = item.profile?.username ?? "—";
          return (
            <View className="px-6 py-3 flex-row items-center gap-3 border-b border-paper-200">
              <MemberAvatar
                username={item.profile?.username}
                avatarUrl={item.profile?.avatar_url}
                size={32}
              />
              <View className="flex-1">
                <Text className="font-body-medium text-ink-900 text-sm">
                  {username}
                  {isSelf && <Text className="font-body text-ink-300"> · toi</Text>}
                  {isCreator && <Text className="font-body text-ink-300"> · créateur</Text>}
                </Text>
                <Text className="font-body text-ink-300 text-eyebrow">
                  rejoint le {new Date(item.joined_at).toLocaleDateString("fr-FR")}
                </Text>
              </View>
              {isOwner && !isSelf && (
                <Pressable onPress={() => kick(item.user_id, username)} className="active:opacity-50">
                  <Text
                    className="font-body-semibold text-error text-eyebrow"
                    style={{ letterSpacing: 1.5 }}
                  >
                    RETIRER
                  </Text>
                </Pressable>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <View className="px-6 pt-8">
            <Pressable
              onPress={leave}
              className="border border-error active:bg-error/10 py-4 items-center"
            >
              <Text
                className="font-body-semibold text-error text-eyebrow"
                style={{ letterSpacing: 2 }}
              >
                QUITTER LE CERCLE
              </Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}
