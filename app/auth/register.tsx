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

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      Alert.alert("Erreur", error.message);
      setLoading(false);
      return;
    }

    // Create profile
    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        username,
        coldness_level: 3,
      });
    }

    Alert.alert("Bienvenue !", "Ton compte a été créé.");
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <View className="flex-1 justify-center px-8 bg-midnight">
        <Text className="text-cream-500 text-4xl font-sans-bold text-center mb-2">
          Rejoins frileux
        </Text>
        <Text className="text-cream-200 text-base text-center mb-10 opacity-70">
          Crée ton compte en 30 secondes
        </Text>

        <TextInput
          className="bg-midnight-500 text-cream-50 rounded-xl px-4 py-4 mb-4 text-base"
          placeholder="Prénom ou pseudo"
          placeholderTextColor="#6F6F91"
          value={username}
          onChangeText={setUsername}
        />

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
          onPress={handleRegister}
          disabled={loading}
          className="bg-cream-500 rounded-xl py-4 items-center active:bg-cream-400"
        >
          <Text className="text-midnight text-lg font-sans-semibold">
            {loading ? "Création..." : "Créer mon compte"}
          </Text>
        </Pressable>

        <Link href="/auth/login" asChild>
          <Pressable className="mt-6 items-center">
            <Text className="text-cream-300 text-base">
              Déjà un compte ?{" "}
              <Text className="text-cream-500 font-sans-semibold">
                Se connecter
              </Text>
            </Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
