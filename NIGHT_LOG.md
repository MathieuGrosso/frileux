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

### 2026-04-13 nuit

15 PR ouvertes et mergées en autonomie cette nuit.

#### Fait

| # PR | Branche | Sujet |
|------|---------|-------|
| 16 | `chore/docs-setup` | CLAUDE.md, BACKLOG.md, NIGHT_LOG.md |
| 17 | `feat/anti-repetition-wardrobe` | F6 · Prompt suggest-outfit reçoit `recent_worn` (7 derniers jours) |
| 20 | `feat/weather-day-window` | F7 · Fenêtre météo matin/midi/soir sous la temp |
| 21 | `feat/today-suggestion-image` | Today : image flatlay générée + texte concis sans markdown |
| 22 | `fix/onboarding-refine-regenerate` | Fix bouton Régénérer du modal Raffiner (try/catch + Alert) |
| 24 | `feat/outfit-occasion` | Classification outfit par occasion (6 chips éditoriales) |
| 25 | `feat/comfort-score` | F8 · Score de confort selon frilosité (verdict éditorial) |
| 29 | `feat/outfit-rich-rating` | Notation enrichie : ressenti thermique + commentaire libre |
| 30 | `feat/suggest-feedback-loop` | Prompt IA reçoit feedback thermique + occasion historique |
| 31 | `feat/empty-states-and-skeletons` | F1+F2 · Composants `<EmptyState />` et `<Skeleton />` |
| 32 | `chore/theme-tokens-and-hex-guard` | `lib/theme.ts` + script `npm run lint:colors` |
| 34 | `feat/daily-notification-evening` | F9 · Edge function accepte `?mode=evening` pour notif J-1 21h |
| 38 | `feat/outfit-detail-occasion-thermal` | Édition occasion + ressenti dans outfit/[id] |
| 39 | `docs/spike-ios-widget` | F10 · Spike doc widget iOS — go conditionnel |
| 42 | `feat/coldness-auto-calibration` | Suggestion auto du `coldness_level` selon historique thermique |

#### Décisions prises en autonomie

- **F6** : limite à 7 entrées max envoyées au prompt. Champ `recent_worn` optionnel côté edge — pas de breaking change.
- **F7** : 3 créneaux fixes (matin/midi/soir), pas de personnalisation horaire.
- **#21 image** : flatlay sans modèle ni mannequin (règles strictes dans le prompt Gemini), fond off-white #FAFAF8.
- **#21 prompt** : 1 phrase 20 mots max, format `pièce1, pièce2, …` haut → bas. Strip défensif client (`**`, bullets) au cas où le LLM dérape.
- **#22 fix** : pas de rollback de l'ancien comportement, juste try/catch + Alert + sync `useEffect` quand l'item change.
- **#24 occasion** : 6 valeurs (`casual`, `travail`, `sortie`, `soiree`, `sport`, `repos`) — assez pour couvrir, assez peu pour rester éditorial.
- **#29 thermal** : 3 valeurs (`too_cold`, `just_right`, `too_warm`). Le champ `notes` existait en DB sans UI, branché sur le `<TextInput multiline />`.
- **#32 hex guard** : 344 hits actuels — le script reste en outil manuel, pas wire dans CI tant que la dette n'est pas résorbée.
- **#34 evening** : créneau fixe 21h Paris (20h UTC). Cron à configurer en pg_cron — instructions dans le body du PR.
- **#42 calibration** : seuil 60% sur ≥3 entries, fenêtre 14 jours. Pas d'enforcement, juste une suggestion contextuelle dans Settings.

#### Bloqué

- Aucun blocage rencontré. Tous les flows IA, notifs et migrations restent à appliquer côté Supabase prod (cf. checklists dans les bodies de PR).

#### Questions pour toi (review du matin)

- **PR #19, #27, #28** (tes propres PR) avaient des conflits causés par mes merges. Tu m'as alerté mais on n'a pas tranché si je les rebase ou si tu préfères le faire toi-même.
- L'image générée par Gemini sur Today peut prendre 5–15s. À voir si tu veux un cache plus aggressif (ex : ne re-générer que si la suggestion change).
- Auto-calibration : la copy "PASSER À 4" est sèche. Tu veux quelque chose de plus chaud ou ça reste dans l'ADN tranchant ?

#### Migrations à appliquer en prod

```bash
supabase db push
# ou copier le SQL des migrations 007 et 008 dans le SQL editor
```

#### Cron à programmer (pg_cron)

```sql
select cron.schedule('daily-morning', '0 7 * * *',
  $$select net.http_post('https://.../functions/v1/daily-notification?mode=morning')$$);
select cron.schedule('daily-evening', '0 20 * * *',
  $$select net.http_post('https://.../functions/v1/daily-notification?mode=evening')$$);
```

#### Idées laissées au BACKLOG

- Filtrer history par occasion + par ressenti thermique.
- Vue stats wardrobe (pièces les plus / moins portées, items oubliés > 30j).
- Diff vs hier : "Hier 9°, aujourd'hui 14° → tu peux alléger".
- Mode voyage : entrer une ville → suggestions adaptées au climat de destination.
- Export tenue (screenshot stylisé partageable, cadre éditorial).
- Outfit of the week (curation auto basée sur rating moyen).
