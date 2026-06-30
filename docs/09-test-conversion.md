# 09 — Test de conversion quotidien → projet (kit concierge, gratuit)

> Priorité business n°1 (décidée 2026-06-30). On valide L'hypothèse qui décide de tout :
> **les gens convertissent-ils l'usage quotidien en vrais projets-agence ?** Sans ça, Cleveria = un
> ChatGPT à 39 €. Méthode **concierge** = gratuite (aucun crédit API, via `/bras-droit`).

## Pourquoi concierge (et pas l'app)
Tester sur l'app déployée coûterait du crédit API (chaque run réel = appels Claude). Or on n'a pas de
crédit. **Solution** : Benoit joue le bras droit **à la main** via la commande Claude Code
`/bras-droit` (gratuit, mobilise les vrais agents) pour 5-10 prospects réels. On teste la **désirabilité
et l'intention**, pas l'infra. C'est plus rapide à monter et ça suffit à trancher l'hypothèse.

## Qui recruter (segment beachhead)
**Consultant / solopreneur expert en développement actif de sa pratique** : coach, formateur,
consultant, freelance senior, qui porte des clients **et** au moins un projet de développement de sa
propre activité (nouvelle offre, nouveau marché, repositionnement). 5 à 10 personnes. Critère clé : le
« en développement actif » — c'est lui qui crée le besoin de livrable toutes les 2-3 semaines.

## Déroulé (par personne, ~30 min)
1. **Quotidien d'abord** : « donne-moi une petite tâche de ta semaine » (un mail, une relecture, une
   synthèse). Tu la traites en `direct` via `/bras-droit`. → crée l'effet « assistant ».
2. **Le vrai test — le projet** : « et un sujet plus gros que tu repousses ? » (une offre à monter, une
   stratégie, un dossier). Tu lances le **run agence** via `/bras-droit` (vrais agents factory) → tu
   montres le livrable produit.
3. **Mesure de l'intention**, à chaud, sans vendre :
   - Réaction au livrable projet (le « AHA » a-t-il lieu ?).
   - « L'aurais-tu déclenché toi-même ? » / « Ça remplace quoi pour toi (3 jours de boulot ? un presta ?) »
   - « À quel prix mensuel ça te paraît évident ? » (laisse-le donner un chiffre).

## La métrique qui tranche
**% des testés chez qui le run-projet provoque un AHA + une intention de déclencher seul.**
- **≥ ~50 %** → hypothèse validée : on débloque le crédit (chiffrage réel) puis la V2 (douve mémoire).
- **< ~40 %** → l'hypothèse ne tient pas : le problème est le **message/onboarding** (ils ne pensent pas
  à déclencher un projet) **ou** le **produit** (le livrable ne convainc pas). On repositionne avant
  de dépenser quoi que ce soit.

## Les 5 briefs canoniques (double usage)
Ils servent au test **et** de jeu de référence pour le banc d'essai qualité du `factory-manager`
(axe 4, `docs/08`). Couvrir des natures variées :
1. **Offre / produit** : « structure une nouvelle offre de formation et son programme ».
2. **Go-to-market** : « bâtis ma stratégie commerciale pour le prochain trimestre ».
3. **Proposition client** : « transforme ce brief client flou en proposition structurée ».
4. **Financement** : « monte le dossier pour financer ce projet ».
5. **Tech léger** : « cadre la V1 d'un petit outil que je veux me faire ».

## Ce qu'on NE fait pas encore
Pas d'app payante ouverte, pas d'acquisition payante, pas de grille de prix publique tant que ce test
n'a pas tranché et que le coût réel (15-20 runs) n'est pas mesuré.

## Journal des sessions (à remplir)
| # | Profil | Brief projet testé | AHA ? | Intention | Prix évoqué | Note |
|---|--------|--------------------|-------|-----------|-------------|------|
|   |        |                    |       |           |             |      |
