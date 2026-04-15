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
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/components/BrandLogo";
import { mapAuthError } from "@/lib/auth-errors";
import { colors } from "@/lib/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(mapAuthError(err));
    setLoading(false);
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

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>
              {loading ? "CONNEXION…" : "SE CONNECTER"}
            </Text>
          </Pressable>
        </View>
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
});
