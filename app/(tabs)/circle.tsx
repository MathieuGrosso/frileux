import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { OutfitWithProfile, Circle } from "@/lib/types";
import { weatherEmoji } from "@/lib/weather";

export default function CircleScreen() {
  const [circle, setCircle] = useState<Circle | null>(null);
  const [outfits, setOutfits] = useState<OutfitWithProfile[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCircle();
  }, []);

  async function loadCircle() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's circle
    const { data: membership } = await supabase
      .from("circle_members")
      .select("circle_id, circles(*)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membership?.circles) {
      const c = membership.circles as unknown as Circle;
      setCircle(c);
      loadCircleOutfits(c.id, user.id);
    } else {
      setLoading(false);
    }
  }

  async function loadCircleOutfits(circleId: string, currentUserId: string) {
    // Get all members of the circle
    const { data: members } = await supabase
      .from("circle_members")
      .select("user_id")
      .eq("circle_id", circleId);

    if (!members) return;

    const memberIds = members
      .map((m) => m.user_id)
      .filter((id) => id !== currentUserId);

    if (memberIds.length === 0) {
      setLoading(false);
      return;
    }

    // Get today's outfits from circle members
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("outfits")
      .select("*, profile:profiles(username, avatar_url)")
      .in("user_id", memberIds)
      .eq("date", today)
      .order("created_at", { ascending: false });

    setOutfits((data as unknown as OutfitWithProfile[]) ?? []);
    setLoading(false);
  }

  async function createCircle() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from("circles")
      .insert({
        name: "Mon cercle",
        invite_code: code,
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !data) {
      Alert.alert("Erreur", "Impossible de créer le cercle.");
      return;
    }

    await supabase.from("circle_members").insert({
      circle_id: data.id,
      user_id: user.id,
    });

    setCircle(data);
    Alert.alert(
      "Cercle créé !",
      `Partage ce code avec tes amis : ${code}`
    );
  }

  async function joinCircle() {
    if (!inviteCode.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: circleData } = await supabase
      .from("circles")
      .select()
      .eq("invite_code", inviteCode.toUpperCase())
      .single();

    if (!circleData) {
      Alert.alert("Erreur", "Code invalide.");
      return;
    }

    const { error } = await supabase.from("circle_members").insert({
      circle_id: circleData.id,
      user_id: user.id,
    });

    if (error) {
      Alert.alert("Erreur", "Tu fais peut-être déjà partie de ce cercle.");
      return;
    }

    setCircle(circleData);
    Alert.alert("Bienvenue !", `Tu as rejoint "${circleData.name}".`);
  }

  if (!circle && !loading) {
    return (
      <SafeAreaView className="flex-1 bg-midnight">
        <View className="flex-1 justify-center px-8">
          <Text className="text-cream-500 text-3xl font-sans-bold text-center mb-2">
            Cercle privé
          </Text>
          <Text className="text-cream-200 text-base text-center opacity-60 mb-10">
            Partage tes tenues avec tes proches
          </Text>

          <Pressable
            onPress={createCircle}
            className="bg-cream-500 rounded-xl py-4 items-center mb-6 active:bg-cream-400"
          >
            <Text className="text-midnight text-lg font-sans-semibold">
              Créer un cercle
            </Text>
          </Pressable>

          <Text className="text-cream-300 text-center mb-4">ou</Text>

          <TextInput
            className="bg-midnight-500 text-cream-50 rounded-xl px-4 py-4 mb-4 text-base text-center tracking-widest"
            placeholder="CODE D'INVITATION"
            placeholderTextColor="#6F6F91"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            maxLength={6}
          />

          <Pressable
            onPress={joinCircle}
            className="border border-cream-500 rounded-xl py-4 items-center active:bg-cream-500/10"
          >
            <Text className="text-cream-500 text-lg font-sans-semibold">
              Rejoindre
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  function renderOutfit({ item }: { item: OutfitWithProfile }) {
    return (
      <View className="mb-6 bg-midnight-500 rounded-2xl overflow-hidden">
        {/* User header */}
        <View className="flex-row items-center gap-3 p-4">
          <View className="w-8 h-8 rounded-full bg-cream-500/20 items-center justify-center">
            <Text className="text-cream-500 font-sans-bold text-sm">
              {item.profile?.username?.[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <Text className="text-cream-200 font-sans-medium">
            {item.profile?.username ?? "Anonyme"}
          </Text>
          <View className="flex-row items-center ml-auto gap-1">
            <Text>{weatherEmoji(item.weather_data?.icon ?? "01d")}</Text>
            <Text className="text-cream-300 text-sm">
              {item.weather_data?.temp}°C
            </Text>
          </View>
        </View>

        <Image
          source={{ uri: item.photo_url }}
          className="w-full h-80"
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-midnight">
      <View className="px-6 pt-4 pb-4 flex-row justify-between items-center">
        <View>
          <Text className="text-cream-500 text-3xl font-sans-bold">
            Cercle
          </Text>
          <Text className="text-cream-300 text-sm opacity-60">
            Code : {circle?.invite_code}
          </Text>
        </View>
      </View>

      <FlatList
        data={outfits}
        renderItem={renderOutfit}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center pt-20">
            <Text className="text-6xl mb-4">👯</Text>
            <Text className="text-cream-300 text-lg text-center">
              Personne n'a posté aujourd'hui.{"\n"}Sois la première !
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
