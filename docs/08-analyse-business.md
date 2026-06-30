# 08 — Analyse business de Cleveria (synthèse)

> Synthèse du bras droit à partir de l'équipe factory (direction, finance, business-dev, manager),
> 2026-06-30. Possédée et arbitrée, pas juste compilée.

## Verdict en une ligne
**Désirable : oui. Viable : sous conditions, non encore démontré.** Le sort du produit ne tient pas à
la techno (déjà prouvée, live) mais à **une seule hypothèse non testée** — les gens convertissent-ils
l'usage quotidien en vrais projets ? — et à **une discipline de prix** (jamais d'illimité).

## 1. Les 3 vérités où toute l'équipe converge (haute confiance)

1. **Aucune douve technique.** Les 22 agents = des prompts, l'orchestration est reproductible, tout
   repose sur l'API Claude. La **seule douve constructible = mémoire + relation + habitude** (le CDP
   personnalisé, V2 auth/Supabase). → La roadmap doit servir la douve, pas la feature. **La V2 n'est
   pas du confort, c'est *le* chantier stratégique.**

2. **Le coût marginal n'est jamais nul → l'illimité est suicidaire.** Modèle quasi 100 % variable
   (coût = crédit API). Tout palier doit **faire payer le run à son coût**.

3. **L'hypothèse n°1 à valider = la conversion quotidien → projet.** Si l'utilisateur reste au
   quotidien, Cleveria = « un ChatGPT à 39 € » et churne (Claude Pro fait le léger à 20 €). Le
   différenciateur (l'agence sur un vrai projet) doit être **vécu dans les 7-14 jours**.

## 2. Les chiffres qui cadrent la discussion (finance, calculés sur l'archi réelle)

| | Coût API |
|---|---|
| Demande **directe** (1 appel) | **~0,05 €** |
| **Run projet** (planner + 3-5 agents Opus + synthèse) | **~0,55 €** (0,35 → 1,10 €) |

- Un run ≈ **10× un direct** : c'est le fait dominant. Un client semi-pro coûte **4-14 €/mois** de crédit.
- Coûts fixes ~50 €/mois → **point mort ≈ 4 clients payants**. Le vrai enjeu n'est pas le volume mais
  **la marge par client** (prix encaissé > coût de CE client).
- Leviers de marge : Sonnet sélectif sur les agents de support (run −40 %), plafond d'étapes du
  planner, prompt caching (−30-40 % d'input).

**Réconciliation que je tranche** : business-dev redoutait un run à « 3-15 € » → un free tier
déficitaire. **Faux** : le coût réel est ~0,55 €. Donc **un palier gratuit de 2 runs coûte ~1-2 €/mois
par utilisateur — c'est du CAC, pas une fuite.** L'objection tombe : le free tier d'acquisition est
finançable.

## 3. Les tensions que j'ai arbitrées

- **Prix d'ancrage** : finance proposait ~19 €, business-dev 39 €/99 €. → **Je tranche à ~29 €** pour
  le palier Solo (entre les deux), structure **hybride** (quota inclus + overage facturé au coût
  haut), free « Découverte » plafonné, Studio 99 € plus tard (multi-sièges + CDP personnalisé). À
  recaler dès qu'on a le coût réel de 15-20 runs.
- **Message d'acquisition vs rétention** : pas une contradiction, deux moments. **On acquiert sur
  l'effet agence** (« transforme un brief en livrables d'équipe en 15 min » — le différenciateur), on
  **retient sur le quotidien + la mémoire**. L'entrée produit reste le quotidien (habitude), mais le
  pitch mène avec l'agence.
- **Onboarding** : il doit **forcer un run agence complet dès la 1ʳᵉ session**. Métrique leading n°1 :
  *% d'utilisateurs gratuits qui déclenchent ≥ 1 run en 14 jours*. Sous 40 % → problème de message/
  onboarding, pas de produit.

## 4. Ce qui a déjà été fait dans cette passe (le bras droit a tué ce qu'il pouvait)

- **Bug P0 corrigé** (trouvé par la rétro manager) : la garde anti-hallucination manquait dans la
  synthèse finale → `CLEVERIA_SYNTHESIS_OPS` injecté dans `synthesize()`. Le CDP ne peut plus
  requalifier « prêt à exécuter » en « fait/testé/déployé ». *(commit d1c278b)*
- **Visuel « de ce qui est en cours d'échange »** : tranché **V1.x, pas V2** — le moteur Mermaid est
  déjà déployé ; il ne manque que (a) étendre le rendu au chat hors mode direct, (b) inciter le bras
  droit à proposer un schéma. Cheap, sans crédit. *(en attente de go)*

## 5. Faiblesses internes trouvées par le manager (à arbitrer)

| Axe | Problème | Coût |
|---|---|---|
| 1 ✅ | Garde anti-hallucination absente en synthèse | **fait** |
| 2 | Le **vrai triage post-GO = le planner dans le code**, hors périmètre d'amélioration des agents ; chaîne dev→LT→QA optionnelle ; sur-mobilisation post-GO | mini-décision (créer `factory-orchestrateur.md` ?) |
| 3 | Pas de **contrat de handoff** : les livrables ne s'emboîtent pas (prose libre re-devinée) | cheap (ajout à la couche ops) |
| 4 | « Bon run » non défini → tuning « evidence-driven » sans instrument | cheap (rubrique + protocole `/bras-droit`) — **débloque la mesure SANS crédit** |
| 5 | `factory-architecte` est juridico-financier → produit du montage juridique sur un projet logiciel | cheap (trancher la casquette) |

> Insight manager le plus fort (axe 4) : la mesure de qualité est **gratuite** à construire (rubrique
> + briefs canoniques via `/bras-droit`). Le tuning n'est donc **pas** bloqué par le crédit API,
> contrairement à ce qu'on pensait — seul le test en conditions *de prod* l'est.

## 6. Recommandation de priorités (GO conditionnel)

**Posture : venture à valider, pas produit à scaler.** Pas d'euro marketing ni de scaling tant que :

1. **Tester la conversion quotidien → projet** sur 5-10 utilisateurs cibles réels (segment beachhead =
   **consultant/solopreneur expert en développement actif de sa pratique**). Gratuit via `/bras-droit`.
2. **Chiffrer l'unit economics réel** (15-20 runs) → fige la grille de prix. *Bloqueur : crédit API.*
3. **Construire la douve : auth + mémoire (V2)**. *Bloqueur : quota Supabase (décision : libérer un
   slot ou passer l'org en payant).*

Tout le reste (voix temps réel, esthétique, élargir le roster) est prématuré.
