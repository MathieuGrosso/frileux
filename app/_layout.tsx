import "../global.css";
import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { registerForPushNotifications, savePushToken } from "@/lib/notifications";
import { View, ActivityIndicator } from "react-native";
import { useFonts } from "expo-font";
import {
  Cormorant_300Light,
  Cormorant_600SemiBold,
} from "@expo-google-fonts/cormorant";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Cormorant_300Light,
    Cormorant_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        registerForPushNotifications().then((token) => {
          if (token) savePushToken(token);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "auth";
    if (!session && !inAuthGroup) {
      router.replace("/auth/login");
    } else if (session && inAuthGroup) {
      router.replace("/");
    }
  }, [session, loading, segments]);

  if (loading || !fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-900">
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return <Slot />;
}
