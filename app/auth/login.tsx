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
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert("Erreur", error.message);
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const redirectUri = makeRedirectUri({ path: "auth/callback" });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUri, skipBrowserRedirect: true },
    });

    if (error || !data.url) {
      Alert.alert("Erreur", error?.message ?? "Google sign-in unavailable");
      setGoogleLoading(false);
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    if (result.type === "success" && result.url) {
      const url = new URL(result.url);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
        if (sessionError) Alert.alert("Erreur", sessionError.message);
      }
    }

    setGoogleLoading(false);
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        {/* Brand */}
        <View style={styles.brand}>
          <Text style={styles.logo}>frileuse</Text>
          <Text style={styles.tagline}>habille-toi pour le froid</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
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
            onPress={handleLogin}
            disabled={loading || googleLoading}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>
              {loading ? "CONNEXION…" : "SE CONNECTER"}
            </Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={handleGoogleLogin}
            disabled={loading || googleLoading}
            style={({ pressed }) => [styles.btnGoogle, pressed && styles.btnGooglePressed]}
          >
            <Text style={styles.btnGoogleText}>
              {googleLoading ? "Connexion…" : "Continuer avec Google"}
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <Link href="/auth/register" asChild>
          <Pressable style={styles.footer}>
            <Text style={styles.footerText}>
              Pas encore de compte ?{" "}
              <Text style={styles.footerLink}>S'inscrire</Text>
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
  logo: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 56,
    color: "#0F0F0D",
    letterSpacing: -1,
    lineHeight: 56,
  },
  tagline: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    color: "#9E9A96",
    marginTop: 6,
    letterSpacing: 0.5,
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

  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E8E5DF" },
  dividerText: {
    fontFamily: "Jost_400Regular",
    fontSize: 13,
    color: "#9E9A96",
  },

  btnGoogle: {
    borderWidth: 1,
    borderColor: "#E8E5DF",
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: "#F2F0EC",
  },
  btnGooglePressed: { backgroundColor: "#E8E5DF" },
  btnGoogleText: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#6B6A66",
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
