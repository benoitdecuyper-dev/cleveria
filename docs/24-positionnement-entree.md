# 24 — Repositionnement de l'entrée (accueil) pour le client « je veux un site »

> Rédigé par le marketing/communication de la Factory, 2026-07-04, à la demande de Ben
> après son retour sur l'accueil actuel : « le "bras droit" n'est pas vraiment adapté à
> l'interfaçage d'un client qui veut un nouveau site web. » S'appuie sur
> [`19-service-site.md`](./19-service-site.md) (le parcours), [`20-etude-marche-cleveria.md`](./20-etude-marche-cleveria.md)
> (la cible et ses réflexes), [`14-marque.md`](./14-marque.md) et [`17-pitch.md`](./17-pitch.md)
> (la marque et le pitch existants), et la décision déjà actée dans `BACKLOG.md` (épic
> `CLV-E-ARCHI`, GO Benoit 2026-07-03) : **une seule surface, la conversation ; le Projet
> = objet ; « home/pitch = mener par le Projet (le site se vend, l'assistant seul non) » ;
> le bras droit reste — c'est la douve — mais n'est plus la promesse d'entrée.**
>
> Ce document **ne touche ni au produit ni au parcours** (doc 19 n'est pas remis en
> cause) : il traite uniquement la **façon dont on introduit** ce service à quelqu'un qui
> arrive avec une intention précise — « j'ai besoin d'un site » — et pas encore l'envie
> de comprendre comment Cleveria fonctionne en interne.

## Cible et contexte (préalable)

**Qui arrive sur cette page ?** D'après le segment d'entrée retenu par l'étude de marché
(doc 20 §4) : un indépendant, un consultant, un petit professionnel de service, ou une
petite association — quelqu'un qui décide seul (ou presque), qui n'a **pas de site**, ou
qui en a un **vieilli/bricolé** qu'il veut moderniser. Il arrive soit par une recherche
(« créer site internet association », « refaire mon site indépendant »), soit par
recommandation. Il **ne cherche pas un outil d'IA** — il cherche **un site**, et il a
déjà en tête trois options connues : se débrouiller seul (Wix/Squarespace), payer une
agence/un freelance, ou demander au neveu qui code. Ce qu'il redoute : perdre du temps à
piloter un projet qu'il ne maîtrise pas, payer avant de voir un résultat, ou tomber sur
un jargon technique qui confirme que « ce n'est pas pour lui ». Ce à quoi il est
réceptif : voir vite un résultat concret, ne rien payer tant qu'il n'est pas convaincu,
sentir qu'une vraie équipe finit le travail derrière. Ce à quoi il est **allergique** :
le vocabulaire produit interne (« agents », « bras droit », « équipe à la demande ») qui
ne répond à aucune de ses questions immédiates (« est-ce que je suis au bon endroit ? »,
« qu'est-ce que j'obtiens, et à quel risque ? »).

**Registre juste** : professionnel, concret, orienté résultat — pas de survente, pas de
tagline creuse, mais une promesse claire et un CTA qui nomme l'outcome (le site), pas le
mécanisme (la conversation). Le document ci-dessous est rédigé au vouvoiement
professionnel, cohérent avec l'accueil actuel déjà en « vous » — voir la remarque de
cohérence en fin de document (§4) sur la tension avec le tutoiement du pitch général
(doc 17) et de `/echange`.

---

## 1. Diagnostic — pourquoi l'accueil actuel rate ce client-là

L'accueil actuel (`apps/web/app/page.tsx`) :

> Votre équipe, à la demande
> Dites-nous ce que vous voulez faire
> Une conversation avec votre bras droit suffit pour démarrer. Il vous écoute, cadre
> votre besoin avec vous, puis mobilise une équipe d'agents pour le réaliser — quand vous
> êtes prêt à passer à l'action.
> [Commencer une conversation →]

Quatre problèmes précis pour la cible « je veux un site » :

1. **Aucune confirmation qu'on est au bon endroit.** Rien dans le titre, l'accroche ou le
   CTA ne mentionne « site », « site web » ou un mot-clé de recherche que cette personne
   aurait tapé. Un visiteur qui arrive avec une intention précise doit se reconnaître en
   3 secondes ; ici, la page pourrait tout aussi bien vendre un service juridique ou un
   plan marketing. C'est le problème n°1, et il suffit à lui seul à faire rebondir.
2. **Le message mène par le mécanisme, pas par le résultat.** « Bras droit », « mobilise
   une équipe d'agents » décrivent *comment* Cleveria fonctionne, pas *ce que le client
   obtient*. C'est exactement l'inversion que `docs/14-marque.md` §1 identifie déjà comme
   erreur à éviter pour la marque en général (« le mot qui compte, c'est livrer ») — sauf
   qu'ici elle est appliquée à l'envers sur l'entrée dédiée au service phare.
3. **Le vocabulaire risque de braquer, pas seulement de ne pas convaincre.** « Une équipe
   d'agents » sonne technique/IA pour un public non technique (TPE, association) — l'étude
   de marché (doc 20 §1.2, §3) est claire : l'obstacle de cette cible n'est ni le prix ni
   la technique, il est « conversationnel et décisionnel » — elle n'a ni le temps ni le
   vocabulaire pour piloter un projet web. Un jargon d'orchestration d'agents ajoute de la
   friction exactement là où il faut en retirer.
4. **L'argument le plus fort du marché est invisible.** Le vrai différenciateur de
   Cleveria face à la concurrence (doc 20 §3.1 : « zéro décision de design à porter seul
   avant de voir un résultat, ET gratuit jusque-là ») n'apparaît nulle part sur l'accueil.
   Ni une agence ni un DIY builder n'offrent ce combo — c'est l'argument qui devrait être
   en tête de page, pas une ligne parmi d'autres plus bas dans le parcours.

**En deux lignes** : l'accueil actuel vend l'assistant générique (« votre équipe à la
demande ») quand ce client précis vient acheter un site — et le seul argument vraiment
différenciant de Cleveria sur ce marché (maquette réelle, gratuite, avant tout paiement)
n'y figure pas.

---

## 2. Le repositionnement — promesse, hero, et le sort du mot « bras droit »

### La promesse d'accueil

L'entrée doit dire, dans cet ordre : **(1) c'est un site — vous êtes au bon endroit ; (2)
vous voyez un résultat concret et gratuit avant de décider ; (3) une vraie équipe le
construit ensuite.** Le mécanisme (une conversation avec un bras droit) vient soutenir
cette promesse, pas la précéder.

### Trois variantes de hero, prêtes à coller

**Variante 1 — recommandée (l'outcome et le risque inversé en premier)**

```
Création & refonte de site internet — pour indépendants, TPE et associations

Votre site, avant de payer un centime.

Décrivez votre activité, ou donnez-nous l'adresse de votre site actuel : en quelques
minutes, vous voyez une vraie maquette de votre futur site — gratuitement. Vous ne
validez un devis que si le résultat vous convainc ; c'est alors notre équipe qui
construit le site pour de vrai.

[Voir la maquette de mon site — gratuit →]

Pas de formulaire à remplir : vous en discutez avec votre bras droit Cleveria, qui
construit la maquette avec vous, à votre rythme.
```

**Variante 2 — l'aisance du process en avant (contre la friction identifiée doc 20 §0)**

```
Un site web, sans cahier des charges à écrire

Expliquez votre projet. Voyez votre site apparaître.

Pas de jargon technique, pas de brief à rédiger : vous nous parlez de votre activité (ou
nous donnez l'URL de votre site actuel à moderniser), et une maquette réelle prend forme
sous vos yeux, gratuitement. Convaincu ? Un devis clair, puis une équipe la construit.

[Créer mon site — gratuit →]
```

**Variante 3 — courte, le bras droit nommé une fois en soutien**

```
Cleveria — sites web pour indépendants, TPE, associations

Un vrai site. Une vraie maquette gratuite. Avant toute décision.

Décrivez votre projet ou transmettez-nous votre site actuel : votre bras droit Cleveria
échange avec vous et fait apparaître une maquette concrète en quelques minutes. Rien
n'est facturé avant que vous ayez vu — et validé — le résultat.

[Démarrer gratuitement →]
```

Les trois partagent la même architecture : **eyebrow qui nomme le service et la cible,
titre qui nomme l'outcome + le risque inversé (gratuit, avant paiement), lead qui explique
le geste concret (décrire ou coller une URL) et rappelle que c'est gratuit jusqu'à la
maquette, CTA qui nomme le livrable (« mon site », « la maquette »), jamais l'action
générique (« commencer une conversation »).**

### Le mot « bras droit » : tranché — en façade ou second rideau ?

**Décision : il passe en second rideau sur cette entrée.** Il n'apparaît **ni dans
l'eyebrow, ni dans le titre, ni dans le CTA** — il peut apparaître **une fois**, en
sous-texte ou dans un bloc « comment ça marche » juste en dessous du hero, une fois que
la promesse (le site, gratuit, sans risque) est déjà comprise.

**Argumentation** :
- C'est cohérent avec la décision déjà actée (`BACKLOG.md`, épic `CLV-E-ARCHI`) : « home/
  pitch = mener par le Projet, le site se vend, l'assistant seul non. » Ce document
  applique cette décision à la lettre — il ne la rediscute pas, il en tire la conséquence
  concrète sur le hero.
- Le bras droit **reste** un atout réel (mémoire, relation, tunnel de conversion — la
  douve identifiée dans `BACKLOG.md`) — on ne le supprime pas du vocabulaire de marque, on
  le repositionne : il devient le **comment**, pas le **quoi**. Une fois que le visiteur
  sait qu'il va obtenir un site gratuit avant de payer, apprendre qu'il y arrive « en
  discutant avec un bras droit » est une information rassurante et différenciante (ce
  n'est pas un formulaire, ni un générateur one-shot façon Durable) — mais seulement à ce
  moment-là, pas avant.
- Cette cible n'est pas réceptive au vocabulaire de mécanisme IA en première ligne (doc 20
  §1.2, §3) : elle juge sur le résultat et le risque, pas sur l'élégance du dispositif
  conversationnel. Mettre « bras droit » en titre revient à répondre à une question
  qu'elle ne pose pas encore.
- Le mot n'est pas mis à la casse ailleurs dans la marque : il reste la signature du
  pitch général (doc 17, pour un public déjà curieux du produit/des investisseurs) et le
  nom d'usage dans `/echange` (« Bras droit — Échange »). Rien ici ne demande de le
  retirer de ces contextes — seulement de son rôle de tête d'affiche sur l'entrée qui vend
  le site.

---

## 3. Articulation avec le reste du parcours

- **Le mode conversation reste le « comment », introduit juste après la promesse.** Un
  bloc court sous le hero (3 étapes, langage client, pas les noms d'états internes du doc
  19) peut porter ce rôle :
  1. *Vous décrivez votre projet, ou vous nous donnez l'adresse de votre site à
     moderniser.*
  2. *En quelques minutes, une maquette réelle de votre site apparaît — vous l'ajustez en
     discutant, autant de fois qu'il faut.*
  3. *Convaincu ? Un devis clair vous est présenté. Une fois validé, une équipe complète
     construit le site pour de vrai.*
  C'est là, et seulement là, que « bras droit » peut apparaître une seconde fois si
  besoin (ex. légende de l'étape 1 : « votre bras droit échange avec vous »).

- **La maquette gratuite doit être le moment fort mis en scène, pas une phrase parmi
  d'autres.** C'est l'argument différenciant n°1 identifié par l'étude de marché (doc 20
  §3.1) — aucun concurrent (Wix, Squarespace, agences, B12) n'offre exactement ce combo
  gratuit + concret + avant décision. Recommandation pour `factory-ux-ui` (à qui revient
  la maquette du hero, pas moi) : envisager un aperçu visuel (capture ou rendu stylisé
  d'une maquette) dès le premier écran, pas seulement une promesse en texte — le texte
  décrit, l'image prouve.

- **Le devis doit être présenté comme un argument de confiance, pas comme un obstacle
  qu'on repousse discrètement plus bas dans la page.** « Vous ne payez qu'après avoir vu
  votre site » doit rester dans les deux premières lignes du hero (c'est déjà le cas dans
  les 3 variantes proposées) — c'est l'inverse du cycle agence classique (devis avant
  résultat) et du DIY (le client porte seul le risque de temps). Le retenir plus bas
  affaiblirait l'argument au moment où il pèse le plus.

- **Point d'attention non résolu ici, à signaler pour la suite** : le CTA de l'accueil
  mène aujourd'hui vers `/echange`, dont le hero actuel dit « De quoi veux-tu qu'on
  parle ? » / « Appuie et parle » — un accueil **vocal, générique, au tutoiement**, sans
  aucune mention de site ni d'URL à coller. Un visiteur qui vient de lire une promesse
  précise sur `/` (« votre site », vouvoiement) atterrit sur un écran qui ne confirme plus
  rien de cette promesse et change de registre en cours de route. Ce n'est pas un défaut
  de copywriting isolé, c'est une rupture du principe « une audience = un objectif = un
  message » au changement de page. Je le signale ici sans le trancher : la réécriture de
  `/echange` (accueil du mode conversation lui-même, pas seulement `/`) sort du périmètre
  de ce document mais devrait suivre dans la foulée, une fois ce hero validé.

---

## 4. Ce qui doit changer dans la microcopie existante

- **`apps/web/app/page.tsx`** — eyebrow, titre, texte et libellé du CTA du hero : à
  remplacer par une des trois variantes du §2 (ou une synthèse). Les liens discrets
  restants (« Retrouver mes projets », « Voir une démo ») peuvent rester, en reformulant
  éventuellement « Voir une démo » en « Voir un exemple de maquette » pour renforcer la
  promesse maquette dès cette ligne secondaire.

- **`apps/web/app/layout.tsx`** — métadonnées `title`/`description` : actuellement
  « Cleveria — votre agence d'agents IA » / « Confiez votre besoin à votre bras droit :
  une équipe d'agents IA le cadre et le réalise. » C'est le même problème que le hero,
  mais sur le canal SEO/partage de lien (le titre d'onglet, l'aperçu partagé sur
  réseaux/messagerie) : aucune mention de « site » alors que c'est précisément ce que
  cette cible recherche. À reformuler autour du service (ex. « Cleveria — Créez ou
  modernisez votre site web » / description mentionnant indépendants, TPE, associations,
  maquette gratuite) plutôt qu'autour du mécanisme IA.

- **`apps/web/app/echange/page.tsx`** — le hero avant le premier message (« De quoi
  veux-tu qu'on parle ? » / « Appuie et parle. Je te réponds à voix haute, puis je
  réécoute. ») : à minima, incohérence de registre à corriger (tutoiement ici, vouvoiement
  sur `/`) indépendamment de ce chantier ; idéalement, un accueil qui confirme la
  promesse du hero (site/URL) plutôt qu'une invite à parler de « n'importe quoi » — sujet
  qui dépasse ce document (touche à CLV-33/34, capture d'URL, pas encore construites) mais
  à garder en tête pour la suite immédiate.

- **Cohérence de registre globale, à signaler sans la trancher ici** : le pitch général
  (doc 17) et la personnalité de marque (doc 14 §2, « Ton de voix : Tutoiement ») sont
  écrits au tutoiement, alors que l'accueil actuel et ce document sont au vouvoiement. Ce
  n'est pas nécessairement une erreur — un client qui commande un site est dans une
  relation plus proche d'une commande de service professionnel que du tutoiement d'un
  outil quotidien — mais c'est une divergence de fait entre deux documents de marque qui
  mérite d'être actée explicitement plutôt que de rester implicite.
