# Rétro du 2026-07-18 — journée « refonte de la méthode » (première rétro outillée `/retro`)

_Manager. Période couverte : la journée du 18/07 (parcours méthode 7/7 + revue UX sur capture)._

## Mesure (évals — journal du jour, pas de re-run : suites de moins de 12 h)
- 12:40 suite complète harnais sous-agent : s1-s4, s6 ✓ · s5 ✗ (timeout infra 300 s)
- 12:51 s5 ✓ (timeout 600 s) · 12:53 s7 ✓ (canary « schéma d'abord ») · 13:02 + 13:36 s8 ✓ (revue
  UX sur capture, 8/8 classes vues — fixture enrichie des retours réels Sporae docs/40)
- **État : 8 scénarios, tous verts.** Aucun constat rouge issu de la mesure.

## Constats & décisions
1. **Éditions d'agents hors manager toute la journée** (CDP, formateur — sur directive de Benoit,
   légitime) sans consolidation. Cause racine : `/retro` ne prévoyait pas la revue des diffs
   d'agents. **Patch (mécanisme)** : étape 2 de `~/.claude/commands/retro.md` enrichie —
   consolidation `git log … -- agents/` + marges de budget à chaque rétro. Consolidation du jour
   faite : pas de doublon détecté, cohérence inter-fiches OK (fiche d'intake = source unique
   déclarée, libellés harmonisés).
2. **Marges de budget faibles** : formateur 447/450 (marge 3), CDP 502/550 (48),
   expert-conformité 353/400 (47), ux-ui 1372/1450 (78). **Non-patch** (le cliquet EST le
   mécanisme et fonctionne — il a refusé le formateur à 457 aujourd'hui même). Consigne notée :
   la **prochaine leçon** sur ces fiches sort en mécanisme ou en relocalisation JIT, pas en prose.
3. **Suite complète jamais rejouée d'un seul tenant** depuis l'ajout de s7/s8 (joués en `--only`).
   **Non-patch** : à jouer en ouverture de la prochaine rétro (`npm run evals`), coût inutile ce soir.
4. **Classe « rythme vertical / scroll »** (le scroll-snap « insupportable » de la refonte Sporae)
   non capturable en fixture statique. **Non-patch** : scénario dynamique (navigateur) à créer au
   premier signal réel récurrent — pas d'anticipation.
5. **Positif à graver nulle part (déjà mécanisé)** : la passation inter-sessions par
   artefact-pointeur a fonctionné (Sporae `docs/40` relu ici → moisson d'évals) ; le cliquet a
   attrapé son propre auteur ; 3 défauts réels attrapés par la suite sont devenus des mécanismes
   le jour même. La boucle promise par le parcours tourne.

## Canaries joués sur la période
s7 (« schéma d'abord », rouge→vert le jour même) · s8 (revue UX, vert 5/5 puis 8/8 après
enrichissement) · cliquet budgets (rouge 457>450 → vert après dégraissage) · gate TRIAGE
(violation forcée → bloquée → conforme) · gate fiche d'intake (constat s3 → hook → vert).

## Prochaine priorité
**Éprouver en réel** : prochain lot de la refonte vitrine Sporae dans le circuit complet
(fiche d'intake → maquette → dev → capture + checklist AVANT Benoit) et **compter ses retours
de passe finale** — l'écart avec les ~15 du 18/07 est LA mesure vivante de la méthode. Chaque
retour restant = défaut échappé → fixture + grader s8 (boucle d'enrichissement).
