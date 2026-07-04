# 20 — Étude de marché Cleveria (service phare : créer/rebranding de site web)

> Produit par `factory-business-dev` (+ apports finance), 2026-07-04. Référencé depuis
> `BACKLOG.md` (bloc REPRISE) et complète [`08-analyse-business.md`](./08-analyse-business.md)
> (hypothèse n°1 : conversion quotidien→projet) et [`19-service-site.md`](./19-service-site.md)
> (le parcours maquette→devis→prod). Se lit avec [`21-tarifs-cleveria.md`](./21-tarifs-cleveria.md)
> (grille tarifaire, non traitée ici).
>
> **Méthode et limite à assumer** : toute affirmation factuelle et tout prix cité ci-dessous est
> sourcé (URL) et recoupé sur une 2ᵉ source indépendante quand c'est possible. Quand le recoupement
> échoue ou que les sources divergent, c'est écrit noir sur blanc — **« à confirmer »** — plutôt que
> lissé. Prix en euros, marché France en priorité (le SaaS de site building est majoritairement coté
> en dollars ; conversion/équivalent FR signalé).

---

## 0. Résumé exécutif

**Le marché est réel et énorme, la commodité aussi.** Construire un site simple est un problème
résolu depuis quinze ans par les DIY builders (Wix, Squarespace…) à 15-40 €/mois, et un problème
sous-traité depuis toujours par des agences/freelances à 800-5 000 € le projet (recoupé, cf. §2).
Le vrai obstacle n'est presque jamais technique ni financier — il est **conversationnel et
décisionnel** : une TPE/asso qui n'a pas de site aujourd'hui n'a le plus souvent ni le temps, ni le
vocabulaire, ni l'envie de piloter un projet web (remplir un brief, choisir un thème, écrire les
textes). Le créneau de Cleveria n'est donc pas « moins cher que Wix » ni « plus rapide qu'une
agence » — c'est **zéro effort de pilotage avant de voir un résultat concret et gratuit** (la
maquette), puis **une vraie équipe qui livre pour de vrai** derrière un devis one-shot. C'est
structurellement le positionnement de B12.io (US, cf. §2.3) — preuve que le modèle « IA qui
dégrossit + humains qui finissent, vendu à l'acte » existe et fonctionne déjà, mais qu'il n'a pas
d'équivalent identifié sur le marché francophone à ce jour (à confirmer par une recherche
concurrentielle FR plus poussée, non exhaustive ici).

---

## 1. Le marché : qui a besoin d'un site simple

### 1.1 Volumes (France)

| Segment | Volume | Source | Recoupement |
|---|---|---|---|
| Associations actives | **1,6 million**, dont 9/10 sans salarié ; 74 000 créations entre juillet 2024 et juin 2025 | [La France associative en mouvement 2025, Recherches & Solidarités](https://www.francegenerosites.org/ressources/la-france-associative-en-mouvement-recherches-et-solidarites-2025/) | Repris à l'identique par [associations.gouv.fr](https://associations.gouv.fr/la-france-associative-en-mouvement-2025) (même étude, diffusion institutionnelle officielle) — **ordre de grandeur solide**, mais les deux citations remontent à la même étude source (R&S/Insee), pas deux mesures indépendantes. |
| Auto-entrepreneurs administrativement actifs | **3,186 millions** (juin 2025), +204 000 sur un an ; 758 600 immatriculations en 2025 | [Urssaf.org, communiqué officiel](https://www.urssaf.org/accueil/espace-medias/communiques-et-dossiers-de-press/communiques-de-presse/2025/les-auto-entrepreneurs-a-fin-dec.html) | Recoupé par [Bpifrance Création](https://bpifrance-creation.fr/entrepreneur/actualites/augmentation-auto-entrepreneurs-actifs) — deux organismes distincts, cohérents. **Nuance importante** : seuls 49,8 % sont économiquement actifs (CA positif déclaré) — la moitié de la base est dormante, à exclure du calcul d'adressabilité réelle. |
| Entreprises artisanales | ~**1,8 million** tous secteurs (CMA France) ; 278 700 immatriculations en 2024 (+11 %) | [veille.artisanat.fr / infometiers.org, Baromètre de l'artisanat 2025](https://infometiers.org/les-chiffres-cles-de-la-creation-dentreprise-artisanale-barometre-de-lartisanat-2025-ism-maaf/) | Ordre de grandeur cohérent avec les chiffres régionaux cités (ex. 348 000 en Île-de-France seule) — cohérence interne, pas une 2ᵉ étude indépendante. **À confirmer** : le chiffre exact « 1,8M » vs le chiffre Insee des « entreprises de l'artisanat » qui varie selon la définition retenue (immatriculées au Répertoire des métiers vs entreprises actives). |
| TPE (0 salarié, tous secteurs) | Donnée récente précise **non trouvée** ; référence structurelle Insee (2012, datée) : 55 % des TPE sans salarié, CA médian ~41 400 €/an pour la moitié d'entre elles | [Insee Focus n°24](https://www.insee.fr/fr/statistiques/1379753) | **À confirmer** — cette statistique a plus de dix ans, ne pas la citer comme actuelle dans un pitch commercial ; sert seulement de repère d'ordre de grandeur (beaucoup de très petites structures à budget contraint). |

**Lecture business-dev** : additionner ces volumes serait malhonnête (chevauchements — un artisan est
souvent aussi auto-entrepreneur, une association peut avoir un salarié qui est par ailleurs
indépendant). Le signal utile n'est pas la somme mais la **texture** : plusieurs millions
d'entités françaises, budget contraint, décision rapide et solitaire (indépendant/artisan) ou lente
et collégiale (association, cf. §4), pour qui « avoir un site » est un sujet permanent et jamais
prioritaire.

### 1.2 Comment ils font aujourd'hui — la vraie concurrence n'est pas toujours un concurrent

- **Pas de site du tout, réseaux sociaux/Linktree en guise de vitrine.** Le chiffre le plus cité —
  « X % des TPE n'ont pas de site » — **diverge fortement selon les résumés secondaires du même
  Baromètre France Num** : une synthèse indique 15 % (édition 2024, « jugent que ce n'est pas
  pertinent »), une autre indique ~30 % en dérivant l'édition 2025 (« 70 % ont un site » → 30 %
  n'en ont pas), cf. [page France Num du Baromètre 2025](https://www.francenum.gouv.fr/guides-et-conseils/strategie-numerique/comprendre-le-numerique/barometre-france-num-2025-le)
  et le [rapport PDF officiel](https://www.francenum.gouv.fr/files/2025-09/Barom%C3%A8tre%20France%20Num%202025%20-%20Rapport.pdf)
  (PDF non accessible en lecture directe lors de cette étude — **le chiffre exact reste à
  confirmer** en ouvrant le rapport). Le fait qualitatif, lui, est solide et convergent : **une
  part significative et non marginale des TPE françaises (probablement entre 15 et 30 %, donc
  plusieurs centaines de milliers d'entités) n'a toujours pas de site**, et gère sa présence en
  ligne uniquement via une page Facebook/Instagram, une fiche Google Business, ou rien.
  Pour les associations, le baromètre sectoriel disponible ([France Générosités, 2025](https://www.francegenerosites.org/ressources/chiffres-reseaux-sociaux-2025-barometre-des-associations-et-fondations-juin-2025/))
  documente surtout la présence réseaux sociaux (quasi 100 % sur Facebook/Instagram) sans donner de
  taux de possession de site — **absence de site des petites associations = non mesurée
  spécifiquement, à confirmer par une enquête ad hoc**, mais l'expérience de terrain (et le
  volume de 9 asso sur 10 sans salarié, donc sans personne dédiée au numérique) rend l'hypothèse
  plausible.
- **DIY builders** (Wix, Squarespace, Hostinger AI, Durable, 10Web…) — cf. §2.1. Le concurrent le
  plus fréquent en volume, pas le plus cher.
- **Agences locales et freelances** (Malt, Fiverr, bouche-à-oreille, « le neveu qui code ») — cf.
  §2.2. Le concurrent le plus cher, réservé aux structures qui ont déjà décidé d'investir.
- **« Le neveu qui code » / bénévole compétent** — canal informel, invisible dans les études, mais
  cité de façon récurrente dans la culture associative française (pas de source chiffrée
  disponible — **à confirmer**, mentionné ici comme angle mort qualitatif connu plutôt que comme
  fait chiffré).

---

## 2. La concurrence

### 2.1 DIY builders (le client fait tout lui-même)

| Acteur | Prix (recoupé) | Ce qu'ils font bien | Angle mort |
|---|---|---|---|
| **Wix** | 16,80 € (Light) à 178,80 €/mois (Business Plus), facturation annuelle, TTC | [lafabriquedunet.fr](https://www.lafabriquedunet.fr/logiciels/tendances/prix-site-wix) — recoupé par [websiteplanet.com](https://www.websiteplanet.com/blog/wix-pricing-plan-best/) (Business ≈ 40,46 €/mois, même ordre) | Écosystème mature, IA de génération intégrée, support FR | Le client pilote **seul** tout l'atelier (choix de template, remplissage, réglages SEO) ; ce qui est gratuit (le prix d'entrée) coûte cher **en temps et en compétence**, pas en argent — c'est justement le manque que Cleveria cible |
| **Squarespace** | FR : 11 € (Basic) à 36 €/mois (Advanced) en annuel ; version internationale officielle 16-99 $/mois | [agencezigzag.fr](https://www.agencezigzag.fr/squarespace-tarifs-formules/), recoupé par la [page officielle squarespace.com/pricing](https://www.squarespace.com/pricing) (ordre de grandeur cohérent, écart = régionalisation devise) | Design haut de gamme par défaut, bon pour le portfolio/vitrine esthétique | Courbe d'apprentissage réelle pour sortir des templates ; support majoritairement en anglais pour les cas complexes |
| **Webflow** | Premium ≈ 15 €/mois en annuel (nouvelle grille), jusqu'à 39 $/mois en mensuel ; plans Team dès 2 500 $/mois | [Blog officiel Webflow, mise à jour mai 2026](https://webflow.com/blog/simplified-plans-and-updated-pricing-2026) — recoupé par [appsrow.com](https://www.appsrow.com/blog/webflow-pricing-2026-complete-guide-to-plans-costs-and-comparisons) | Puissance quasi no-code pro, cible agences | **Beaucoup trop technique pour une asso/artisan** — conçu pour des designers/devs, pas pour le public cible de Cleveria ; angle mort total sur ce segment |
| **Framer** | Basic 10 $/mois, Pro 30 $/mois, Scale 100 $/mois (annuel) + 20 $/mois par siège éditeur | [framer.com/pricing](https://www.framer.com/pricing) — recoupé par [flowout.com](https://www.flowout.com/blog/framer-pricing) et [costbench.com](https://costbench.com/software/ai-design-tools/framer/) (mêmes montants) | Sites très design, rapides à produire pour un designer | Même angle mort que Webflow : outil de designer, pas de non-initié |
| **10Web (WordPress + IA)** | 10 à 23 $/mois (plans Business IA), jusqu'à 250 $/mois (Agency Ultimate) | [10web.io/pricing-platform](https://10web.io/pricing-platform/) — recoupé par [scribehow.com](https://scribehow.com/page/10Web_Pricing_Plans_2026_Full_Breakdown_of_Every_Plan_and_Which_One_Is_Actually_Worth_It__pPHAETFcRT-iVYlt5uYFFQ) | Combine génération IA + WordPress (écosystème plugin énorme) | Hérite de la complexité WordPress dès qu'on sort du gabarit auto-généré ; maintenance technique (plugins, mises à jour) reste à la charge du client |
| **Durable** | Repéré entre 15-25 $/mois (Starter/Launch) et 95-99 $/mois (Mogul/Grow) selon les sources — **noms de plans instables d'une source à l'autre**, signe d'un remaniement de grille fréquent | [durable.com/pricing](https://durable.com/pricing) — recoupé (ordre de grandeur, pas les noms exacts) par [techradar.com](https://www.techradar.com/pro/software-services/durable) | Génère un site + CRM + facturation en un seul abonnement, très rapide (< 1 min annoncée) | Site généré générique, faible en profondeur de contenu réel ; positionnement « side hustle US » assez éloigné du besoin FR asso/artisan |
| **Hostinger (générateur IA)** | Offres d'appel 2,99-3,99 €/mois engagées 48 mois, puis 11,99-14,99 €/mois au renouvellement (mécanique promo/lock-in classique de l'hébergeur) | [leblogdudirigeant.com](https://www.leblogdudirigeant.com/creation-site-web-ia-hostinger/) — recoupé par [clubic.com](https://www.clubic.com/hebergement/avis-379587-hostinger-createur-de-site.html) (« à partir de 1,99 €/mois ») | Prix d'appel imbattable, marque connue en France | Le vrai prix n'apparaît qu'au renouvellement — angle mort de transparence tarifaire que Cleveria peut retourner en argument (« devis clair, pas d'abonnement piège ») |

### 2.2 Agences et freelances (quelqu'un le fait pour le client)

| Acteur | Prix (recoupé, France) | Ce qu'ils font bien | Angle mort |
|---|---|---|---|
| **Agences web classiques** | 1 500 à 5 000 € pour un site vitrine TPE (3-5 pages), jusqu'à 30 000 €+ en sur-mesure | [toonetcreation.com](https://www.toonetcreation.com/blog/sites-web/combien-coute-un-site-vitrine-en-2025-guide-complet-et-comparatif.html), recoupé par [agence-synqro.fr](https://www.agence-synqro.fr/en/blog/prix-site-vitrine) et [ipaoo.fr](https://www.ipaoo.fr/creer-un-site-vitrine/prix/) (fourchettes convergentes) | Accompagnement complet, relation humaine dans la durée, responsabilité juridique claire | Cycle de vente long (devis, rendez-vous, allers-retours), coût élevé, délai de plusieurs semaines/mois avant de voir un premier résultat visuel |
| **Freelances (Malt, Fiverr…)** | 800 à 2 500 € pour un site vitrine ; tarif jour développeur ≈ 350 €/j en moyenne (extrêmes 150-1 000+ €/j) ; webmaster WordPress freelance ≈ 419 €/j en moyenne | [Grille des tarifs Malt 2026](https://www.malt.fr/t/barometre-tarifs/tech) — recoupé par [Orange Pro](https://pro.orange.fr/lemag/combien-ca-coute-de-faire-appel-a-un-developpeur-CNT0000027Jthl.html) qui cite une moyenne France Num de ~900 € pour un site vitrine simple | Moins cher qu'une agence, relation directe, flexible | Qualité et fiabilité très variables (pas de garantie d'équipe de secours si le freelance disparaît) ; le client doit quand même **rédiger un brief** et arbitrer seul le design — pas de filet visuel gratuit avant paiement |
| **« Le neveu qui code » / bénévole** | Gratuit ou quasi | — (pas de source chiffrée, mention qualitative, cf. §1.2) | Coût nul, relation de confiance | Disponibilité et pérennité aléatoires ; site souvent abandonné/non maintenu dès que le bénévole se désengage — angle mort structurel que Cleveria peut cibler en 2ᵉ vague (« votre site actuel a été fait par un ami, il ne répond plus ? ») |

### 2.3 IA « site en un prompt » — le concurrent le plus proche du positionnement Cleveria

- **B12.io (US)** — le précédent le plus proche du modèle Cleveria : génération IA immédiate d'un
  brouillon de site, puis **une vraie équipe humaine (design, rédaction) qui finalise et
  maintient**, vendue comme option « Experts Do It For You » à **1 999 $ de frais de mise en place
  unique** + abonnement mensuel (Professional 199 $/mois, Advanced 399 $/mois) pour l'hébergement/
  maintenance/support continu. Sources recoupées : [b12.io/pricing](https://www.b12.io/pricing/)
  et [support.b12.io (page officielle dédiée)](https://support.b12.io/en/b12-website-subscription-plans-and-pricing),
  confirmées par une synthèse tierce ([cybernaira.com](https://cybernaira.com/b12-ai-pricing/)).
  **C'est la preuve de marché la plus directe que le modèle « IA qui dégrossit, équipe qui
  livre, facturé à l'acte + abonnement » fonctionne** — mais en anglais, positionné US, pas de
  présence FR identifiée. Angle mort : prix d'entrée élevé pour une petite structure française
  (1 999 $ ≈ proche du haut de la fourchette agence FR), et le funnel gratuit de B12 est plus
  léger que la maquette-first de Cleveria (génération quasi instantanée, pas de vraie phase
  d'itération conversationnelle documentée dans les sources consultées — **à confirmer** en
  testant réellement l'outil).
- **Lovable, Wegic et assimilés** — génération de sites/apps par prompt (Lovable : gratuit limité,
  Pro à partir de ~25 $/mois selon une synthèse tierce non recoupée sur la page officielle
  [lovable.dev/pricing](https://lovable.dev/pricing) — **prix à confirmer**, la page officielle
  consultée ne détaillait pas les montants au moment de cette étude). Ces outils ciblent surtout
  les développeurs/makers qui « vibe-codent » une appli, pas le public non-technique
  assos/artisans — **angle mort direct** : aucune notion de devis, d'équipe humaine de finition,
  ni de vocabulaire pensé pour un non-développeur.

---

## 3. Le créneau défendable de Cleveria

**Où Cleveria gagne :**
1. **Zéro décision de design à porter seul avant de voir un résultat, ET gratuit jusque-là.** Ni
   Wix/Squarespace (le client choisit et remplit tout) ni une agence (semaines d'attente + devis
   payant dès le premier rendez-vous engageant) n'offrent ce combo. B12 s'en approche le plus
   (§2.3) mais sans présence francophone identifiée ni le même degré d'itération conversationnelle
   revendiqué par le doc 19.
2. **Le devis arrive après avoir VU le site, pas avant.** C'est l'inverse du cycle agence classique
   (devis sur description → attente → premier rendu). Réduit le risque perçu du client à quasi
   zéro avant paiement.
3. **Une vraie équipe livre derrière, pas un template auto-généré qu'il faut soi-même finir.**
   Contrairement aux DIY builders (Wix, Squarespace, Hostinger, Durable, 10Web) où le "site généré"
   reste la responsabilité du client pour la finition/maintenance, et contrairement à un freelance
   solo (pas de garantie de continuité), Cleveria mobilise une équipe structurée (`ux-ui`,
   `développeur`, `lead-tech`, `QA`) — argument de sérieux à faire valoir face au flou qualité des
   plateformes Fiverr/freelances bas de gamme.
4. **Rebranding à partir d'une URL existante (capture de contenu)** — aucun concurrent DIY ou IA
   identifié dans cette étude ne propose ce point d'entrée spécifique (partir du contenu réel du
   client plutôt que d'un template vide) ; à vérifier plus finement si un concurrent le fait déjà
   (recherche non exhaustive sur ce point précis — **à confirmer**).

**Où Cleveria perd (ou est en risque) :**
1. **Le prix affiché des DIY builders est très bas (15-40 €/mois) et connu du public** — Cleveria
   ne peut pas gagner sur le prix d'entrée nu ; il faut vendre le **temps et l'angoisse épargnés**,
   pas un tarif plus bas qu'un abonnement Wix.
2. **La maintenance après livraison n'est pas traitée dans le doc 19** (V1 = funnel gratuit
   jusqu'au devis, paiement/prod = phase 2 non chiffrée). Les DIY builders et B12 vendent un
   abonnement récurrent incluant l'hébergement/la maintenance — si Cleveria ne propose qu'un
   one-shot payant sans suite claire, un client peut se retrouver sans interlocuteur pour la
   moindre retouche post-livraison. **Risque produit direct sur la rétention**, à trancher avec
   `factory-finance`/`factory-direction`.
3. **Cycle de décision associatif long et collégial** (bureau/CA à convaincre, budget voté) —
   même produit désirable, le temps de closing peut être bien plus long qu'avec un indépendant qui
   décide seul. Ne pas confondre volume d'associations (1,6M) et volume de décisions rapides.
4. **Aucune preuve encore que le funnel maquette→devis convertit réellement** (doc 19 est un
   cadrage produit, pas un test terrain) — cf. doc 08, l'hypothèse n°1 non testée porte sur tout
   Cleveria, mais elle est encore plus critique ici : la maquette gratuite doit vraiment déclencher
   l'envie de payer, sinon Cleveria finance un générateur de maquettes gratuit sans conversion,
   pire que le free tier déjà identifié comme CAC dans doc 08.

---

## 4. Segment d'entrée à viser en premier

**Recommandation : indépendants et petits professionnels de service qui décident seuls** —
consultants, coachs, professions libérales, artisans de service (pas le BTP lourd), en création de
1er site ou rebranding d'un site vieillissant/bricolé. Dans cet ordre de priorité :

1. **Décision solitaire et rapide** — pas de comité à convaincre (contrairement à une association),
   le cycle de vente peut tenir en une seule session de conversation + un devis signé dans la
   foulée, cohérent avec la mécanique maquette-first du doc 19 (« on pinaille devant des maquettes,
   pas devant des cahiers des charges »).
2. **Budget déjà là et déjà dépensé ailleurs** — ce public paie aujourd'hui 15-40 €/mois à un DIY
   builder ou a déjà payé 800-2 500 € à un freelance (§2), donc la notion de payer pour un site
   n'est pas à créer, seulement à recapter avec un meilleur parcours.
3. **Cohérence avec le beachhead déjà retenu côté produit** (doc 08 : « consultant/solopreneur
   expert en développement actif de sa pratique » pour tester l'hypothèse quotidien→projet
   globale de Cleveria) — **ce n'est pas exactement le même public** (doc 08 vise un profil plus
   technique/expert que le grand public assos/artisans visé par le service site), mais le
   recoupement est fort sur le sous-ensemble **solopreneurs/indépendants qui pilotent déjà seuls
   leur activité** : tester le service site sur ce public sert les deux hypothèses en même temps
   sans complexifier l'acquisition avec deux discours différents.
4. **Associations en 2ᵉ vague, pas en tête de pont** — volume énorme (1,6M) et angle marketing
   fort (« aider les petites assos à exister en ligne »), mais cycle de décision plus lent et
   budget contraint (53 % des employeurs associatifs et 29 % des dirigeants sans salarié jugent
   leur situation financière difficile, [Recherches & Solidarités 2025](https://www.francegenerosites.org/ressources/la-france-associative-en-mouvement-recherches-et-solidarites-2025/)) — bon canal de
   notoriété/bouche-à-oreille communautaire, moins bon canal pour valider vite l'hypothèse de
   conversion payante.
5. **Artisans du bâtiment en 3ᵉ vague** — volume et besoin réels (crédibilité Google), mais
   moins naturellement à l'aise dans un parcours conversationnel piloté au clavier/à la voix ;
   nécessite probablement un point d'entrée assisté (quelqu'un les aide à démarrer la conversation)
   plutôt qu'une acquisition self-service pure — hypothèse à tester, pas tranchée ici.

---

## 5. Ce qui reste à vérifier (limites de cette étude)

- Chiffre exact du Baromètre France Num 2025 sur la part de TPE sans site (§1.2) — PDF non
  accessible en lecture directe pendant cette étude, à ouvrir manuellement pour trancher entre les
  résumés secondaires divergents (15 % vs ~30 %).
- Taux de possession de site (pas seulement réseaux sociaux) chez les petites associations —
  aucune étude chiffrée trouvée spécifiquement sur ce point.
- Existence ou non d'un concurrent francophone direct du modèle B12 (IA + équipe humaine, facturé
  à l'acte) — recherche non exhaustive, à creuser avant tout pitch affirmant « nous sommes les
  seuls en France ».
- Tarification Lovable non recoupée sur la page officielle — prix cité par des tiers seulement.
- Aucun test terrain réel du funnel maquette→devis (cf. doc 08, hypothèse n°1) — cette étude cadre
  le marché et la concurrence, elle ne remplace pas le test avec 5-10 utilisateurs cibles réels déjà
  recommandé par `factory-direction`.
