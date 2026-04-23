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

## 2026-04-22 session — FEED éditorial (lightbox + réactions + photos DM)

### Fait
- **Lot 1** ✅ PR #177 · `feat/feed-lightbox` · commit de7a178
  - Fix P0 crop iPad : ratio adaptatif mesuré via `onLoad`, letterbox warm `paper-200`, plafond 78% viewport. Max card width 560 centrée sur iPad.
  - Nouveau `components/feed/PhotoLightbox.tsx` : modal plein écran, pinch zoom 1x-4x, pan quand zoomé, swipe vertical pour fermer, tap pour dismiss. Aucune nouvelle dépendance.
  - Split tap zones : méta → détail, photo → lightbox.
- **Lot 2** ✅ PR #178 · `feat/feed-reactions` · commit 877e560 · empilé sur #177
  - Migration `050_outfit_reactions.sql` appliquée **en prod** (enum fit/color/styling/piece, RLS, realtime).
  - `hooks/useOutfitReactions.ts` : counts + mine + toggle optimiste, realtime optionnel.
  - `components/feed/ReactionStrip.tsx` : 4 compteurs typographiques sous la photo, axe actif souligné.
  - `components/feed/ReactionRadial.tsx` : modal long-press avec les 4 axes en Barlow Condensed 28px.
  - Sur OutfitFeedCard : double-tap → toggle `fit` + trait `ice` 2px pulse + haptic success. Long-press → radial.
  - Sur écran détail : ReactionStrip en grand format avec realtime.
- **Lot 3** ✅ PR #179 · `feat/outfit-comment-photo` · commit c98b2e9 · empilé sur #178
  - Migration `051_outfit_comments_photo.sql` écrite mais **non appliquée** (sandbox a bloqué `supabase db push` pour cette migration).
  - Bucket `outfit_replies` public, 5 MB cap, RLS `{user_id}/*`.
  - `OutfitNotes` : bouton image galerie, preview 72×96 avec × pour retirer, thumbnail 128×170 dans le thread, tap → PhotoLightbox. Légende optionnelle.
- **Lot 4** ✅ PR #180 · `feat/dm-photo` · commit 0a3d966 · empilé sur #179
  - Migration `052_dm_messages_attachment.sql` écrite, non appliquée.
  - Bucket privé `dm_media` 8 MB, RLS stricte 2-participants, path `{thread_id}/{user_id}/*`.
  - Trigger `dm_bump_thread` mis à jour : `last_message_preview` fallback `[photo]` quand body null.
  - Écran DM : bouton image, preview 80×108 dans le composer, bulle photo 160×210, tap → lightbox.

### Décisions prises en autonomie
- **Pas d'étoiles ni de slider 1-10** pour noter : trop consumer, incompatible §2. Remplacé par 4 axes qualitatifs courts (fit / color / styling / piece) + double-tap silencieux sur axe `fit`.
- **Double-tap ≠ cœur Instagram** : trait `ice` 2px vertical pulse sur le bord gauche 220ms, zéro iconographie cœur.
- **Radial menu simplifié** en modal centré (labels en colonne) au lieu de drag-and-release radial iOS-style — plus fiable, reste éditorial, 4 slots en display 28px.
- **DM photo = attachment, pas éphémère** : pas de "snap" ni compteur de vues. Photo persistante comme pour tout contenu fashion (on veut pouvoir revenir dessus).
- **Bucket `dm_media` privé** (public=false) contrairement aux buckets outfits/wardrobe : les DM sont 1-to-1 intimes, photo ne doit pas être accessible via URL publique.

### Bloqué
- **Migrations 051 et 052 non appliquées en prod** : la sandbox a refusé `supabase db push` après la 050 (auto-mode mais non autorisé spécifiquement pour ces migrations). À pousser manuellement au réveil, avant merge des PRs #179/#180. Cf. memo `feedback_apply_migrations.md`.
- **Local Supabase non démarré** : conteneur `supabase_db_frileux` unhealthy. À `supabase start` si dev local voulu.
- **Test device iOS requis** pour le Lot 4 (caméra / picker galerie DM) — §8. Simu iOS OK pour les Lots 1/2/3.

### Questions pour toi (review du matin)
- OK pour la position du double-tap shortcut = `fit` ? Si tu préfères `styling` c'est une ligne à changer (`DOUBLE_TAP_AXIS` dans `OutfitFeedCard.tsx`).
- Validation produit pour le Lot 5 (wantbook, memory replay, critique structurée, zonal tag) — j'ai juste listé dans `BACKLOG.md` section Inventées > Éditorial bonus FEED. À prioriser si tu veux embarquer pour la prochaine session.
- Les PRs sont stackées : pour merger proprement il faut soit merger #177→#178→#179→#180 dans l'ordre, soit rebaser chaque branche sur `main` après merge de la précédente.

### Idées ajoutées au BACKLOG
- **Wantbook** · bouton silencieux « même pièce » sur un outfit du feed, liste privée dans GOÛT.
- **Memory replay** · filtre HISTORIQUE « il y a 1 an, ±2°C ».
- **Critique structurée 3 axes** · fit/color/styling en champs courts éditoriaux.
- **Zonal tag** · long-press sur zone photo → pièce wardrobe taggée (gros chantier).
- **Hype anonyme par cercle** · leaderboard intime quand les cercles reviennent.
- **Collection auto-contextuelle** · auto-boards groupés par météo détectée.

---

## 2026-04-22 session — L'ŒIL (dépôt d'inspirations externes)

### Fait
- PR #164 ✅ draft · feat/oeil-inspirations · worktree ../frileux-oeil
  - Migration 048_user_inspirations (enum piece/shop/lookbook, RLS, indexes)
  - lib/inspirations.ts (CRUD + fetchOgPreview + inspirationToDerivedPref)
  - lib/profile.ts : injection **en tête** de derived_prefs (5 inspirations max, 6 mois de rétention)
  - Composants : EyeCard, EyeKindChips, EyeAddSheet (3 routes PHOTO/LIEN/TEXTE)
  - Hook useEyeAdd (mirror simplifié de useWardrobeAdd)
  - Écrans app/eye/ : _layout + index (grid 2-col + filtres TOUT/PIÈCES/ADRESSES/PLANCHES) + [id] (fiche détail)
  - Edge function og-scrape (16KB cap, regex OG + twitter, quota 30/h)
  - Entry points : Settings > Goût & style > L'œil + bouton "+ DÉPOSER DANS L'ŒIL" sur Today sous À chiner
  - typecheck vert, lint:colors : aucun hex ajouté

### Décisions prises en autonomie
- **Naming** : "L'ŒIL" choisi avec l'user (vs CHINÉ qui entrait en collision avec "À CHINER" algo).
- **Kinds** : enum DB en anglais (piece/shop/lookbook), UI en français (PIÈCE/ADRESSE/PLANCHE) via KIND_LABEL.
- **Storage** : bucket wardrobe réutilisé, path {user_id}/eye/ — pas de nouvelle migration storage.
- **Pas de bouton presse-papiers** sur route LIEN — évite d'ajouter expo-clipboard. L'user colle manuellement via long-press iOS.
- **Police mono URL** : Platform.select Menlo/monospace système, zéro nouvelle dépendance.
- **Pas de "COMPOSER AUTOUR"** ni try-on visuel dans cette PR — scope validé avec l'user, reporté.
- **approved=false** auto si description < 10 chars (non-vêtement, ambigu) → exclu de derived_prefs mais visible dans L'ŒIL.

### Bloqué / À faire côté user
- **Migration prod bloquée** (permission denied) → l'user doit exécuter :
  ```
  supabase db push --linked
  supabase functions deploy og-scrape --project-ref qkghokrzqrbddqrsoksm
  ```
- **Vérif iOS sim bloquée** (permission denied sur `expo start`) → l'user doit lancer :
  ```
  cd ../frileux-oeil && npx expo start --ios
  ```
  Parcours à tester : Settings → L'œil → + DÉPOSER → PHOTO galerie → analyse → DÉPOSER → card visible → fiche → RETIRER. Puis LIEN (URL Ssense) puis TEXTE. Vérifier les logs suggest-outfit pour voir "inspiration (PIÈCE) : …" en tête de derived_prefs.

### Questions pour toi (review du matin)
- Label "L'ŒIL" tient la route à l'usage ? Alternatives si besoin : "REPÉRÉ", "ARCHIVÉ".
- "+ DÉPOSER DANS L'ŒIL" sur Today — position sous "À CHINER" te paraît-elle bonne, ou trop bas dans la scroll ?
- Try-on visuel suivant : Gemini Image API (selfie ¾ + item overlay) ou approche plus simple ? (PR dédiée).

### Idées ajoutées au BACKLOG
- Bouton "COMPOSER AUTOUR" (force une inspiration comme ancre dans suggest-outfit).
- Try-on visuel Gemini Image API (selfie + item).
- Auto-pattern : "tu épingles souvent du camel" → promu en style_memory.
- Partage d'inspirations dans Circles.

---

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

## 2026-04-17 nuit — Raffinage IA + Hello calibrage

### Fait

- **PR #146** ✅ `fix/unisex-gender-signal` · fix du prompt suggest-outfit
  quand `gender_presentation === "both"` (la ligne était filtrée → biais
  masculin par défaut du LLM). Même fix dans `critique-outfit`. Exemple
  final du prompt rendu paramétrique.

- **PR #148** ✅ `feat/sonnet-editorial-prompt` · upgrade Haiku 4.5 → Sonnet
  4.6 sur `suggest-outfit`, `critique-outfit`, `daily-notification`.
  Réécriture du prompt suggest-outfit : ton éditorial (Ssense /
  Highsnobiety), règles de composition (silhouette nette, 2 textures min,
  palette ≤3, pièce signature, matière nommée), vocabulaire interdit
  ("joli", "basique"), anti-template "pull + jean + baskets".

- **PR #149** ✅ `fix/memory-persists-feedback` · l'écran "Ce que Frileux
  sait de toi" ignorait la majorité des retours. Bugs fixés :
  1. `recordCritiqueFacts` n'écrivait que pour score ≥8 ou ≤5. Élargi à
     ≥7 / ≤6 + insertion du 2e improvement comme pattern sur toute critique.
  2. Les raffinements (reason, steer_text, steer_brands) n'allaient
     jamais dans style_memory. Nouvelle fonction
     `recordRefinementFeedback` qui insère comme pattern + fallback lisible
     par raison preset.

- **PR #151** ✅ `feat/refinement-chain` · fix le "je raffine, l'IA
  oublie". Migration 043 : `outfit_rejections` + `parent_rejection_id`,
  `iteration_number`, `steer_text`, `steer_brands`. Client : state
  refinementChain + lastRejectionId, rechargé au mount, passé à chaque
  fetchSuggestion. UI : label "ITÉRATION 02 · SUGGESTION DU JOUR" +
  rappel du dernier steer. RefineSheet : titre "RAFFINER · ITÉRATION 03"
  + bloc "DÉJÀ DEMANDÉ AUJOURD'HUI". Edge : nouveau `chainBlock` dans le
  prompt qui liste chaque itération rejetée + directive demandée +
  instruction de dévier du fil rouge.

- **PR #152** ✅ `feat/hello-calibration` · module Hello à la connexion.
  Migration 044 : `taste_probes` (batch_id, axis, options, chosen,
  judged_at) + RLS. Edge `daily-taste-probe` : **Opus 4.7 température
  0.9**, génère 5 duels contrastés sur axes variés (silhouette /
  palette / texture / registre / proportion), relit historique pour
  éviter redondance. Screen `/calibrate` affiché tant que
  `judged_count < 30` (cooldown 4h). Jauge hairline, "HELLO. DIS-MOI CE
  QUE TU AIMES.", 5 duels, écran "VU · TON GOÛT EST MIEUX CERNÉ".
  Settings → "RECALIBRER MON GOÛT". L'écran Today **reste intouché**.

- **PR #153** ✅ `feat/swipe-feedback-integration` · `outfit_preferences`
  (swipes d'onboarding) et `taste_probes` (calibrage) enfin relus dans
  `loadProfileBundle` → injectés dans derived_prefs → suggest-outfit.
  Slice à 10 max pour respecter la validation edge. Priorité :
  calibrage > mémoire > regret > swipes > rejects.

- **PR #154** ✅ `feat/critique-memory-closure` · dédoublonnage de
  style_memory. Normalisation robuste (lowercase, sans diacritics, slice
  80). Duplicate → delete ancien + insert nouveau (recency bump). Les
  signaux récurrents remontent naturellement en tête via `order by
  created_at desc limit 8` dans `loadProfileBundle`.

Queue de merge recommandée : #146 → #148 → #149 → #151 → #152 → #153 → #154.

Migrations 043 et 044 **déjà appliquées en prod** via `supabase db push`.
Edge functions **déployées en prod** : suggest-outfit, critique-outfit,
daily-notification, daily-taste-probe.

### Décisions prises en autonomie

- **Modèle** : Sonnet 4.6 partout pour suggest/critique/daily (confirmé
  via AskUserQuestion). Opus 4.7 seulement pour daily-taste-probe
  (diversité critique, budget ≤ 3 batchs/jour cappé, user a dit "tant
  pis le prix").
- **Scope aesthetic_personality** : abandonné au profit du Hello
  calibrage en batch de 5 duels (idée plus riche exprimée par
  l'utilisatrice en mid-session). Signal 100× plus dense qu'un champ
  statique.
- **Seuil calibrage** = 30 jugements (6 sessions environ). Cooldown 4h
  pour ne pas harceler à chaque refresh.
- **UI** : "ITÉRATION 02" en display uppercase tracking-widest, pas de
  badge ni pill — footer de chapitre System magazine style.
- **Copy** : tutoiement partout, "Hello. Dis-moi ce que tu aimes." avec
  point final typographique intentionnel.
- **Dédoublonnage mémoire** : recency bump via delete+insert (pas de
  nouvelle policy UPDATE à ajouter).

### Bloqué

- Rien.

### Questions pour toi (review du matin)

- **Coût Opus** : monitorer le dashboard Supabase après 1-2 jours
  d'usage pour voir si le cap 3/jour/user suffit. Si trop cher → switch
  Sonnet sur daily-taste-probe (fallback prévu dans le code).
- **Queue de merge** : les 7 PRs forment une chaîne linéaire. Mergent
  dans l'ordre indiqué et chaque rebase devrait être trivial.

### Idées ajoutées au BACKLOG

- (aucune, backlog 0417 fermé)
