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
import { supabase } from "@/lib/supabase";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { Alert.alert("Erreur", error.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("profiles").insert({ id: data.user.id, username, coldness_level: 3 });
    }
    Alert.alert("Bienvenue !", "Ton compte a été créé.");
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1C1917", "#292524"]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.inner}>

        <View style={styles.brand}>
          <Text style={styles.logo}>frileuse</Text>
          <Text style={styles.tagline}>crée ton compte</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input} placeholder="Prénom ou pseudo" placeholderTextColor="#57534E"
            value={username} onChangeText={setUsername} selectionColor="#F59E0B"
          />
          <TextInput
            style={styles.input} placeholder="Email" placeholderTextColor="#57534E"
            value={email} onChangeText={setEmail} autoCapitalize="none"
            keyboardType="email-address" selectionColor="#F59E0B"
          />
          <TextInput
            style={styles.input} placeholder="Mot de passe" placeholderTextColor="#57534E"
            value={password} onChangeText={setPassword} secureTextEntry selectionColor="#F59E0B"
          />
          <Pressable
            onPress={handleRegister} disabled={loading}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>{loading ? "Création..." : "Créer mon compte"}</Text>
          </Pressable>
        </View>

        <Link href="/auth/login" asChild>
          <Pressable style={styles.footer}>
            <Text style={styles.footerText}>
              Déjà un compte ? <Text style={styles.footerLink}>Se connecter</Text>
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
  tagline: { fontFamily: "DMSans_400Regular", fontSize: 14, color: "#57534E", marginTop: 8 },
  form: { gap: 12 },
  input: {
    backgroundColor: "#292524", borderWidth: 1, borderColor: "#44403C", borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 16, fontFamily: "DMSans_400Regular", fontSize: 15, color: "#E7E5E4",
  },
  btn: { backgroundColor: "#F59E0B", borderRadius: 12, paddingVertical: 18, alignItems: "center", marginTop: 8 },
  btnPressed: { backgroundColor: "#D97706" },
  btnText: { fontFamily: "DMSans_700Bold", fontSize: 15, color: "#1C1917" },
  footer: { alignItems: "center" },
  footerText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: "#57534E" },
  footerLink: { fontFamily: "DMSans_500Medium", color: "#F59E0B" },
});
