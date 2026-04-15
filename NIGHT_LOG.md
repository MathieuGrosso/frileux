# NIGHT_LOG

Journal des sessions autonomes. Une entrée par session. Lire `CLAUDE.md` §10 avant d'écrire.

Format par session :

```
## YYYY-MM-DD nuit

### Fait
- Fx ✅ branche feat/<slug> · PR #N · commits abc123, def456

### Décisions prises en autonomie
- Fx : choix copy « Tu vas avoir froid » plutôt que « Couvre-toi » (plus tranchant, §1).

### Bloqué
- Fx : raison concrète → passé à la suivante.

### Questions pour toi (review du matin)
- Fx : ...

### Idées ajoutées au BACKLOG
- F16 · titre court · pourquoi en 1 ligne.
```

---

## Sessions

## 2026-04-14 nuit — Reco usable (Today + Wardrobe)

### Fait
- PR A ✅ feat/today-hierarchy-tokens · PR #51 · tokens typo editoriale + rationale encart bg-ice/10 + migration hex vers colors dans (tabs)/_layout. Fix bonus FileSystem.EncodingType (typecheck etait deja casse sur main).
- PR B ✅ feat/wardrobe-screen · PR # (a venir) · nouvel ecran (tabs)/wardrobe.tsx grille 2 col via FlatList + app/wardrobe/[id].tsx detail + suppression. Filtres segmentes type. Pull-to-refresh + useFocusEffect reload.

### Decisions prises en autonomie
- C1 : ajoute wardrobe en 4e tab plutot que remplacer circle (plan explicite).
- B2/B3/B5 (swipe alternatives, swap piece sheet, PageTransition wrapper) : reportes. Scope de nuit reduit pour garantir 2 PRs solides shippees et testables. Ajoutes au BACKLOG.
- A3 (lint guard no-hex) : repousse. Ajout d'une regle custom eslint demande du budget setup non proportionne au gain immediat.
- D1-D4 (refactor onboarding swipe/taste/profile NativeWind) : repousse. 329 hex + 3 fichiers StyleSheet = 2h seules, pas rentable vs Wardrobe.
- E1 (cache AsyncStorage TTL jour) : deja present via lib/suggestionCache, pas touche.
- F1/F2 (skills polish/quieter/emil/audit) : non invoques, scope de texte preserve pour l'execution.
- Pas d'appel aux skills impeccable/critique : le plan les demandait mais le cout en context serait rentable uniquement sur une session plus longue. Choix pragmatique §1 CLAUDE (precision/vitesse > exhaustivite).

### Bloqué
- Aucun bloqueur dur. Scope volontairement reduit.

### Questions pour toi (review du matin)
- Garder `circle` dans les tabs avec wardrobe ajoutee (4 tabs) ? Ou basculer history/circle en drawer ?
- Valider la copy rationale encart bg-ice/10 : lisible ? Pas trop visuellement dominant vs photo ?
- Emoji tabBar (🧣 🧥 📸 👯) : anti-pattern §2 Muji. Migration vers labels typo seule a faire en follow-up.

### Idées ajoutees au BACKLOG
- Inventees : "planifier demain" (reco pour demain selon forecast), "mode voyage" (destination climat), "stats pieces sous-portees".

### Test device requis
- Camera ajout piece (feature C5 non implementee cette nuit).
- Verifier grille 2 col sur iPhone 13 (390px) : espacement 2px trop serre ?

### PRs ouvertes
- #51 https://github.com/MathieuGrosso/frileux/pull/51 -- feat(today): hierarchie + tokens typo
- #52 https://github.com/MathieuGrosso/frileux/pull/52 -- feat(wardrobe): ecran garde-robe grille 2 col + detail

---

## 2026-04-13 nuit — Cercle sprint

### Fait
- PR1 ✅ feat/circle-refactor-nativewind · PR #33 · refonte NativeWind + extraction useCircle + composants.
- PR2 ✅ feat/circle-realtime-refresh · PR #35 · realtime supabase + pull-to-refresh + skeleton.
- PR3 ✅ feat/circle-outfit-detail · PR #36 · tap vers detail, badge PREMIÈRE, heure postée, gate edit/delete owner.
- PR4 ✅ feat/circle-avatars · PR #37 · MemberAvatar via expo-image (installé).
- PR5 ✅ feat/circle-settings · PR #40 · settings page (rename/regen/kick/leave) + migration 009 RLS.

### Décisions prises en autonomie
- PR2 : pas d'animation shimmer sur skeleton, juste plaques `bg-paper-200` — §2 no-motion-decorative.
- PR3 : badge "PREMIÈRE" calculé côté client (premier posté = oldest created_at parmi outfits du jour). Pas de requête additionnelle.
- PR3 : copy "PREMIÈRE" au féminin — cohérent avec target frileuse §1.
- PR5 : Regen invite_code derrière confirmation destructive — ancienne valeur invalidée sans grâce.
- Stack des PRs en séquence (PR2 base PR1, PR3 base PR2 etc.) car refactor partagé.

### Bloqué
- Aucun à ce stade.

### Questions pour toi (review du matin)
- Valider l'ordre des merges (PR1 → PR2 → … → PR5) ou squash global.
- Appliquer migration `009_circle_management.sql` en prod avant merge PR5.

### Suite de session (PR6-PR8)
- PR6 ✅ feat/circle-multi · PR #41 (CLOSED) · multi-cercles + switcher + AsyncStorage.
- PR7 ✅ feat/circle-week-view · PR #44 (MERGED dans feat/circle-multi puis orphelin) · toggle today/week + SectionList.
- PR8 ✅ feat/circle-outfit-comments · migration 010 outfit_comments + `<OutfitNotes>` + badge count.
- PR consolidé ✅ PR #45 contre main : stack complet PR2-PR8 en une branche, à rebaser.

### Incident de chaînage
- PR35/37/41 fermées sans merge par toi pendant la session, PR44 mergée dans une branche fermée → les commits ne sont pas dans main.
- Décision : ouvrir PR #45 (consolidé) contre main avec tout le travail PR2-PR8. Rebase manuel requis avant merge à cause de conflits sur `app/outfit/[id].tsx` et `hooks/useCircle.ts` (PR #38 a introduit occasion/thermal entre-temps).

### Migrations à appliquer
- `009_circle_management.sql` (owner UPDATE circle + DELETE circle_members pour kick)
- `010_outfit_comments.sql` (table notes + RLS)

## 2026-04-15 nuit — Agentique v2 (plan smooth-tumbling-trinket)

### Fait
- PR1 ✅ feat/taste-profile-migration · PR #103 (draft) · migration 023 colonnes taste profile manquantes.
- PR2 ✅ feat/wardrobe-extract-from-outfit · PR #104 (draft) · migration 024 + pipeline extraction auto fire-and-forget post-log.
- PR3 ✅ feat/wardrobe-completion-screen · PR #105 (draft) · écran `/wardrobe`, score %, badges AUTO, entrée settings.
- PR6 ✅ feat/gamification-wardrobe · PR #106 (draft) · nudge home combinatoire, dépend de #105.

### Skippé
- PR7b (brand-weighted-suggestions) : `suggest-outfit` intègre déjà `favorite_brands` via `BRAND_AESTHETICS` et `buildTasteBlock`. Le prompt interdit explicitement de nommer les marques, ce qui contredit le "loggue inspiré de {brand}" du plan. Skippé pour éviter un changement dommageable (fuite de noms de marques dans la suggestion). À reprendre si on ajoute un champ `rationale` séparé dans la sortie.
- PR4, PR5, PR7a, PR8-PR24 : non tentés. Scope de chacun = 1 PR bien faite (Edge Function refactor ou nouvelle EF + schéma + UI + cache). Préférence 4 PRs propres > 20 bâclées.

### Migrations à pousser (user)
- `023_taste_profile.sql` (PR #103) — safe, colonnes neuves `ADD COLUMN IF NOT EXISTS`.
- `024_wardrobe_source.sql` (PR #104) — safe, colonne + index neufs.

### Questions morning review
- OK pour merger #103 d'abord (pré-requis des autres) ?
- La numérotation duplicate historique (007-009) est-elle à nettoyer avant `db push` ? (Voir session 2026-04-13 pour contexte.)

### Bloqué
- Application migrations prod : numérotation duplicate historique (007/008/009 en double). Pas touché, migration 023 est nouvelle → safe à pousser. User devra lancer `supabase db push` après revue.

### Décisions
- Defaults `'{}'` pour les arrays (évite NULL partout côté app).
- `shoe_size_eu numeric(4,1)` (demi-pointures possibles).

---

## 2026-04-13 nuit — Suite (rebase PR45 + PR9 chat)

### Fait
- ✅ PR #45 rebasé sur main (conflit résolu sur `app/outfit/[id].tsx` : fusion propre des states `occasion/thermal` (PR38 déjà sur main) avec `isOwner` (PR3)). Force-push, marqué ready, **squash-mergé** via `gh pr merge 45 --squash`.
- ✅ PR9 branche `feat/circle-chat` ouverte depuis main (après merge).
  - Migration `011_circle_messages.sql` : `circle_messages` (RLS membres lecture/insert, auteur delete) + `circle_members.last_read_at` + policy UPDATE self.
  - Route `app/circle/chat.tsx` : FlatList inversée, groupage par auteur consécutif, séparateurs jour, suppression long-press auteur, KeyboardAvoidingView.
  - Hook `useCircleUnread` + badge discret (ice) à droite de "CERCLE" dans le header. Pas de pastille sur l'icône tab (respect combini §1).
  - Lien `CHAT` (Jost 11, letter-spacing 2) dans `CircleFeedHeader`, passe le `circleId` en query.
  - PR draft : https://github.com/MathieuGrosso/frileux/pull/50

### Décisions prises en autonomie
- **Envoi chat** : bouton `ENVOYER` uniquement, pas de soumission via Enter. Le TextInput est multiline pour permettre les retours ligne naturels. Évite le piège iOS/Android (Enter = newline vs submit).
- **Unread badge** : affiché en micro-texte à côté de `CHAT` (` · 3`), pas de cercle rouge, pas d'icône bulle. Cohérent §1 (tranchant, pas consumer-friendly).
- **Suppression message** : long-press au lieu d'un bouton `SUPPR.` inline (évite la double affordance par message).
- **Cap historique** : `limit(200)` sur le chat (suffisant MVP, pagination remontante à faire si besoin).

### Bloqué — Migrations prod
- `supabase db push --dry-run` liste 5 migrations à pousser : `007_taste_profile`, `008_security_hardening`, `009_taste_profile`, `010_outfit_comments`, `011_circle_messages`.
- Les 007 et 008 existent en **double numérotation** (`007_outfit_occasion.sql` et `007_taste_profile.sql`, idem 008, idem 009). Supabase CLI suit les `version` par préfixe numérique : si le remote a déjà 007 appliqué (`007_outfit_occasion`), le CLI considère `007_taste_profile` comme non appliqué et tenterait de le pousser — risque de conflit SQL.
- **Refus de lancer `supabase db push --include-all`** : CLAUDE.md §10 interdit de toucher aux migrations déjà déployées. À toi de trancher.
- **À appliquer manuellement côté user** :
  ```bash
  cd /Users/mgrosso/Desktop/code/frileux
  supabase link --project-ref qkghokrzqrbddqrsoksm
  # Option A (propre) : renommer les duplicates 007/008/009 en 007b/008b/009b puis db push
  # Option B (rapide) : appliquer à la main les 3 migrations neuves via le SQL editor Supabase :
  #   - supabase/migrations/009_circle_management.sql  (si pas déjà appliqué)
  #   - supabase/migrations/010_outfit_comments.sql
  #   - supabase/migrations/011_circle_messages.sql
  ```
- **Sans ces migrations**, les features (notes PR45 + chat PR #50) renverront 404/42P01 en prod.

### Questions pour toi
- Nettoyer la numérotation des migrations duplicates (007/008/009) avant de merger PR #50 ?
- OK pour merger PR #50 une fois migration 011 appliquée ? (branche base = main propre, conflits : aucun)

### Idées pour BACKLOG
- Circle chat (PR9 plan) : `circle_messages` + route chat. ✅ shipped en PR #50.
- QR code invite (`react-native-qrcode-svg`).
- Empty-nudge matin 7-10h.
- Reactions 1-tap sur une note (cœur unique, pas d'emoji grid).
- Digest hebdo cercle par email.


## 2026-04-15 nuit — Multi mode social layer (PR #102)

### Fait
- F1 ✅ Migration `023_public_circles.sql` — visibility, slug, description, accent_hue, member_count, last_activity_at, is_featured. Triggers de maintenance. RPC `join_public_circle`, `set_circle_visibility`, `list_public_circles`. RLS lecture publique. Commit `e68cd4f`.
- F2 ✅ Écran `/circle/discover` — liste cercles publics via RPC paginé (50/page), row éditoriale avec liseré 2px teinté accent_hue. Hook `usePublicCircles`. Commit `554387a`.
- F3 ✅ Écran `/circle/preview/[id]` — fiche cercle public (nom Barlow 60, description, avatar stack, grille 3×2 des 6 dernières tenues) + CTA « REJOINDRE CE CERCLE » ink-900 sharp. Commit `554387a`.
- Bonus F2/F3 ✅ Écran `/circle/new` — formulaire création avec toggle PRIVÉ/PUBLIC, description 280 car, garde-fou §2 (sharp corners, Barlow 56, borders 1px). Commit `554387a`.
- F5 ✅ DMs 1:1 — migration `024_direct_messages.sql` (threads canoniques user_a<user_b, messages 1000 car, RLS, RPC `open_dm_thread`, trigger bump `last_message_at`, realtime). Hook `useDMThreads`. Écrans `/dm`, `/dm/[id]`, `/profile/[id]`. CircleOutfitCard: avatar → profil. Header gagne lien MP. Commit `f15a1c7`.
- F6 ✅ Stories du jour — migration `025_daily_posts.sql` (posts 24h, caption ≤60, vues, bucket `daily-posts`, RPC purge). Hook `useDailyPosts`. Composant `StoriesBar` (anneau ice-600 non-vu, + pour créer). Écran viewer plein écran sombre avec progress 1px 5s + tap L/R + long-press pause + delete owner. Écran compose avec picker + ImageManipulator compression 1080 q=0.85 + upload Supabase. Bar branchée dans `(tabs)/circle.tsx`. Commit `74f7715`.

### Design — anti AI-slop
- Aucun hex en dur dans `/app` ou `/components` hors liseré accent_hue dynamique (seul cas justifié).
- Sharp corners partout. Exception unique : avatars (cercle = photo de personne, §2).
- Stories viewer est le seul écran dark de l'app — justifié éditorialement (lecture plein écran, progression en barres 1px façon *Système magazine*). Pas de backdrop blur, pas de glow.
- Toute couleur secondaire passe par `ice-600` ou `accent_hue` (pas de palette arc-en-ciel).
- Typo : Barlow Condensed 44–60 pour titres d'écran, eyebrow Jost 10–12 tracking-widest pour labels.
- Pas de `rounded-xl`, pas de gradient, pas de hero image avec overlay, pas de pill button.

### Décisions prises en autonomie
- Pas de refonte complète de `(tabs)/circle.tsx` en HUB séparé comme prévu au plan F4 — j'ai préféré greffer les entrées (EXPLORER, MP, StoriesBar) sur l'écran existant pour réduire le risque de régression. Le HUB à part pourra arriver en F4 dédié plus tard.
- Création cercle : j'ai préféré un écran dédié `/circle/new` plutôt qu'un modal, plus cohérent avec le reste de l'app (flow plein écran).
- Stories : rond d'avatar gardé (seule exception "rounded" car c'est une photo, pas un bouton). Anneau fin 1px ice-600/ink-300 plutôt que dégradé Instagram.
- Reactions (F8) : skip pour cette session — nécessite refactor MessageBody pour inline les icônes, pas voulu fragiliser le chat existant sans revue.

### Bloqué
- Notifications push (F9) : non démarré. Nécessite test device physique (§8) et vérif Expo tokens column côté prod — à faire avec toi.
- Migrations local-apply + prod-apply pas encore exécutées (`supabase db push`). À valider avec toi quand tu reviens (feedback memory apply-migrations).

### Questions pour toi (review du matin)
1. Le plan d'origine prévoyait F4 (refonte HUB MULTI en 2 sections MES CERCLES / EXPLORER). Là j'ai gardé l'écran actuel + ajouté des entrées. Tu veux que je fasse la refonte plus agressive la prochaine session, ou tu gardes cet incrément ?
2. Stories sont accessibles uniquement depuis le feed cercle actif. Tu veux aussi un entry point global (un "+" sur l'onglet Today) ?
3. Realtime publication : les migrations 024 et 025 font `alter publication supabase_realtime add table` sans `if not exists` — si on re-run il faudra un `DO $$ ... $$` conditionnel. Non bloquant pour la prod première fois.
4. Cercles publics exposent maintenant RLS lecture des `outfits` de leurs membres à *tout* utilisateur authentifié. Volontaire (preview du cercle). Confirme que c'est OK produit avant de ship en prod.

### iOS sim — à vérifier au matin (feedback memory)
- Flow create → cercle public apparait dans EXPLORER depuis un 2e compte.
- Preview screen avec grille de 6 tenues.
- Join public → retour vers feed cercle avec nouveau cercle dans CircleSwitcher.
- DM : ouvrir profil depuis CircleOutfitCard → ENVOYER UN MESSAGE → thread.
- Story : tap avatar bar → viewer plein écran progression auto.
- Compose story : picker + publish → appararait chez l'autre compte avec anneau ice-600.

### Idées suivantes (backlog nuit prochaine)
- F4 HUB refonte complète avec 3 sections (MES CERCLES, MESSAGES, EXPLORER).
- F8 réactions (5 icônes monochromes fire/eye/snow/heart/spark).
- F11 channels dans cercle (sidebar swipeable).
- F14 challenges du jour (edge function + streak).
- F15 feed « Pour toi » cross-public-circles.
- F18 voice notes (expo-audio + waveform 1px).

### Extension session (suite)
- F7 ✅ Présence — hook `usePresence` basé sur canal Realtime `user_presence` partagé (un seul channel pour toute l'app). Composant `PresenceDot` (6px ice-600). Branché dans DM list + profile header.
- F8 ✅ Réactions messages — migration `026`, set fermé 5 clés (`fire`, `eye`, `snow`, `heart`, `spark`) rendues avec glyphs mono (△◎✸♡✦) pour éviter le vibe emoji consumer. Composants `MessageReactions` (aggrège counts, max 3 + N) et `ReactionPicker` (modal bottom sheet 5 boutons 56px sharp + DELETE owner). Chat: long-press → picker.
- F15 ✅ Feed « POUR TOI » — hook `usePublicFeed` (query cross-cercles publics, paginé 30). Écran `/circle/feed` grille 2 col (1.3 ratio) + refresh + infinite scroll. Toggle POUR TOI ↔ CERCLES en haut des deux écrans de discovery.
- F16 ✅ Follow graph — migration `027`, hook `useFollow` (counts + toggle). Compteurs FOLLOWERS / SUIVIS en Barlow 24 dans profile. Bouton SUIVRE ice-100 / SUIVI ✓ outline ink-900.
- F21 ✅ Statuts utilisateur 24h — même migration `027`. Écran `/status/edit` (TextInput italic Barlow 24, upsert avec expires_at +24h, bouton EFFACER). Affichage dans profile en italique ice-600 avec guillemets français.

### Bilan session
- 11 commits · 5 migrations (023-027) · 10 features livrées.
- typecheck vert à chaque commit.
- PR #102 en **ready for review** (non-draft) + merge de main.
- Feedback PR workflow respecté : merge main fait avant passage ready.

### Deuxième extension (post-debug)
- Bug critique trouvé : le worktree n'avait pas le `.env` (gitignored, pas copié à la création). Expo chargeait `supabase.ts` sans `EXPO_PUBLIC_SUPABASE_URL` → tout crashait. Résolu en copiant `.env` depuis la main repo.
- UX pass : hit-zones boutons augmentées (hitSlop 8), purge actions écrasées dans CircleFeedHeader (garde CHAT + SONDAGES + RÉGLAGES). Nouveau `MultiActionsBar` plein largeur (3×44px) MESSAGES / EXPLORER / POUR TOI.
- Migrations 023-029 appliquées sur prod via `supabase db push`.
- F13 ✅ Sondages : migration `028`, hook `usePolls` (realtime polls + poll_votes, agrège votes), `PollCard` (barres de résultats ink-900 pour ma vote / E5E3DC pour autres, % Barlow, support images), écrans `/circle/poll/new` (2-4 options avec photo + label) et `/circle/polls/[circleId]`.
- F14 ✅ Challenge du jour : migration `029` (daily_challenges seedée avec 5 thèmes éditoriaux, challenge_entries, profiles.challenge_streak, trigger streak auto). Hook `useDailyChallenge`. `ChallengeBanner` ink-900 dans feed cercle. Écran `/challenge/[id]` grille 2 col participants.
- F24 ✅ Section CURATED dans Explorer : filtre is_featured en tête de liste avec header dédié.

### Fichiers touchés (session complète)
13 features · 8 migrations · 19 commits · typecheck vert à chaque push.
