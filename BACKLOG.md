# BACKLOG — Frileux

Specs exécutables. Lire `CLAUDE.md` avant d'attaquer. Ordre d'exécution en mode nuit : **Tier 2 → Tier 1 → Tier 3 → Tier 4 → Inventées**.

Chaque feature suit le format : *Pourquoi · Scope · Hors scope · Fichiers · Done*.

---

## Tier 2 — Features produit (priorité nuit)

### F6 · Anti-répétition garde-robe
- **Pourquoi** : ne pas suggérer 3 jours de suite le même pull. Cœur de la promesse matinale.
- **Scope** :
  - Côté client : récupérer les `outfits.worn_description` des 7 derniers jours du user.
  - Les passer à l'edge `suggest-outfit` dans le payload (`recent_worn: string[]`).
  - Modifier le prompt Claude pour exclure explicitement les pièces récentes.
- **Hors scope** : UI qui visualise l'historique (juste l'effet sur la suggestion).
- **Fichiers** : `app/(tabs)/index.tsx`, `lib/supabase` (helper `getRecentWorn`), `supabase/functions/suggest-outfit/index.ts`.
- **Done** : porter manuellement un item J et J+1 → suggestion J+2 ne le mentionne plus. Vérif via console + test sur sim iOS.

### F7 · Fenêtre météo journalière
- **Pourquoi** : la temp actuelle ne suffit pas si journée évolutive (pluie 19h).
- **Scope** :
  - Endpoint `forecast` OpenWeatherMap (3h granularity).
  - Extraire 3 créneaux : matin (~9h), midi (~13h), soir (~19h).
  - Affichage sous la temp principale, micro-typo Jost 11px tracking-widest, pastilles `text-ice`.
- **Hors scope** : pluie/vent détaillés (juste temp).
- **Fichiers** : `lib/weather.ts`, `app/(tabs)/index.tsx`.
- **Done** : visible sur Today, format `9° · 14° · 11°` ou similaire, mis à jour avec géoloc.

### F8 · Score de confort perso
- **Pourquoi** : `coldness_level` (1–5) existe en DB mais aucun feedback visuel utilisateur.
- **Scope** :
  - Helper pur `lib/comfort.ts` : `comfortLabel(perceivedTemp, coldness): { label, tone }`.
  - Offsets : `{1: -2, 2: -1, 3: 0, 4: +1, 5: +2}` (frileuse = +2 ressenti froid).
  - Labels FR courts : « Doux pour toi », « Correct », « Tu vas avoir froid », « Glacial pour toi ».
  - Affichage en sous-ligne sous la temp.
- **Fichiers** : `lib/comfort.ts` (nouveau), `app/(tabs)/index.tsx`, `app/settings.tsx` (changer coldness → label change).
- **Done** : changer coldness 1↔5 dans settings → label visible bouge sur Today.

### F9 · Notif veille (J-1 21h)
- **Pourquoi** : préparation mentale → moins de friction matin.
- **Scope** :
  - Étendre `daily-notification` avec un second cron 21h local user.
  - Récupère forecast J+1 (températures min/midi/max).
  - Envoie push : `Demain · 12° · laine légère + manteau court` (générée par `suggest-outfit` light).
- **Hors scope** : personnalisation horaire (fix 21h), choix opt-in (reprise du toggle existant si présent).
- **Fichiers** : `supabase/functions/daily-notification/index.ts`.
- **Done** : déclenchement manuel `supabase functions invoke` → notif reçue sur device test (iOS).

### F10 · Spike widget lock screen iOS
- **Pourquoi** : réponse sans ouvrir l'app = idéal matin.
- **Scope** : **document seul**, pas de code. Évaluer faisabilité via `expo-apple-targets` ou config plugin tiers (`expo-widget-extensions`).
- **Fichiers** : `docs/spike-widget.md`.
- **Done** : doc avec verdict go/no-go + estimation effort + risques EAS Build.

---

## Tier 1 — Polish & quick wins

### F1 · Composant `<EmptyState />`
- **Scope** : composant typographique (Barlow 32 ink-900 / Jost 14 ink-500 / CTA `text-ice underline`). Props `title`, `subtitle?`, `cta?: { label, onPress }`.
- **Fichiers** : `components/EmptyState.tsx`, usage dans `app/(tabs)/history.tsx`, `app/(tabs)/circle.tsx`, et écran wardrobe vide.
- **Done** : 3 écrans vides utilisent le composant, zéro hex en dur.

### F2 · `<Skeleton />` loaders
- **Scope** : bandes `bg-ink-100` animées (opacity 0.4↔0.8, 1s loop). Variantes `line | block | circle`.
- **Fichiers** : `components/Skeleton.tsx`, intégration dans `app/(tabs)/index.tsx` (zone weather + suggestion).
- **Done** : plus de flash blanc au cold load.

### F3 · Refonte hiérarchie Today
- **Scope** : ordre vertical strict — date+ville (micro caps) / temp géante Barlow 96px / suggestion 2 lignes max / actions secondaires sous la fold.
- **Fichiers** : `app/(tabs)/index.tsx`.
- **Done** : sur iPhone 13, la suggestion est **au-dessus de la fold**.

### F4 · Transitions de pages
- **Scope** : `Stack.Screen options={{ animation: 'fade', animationDuration: 160 }}` sur les routes principales (outfit/[id], settings, onboarding/*).
- **Fichiers** : `app/_layout.tsx`, `app/(tabs)/_layout.tsx`.
- **Done** : plus de slide iOS par défaut, fade subtil partout.

### F5 · Tokens typographiques
- **Scope** : ajouter dans `tailwind.config.js` :
  ```js
  fontSize: {
    'display-xl': ['96px', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
    'display':    ['64px', { lineHeight: '1.0',  letterSpacing: '-0.02em' }],
    'h1':         ['32px', { lineHeight: '1.1',  letterSpacing: '-0.01em' }],
    'h2':         ['24px', { lineHeight: '1.2' }],
    'body':       ['15px', { lineHeight: '1.5' }],
    'caption':    ['13px', { lineHeight: '1.4' }],
    'micro':      ['11px', { lineHeight: '1.3', letterSpacing: '0.08em' }],
  }
  ```
- **Fichiers** : `tailwind.config.js`. Refactor opportuniste de 5+ usages `text-[Npx]`.
- **Done** : grep `text-\[\d` retourne moins de 3 occurrences justifiées.

---

## Tier 3 — Infra & qualité

### F11 · `lib/theme.ts`
- Miroir JS du Tailwind config (couleurs, fontSizes) pour usages `Animated`/`StatusBar`/native modules.
- **Done** : zéro hex dupliqué entre TS et Tailwind.

### F12 · Hook `useWeather`
- Extraire géoloc + fetch + cache + erreurs dans `hooks/useWeather.ts`. Retourne `{ data, loading, error, refresh }`.
- **Done** : `app/(tabs)/index.tsx` n'a plus de `useEffect` lié à la météo.

### F13 · Garde-fou anti-hex
- Script `scripts/check-hex.sh` qui grep `#[0-9a-fA-F]{6}` dans `app/`+`components/` et exit 1 si hit. Ajouter au `package.json` : `"lint:colors": "..."`.
- **Done** : `npm run lint:colors` vert sur le repo actuel (après nettoyage si besoin).

---

## Tier 4 — Refactors lents

### F14 · Décomposer Today
- `components/today/{WeatherBlock,SuggestionBlock,PhotoBlock}.tsx`. Orchestrateur mince dans `app/(tabs)/index.tsx`.
- **Done** : `index.tsx` < 80 lignes.

### F15 · Décomposer onboarding/swipe
- Même logique, extraire `<SwipeCard>` + `<SwipeStack>` réutilisables.
- **Done** : screen swipe < 100 lignes.

---

## Inventées (à enrichir pendant la nuit)

> Section vivante : quand le backlog est épuisé, ajouter ici de nouvelles features alignées avec §1 du `CLAUDE.md`. Ne pas s'arrêter.

### Idées de départ (non spécifiées, à scoper avant exécution)
- **Mode « lookbook du jour »** : carrousel d'1–3 références éditoriales (images du wardrobe user) qui matchent la météo.
- **Capsule saisonnière auto** : à mi-saison, l'app propose d'archiver les pièces hors-saison du wardrobe.
- **Historique typé** : filtrer history par météo (« mes tenues quand il faisait < 10° »).
- **Vue garde-robe stats** : pièces les plus/moins portées, items oubliés > 30 jours.
- **Export tenue** : screenshot stylisé partageable (cadre éditorial, météo + temp + tenue), pour les circles.
- **Recherche météo passée** : « qu'est-ce que je portais le 14 février ? ».
- **Mode voyage** : entrer une ville → suggestions adaptées au climat de destination pour les jours à venir.
- **Pondération acceptation** : si l'utilisateur rejette systématiquement les suggestions à manches courtes en mai, ajuster les futures.
- **Diff jour précédent** : « Hier 9°, aujourd'hui 14° → tu peux alléger ».
