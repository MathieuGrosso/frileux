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

## Déploiement

### Web (live) — https://frileuse.expo.app

Hébergé sur **EAS Hosting**. Deux étapes : export statique puis deploy.

```bash
# 1. Build le bundle web dans dist/
npx expo export -p web

# 2. Push + promote en prod
eas deploy --prod
```

Le CLI renvoie une URL de déploiement unique (`frileuse--xxxx.expo.app`) + promeut sur la prod `frileuse.expo.app`. Pour un preview sans écraser la prod :

```bash
eas deploy           # sans --prod → URL de preview uniquement
```

Dashboard des déploiements : https://expo.dev/accounts/batmat9/projects/frileuse/hosting/deployments

Native modules (caméra, géoloc, notifs) dégradés sur web — fallbacks navigateur.

### Partage rapide via Expo Go (sans compte Apple)

Ami sur le même WiFi :
```bash
npx expo start
```

Ami à distance (nécessite ngrok dispo) :
```bash
npx expo start --tunnel
```

L'ami installe **Expo Go** depuis l'App Store, scanne le QR. Ton Mac doit rester allumé.

### EAS Update (preview / dev clients)

```bash
eas update --branch preview --message "..."
```

Pousse un nouveau bundle JS aux builds dev/preview installés. Ne crée pas de nouveau binaire.

### iOS TestFlight

Pré-requis : compte **Apple Developer** validé (99 €/an, enrollment sur https://developer.apple.com/programs/enroll/, Individual, validation 24–48h).

```bash
eas credentials                                       # une seule fois — EAS gère certif + provisioning
eas build --platform ios --profile production         # ~15–20 min sur serveurs Expo
eas submit --platform ios --latest                    # upload App Store Connect
```

Ensuite sur **App Store Connect → TestFlight** : remplir la fiche test, ajouter testeurs internes par email Apple, ils reçoivent l'invit.

### Profils EAS Build

Définis dans [`eas.json`](./eas.json) :

- `development` — dev client + simulateur iOS
- `preview` — build ad-hoc, distribution interne (UDID requis)
- `production` — store, auto-increment `buildNumber`

### Bump version

- `app.json` → `expo.version` (user-facing, ex: `1.0.0`)
- `app.json` → `expo.ios.buildNumber` (auto-incrémenté en profile production)

Voir [`DEPLOY.md`](./DEPLOY.md) pour les commandes courtes.

