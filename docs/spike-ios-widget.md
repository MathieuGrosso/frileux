# Spike — Widget iOS lock screen / écran d'accueil

Décision **go / no-go** sur l'ajout d'un widget iOS qui afficherait, sans ouvrir l'app, la météo + la suggestion ultra-courte du matin.

---

## Enjeu produit

Principe §4 du `CLAUDE.md` : *Speed as UX*. Le widget est l'incarnation absolue de ce principe — réponse au regard, sans tap. C'est la promesse qui distingue Frileux d'une app météo + d'une app journal.

Cible : widget Lock Screen (rectangulaire petit, iOS 16+) qui affiche :

```
┌──────────────────────────────┐
│  8°  pluie                    │
│  pull laine, manteau, bottes  │
└──────────────────────────────┘
```

Plus tard : widget Home Screen carré 2x2 avec image flatlay miniature.

---

## Faisabilité technique

### Contraintes Expo

Expo (et React Native en général) **ne supporte pas nativement** les WidgetKit iOS. Un widget = une extension Swift séparée, compilée à part de l'app, qui partage des données via un App Group + UserDefaults.

Trois options pratiques :

### Option A — `@bittingz/expo-widgets` (config plugin tiers)

- Plugin Expo qui injecte une extension WidgetKit pendant le build EAS.
- Le widget reste écrit en **Swift** (pas en TS).
- Données partagées via App Group + `UserDefaults(suiteName:)`.
- Statut : **utilisé en prod par plusieurs apps**, doc claire mais pas Anthropic-grade.
- Build : nécessite EAS Build (pas Expo Go), ce qui est déjà notre cas.

**Effort estimé** : 2-3 jours
- 0.5j : config plugin + App Group entitlement + dev build qui shippe le widget vide.
- 1j : écrire la vue Swift (Lock Screen rectangulaire) + DataProvider.
- 0.5j : côté JS, pousser les données dans `UserDefaults` via natif après le `fetchSuggestion`.
- 1j : refresh policy, tests sur device réel, polish typo.

### Option B — `react-native-widgetkit` (mainteneur unique)

- Bridge natif qui expose juste l'API `WidgetCenter.reloadAllTimelines()` au JS.
- N'écrit pas le widget pour toi, juste te permet de le re-trigger.
- Toujours besoin d'écrire le widget en Swift à côté.
- Moins de magie, plus de stabilité long terme.

**Effort estimé** : 2-3 jours, équivalent à A.

### Option C — Pas de widget, fallback Live Activity (iOS 16.1+)

- Une Live Activity peut s'afficher sur le Lock Screen pendant ~8h, ce qui couvre la fenêtre matinale (8h–16h).
- Plus simple à wire (toujours Swift, mais pas d'extension WidgetKit séparée).
- **Limitation forte** : doit être démarrée par l'app, donc l'utilisateur doit ouvrir Frileux le matin pour la déclencher. Casse la promesse "pas besoin d'ouvrir l'app".

**Effort estimé** : 1.5 jours mais **valeur produit moindre**.

---

## Risques

| Risque | Probabilité | Mitigation |
|---|---|---|
| Conflit Expo SDK 54 vs plugin tiers | moyen | Tester sur dev build avant d'écrire la vue Swift. Verrou potentiel : downgrade ou patch du plugin. |
| Update OTA cassée par l'extension | moyen | EAS Update ne gère pas le code natif — toute évolution du widget = nouveau build TestFlight. Cohabite mal avec une vélocité OTA quotidienne. |
| Refresh trop lent / quota WidgetKit | faible | Le système iOS limite à ~40 reloads / jour. Largement assez pour un widget matin + 1-2 refresh. |
| Charge maintenance (Swift à côté du TS) | élevé | Personne d'autre que moi pour relire le Swift. Si le mainteneur du plugin disparaît, on hérite du fork. |

---

## Verdict

**Go conditionnel — Option A.**

Conditions :
1. Frileux a au moins **20 utilisateurs actifs** (sinon l'effort 2-3j ne se justifie pas).
2. La suggestion du matin est **stable** côté qualité (sinon le widget va exposer du bullshit IA en gros sur le lock screen).
3. EAS Build cycle est OK pour des updates < 1 fois par semaine sur le widget (pas de fix urgent OTA possible côté natif).

À court terme, prioriser le polish des features web/mobile existantes.
Re-prioriser le widget dans 2-4 semaines une fois la base usagers atteinte.

---

## Plan d'exécution si on lance

1. **J1** : ajouter `@bittingz/expo-widgets` dans `app.json`, configurer App Group `group.expo.frileuse.widgets`, faire un dev build qui shippe un widget Hello World blanc. Vérifier qu'il apparaît dans la liste des widgets disponibles sur device test.
2. **J2** : écrire la vue Swift `LockScreenView` (texte 11pt SF Pro Condensed, mock data). Brancher un `TimelineProvider` qui lit `UserDefaults(suiteName: "group.expo.frileuse.widgets")`.
3. **J3** : côté JS, après `fetchSuggestion`, appeler un module natif pour écrire `{ temp, condition, suggestion }` dans le shared UserDefaults + `WidgetCenter.shared.reloadAllTimelines()`. Tester le flow E2E sur device.
4. **J3.5** : polish typo, dark mode lock screen (texte clair sur fond sombre auto), localisation FR.

---

## Hors scope de ce spike

- Widget Android (`AppWidgetProvider`). À traiter séparément, l'écosystème Android est beaucoup moins editorial sur les widgets.
- Watch app — out.
- Apple Wallet pass — out.
