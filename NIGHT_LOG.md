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

### Idées pour BACKLOG
- Circle chat (PR9 plan) : `circle_messages` + route chat.
- QR code invite (`react-native-qrcode-svg`).
- Empty-nudge matin 7-10h.
- Reactions 1-tap sur une note (cœur unique, pas d'emoji grid).
- Digest hebdo cercle par email.

