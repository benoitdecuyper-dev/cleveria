# 21 — Tarifs Cleveria : structure de coûts, grille, unit economics, garde-fous

> Livrable finance — 2026-07-04. Chiffre la tarification du **service phare** (créer/rebrander
> un site via maquette gratuite → devis → production payée par une équipe d'agents),
> décrit dans [`19-service-site.md`](./19-service-site.md).
>
> **Règle produit non négociable (Benoit) : jamais d'offre illimitée.** Tout palier plafonne
> l'usage par des quotas ; l'excédent est facturé au coût ou bloqué (§5).
>
> **Ce qui est à moi / ce qui ne l'est pas.** Je chiffre. Le **montage en entités** revient à
> `factory-architecte`, la **TVA / conformité** à `factory-expert-conformite`, le **besoin de
> financement** consolidé part à `factory-levee-de-fonds` (§7). Prix affichés **HT**.

---

## 0. Hypothèses (traçables et discutables)

**Sources internes (coûts) — estimées, pas mesurées en prod à grande échelle :**

| Hypothèse | Valeur | Origine |
|---|---|---|
| Prix API Opus 4.8 | 5 $ / 25 $ le M tokens (in/out) | skill claude-api |
| Prix API Sonnet 4.6 | 3 $ / 15 $ le M tokens (in/out) | skill claude-api |
| 1 tour « bras droit » (Opus, cadrage) | ≈ 0,03 $, croît avec la conversation | note CONSO 2026-07-03 |
| 1 génération de maquette (Sonnet) | ≈ 0,10 $ | note CONSO 2026-07-03 |
| 1 retouche de maquette (Sonnet) | ≈ 0,11 $ | note CONSO 2026-07-03 |
| Session maquette complète (1 gén + ~5 retouches) | ≈ 0,80–1,00 $ | note CONSO 2026-07-03 |
| 1 **run factory complet** (planner + 3-5 agents Opus + synthèse) | ≈ **0,55 €** (0,35 → 1,10 €) | [`08-analyse-business.md`](./08-analyse-business.md) |
| Prompt caching câblé en prod | ≈ **−90 %** sur l'input répété | note CONSO / [`08`](./08-analyse-business.md) |
| Coûts fixes mensuels (infra, outils) | ≈ **50 €/mois** | [`08-analyse-business.md`](./08-analyse-business.md) |
| Change appliqué | **1 $ ≈ 0,90 €** *(à confirmer, ordre de grandeur)* — par prudence les coûts en $ sont convertis **sans décote** (1 $ ≈ 1 €) | — |

**Parti pris de prudence finance :** sous-estimer les recettes, sur-estimer les coûts. Les
coûts API ci-dessus sont si petits que je les arrondis systématiquement **vers le haut**, et
j'ajoute un poste « reprise humaine » non présent dans les ancres (§1.3, c'est l'angle mort).

---

## 1. Structure de coûts réelle par étape du funnel

Le funnel se coupe en deux régimes économiques **radicalement différents** :

### 1.1 — Funnel GRATUIT (centimes par prospect) — tout jusqu'au devis

Coût pour Cleveria d'un prospect **qui va jusqu'au bout** (cadrage → maquette → itérations →
devis), aucun euro encaissé à ce stade :

| Étape | Nature | Coût estimé |
|---|---|---|
| Cadrage conversationnel | 6–10 tours bras droit (Opus), atténués par le caching | ≈ 0,20–0,40 € |
| Capture d'URL (rebranding) | Jina Reader (`readUrl`, gratuit sans clé) | 0 € |
| 1ère génération de maquette | 1 appel Sonnet | ≈ 0,10 € |
| Itérations maquette (hyp. 5) | 5 × ≈ 0,11 € | ≈ 0,55 € |
| Questions d'affinage | 2–4 tours bras droit | ≈ 0,10–0,15 € |
| Génération du devis | 1 appel Sonnet | ≈ 0,03–0,05 € |
| **Total prospect « engagé »** | | **≈ 1,00–1,20 €** |

La plupart des prospects abandonnent avant le devis → **coût moyen par prospect entrant plus
bas, ≈ 0,30–0,60 €.** Conclusion identique à celle du doc 08 : **le funnel gratuit est du CAC,
pas une fuite** — quelques dizaines de centimes par prospect.

**Sensibilité — le prospect qui itère 20 fois la maquette :** 20 × 0,11 € = **2,20 €**
+ cadrage ≈ **~3 €** au total. Toujours de l'ordre de l'euro. Le risque n'est pas *un* abuseur,
c'est **le volume d'abuseurs qui ne convertissent jamais** (§1.3 et §5).

### 1.2 — Production PAYÉE (le poste coûteux) — après paiement du devis uniquement

Déclenchée seulement par un devis payé (`/api/run`, orchestrateur multi-agents) :

| Poste | Hypothèse | Coût estimé |
|---|---|---|
| 1 run factory complet | ancre doc 08 | 0,55 € (0,35–1,10 €) |
| Production complète d'un **vrai site** | hyp. prudente : 3–8 runs équivalents + reprises (ux-ui, développeur, lead-tech, QA, itérations) | **≈ 2–6 €**, central **~5 €** |

Même sur-estimé à 10 €, **le coût API d'une production est négligeable devant un prix de vente
à plusieurs centaines d'euros.** La marge brute côté API est structurellement > 95 %.

### 1.3 — L'angle mort : le coût de reprise humaine (hors ancres)

Les ancres ne chiffrent **que l'API**. Un site réellement livrable suppose potentiellement :
mise en ligne / hébergement du site produit, nom de domaine, et surtout **une reprise humaine**
si les agents ne sortent pas un livrable exploitable du premier coup (QA finale, ajustements,
SAV). **C'est le seul poste capable de faire basculer la marge du one-shot** — pas l'API. Je le
provisionne prudemment à **10–15 % du prix de vente** tant qu'on n'a pas la mesure réelle sur
les 10 premières productions. À instrumenter en priorité.

---

## 2. Grille tarifaire proposée

### 2.1 — Positionnement marché (références externes, citées + recoupées)

Prix de création d'un site vitrine en France (**HT**, 2 sources concordantes) :

| Prestataire | Fourchette | Source A | Source B |
|---|---|---|---|
| DIY / no-code (CMS) | 300–800 € | Wix blog | — |
| **Freelance** | 800–3 000 € (médiane ≈ 2 200 €) | [Malt / Majorflow](https://www.majorflow.fr/article/prix-site-vitrine) | [Wix blog](https://fr.wix.com/blog/quel-est-le-prix-d-un-site-internet-vitrine-en-france) |
| **Agence** | 1 500–6 000 € (jusqu'à 15 000) | [Wix blog](https://fr.wix.com/blog/quel-est-le-prix-d-un-site-internet-vitrine-en-france) | [Saucedigital](https://saucedigital.fr/fr/blog/prix-site-internet-professionnel-2025) |
| Clé-en-main / abonnement | 500–3 000 € ou **19–70 €/mois** | [Nocodefactory](https://www.nocodefactory.fr/blog/tarif-creation-site-internet-professionnel) | [Wix blog](https://fr.wix.com/blog/quel-est-le-prix-d-un-site-internet-vitrine-en-france) |

Maintenance mensuelle (**HT**, recoupé) : petit site TPE **29–49 €/mois** à 30–80 €/mois ;
no-code léger 10–30 €/mois ; hébergement mutualisé seul 2–5 €/mois.
Sources : [WeComm](https://wecomm.fr/prix-maintenance-site-internet/),
[Saucedigital](https://saucedigital.fr/fr/blog/prix-site-internet-professionnel-2025).

Builders IA SaaS (repères, **USD**) : Wix 17–39 $/mois, Durable 12 $/mois.
Sources : [WebsiteBuilderExpert](https://www.websitebuilderexpert.com/website-builders/wix-pricing/),
[Durable](https://durable.com/ai-tools/wix-ai-website-builder-review).

**Lecture finance.** Cleveria n'est ni un pur DIY (l'utilisateur ne bricole pas : une équipe
d'agents produit) ni une agence humaine (coût marginal ~nul). Le bon créneau : **sous le
freelance médian, au-dessus du DIY** — assez cher pour être crédible (un site à 99 € « sent »
l'arnaque et détruit la valeur perçue), assez abordable pour convertir une TPE.

### 2.2 — Modèle retenu : forfait de création (one-shot) + abonnement récurrent

Le doc 08 est explicite : **la douve = mémoire + relation + habitude (récurrence)**. Un modèle
purement one-shot laisse la valeur récurrente sur la table. Retenu : **one-shot qui finance la
production + abonnement qui installe la récurrence.**

**A. Création — forfait one-shot (facturé au devis, §19)**

| Palier | Périmètre | Prix HT | Positionnement |
|---|---|---|---|
| **Lancement** | Landing / 1 page vitrine (Hero, offre, contact) | **350 €** *(à confirmer)* | ≈ haut du DIY |
| **Vitrine** | Site multi-sections crédible (À propos, Services, Tarifs, Preuve sociale, Contact — cf. CLV-43), création ou rebranding | **690 €** | sous le freelance bas |
| **Sur-mesure** | Multi-pages, intégrations (RDV, formulaires, multi-langue) | **à partir de 1 490 €**, sur devis | freelance / bas agence |

**B. Abonnement récurrent (optionnel, après livraison) — À COMPOSANTS SÉPARABLES**

> **Règle produit (Benoit) : l'hébergement est un service LOURD ; si on n'a pas à héberger,
> ça doit coûter moins cher.** Beaucoup de clients — surtout les cas *rebranding d'un site
> existant* — ont déjà leur hébergement et leur domaine. On ne leur facture donc PAS
> l'hébergement. Le récurrent se scinde en **un socle toujours présent** + **une option
> hébergement désactivable.**

**B.1 — D'où sortait le « 39 € » : décomposition ligne par ligne**

L'ancien palier unique à 39 € regroupait, de fait, cinq postes de nature différente. Les
séparer était nécessaire :

| Poste couvert | Ce que ça fait | Coût direct estimé /mois | Repère marché |
|---|---|---|---|
| Assistant scopé + mémoire | Assistant qui connaît le site (CLV-49), mémoire distillée, itérations d'évolution | ≈ 1–3 € (API au quota) | builders IA 12–39 $/mois |
| Maintenance / sécurité / sauvegarde | Monitoring uptime, correctifs, sauvegardes, mises en ligne | ≈ 0–2 € (surtout du temps) | maintenance basique **29–80 €/mois HT** ([WeComm](https://wecomm.fr/prix-maintenance-site-internet/), [ellebay](https://ellebay-digital.com/blog/cout-maintenance-site-web-2026)) |
| Support | Canal de contact + réponses | provision ≈ 2 € | inclus dans les forfaits maintenance |
| **Sous-total « site vivant » (hors hébergement)** | | **≈ 4–5 €** | |
| Hébergement mutualisé | Serveur, TLS, bande passante | ≈ 2–9 € | o2switch **1,76→9 € HT**, OVH **3,29→7,19 € HT** ([o2switch](https://www.o2switch.fr/comparatif-des-offres-dhebergement-web/), [tool-advisor](https://tool-advisor.fr/blog/cout-hebergement-site-web/)) |
| Nom de domaine | Enregistrement + renouvellement | ≈ 1 € (≈ 12 €/an, *à confirmer*) | — |
| **Sous-total « hébergement + domaine »** | | **≈ 3–10 €**, central ~6 € | |

Le 39 € mélangeait un cœur à ~4–5 € de coût (l'assistant + la maintenance, la vraie douve)
et un pass-through d'hébergement à ~6 € de coût. **Les deux n'ont ni le même coût, ni la même
valeur, ni la même pertinence selon le client** → on dégroupe.

**B.2 — Nouvelle structure (2 composants)**

| Composant | Inclus | Prix HT/mois | Quota (jamais illimité) |
|---|---|---|---|
| **Socle « Site vivant + assistant »** *(toujours là)* | Assistant scopé + mémoire (CLV-49) + maintenance/sécu/sauvegarde + support + évolutions | **24 €/mois** | **20 itérations maquette / mois + 1 run d'évolution / mois**, overage facturé |
| **Option « Hébergement + nom de domaine »** *(désactivable)* | Hébergement du site + domaine + mise en ligne + TLS | **+9 €/mois** | 1 site hébergé |

**Les 2 prix résultants :**
- **Client qui héberge déjà (ex. rebranding) : 24 €/mois HT** — socle seul.
- **Client hébergé par Cleveria : 33 €/mois HT** — socle + option (24 + 9).

On passe donc de **39 € indifférencié à 24 €/33 € selon le service réellement rendu** — moins
cher pour qui n'a pas besoin d'hébergement, conforme à la règle Benoit. Le socle à 24 € reste
**sous le marché de la maintenance basique** (29–80 €/mois HT), ce qui est cohérent : notre
coût marginal est quasi nul et l'assistant ajoute une valeur que la maintenance classique n'a
pas.

---

## 3. Unit economics par palier

Coûts directs par client : funnel converti (~1,20 €) + production (~5 €, sur-estimée) +
provision reprise humaine (10–15 % du prix, §1.3).

### 3.1 — Création (one-shot)

| Palier | Prix HT | Coût API (funnel + prod) | Provision reprise (12 %) | Marge brute € | Marge % |
|---|---|---|---|---|---|
| Lancement | 350 € | ≈ 6 € | 42 € | **≈ 302 €** | **86 %** |
| Vitrine | 690 € | ≈ 6 € | 83 € | **≈ 601 €** | **87 %** |
| Sur-mesure | 1 490 € | ≈ 10 € | 179 € | **≈ 1 301 €** | **87 %** |

Même en doublant la provision de reprise (24 %, scénario pessimiste où beaucoup de sites
nécessitent un humain), la marge Vitrine reste **≈ 76 %**. **La production API n'est jamais le
risque ; la reprise humaine l'est.**

### 3.2 — Abonnement (récurrent) — par composant

| Cas | Prix HT/mois | Coûts directs /mois | Marge brute €/mois | Marge % |
|---|---|---|---|---|
| **Socle seul** (client héberge déjà) | 24 € | API au quota ≈ 2,8 € + support/maint. ≈ 2 € = **~5 €** | **≈ 19 €** | **79 %** |
| **Option hébergement seule** | 9 € | hébergement ≈ 5 € + domaine ≈ 1 € = **~6 €** | **≈ 3 €** | **33 %** |
| **Socle + hébergement** (tout compris) | 33 € | ≈ 11 € | **≈ 22 €** | **67 %** |

**Lecture.** Le **socle est le vrai centre de profit** (79 % de marge) — c'est la douve
(assistant + mémoire + maintenance). **L'option hébergement est un quasi-pass-through**
(33 % de marge, assumé) : on ne cherche pas à en faire une marge, juste à ne pas la subir. Un
client qui héberge déjà paie **24 € et nous laisse notre meilleure marge** ; on ne perd donc
rien à dégrouper, au contraire — on retire un service lourd et peu margé quand il est inutile.

Le quota (20 itérations + 1 run/mois) est calibré pour que **même un abonné qui le consomme
entièrement reste rentable** — traduction directe de « faire payer le run à son coût » (doc 08).
Note : l'hébergement mutualisé peut porter **plusieurs sites** sur un même compte hébergeur
(o2switch/OVH ne facturent pas au site) → à volume, le coût réel de l'option baisse sous 5 €,
la marge de l'option remonte. *(à confirmer selon l'offre hébergeur retenue.)*

### 3.3 — Point mort

- **Coûts fixes ≈ 50 €/mois** (ancre doc 08).
- **En one-shot :** une seule vente **Vitrine** (marge ≈ 600 €) couvre **≈ 12 mois** de fixes.
  → **point mort < 1 site vendu par mois.** Le point mort n'est pas l'enjeu du modèle one-shot.
- **En récurrent :** point mort ≈ 50 € de fixes / **19 €** de marge socle ≈ **~3 abonnés
  socle** (cohérent avec le **point mort ≈ 4 clients** du doc 08). L'option hébergement, à
  ~3 € de marge, ne contribue quasi pas au point mort — c'est voulu, elle n'est pas là pour ça.

**Le vrai enjeu n'est donc pas le point mort (atteint vite) mais le CAC et le taux de
conversion prospect gratuit → devis payé** — c'est là que se joue le résultat, pas dans le coût
unitaire.

### 3.4 — Sensibilité : les 2-3 hypothèses qui font basculer

| Hypothèse | Central | Bascule si… | Effet |
|---|---|---|---|
| **Taux de reprise humaine** | 12 % du prix | > 40 % (agents insuffisants → intervention lourde) | marge Vitrine tombe de 87 % à ~55 % ; **poste n°1 à mesurer** |
| **Taux de conversion gratuit → payé** | à mesurer | trop bas | le coût cumulé des maquettes gratuites (§1.1) dépasse la marge des rares ventes → **le gratuit devient une fuite** |
| **Nb d'itérations gratuites par prospect** | ~5 | non plafonné (20–50+) | coût funnel × 4–10 ; d'où les garde-fous §5 |

---

## 4. Le risque de marge structurel : le funnel gratuit « exploité »

Le HTML de la maquette est **exportable** (doc 18 §3, `downloadBoard` → `.html`). Un visiteur
peut donc théoriquement itérer une maquette gratuitement, l'exporter et partir : **on offrirait
un générateur de sites gratuit.** C'est le risque de marge n°1 du modèle, avant même l'API.

**Mitigation par le produit (déjà dans l'esprit du doc 19) :** la maquette gratuite est
**volontairement une maquette** — pas le site déployé, hébergé, avec contenu complet, SEO,
formulaires fonctionnels et back-office. Le livrable payé, c'est le **site exploitable mis en
ligne**, pas le HTML statique d'aperçu. Il faut **assumer et maintenir cet écart de valeur** :
c'est lui qui justifie le paiement. Si la maquette gratuite devient « déjà suffisante », le
modèle fuit.

---

## 5. Garde-fous quotas (concrets)

Traduction opérationnelle de « jamais d'illimité » :

**Funnel gratuit (pré-devis) :**
- **Plafond d'itérations maquette gratuites : 15 par projet.** Au-delà : message invitant à
  passer au devis (pas de blocage brutal, mais fin de la gratuité illimitée de fait).
- **Plafond de projets gratuits par compte / IP anonyme** (ex. 3) pour éviter le
  « générateur gratuit » à grande échelle. À câbler avec l'auth V2 (CLV-MEM).
- Instrumenter le **nombre d'itérations avant validation** (déjà recommandé doc 16 §6, CLV-10)
  pour caler ces plafonds sur du réel, pas au doigt mouillé.

**Création payée :**
- Le forfait inclut **N itérations d'affinage post-devis** (ex. 15) ; au-delà → nouveau devis
  d'évolution. La maquette pré-devis a déjà servi à décider.

**Abonnement (le poste à risque de marge négative) :**
- **Socle « Site vivant » (24 €) :** **20 itérations maquette/mois + 1 run d'évolution/mois
  inclus.** Excédent → **overage facturé au coût majoré** (ex. run d'évolution supplémentaire
  ≈ 1,50 € HT, soit ~3× le coût) **ou** blocage jusqu'au mois suivant. Jamais d'évolution
  illimitée.
- **Option hébergement (+9 €) :** **1 site hébergé** par abonnement. Sites additionnels →
  option supplémentaire, pas d'empilement gratuit. Désactivable à tout moment si le client
  rapatrie son hébergement (et le prix retombe à 24 €).
- **Règle d'or (doc 08) :** tout dépassement de quota **fait payer le run à son coût**. Un
  quota qui laisserait passer un usage à marge négative est un bug produit, pas une générosité.

---

## 6. Conclusion : viable sous conditions

**Viable sous conditions.** Le modèle est **structurellement à très forte marge brute**
(> 85 % sur le one-shot, ≈ 79 % sur le socle d'abonnement — l'option hébergement, quasi
pass-through à ~33 %, ne dégrade pas le cœur puisqu'elle est séparée) et **cash-positif dès le
premier site vendu** (pas de capex, coût marginal de production ≈ quelques euros). Le point
mort est atteint avec **< 1 vente/mois** (one-shot) ou **~3 abonnés socle** (récurrent,
cohérent doc 08).

Les conditions — **rien d'financier, tout de l'opérationnel** :
1. **Mesurer le taux de reprise humaine** sur les 10 premières productions (le seul poste qui
   peut casser la marge — §1.3, §3.4).
2. **Tenir l'écart de valeur maquette gratuite ≠ site payé** (§4), sinon le gratuit fuit.
3. **Câbler les garde-fous quotas** (§5) avant toute ouverture publique.
4. **Valider le taux de conversion gratuit → payé** (hypothèse n°1 du doc 08, non testée).

---

## 7. Besoin de financement (à passer à `factory-levee-de-fonds`)

Le service **ne réclame pas de gros financement** : marge brute élevée, cash-positif au premier
client, coût marginal quasi nul. Le besoin est un **fonds de roulement modeste**, pas un capex :

| Poste | Nature | Ordre de grandeur *(hypothèse à affiner)* |
|---|---|---|
| Crédit API du funnel gratuit avant conversion (CAC) | récurrent, variable | ≈ 0,30–0,60 € × nb de prospects/mois |
| Reprise humaine au démarrage (avant que les agents soient rôdés) | one-shot décroissant | provision 12–24 % du CA des 1ères ventes |
| Développement produit restant (V1 funnel + V2 auth/mémoire) | one-shot | à chiffrer avec `factory-direction` (roadmap) |
| Infra fixe | récurrent | ≈ 50 €/mois |

**Message à la levée :** ce n'est pas un modèle capitalistique à financer lourdement, c'est un
modèle à **valider commercialement** (conversion) puis à **scaler à marge quasi constante**. Le
capital sert d'abord à absorber le CAC gratuit et la reprise humaine le temps de fiabiliser les
agents — pas à acheter de l'actif. Fourchette de besoin à consolider une fois connus (a) le
volume de prospects visé et (b) le taux de reprise humaine réel.

---

*Chiffres de coût interne : estimés à partir des ancres des docs 08 / note CONSO — à recaler
sur un vrai run de 15-20 productions (bloqueur crédit API, cf. doc 08 §6). Prix externes : cités
et recoupés sur 2 sources. Tout ce qui n'est ni mesuré ni sourcé est marqué « à confirmer ».*
