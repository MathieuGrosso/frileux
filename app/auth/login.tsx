import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/components/BrandLogo";
import { mapAuthError } from "@/lib/auth-errors";
import { colors } from "@/lib/theme";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(mapAuthError(err));
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);

    if (Platform.OS === "web") {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (err) setError(mapAuthError(err));
      setGoogleLoading(false);
      return;
    }

    const redirectUri = makeRedirectUri({ path: "auth/callback" });

    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUri, skipBrowserRedirect: true },
    });

    if (err || !data.url) {
      setError(err ? mapAuthError(err) : "Google indisponible pour le moment.");
      setGoogleLoading(false);
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    if (result.type === "success" && result.url) {
      const url = new URL(result.url);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
        if (sessionError) setError(mapAuthError(sessionError));
      }
    }

    setGoogleLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <BrandLogo size="lg" />
          <Text style={styles.tagline}>habille-toi pour le froid</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.ink[300]}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (error) setError(null);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            selectionColor={colors.ice[600]}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor={colors.ink[300]}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) setError(null);
            }}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            selectionColor={colors.ice[600]}
          />

          <PressableScale
            onPress={handleLogin}
            disabled={loading || googleLoading}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>
              {loading ? "CONNEXION…" : "SE CONNECTER"}
            </Text>
          </PressableScale>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <PressableScale
            onPress={handleGoogleLogin}
            disabled={loading || googleLoading}
            style={({ pressed }) => [styles.btnGoogle, pressed && styles.btnGooglePressed]}
          >
            <View style={styles.googleIcon}>
              <Text style={styles.googleIconText}>G</Text>
            </View>
            <Text style={styles.btnGoogleText}>
              {googleLoading ? "Connexion…" : "Continuer avec Google"}
            </Text>
          </PressableScale>
        </View>

        <Link href="/auth/register" asChild>
          <PressableScale style={styles.footer}>
            <Text style={styles.footerText}>
              Pas encore de compte ?{" "}
              <Text style={styles.footerLink}>S'inscrire</Text>
            </Text>
          </PressableScale>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAFAF8" },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 48,
  },

  brand: { alignItems: "flex-start" },
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

  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E8E5DF" },
  dividerText: { fontFamily: "Jost_400Regular", fontSize: 12, color: "#C5C2BC" },

  btnGoogle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E5DF",
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  btnGooglePressed: { backgroundColor: "#F5F3EF" },
  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 2,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Jost_600SemiBold",
    lineHeight: 14,
  },
  btnGoogleText: {
    fontFamily: "Jost_400Regular",
    fontSize: 14,
    color: "#3C3A36",
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
  footerText: { fontFamily: "Jost_400Regular", fontSize: 14, color: "#9E9A96" },
  footerLink: { fontFamily: "Jost_500Medium", color: "#637D8E" },
});
