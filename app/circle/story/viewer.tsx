import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Alert, Dimensions } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams, Stack } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { supabase } from "@/lib/supabase";

interface StoryRow {
  id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
  image_url: string;
}

const DURATION = 5000;
const { width } = Dimensions.get("window");

function publicUrl(path: string): string {
  const { data } = supabase.storage.from("daily-posts").getPublicUrl(path);
  return data.publicUrl;
}

export default function StoryViewerScreen() {
  const { userId, circleId } = useLocalSearchParams<{ userId: string; circleId?: string }>();
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(0);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user?.id ?? null);
      let q = supabase
        .from("daily_posts")
        .select("id, image_path, caption, created_at")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      if (circleId) q = q.or(`circle_id.eq.${circleId},circle_id.is.null`);
      const { data } = await q;
      const list = ((data as StoryRow[]) ?? []).map((s) => ({ ...s, image_url: publicUrl(s.image_path) }));
      setStories(list);
    })();
  }, [userId, circleId]);

  useEffect(() => {
    if (stories.length === 0) return;
    const current = stories[index];
    if (!current || !me) return;
    void supabase
      .from("daily_post_views")
      .insert({ post_id: current.id, user_id: me })
      .select();
  }, [index, stories, me]);

  useEffect(() => {
    if (stories.length === 0 || paused) return;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: DURATION,
      easing: Easing.linear,
    });
    const t = setTimeout(() => {
      advance();
    }, DURATION);
    return () => {
      clearTimeout(t);
      cancelAnimation(progress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, stories, paused]);

  function advance() {
    if (index < stories.length - 1) {
      setIndex(index + 1);
    } else {
      router.back();
    }
  }

  function back() {
    if (index > 0) setIndex(index - 1);
    else router.back();
  }

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const current = stories[index];

  if (!current) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#0F0F0D" }}>
        <Stack.Screen options={{ headerShown: false, animation: "fade" }} />
        <Text className="text-paper-100 font-display" style={{ fontSize: 24 }}>
          PLUS DE POST
        </Text>
        <Pressable onPress={() => router.back()} className="mt-6">
          <Text className="text-ice-600 font-body-medium" style={{ letterSpacing: 2 }}>
            ← FERMER
          </Text>
        </Pressable>
      </View>
    );
  }

  const mine = me === userId;

  function askDelete() {
    Alert.alert("Supprimer", "Supprimer ce post ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supabase.from("daily_posts").delete().eq("id", current.id);
          setStories((prev) => prev.filter((s) => s.id !== current.id));
          if (index >= stories.length - 1) router.back();
        },
      },
    ]);
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "#0F0F0D" }}>
      <Stack.Screen options={{ headerShown: false, animation: "fade" }} />
      <Image
        source={{ uri: current.image_url }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        contentFit="cover"
      />

      <View className="pt-16 px-4 flex-row gap-1">
        {stories.map((_, i) => (
          <View
            key={i}
            style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.25)" }}
          >
            {i < index ? (
              <View style={{ height: 1, backgroundColor: "#FAFAF8" }} />
            ) : i === index ? (
              <Animated.View style={[{ height: 1, backgroundColor: "#FAFAF8" }, progressStyle]} />
            ) : null}
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => router.back()}
        className="absolute top-14 right-5"
        hitSlop={16}
      >
        <Text className="font-body-medium" style={{ color: "#FAFAF8", fontSize: 18 }}>
          ×
        </Text>
      </Pressable>

      {mine && (
        <Pressable
          onPress={askDelete}
          className="absolute top-14 right-16"
          hitSlop={16}
        >
          <Text className="font-body-medium" style={{ color: "#FAFAF8", fontSize: 11, letterSpacing: 2 }}>
            SUPPR.
          </Text>
        </Pressable>
      )}

      <Pressable
        className="absolute top-0 bottom-0 left-0"
        style={{ width: width * 0.35 }}
        onPress={back}
        onLongPress={() => { pausedRef.current = true; setPaused(true); }}
        onPressOut={() => {
          if (pausedRef.current) {
            pausedRef.current = false;
            setPaused(false);
          }
        }}
      />
      <Pressable
        className="absolute top-0 bottom-0 right-0"
        style={{ width: width * 0.65 }}
        onPress={advance}
        onLongPress={() => { pausedRef.current = true; setPaused(true); }}
        onPressOut={() => {
          if (pausedRef.current) {
            pausedRef.current = false;
            setPaused(false);
          }
        }}
      />

      {current.caption ? (
        <View className="absolute bottom-20 left-0 right-0 px-8">
          <Text
            className="font-display"
            style={{ color: "#FAFAF8", fontSize: 30, letterSpacing: -0.4, lineHeight: 34 }}
          >
            {current.caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
