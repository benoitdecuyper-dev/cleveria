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

## Message d'approche (prêt à envoyer — LinkedIn DM / contacts)
> Salut [Prénom] 👋 Je développe un truc et je cherche quelques indépendants pour le tester.
> C'est un **« bras droit » IA** : tu lui files un vrai sujet — monter une offre, une proposition
> client, ta stratégie du trimestre — et il te sort **un livrable exploitable en quelques minutes**.
> Pas des conseils : le livrable.
> Je prends **5-6 personnes** pour 30 min en visio cette semaine. C'est **gratuit**, et tu repars
> avec ce qu'on aura produit sur **ton** sujet. Partant ?

Variante courte (relance / froid) : *« 30 min, gratuit : tu me donnes un vrai sujet pro, mon outil te
sort le livrable en direct. Tu repars avec. Ça t'intéresse ? »*

Cibler : indépendants/consultants **en développement actif** (cf. beachhead ci-dessus). Pas de
pitch produit, pas de deck — on **montre**.

## Script de session (≈ 30 min, en visio, partage d'écran sur localhost:4242)
1. **(2 min) Cadrer.** « Montre-moi ta semaine type. » Repère **un truc léger** (un mail, une relecture)
   ET **un sujet plus gros qu'il repousse** (une offre, une propale, une stratégie).
2. **(3 min) Le quotidien.** Traite le petit truc en direct → effet « assistant qui fait, pas qui cause ».
3. **(15 min) LE test — le projet.** Lance son vrai sujet via le bras droit → le **livrable se construit
   dans le board** sous ses yeux. C'est le moment où l'AHA se joue. Tais-toi, observe sa réaction.
4. **(5 min) Mesurer (à chaud, sans vendre).**
   - « Ta réaction là, sur ce livrable ? » (note l'AHA ou son absence)
   - « Tu l'aurais déclenché toi-même ? Ça remplace quoi pour toi — 3 jours de boulot ? un presta ? »
   - « À quel prix mensuel ça te paraît évident ? » (laisse-le donner un chiffre)
5. **(5 min) Débrief.** Remplis la grille ci-dessous **tout de suite**, à chaud.

**Règle de décision** (rappel) : ≥ ~50 % d'AHA + intention → on continue (crédit puis V2). < 40 % →
le problème est le message/onboarding ou le produit → on repositionne **avant** de dépenser.

## Ce qu'on NE fait pas encore
Pas d'app payante ouverte, pas d'acquisition payante, pas de grille de prix publique tant que ce test
n'a pas tranché et que le coût réel (15-20 runs) n'est pas mesuré.

## Journal des sessions (à remplir)
| # | Profil | Brief projet testé | AHA ? | Intention | Prix évoqué | Note |
|---|--------|--------------------|-------|-----------|-------------|------|
|   |        |                    |       |           |             |      |
