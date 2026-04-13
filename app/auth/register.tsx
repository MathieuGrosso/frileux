import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/components/BrandLogo";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Erreur", "Remplis tous les champs.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { Alert.alert("Erreur", error.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("profiles").insert({ id: data.user.id, username: username.trim(), coldness_level: 3 });
    }
    // navigation handled automatically by onAuthStateChange in _layout.tsx
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <View style={styles.brand}>
          <BrandLogo size="lg" />
          <Text style={styles.tagline}>crée ton compte</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Prénom ou pseudo"
            placeholderTextColor="#9E9A96"
            value={username}
            onChangeText={setUsername}
            selectionColor="#637D8E"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9E9A96"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            selectionColor="#637D8E"
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor="#9E9A96"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            selectionColor="#637D8E"
          />
          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>
              {loading ? "CRÉATION…" : "CRÉER MON COMPTE"}
            </Text>
          </Pressable>
        </View>

        <Link href="/auth/login" asChild>
          <Pressable style={styles.footer}>
            <Text style={styles.footerText}>
              Déjà un compte ?{" "}
              <Text style={styles.footerLink}>Se connecter</Text>
            </Text>
          </Pressable>
        </Link>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 32, gap: 48 },

  brand: { alignItems: "flex-start" },
  tagline: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    color: "#9E9A96",
    marginTop: 6,
  },

  form: { gap: 12 },
  input: {
    backgroundColor: "#F2F0EC",
    borderWidth: 1,
    borderColor: "#E8E5DF",
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: "Jost_400Regular",
    fontSize: 15,
    color: "#0F0F0D",
  },
  btn: {
    backgroundColor: "#0F0F0D",
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
  },
  btnPressed: { backgroundColor: "#3A3836" },
  btnText: {
    fontFamily: "Jost_600SemiBold",
    fontSize: 11,
    color: "#FAFAF8",
    letterSpacing: 2.5,
  },

  footer: { alignItems: "center" },
  footerText: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#9E9A96",
  },
  footerLink: {
    fontFamily: "Jost_500Medium",
    color: "#637D8E",
  },
});
