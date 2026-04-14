import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/components/BrandLogo";
import { mapAuthError } from "@/lib/auth-errors";
import { colors } from "@/lib/theme";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setError(null);
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("Remplis tous les champs.");
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    if (err) { setError(mapAuthError(err)); setLoading(false); return; }
    if (data.user) {
      await supabase.from("profiles").insert({ id: data.user.id, username: username.trim(), coldness_level: 3 });
    }
    // navigation handled automatically by onAuthStateChange in _layout.tsx
    setLoading(false);
  }

  function clearError() {
    if (error) setError(null);
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
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <TextInput
            style={styles.input}
            placeholder="Prénom ou pseudo"
            placeholderTextColor={colors.ink[300]}
            value={username}
            onChangeText={(v) => { setUsername(v); clearError(); }}
            selectionColor={colors.ice[600]}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.ink[300]}
            value={email}
            onChangeText={(v) => { setEmail(v); clearError(); }}
            autoCapitalize="none"
            keyboardType="email-address"
            selectionColor={colors.ice[600]}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor={colors.ink[300]}
            value={password}
            onChangeText={(v) => { setPassword(v); clearError(); }}
            secureTextEntry
            selectionColor={colors.ice[600]}
          />
          <PressableScale
            onPress={handleRegister}
            disabled={loading}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>
              {loading ? "CRÉATION…" : "CRÉER MON COMPTE"}
            </Text>
          </PressableScale>
        </View>

        <Link href="/auth/login" asChild>
          <PressableScale style={styles.footer}>
            <Text style={styles.footerText}>
              Déjà un compte ?{" "}
              <Text style={styles.footerLink}>Se connecter</Text>
            </Text>
          </PressableScale>
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

  errorBanner: {
    borderLeftWidth: 2,
    borderLeftColor: "#C0392B",
    backgroundColor: "#F2F0EC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  errorText: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#C0392B",
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
