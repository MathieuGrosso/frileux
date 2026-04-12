# frileux

App mobile pour les gens qui ont toujours froid. Suggestions de tenues IA + journal photo quotidien + cercle d'amis.

## Stack

- **Expo** (SDK 54) + React Native + TypeScript
- **NativeWind** (Tailwind CSS pour React Native)
- **Supabase** — Auth, Database (PostgreSQL), Storage, Edge Functions, Realtime
- **OpenWeatherMap** — Météo locale via GPS
- **Claude API** — Suggestions de tenues IA (via Supabase Edge Function)

## Fonctionnalités

- **Météo du matin** — GPS automatique + température ressentie, pluie, vent
- **Suggestion IA** — Tenue adaptée à la météo et ton niveau de frilosité (1-5)
- **Photo du jour** — Caméra ou galerie, sauvegardée dans Supabase Storage
- **Notation** — Note tes tenues de 1 à 5 étoiles avec notes libres
- **Historique** — Feed chronologique filtrable par note (top looks)
- **Cercle privé** — Invite tes amis par code, vois leurs tenues du jour

## Setup

```bash
# Installer les dépendances
npm install

# Copier les variables d'environnement
cp .env.example .env
# Remplir EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_OPENWEATHER_API_KEY

# Lancer le dev server
npx expo start
```

### Supabase

1. Crée un projet sur [supabase.com](https://supabase.com)
2. Exécute la migration : `supabase/migrations/001_initial_schema.sql`
3. Déploie la Edge Function : `supabase functions deploy suggest-outfit`
4. Ajoute `ANTHROPIC_API_KEY` dans les secrets de la Edge Function

## Structure

```
app/                    # Expo Router (file-based routing)
├── _layout.tsx         # Auth guard + providers
├── auth/               # Login / Register
├── (tabs)/             # Tab navigator
│   ├── index.tsx       # Aujourd'hui (météo + suggestion + photo)
│   ├── history.tsx     # Historique des tenues
│   └── circle.tsx      # Cercle privé
├── outfit/[id].tsx     # Détail d'une tenue
└── settings.tsx        # Profil + niveau frilosité

components/             # Composants réutilisables
lib/                    # Supabase client, API météo, types
supabase/               # Migrations + Edge Functions
```
