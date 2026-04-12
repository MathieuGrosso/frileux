import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) Alert.alert("Erreur", error.message);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <View className="flex-1 justify-center px-8 bg-midnight">
        <Text className="text-cream-500 text-5xl font-sans-bold text-center mb-2">
          frileux
        </Text>
        <Text className="text-cream-200 text-lg text-center mb-12 opacity-70">
          habille-toi pour le froid
        </Text>

        <TextInput
          className="bg-midnight-500 text-cream-50 rounded-xl px-4 py-4 mb-4 text-base"
          placeholder="Email"
          placeholderTextColor="#6F6F91"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          className="bg-midnight-500 text-cream-50 rounded-xl px-4 py-4 mb-8 text-base"
          placeholder="Mot de passe"
          placeholderTextColor="#6F6F91"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          onPress={handleLogin}
          disabled={loading}
          className="bg-cream-500 rounded-xl py-4 items-center active:bg-cream-400"
        >
          <Text className="text-midnight text-lg font-sans-semibold">
            {loading ? "Connexion..." : "Se connecter"}
          </Text>
        </Pressable>

        <Link href="/auth/register" asChild>
          <Pressable className="mt-6 items-center">
            <Text className="text-cream-300 text-base">
              Pas encore de compte ?{" "}
              <Text className="text-cream-500 font-sans-semibold">
                S'inscrire
              </Text>
            </Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
