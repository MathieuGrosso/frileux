# CLAUDE.md — Frileux

Instructions projet pour Claude Code. À lire **en entier** avant toute action sur ce repo. Ces règles supplantent les défauts.

---

## §1 Mission & ton produit

**Frileux** = app mobile (Expo) qui répond, en un regard et chaque matin, à la question « **quoi porter aujourd'hui ?** ».

- **Utilisateurs** : 20–30 ans, fashion-conscious. Lisent Hypebeast, achètent sur Ssense, suivent Highsnobiety.
- **Contexte d'usage** : matin, au lit, à moitié réveillés. Charge cognitive faible. Portrait mobile uniquement.
- **Objectif émotionnel** : outil éditorial haut de gamme. **Pas** un widget météo, **pas** une app consumer friendly.
- **Trois mots brand** : *clinique, tranchant, précis*.

Si une décision produit hésite, trancher en faveur de la **précision** et de la **vitesse de lecture**, jamais de la chaleur ou de la pédagogie.

---

## §2 Design system — non négociable

### Palette (définie dans `tailwind.config.js`)
- `paper` `#FAFAF8` — fond principal (off-white tiède)
- `ink-900` `#0F0F0D` → `ink-100` — typo et hiérarchie
- `ice` `#637D8E` — **seul accent**, bleu-pierre froid
- Sémantiques : `success`, `error`, `warning` (usage rare)

### Typo
- **Display** : `Barlow Condensed` 600, `tracking-tight`
- **Body** : `Jost` 400 → 600
- Tailles : passer par tokens Tailwind (voir F5 dans `BACKLOG.md`). Pas de `text-[28px]` dispersés.

### Règles dures
- **Jamais de hex en dur** dans `/app` ou `/components`. Toujours via tokens (`bg-paper`, `text-ink-900`, `text-ice`).
- **Sharp corners** : `rounded-none` par défaut, `rounded-sm` exceptionnellement. Jamais `rounded-full`, `rounded-xl`, `rounded-2xl`.
- **Pas de gradient.** Pas de drop-shadow décorative. Pas de glassmorphism.
- **Pas de carte dans une carte.** Pas de pill arrondi. Pas de hero image avec overlay text.
- **Light mode uniquement.** Dark mode = hors scope.

### Motion
- Reanimated ou Animated, transitions **< 200ms**, `Easing.out(Easing.cubic)`.
- Pas de spring bounce. Pas de wobble. Une transition = une page qui tourne, pas un menu qui s'ouvre.

### Anti-références (à refuser même si demandé en langage flou)
Apps météo grand public, Shein/Zara/H&M, dashboards SaaS colorés, tout ce qui ressemble à du Material Design.

### Références positives
Muji, System magazine, Ssense product UI, signage combini japonais (Lawson/7-Eleven JP).

---

## §3 Stack & conventions code

- **Expo 54**, **React Native 0.81**, **TypeScript 5.9 strict**.
- **NativeWind 4** — styling exclusivement via `className=`. Pas de `StyleSheet.create` sauf animations impératives qui l'exigent.
- **Expo Router 6** — file-based routing. Pas de navigation impérative hors `router.push/replace/back`.
- **Composants fonctionnels** uniquement, hooks colocalisés.
- **Texte UI en français** (copy, erreurs, placeholders). Le code et les commentaires en anglais sont OK.
- **Nommage** : `PascalCase` composants, `camelCase` hooks/utils.
- **Pas de `any`** implicite. Si nécessaire, `unknown` + narrowing.
- **Pas de console.log** committé (`console.warn`/`error` OK pour erreurs gérées).
- **Pas de commentaires** sauf si le *pourquoi* est non-évident.

---

## §4 Données — Supabase

- **Tables existantes** : `profiles`, `outfits`, `wardrobe_items`, `outfit_preferences`, `circles`, `circle_members`. RLS activée partout.
- **Toute mutation** passe par le client `lib/supabase`. Pas de `fetch` direct vers l'URL Supabase.
- **Edge Functions** : seuls endroits qui appellent Claude/Gemini. Clés API jamais côté client.
- **Migrations** : numérotées (`007_*.sql` prochain). Toute nouvelle table doit avoir RLS-on dès la migration.
- **Storage** : paths préfixés `user_id/` pour respecter les policies RLS.

---

## §5 Routing & navigation

```
app/
├── _layout.tsx            # Auth guard + redirection onboarding
├── (tabs)/                # 5 onglets canoniques
│   ├── index.tsx          # AUJOURD'HUI — la réponse matinale
│   ├── wardrobe.tsx       # GARDE-ROBE — pièces possédées
│   ├── gout.tsx           # GOÛT — hub de self-curation (Œil / duels / mémoire / marques / swipes)
│   ├── history.tsx        # HISTORIQUE
│   └── feed.tsx           # FEED — social
├── eye/{index,[id]}.tsx   # L'ŒIL — dépôt d'inspirations externes
├── auth/{login,register}.tsx
├── onboarding/{index,swipe,profile}.tsx
├── outfit/[id].tsx
└── settings.tsx
```

- **5 onglets max** dans la tab bar. iOS bascule en "More" au-delà de 5 — on ne passe jamais cette limite.
- **Tabs = surface principale.** Les 5 existants (AUJOURD'HUI / GARDE-ROBE / GOÛT / HISTORIQUE / FEED) sont stables. **Ajouter ou remplacer un tab = validation produit explicite.**
- Nouvelles vues liées à un tab existant = stack screens enfants, pas de nouvel onglet.
- Pages de détail ou outils secondaires = stack screen au niveau `app/` (ex: `app/eye/`, `app/calibrate.tsx`, `app/memory.tsx`, `app/settings.tsx`) — accessibles via push depuis un tab.
- `_layout.tsx` est la seule source d'auth + redirection onboarding. Ne **jamais** dupliquer cette logique.

---

## §6 Features IA

- **`suggest-outfit`** (Edge Function, Claude) : entrée = `weather + coldness + wardrobe snapshot + récents`. Sortie = tenue + courte rationale.
- **`wardrobe-ai`** (Edge Function, Gemini 2.5-flash) : analyse image → `{type, color, material, style_tags[]}`. Validation JSON côté server obligatoire.
- **`daily-notification`** : cron quotidien.
- **Coût** : batcher les appels. Cacher les suggestions côté client (AsyncStorage, TTL = jour) pour éviter refetch à chaque focus de l'écran.

---

## §7 Performance & médias

- **Listes > 20 items** : `FlashList` ou `FlatList` avec `keyExtractor` stable et `getItemLayout` si possible.
- **Images de tenues** : `expo-image` avec `cachePolicy="memory-disk"` et `contentFit="cover"`. **Pas** de `<Image>` RN de base pour les photos.
- **Re-renders** : `useMemo`/`useCallback` sur les props passées à des enfants mémoïsés. Pas de `useState` qui change à chaque render parent.

---

## §8 Vérif avant de clore une tâche

Obligatoire :
1. `npm run typecheck` → 0 erreur.
2. Lecture du diff : aucun `console.log`, aucun hex en dur, aucun `any` ajouté.
3. Si feature touche caméra/géoloc/notifs → noter dans `NIGHT_LOG.md` qu'un test device est requis (le simulateur ne suffit pas).

Pas de tests automatisés en place — ne pas inventer un setup Jest/Detox sans validation.

---

## §9 Workflow Git

- **Branche par feature** : `feat/<kebab-slug>`. Jamais de commit direct sur `main`.
- **Commit souvent** : dès qu'un sous-ensemble compile et est cohérent, commit. Ne pas accumuler 200 lignes non commitées — risque de perte.
- **Push à chaque commit** sur la branche distante (`git push -u origin <branch>` au premier).
- **PR ouverte systématiquement** dès qu'une feature est utilisable : `gh pr create` avec titre FR + body court (Summary + Test plan). Statut draft OK si en cours.
- Messages **en français**, format `feat(scope): description concise` (ex : `feat(today): add comfort score label`).
- Pas de `--no-verify`, pas de `git reset --hard`, pas de `git push --force` sans confirmation.

---

## §10 Mode exécution autonome (nuit)

Quand l'utilisateur lance une session de travail autonome :

- **Une branche par feature** : `feat/<kebab-slug>` à partir de `main`.
- **Commit fréquent + push à chaque commit** (cf §9). Une perte de session ne doit jamais coûter plus de quelques minutes de travail.
- **Ouvrir la PR dès le premier commit utile** (draft si encore en cours), puis pousser dessus au fur et à mesure.
- Suivre l'ordre du `BACKLOG.md` (Tier 2 d'abord, puis Tier 1, puis Tier 3, puis Tier 4).
- **Une fois le backlog épuisé, inventer de nouvelles features** alignées avec §1 (mission produit). Les écrire dans `BACKLOG.md` section *Inventées*, puis les exécuter. Ne pas s'arrêter.
- **Si une feature bloque** (clé API manquante, schéma incertain, choix produit *réellement* ambigu) : noter dans `NIGHT_LOG.md` (`Bloqué` + `Questions pour toi`) et passer à la suivante. Pour les choix mineurs (copy, micro-UX), trancher en autonomie selon §1 et logger la décision.
- **Mettre à jour `NIGHT_LOG.md` après chaque feature** (Fait / Bloqué / Décisions prises / Questions / Idées suivantes).
- **Garde-fous durs** : ne pas toucher à Auth Supabase, RLS, migrations déjà déployées, `eas.json`, secrets `.env`. Si une de ces zones doit changer → bloqué + log.

---

## §11 Anti-patterns (refus systématique, même demandé vaguement)

- Ajouter une lib UI (MUI, NativeBase, Gluestack, Tamagui, Restyle…) → on reste **NativeWind**.
- Implémenter du dark mode → hors scope.
- Ajouter une dépendance API tierce sans validation produit (analytics, tracking, ads…).
- Dupliquer un composant au lieu de factoriser un existant dans `components/`.
- Remplacer un composant Expo natif par une réimplémentation custom (caméra, location, notifs).
- Introduire Redux/Zustand/Jotai si Context + hooks suffisent.
- Code defensive (try/catch partout, fallbacks pour cas impossibles) — trust the boundaries.

---

## §12 Fichiers de référence

- `BACKLOG.md` — specs des features à attaquer (par tier).
- `NIGHT_LOG.md` — journal des sessions autonomes.
- `DESIGN.md` — référence Linear-inspired (générique, ne supplante pas §2).
- `tailwind.config.js` — source unique des tokens couleur/typo.
- `README.md` — setup et déploiement.
- `DEPLOY.md` — workflow EAS + TestFlight.
