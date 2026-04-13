import "react-native-url-polyfill/auto";
import "../global.css";
import { useCallback, useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { OnboardingContext } from "@/lib/onboarding-context";
import { registerForPushNotifications, savePushToken } from "@/lib/notifications";
import { View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import {
  BarlowCondensed_400Regular,
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
} from "@expo-google-fonts/barlow-condensed";
import {
  Jost_400Regular,
  Jost_500Medium,
  Jost_600SemiBold,
} from "@expo-google-fonts/jost";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    BarlowCondensed_400Regular,
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    Jost_400Regular,
    Jost_500Medium,
    Jost_600SemiBold,
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
      } else {
        setOnboardingCompleted(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshOnboardingFlag = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", session.user.id)
      .single();
    setOnboardingCompleted(data?.onboarding_completed ?? false);
  }, [session]);

  // Fetch onboarding flag whenever session changes.
  useEffect(() => {
    if (!session) return;
    refreshOnboardingFlag();
  }, [session, refreshOnboardingFlag]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "auth";
    const inOnboarding = segments[0] === "onboarding";

    if (!session) {
      if (!inAuthGroup) router.replace("/auth/login");
      return;
    }

    // Wait for onboarding flag to be fetched before deciding.
    if (onboardingCompleted === null) return;

    if (!onboardingCompleted) {
      if (!inOnboarding) router.replace("/onboarding");
    } else if (inAuthGroup || inOnboarding) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loading, onboardingCompleted]);

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAF8" }}>
        <ActivityIndicator size="large" color="#637D8E" />
      </View>
    );
  }

  return (
    <OnboardingContext.Provider
      value={{ completed: onboardingCompleted, refresh: refreshOnboardingFlag }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Slot />
      </GestureHandlerRootView>
    </OnboardingContext.Provider>
  );
}
