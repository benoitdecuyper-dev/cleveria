# 07 — Upgrade des agents : cadrage

> Objectif : rendre les agents de la Factory team « meilleurs du marché » au sens **qualité de
> livrable**, pas au sens « ils ont toutes les sections à la mode ». Décidé avec Ben le 2026-06-30.

## 0. Diagnostic de départ

Les 22 agents sont déjà **lean** (~250-340 mots), à rôle clair, avec méthode + règles + handoffs.
Le risque n'est donc **pas** l'embonpoint — c'est :

1. **Le contexte mort.** Le même prompt tourne dans deux mondes incompatibles :

   | | Claude Code | Cleveria (runtime) |
   |---|---|---|
   | Tours | multi-turn | **un seul shot** |
   | Outils | Read/Write/Bash, fichiers réels | **aucun** |
   | Entrée | l'utilisateur, en dialogue | note de cadrage + livrables des dépendances |
   | Sortie | du code, des commits | **un livrable Markdown** |

   Exemple : `factory-developpeur` dit « exécute les tests, lance le lint/build, ne déclare fini
   que si ça passe ». Juste dans Claude Code ; **mort — voire hallucinogène — dans Cleveria** (pas
   d'outils → l'agent ne *peut pas* lancer un test, donc il l'ignore ou prétend l'avoir fait).

2. **Le manque de profondeur métier** sur certains rôles (un senior réel porte des heuristiques,
   pièges et standards que le prompt ne capture pas encore).

## 1. Principe directeur (anti-cargo-cult)

**Règle d'inclusion** : une ligne ne reste dans un prompt que si on peut répondre à
**« quel pire livrable son retrait provoque-t-il ? »**. Si on ne sait pas nommer la défaillance
qu'elle évite, c'est du décor → on coupe.

Disqualifié d'office (du « widely used » qui ne change pas la sortie) : persona fleurie, « sois
utile », boilerplate de chain-of-thought, redites de l'évidence, listes de best-practices génériques.

## 2. Décision d'architecture : identité stable + ops au runtime

On **généralise le pattern déjà utilisé pour le CDP** (`BRAS_DROIT_INSTRUCTIONS` injectées dans
`/api/brief`) à tout le roster.

```
agent.md  = QUI il est + sa barre de qualité   (stable, identique partout)
            │
   ┌────────┴────────┐
Claude Code        Cleveria
ops agentiques     ops one-shot (injectées au runtime)
(tests, fichiers,  (livrable Markdown, pas d'outils,
 multi-turn)        hypothèses explicites, pas de faux "j'ai testé")
```

### Ce que contient l'`agent.md` « identité » (stable)
- **Rôle & posture** : qui il est, ce qu'il refuse de faire à la place des autres (frontières).
- **Expertise métier** : heuristiques, pièges, standards, angles morts propres au rôle. *C'est ici
  que se gagne le « best on the market ».*
- **Jugement sous ambiguïté** : comment décider quand l'entrée est maigre — **la norme dans
  Cleveria** (une note de cadrage, zéro dialogue).
- **Barre de qualité du livrable** : à quoi ressemble un *excellent* rendu pour CE rôle.
- **Handoffs** : à qui il passe la main, ce qu'il signale comme interdépendance.

### Ce qu'on en RETIRE (migré vers les ops runtime)
Toute procédure dépendant d'outils ou de tours : « lis le repo », « exécute les tests », « lance le
lint/build », « avance par petits commits »… → ça ne vit que dans le contexte qui a les outils.

### Les couches ops (par harnais)
- **Cleveria — spécialistes** : nouvelle constante `CLEVERIA_DELIVERY_OPS`, injectée dans
  `apps/web/lib/orchestrator.ts` → `runStep()` (aujourd'hui `system: agent.prompt` ligne ~206) →
  `system: agent.prompt + "\n\n" + CLEVERIA_DELIVERY_OPS`. Elle dit : un seul shot, aucun outil ;
  produis un livrable Markdown autosuffisant ; **rends explicites tes hypothèses** quand la note est
  incomplète plutôt que de bloquer ; **n'affirme jamais avoir exécuté/testé/vérifié quelque chose**
  (tu ne peux pas) — propose à la place le plan de vérification à dérouler.
- **Cleveria — bras droit** : `BRAS_DROIT_INSTRUCTIONS` (déjà en place) — triage direct/questions/cadrage.
- **Cleveria — planner & synthèse** : `plannerSystem()` et le prompt de `synthesize()` (déjà en place).
- **Claude Code** : fournit nativement ses ops (l'agent tourne en agentique, avec ses outils) — rien
  à injecter.

## 3. Méthode (evidence-driven, pas à l'intuition)

Pour chaque agent en périmètre :
1. **2-3 tâches canoniques** réalistes (briefs types de son domaine).
2. **Baseline** : livrable produit avec le prompt actuel.
3. **Faiblesse du livrable** (on critique la SORTIE, pas le prompt) : qu'est-ce qu'un senior aurait
   fait que l'agent rate ?
4. **Patch ciblé** du prompt pour corriger *cette* faiblesse précise.
5. **Re-test** : on ne garde le changement que s'il améliore le livrable.

> ⚠️ **Dépendance** : les étapes 2 et 5 (produire/comparer des livrables) appellent l'API Claude →
> elles nécessitent du **crédit Anthropic**. Le travail **structurel** (séparer identité/ops, écrire
> `CLEVERIA_DELIVERY_OPS`, restructurer chaque `agent.md`) se fait **sans crédit**. La boucle de
> mesure démarre quand le crédit est dispo. Cf. `docs/05` / mémoire parc.

## 4. Périmètre — passe 1 : bras droit + agents de run (~10)

Les agents qui produisent réellement un livrable dans un run type, par ordre d'agence :

| Rôle | Agent | Pourquoi prioritaire |
|---|---|---|
| Entrée/synthèse | `factory-chef-de-projet` (bras droit) | tout passe par lui (triage + synthèse) |
| Cadrage | `factory-product-owner` | découpe le besoin, fallback du planner |
| Cadrage | `factory-architecte` | montage / architecture |
| Production tech | `factory-developpeur` | cas du « contexte mort » le plus net |
| Contrôle tech | `factory-lead-tech` | qualité/risques du livrable tech |
| Production business | `factory-finance` | chiffrage, déjà bon → étalon de profondeur |
| Production business | `factory-business-dev` | go-to-market / partenariats |
| Supports | `factory-ux-ui` | dossiers, parcours, supports |
| Risques | `factory-expert-conformite` | conditions bloquantes |
| Recette | `factory-qa` | conformité aux critères |

Hors périmètre passe 1 (raffinage ultérieur, surtout Claude Code) : `debugger`, `devops`,
`security-auditor`, `performance-engineer`, `documentation-engineer`, `scrum-master`, `manager`,
`direction`, `marketing`, `levee-de-fonds`, `rh`, `operations`.

## 5. Ordre d'exécution

1. **Structurel (sans crédit)** : écrire `CLEVERIA_DELIVERY_OPS` + l'injecter dans `runStep` ;
   restructurer les ~10 `agent.md` en « identité stable » (sortir les ops, approfondir le métier).
2. **Bras droit d'abord** : valider le triage + la profondeur sur lui.
3. **Mesure (avec crédit)** : dérouler les tâches canoniques, comparer, garder ce qui améliore.
4. Resync `npm run sync:agents`, build, commit, push.

## 6. Definition of done (passe 1)

- Aucun `agent.md` du périmètre ne contient d'instruction qui ne peut pas s'exécuter dans le contexte
  où elle est lue (zéro contexte mort).
- `CLEVERIA_DELIVERY_OPS` en place et injectée ; aucun spécialiste ne prétend avoir testé/vérifié.
- Chaque ligne d'un `agent.md` passe la règle d'inclusion (§1).
- Pour chaque agent : au moins une faiblesse de livrable identifiée et corrigée, re-testée (quand
  crédit dispo).
