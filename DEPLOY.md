# Deploy — Frileuse

## Partage rapide (Expo Go)

```bash
eas login
eas init                       # première fois seulement — crée le projectId
eas update:configure           # première fois seulement
eas update --branch preview --message "preview"
```

Puis copier le QR code / lien renvoyé, le pote installe **Expo Go** (App Store) et scanne.

## TestFlight (iOS prod)

Pré-requis : compte Apple Developer validé (99 €/an).

```bash
# Une seule fois : EAS gère certif + provisioning auto
eas credentials

# Build prod (15–20 min sur serveurs Expo)
eas build --platform ios --profile production

# Submit à App Store Connect
eas submit --platform ios --latest
```

Ensuite sur **App Store Connect → TestFlight** :
1. Remplir la fiche test (description, email contact)
2. Ajouter les testeurs internes via leur Apple ID
3. Ils reçoivent un mail → ouvrent TestFlight → installent

## Build preview ad-hoc (optionnel, avant prod)

```bash
eas build --platform ios --profile preview
```

Requiert l'UDID de chaque iPhone cible (EAS le demande).

## Bump version

- `app.json` → `expo.version` (user-facing)
- `app.json` → `expo.ios.buildNumber` (incrément à chaque build prod ; auto avec `autoIncrement: true`)
