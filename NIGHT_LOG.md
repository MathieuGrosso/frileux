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

