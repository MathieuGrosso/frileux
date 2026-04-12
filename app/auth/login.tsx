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
import { LinearGradient } from "expo-linear-gradient";
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
    const redirectUri = makeRedirectUri({ scheme: "frileuse", path: "auth/callback" });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      Alert.alert("Erreur", error?.message ?? "Google sign-in unavailable");
      setGoogleLoading(false);
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    if (result.type === "success") {
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
      <LinearGradient colors={["#1C1917", "#292524"]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.inner}>

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
            placeholderTextColor="#57534E"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            selectionColor="#F59E0B"
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor="#57534E"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            selectionColor="#F59E0B"
          />

          <Pressable
            onPress={handleLogin}
            disabled={loading || googleLoading}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>
              {loading ? "Connexion..." : "Se connecter"}
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
              {googleLoading ? "Connexion..." : "Continuer avec Google"}
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
  container: { flex: 1, backgroundColor: "#1C1917" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 32, gap: 48 },

  brand: { alignItems: "center" },
  logo: { fontFamily: "Cormorant_600SemiBold", fontSize: 56, color: "#FAFAF9", letterSpacing: -1 },
  tagline: { fontFamily: "DMSans_400Regular", fontSize: 14, color: "#57534E", marginTop: 8, letterSpacing: 0.5 },

  form: { gap: 12 },
  input: {
    backgroundColor: "#292524",
    borderWidth: 1,
    borderColor: "#44403C",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: "#E7E5E4",
  },
  btn: {
    backgroundColor: "#F59E0B",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
  },
  btnPressed: { backgroundColor: "#D97706" },
  btnText: { fontFamily: "DMSans_700Bold", fontSize: 15, color: "#1C1917" },

  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#44403C" },
  dividerText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: "#57534E" },

  btnGoogle: {
    borderWidth: 1,
    borderColor: "#44403C",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
  },
  btnGooglePressed: { backgroundColor: "#292524" },
  btnGoogleText: { fontFamily: "DMSans_500Medium", fontSize: 15, color: "#E7E5E4" },

  footer: { alignItems: "center" },
  footerText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: "#57534E" },
  footerLink: { fontFamily: "DMSans_500Medium", color: "#F59E0B" },
});
