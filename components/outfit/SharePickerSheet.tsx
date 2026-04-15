import { useEffect, useState } from "react";
import { Modal, View, Text, ScrollView, ActivityIndicator } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { supabase } from "@/lib/supabase";
import type { Circle } from "@/lib/types";

interface Props {
  visible: boolean;
  outfitId: string | null;
  userId: string;
  onClose: () => void;
  onDone: (sharedTo: number) => void;
}

function hueToHsl(hue: number | null | undefined): string {
  if (hue == null) return "#0F0F0D";
  return `hsl(${hue}, 28%, 28%)`;
}

export function SharePickerSheet({ visible, outfitId, userId, onClose, onDone }: Props) {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [privateMode, setPrivateMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("circle_members")
        .select("circles(*)")
        .eq("user_id", userId);
      const list: Circle[] = ((data ?? []) as unknown as { circles: Circle }[])
        .map((m) => m.circles)
        .filter((c): c is Circle => !!c);
      setCircles(list);
      const preselected = new Set(list.filter((c) => c.visibility === "private").map((c) => c.id));
      setSelected(preselected);
      setPrivateMode(false);
      setLoading(false);
    })();
  }, [visible, userId]);

  function toggle(id: string) {
    if (privateMode) setPrivateMode(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePrivateMode() {
    const next = !privateMode;
    setPrivateMode(next);
    if (next) setSelected(new Set());
  }

  async function confirm() {
    if (!outfitId) return;
    setSaving(true);
    const ids = Array.from(selected);
    if (ids.length > 0) {
      const rows = ids.map((circle_id) => ({ outfit_id: outfitId, circle_id }));
      await supabase.from("outfit_shares").insert(rows);
    }
    setSaving(false);
    onDone(ids.length);
  }

  const count = selected.size;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-paper-100">
        <View className="px-6 pt-6 pb-4 border-b border-ink-100 flex-row items-center justify-between">
          <PressableScale onPress={onClose} hitSlop={8}>
            <Text
              className="font-body-medium text-ink-500"
              style={{ fontSize: 12, letterSpacing: 2 }}
            >
              PLUS TARD
            </Text>
          </PressableScale>
          <Text
            className="font-body-medium text-ink-300"
            style={{ fontSize: 10, letterSpacing: 2 }}
          >
            PUBLIER
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="px-6 pt-6 pb-4">
            <Text
              className="font-display text-ink-900"
              style={{ fontSize: 44, letterSpacing: -0.8, lineHeight: 46 }}
            >
              OÙ PUBLIER ?
            </Text>
            <Text
              className="font-body text-ink-500 mt-2"
              style={{ fontSize: 13, letterSpacing: 0.5 }}
            >
              coche les cercles où ta tenue sera visible
            </Text>
          </View>

          <PressableScale
            onPress={togglePrivateMode}
            className={`mx-6 mb-6 px-5 py-4 border ${privateMode ? "bg-ink-900 border-ink-900" : "border-ink-100 bg-paper-100"}`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text
                  className={`font-body-semibold ${privateMode ? "text-paper-100" : "text-ink-900"}`}
                  style={{ fontSize: 12, letterSpacing: 2 }}
                >
                  JUSTE POUR MOI
                </Text>
                <Text
                  className={`font-body mt-1 ${privateMode ? "text-paper-300" : "text-ink-300"}`}
                  style={{ fontSize: 11 }}
                >
                  la tenue reste dans ton historique perso
                </Text>
              </View>
              <CheckMark checked={privateMode} inverse={privateMode} />
            </View>
          </PressableScale>

          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#637D8E" />
            </View>
          ) : circles.length === 0 ? (
            <View className="px-6 py-10">
              <Text className="font-body text-ink-500 text-center" style={{ fontSize: 13 }}>
                Tu n'es dans aucun cercle pour l'instant.
              </Text>
            </View>
          ) : (
            <View>
              <Text
                className="font-body-medium text-ink-300 px-6 mb-2"
                style={{ fontSize: 10, letterSpacing: 2.5 }}
              >
                MES CERCLES
              </Text>
              {circles.map((c) => {
                const checked = !privateMode && selected.has(c.id);
                return (
                  <PressableScale
                    key={c.id}
                    onPress={() => toggle(c.id)}
                    scaleTo={0.99}
                  >
                    <View className="px-6 py-4 border-t border-ink-100 flex-row items-center">
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: hueToHsl(c.accent_hue),
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          className="font-display text-paper-100"
                          style={{ fontSize: 18 }}
                        >
                          {c.name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1 ml-3">
                        <Text
                          className="font-display text-ink-900"
                          style={{ fontSize: 20, letterSpacing: -0.3 }}
                          numberOfLines={1}
                        >
                          {c.name.toUpperCase()}
                        </Text>
                        <Text
                          className="font-body text-ink-300 mt-0.5"
                          style={{ fontSize: 10, letterSpacing: 1.5 }}
                        >
                          {c.visibility === "public" ? "PUBLIC" : "PRIVÉ"} · {c.member_count ?? 1} MEMBRE{(c.member_count ?? 1) > 1 ? "S" : ""}
                        </Text>
                      </View>
                      <CheckMark checked={checked} />
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View className="px-6 pt-4 pb-8 border-t border-ink-100 bg-paper-100">
          <PressableScale
            onPress={() => void confirm()}
            disabled={saving || (!privateMode && count === 0 && !privateMode)}
            className="bg-ink-900 active:bg-ink-700 py-5 items-center"
            style={{ opacity: saving ? 0.5 : 1 }}
          >
            <Text
              className="font-body-semibold text-paper-100"
              style={{ fontSize: 13, letterSpacing: 2.5 }}
            >
              {saving
                ? "…"
                : privateMode
                ? "GARDER POUR MOI"
                : count === 0
                ? "NE RIEN PARTAGER"
                : count === 1
                ? "PUBLIER DANS 1 CERCLE"
                : `PUBLIER DANS ${count} CERCLES`}
            </Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

function CheckMark({ checked, inverse }: { checked: boolean; inverse?: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderWidth: 1.5,
        borderColor: inverse ? "#FAFAF8" : checked ? "#0F0F0D" : "#C9C9C4",
        backgroundColor: checked ? (inverse ? "#FAFAF8" : "#0F0F0D") : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked ? (
        <Text
          style={{
            color: inverse ? "#0F0F0D" : "#FAFAF8",
            fontSize: 13,
            lineHeight: 13,
            fontWeight: "700",
          }}
        >
          ✓
        </Text>
      ) : null}
    </View>
  );
}
