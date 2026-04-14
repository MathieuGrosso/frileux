import type { AuthError } from "@supabase/supabase-js";

export function mapAuthError(error: AuthError | Error | null | undefined): string {
  if (!error) return "Connexion impossible. Réessaie.";
  const code = "code" in error ? (error as AuthError).code : undefined;
  const msg = (error.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Email non confirmé. Vérifie ta boîte mail.";
  }
  if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("already exists")) {
    return "Un compte existe déjà avec cet email.";
  }
  if (code === "weak_password" || msg.includes("password should be")) {
    return "Mot de passe trop faible (minimum 6 caractères).";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Connexion réseau impossible. Vérifie ta connexion.";
  }
  return "Connexion impossible. Réessaie.";
}
