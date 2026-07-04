# 23 — Architecture de la bascule : une seule surface, le Projet comme objet

> **Statut : ARCHI CIBLE, prête à séquencer.** Traduit en structure technique la décision de
> fond validée par Benoit (GO 2026-07-03) : on **tue le switch Assistant/Projet**. Une seule
> surface = **la conversation**. Le **Projet devient un objet de 1er niveau créé DEPUIS la
> conversation**. Un échange pur = l'**état zéro** d'un projet non engagé.
> Épic de référence : **`CLV-E-ARCHI`** (`CLV-46` cadrage → `CLV-47` étage 1 → `CLV-48` étage 2).
> Cadrage produit associé : `factory-product-owner` (chiffrage, séquencement fonctionnel).
> Ce document est l'**architecture technique** ; il ne tranche pas le droit du produit (copie
> home, pitch) — signalés « à valider PO/Ben ».

---

## 0. Décision structurante (le pivot)

Aujourd'hui, le champ `mode: "echange" | "voice"` sur la conversation (`lib/history.ts`)
**confond deux choses distinctes** :

1. la **surface d'UX** (orbe vocal mains-libres `/echange` vs chat+board `/voice`) ;
2. l'**état d'engagement** (« je discute » vs « je fabrique un projet »).

La bascule les **découple**. Il n'y a plus qu'**une surface**. Elle porte un **cycle de vie**
explicite : `echange` (état zéro, pas de board) → `engagé` (board actif, objet Projet). Cet
état est porté par l'**objet**, jamais par une reclassification LLM phrase-par-phrase.

**Le garde-fou (non négociable) se lit dans une seule règle :**

> La transition `echange → engagé` est **un acte utilisateur explicite** (bouton « Transformer
> en projet », ou clic GO). **Aucune ligne `MODE:` du LLM ne peut la déclencher.** Le serveur
> choisit ses instructions (`ECHANGE_OPS` vs board) d'après le **`stage` de l'objet**, pas
> d'après ce que le modèle a écrit en première ligne.

C'est exactement la fragilité n°1 que le switch réglait (`docs/12` : « un projet part parfois
en direct/board sans GO »). Le switch était le garde-fou côté UX ; en le retirant, on le
**déplace dans l'objet**. Si on laissait la ligne `MODE:` du LLM rouvrir l'engagement, on
réintroduirait le bug. Le routage LLM survit **uniquement à l'intérieur d'un objet déjà
engagé** (choisir `cadrage` vs `maquette` vs `direct` une fois que l'utilisateur a opté pour
le projet) — là il ne décide plus du « moment magique », il ne fait que router une sous-étape.

---

## 1. Fusion des surfaces — devenir des routes

Aujourd'hui : `/` (chooser 2 dalles) → `/echange` (orbe vocal, `ECHANGE_OPS`, pas de board) et
`/voice` (chat + board + maquette + GO). Le `SiteNav` (header) porte le switch. `/run/[id]` est
le dashboard du run (SSE depuis `runStore` en mémoire). `/echange` possède une passerelle
`toProject()` qui **forke** une nouvelle conversation `mode:"voice"` et navigue vers
`/voice?cadrer=1&conv=<id>`.

Cible :

```
AVANT                                   APRÈS (cible)
─────                                   ─────────────
/            chooser « 2 dalles »   →   /            pitch mené par le Projet, 1 CTA → surface
/echange     Assistant (orbe vocal) →   (redirige) ─┐
/voice       Projet (chat + board)  →   ────────────┼─►  SURFACE UNIQUE « conversation »
SiteNav      switch Assistant|Projet →  SUPPRIMÉ     │    idle = orbe/texte (echange)
                                                     │    engagé = chat + board (projet)
/run/[id]    dashboard du run       →   /run/[id]   INCHANGÉ — « vue prod » de l'objet Projet
/brief       démo/legacy (NoteView) →   retiré ou isolé en chemin démo (dette CLV-12)
/live        scaffold LiveKit       →   inchangé — chantier temps réel futur (docs/12 niv. 3)
```

**Détail des décisions :**

- **`SiteNav` : supprimé** (`CLV-47`). Le sélecteur de mode disparaît du header (`layout.tsx`).
  `Breadcrumb` : retirer les libellés `Assistant`/`Projet`, garder « Projet en cours » pour
  `/run/*` ; l'entrée conversation n'a plus besoin d'un libellé de mode.

- **Surface unique** : on **fait de `/voice` le moteur** (c'est déjà le sur-ensemble — board,
  maquette, historique, GO, machinerie d'abort/STT), et on **replie l'expérience orbe de
  `/echange`** comme **pré-état `idle`/`echange`** de ce même composant. `/echange` **redirige**
  vers la surface unique. Un renommage cosmétique du chemin (`/atelier`, `/conversation`…) est
  un polish **non structurant**, à faire plus tard — ne pas le mettre sur le chemin critique de
  l'étage 1.

- **`/` (home)** : le chooser 2 dalles disparaît. Tension à arbitrer (PO/Ben) : `CLV-47` dit
  « conversation = atterrissage », mais la REPRISE dit « home/pitch mené par le Projet » (le
  site se vend, l'assistant seul non). **Résolution proposée** : `/` reste un **hero de pitch
  court, un seul CTA** qui ouvre la surface conversation — pas un second sélecteur déguisé. On
  garde une page vendeuse ET une seule porte. Copie à valider PO (et `CLV-50` : reformuler
  l'histoire du logo « relais » sans référence au switch).

- **`/run/[id]` : conservé, mais raccroché à l'objet.** Aujourd'hui le run vit seul (`runStore`
  en mémoire) et **la conversation ne stocke pas son `runId`** — donc rouvrir un projet « en
  prod » ne reconnecte pas son dashboard. On **ajoute `runId` sur l'objet** (cf. §2) : `/run/[id]`
  devient la **vue de l'étape `prod`** d'un Projet, et la réouverture du projet y ramène.

> **YAGNI persistance (rappel de méthode) :** l'étage 1 **n'ajoute aucune couche de stockage**
> nouvelle — on réutilise l'IndexedDB existant. Le seul champ ajouté qui *écrit* est `runId`, et
> il est **relu** (rouvrir le dashboard) → il gagne sa place, ce n'est pas un canal en double.

---

## 2. Modèle de données — « fil + mémoire par projet »

### 2.1 De `mode` à `stage` (le cycle de vie porté par l'objet)

Le discriminant `mode: "echange" | "voice"` — qui mélangeait surface et engagement — est
remplacé par un **`stage`** de cycle de vie, aligné sur `CLV-46` (échange / cadrage / maquette
/ prod) :

```ts
type ProjectStage =
  | "echange"    // état zéro : pure conversation, pas de board, ECHANGE_OPS. Jetable.
  | "cadrage"    // ENGAGÉ : board actif, need card. BRAS_DROIT_INSTRUCTIONS (protocole board).
  | "maquette"   // ENGAGÉ visuel : maquette HTML dans le board (routage LLM interne autorisé).
  | "prod";      // GO donné : un run tourne / a tourné → runId posé, dashboard /run/[id].

// `engaged` est DÉRIVABLE (stage !== "echange"), mais on matérialise la bascule (engagedAt)
// pour que ce soit un ACTE tracé, pas une relecture du contenu.
type StoredConversation = {
  id: string;
  stage: ProjectStage;          // REMPLACE `mode`
  title: string;
  titleIsCustom: boolean;
  messages: unknown[];          // format INCHANGÉ (celui de la page)
  board: unknown | null;        // toujours null en stage "echange"
  runId?: string | null;        // NOUVEAU — lien vers /run/[id] (relu à la réouverture)
  engagedAt?: string | null;    // NOUVEAU — horodatage de l'acte echange→engagé (trace)
  sourceConversationId?: string;// conservé (compat legacy) mais plus produit : promotion en place
  createdAt: string;
  updatedAt: string;
  userId: string | null;        // toujours null en V1 — pont Supabase V2 (inchangé)
  schemaVersion: 2;             // BUMP 1→2 : ajout stage/runId/engagedAt
};

type ConversationSummary =
  Pick<StoredConversation, "id" | "stage" | "title" | "updatedAt">; // stage remplace mode
```

**Machine à états (le garde-fou est dans les flèches) :**

```
        [nouvelle conversation]
                 │
                 ▼
          ┌────────────────┐
          │    echange     │   pas de board · ECHANGE_OPS · orbe vocal / texte
          │  (non engagé)  │   = état zéro d'un projet
          └───────┬────────┘
                  │  ★ GESTE EXPLICITE : « Transformer en projet »
                  │     (JAMAIS une ligne MODE: du LLM)  → engagedAt posé
                  ▼
          ┌────────────────┐   MODE: maquette / cadrage
          │    cadrage     │◄──────────────►┌────────────┐
          │  board actif   │  routage LLM   │  maquette  │
          │  need card     │  INTERNE, déjà │ board HTML │
          └───────┬────────┘  engagé (OK)   └─────┬──────┘
                  │  ★ GESTE : GO                   │  ★ GESTE : GO prod
                  ▼◄────────────────────────────────┘
          ┌────────────────┐
          │      prod      │   runId posé → /run/[id] (runStore / SSE)
          │  équipe lancée │
          └────────────────┘

★ = transition d'engagement pilotée par l'OBJET (acte utilisateur). Les flèches sans ★
    (cadrage↔maquette) sont un routage LLM autorisé car l'objet est DÉJÀ engagé.
```

### 2.2 Traduction du garde-fou dans le store / le state

Trois règles d'implémentation, toutes vérifiables :

1. **Sélection des ops serveur par `stage`, pas par `MODE:`.** `/api/brief` reçoit déjà le
   `stage` (aujourd'hui le front envoie `mode=echange` ou rien — on généralise). Le serveur
   applique `ECHANGE_OPS` **si et seulement si** `stage === "echange"`, sinon
   `BRAS_DROIT_INSTRUCTIONS`. Le LLM n'a **aucun** levier sur l'engagement.

2. **La bascule d'engagement est une action de store dédiée**, pas un effet de bord du parsing :

   ```ts
   // lib/history.ts (nouveau) — transition EN PLACE, monotone (ne régresse jamais vers echange)
   engageProject(id: string): Promise<void>  // stage: echange→cadrage, engagedAt=now
   ```

   Elle est appelée **uniquement** par le bouton « Transformer en projet » (et implicitement
   par le GO, qui passe déjà par un objet engagé). Aucun code de flux SSE ne l'appelle.

3. **Une seule liste d'historique** (les deux sidebars filtrées `mode` fusionnent). On badge par
   `stage` (« Échange » vs « Projet »/« En prod ») pour la lisibilité. **⚠️ Ceci renverse la
   décision de `docs/13` §1** (« deux vues filtrées, pas une liste fusionnée illisible ») : cet
   argument valait dans le monde à deux modes ; dans le monde unifié, un échange qui devient
   projet **est le même objet qui évolue** → une seule liste est la représentation correcte. À
   acter explicitement dans `docs/13`.

### 2.3 Promotion EN PLACE (fin de la passerelle par fork)

Aujourd'hui `toProject()` (`echange/page.tsx`) **crée une nouvelle conversation** `mode:"voice"`
avec `sourceConversationId`, puis navigue vers `/voice?cadrer=1&conv=<id>`. Dans la surface
unique, « Transformer en projet » **promeut le même objet sur place** (même `id`, même fil) :

- Plus de fork, plus de `sourceConversationId` produit, plus d'échange orphelin possible.
- Plus de navigation `?conv=<id>` ni de synchronisation inter-conversations → **le risque de
  corruption inter-conversations des flux SSE disparaît sur ce chemin** (on ne change pas de
  conversation).
- `?cadrer=1` (produire la need card tout de suite) devient un **appel en mémoire** : `engageProject()`
  puis **un seul tour cadrage forcé** (`send({force:true})`) sous les instructions board.

Les paires legacy déjà forkées (un `echange` + son enfant `voice` avec `sourceConversationId`)
restent deux objets séparés — inoffensif, on ne migre pas rétroactivement.

---

## 3. Étage 1 (V1, cheap) vs Étage 2 (V2, Supabase)

### Étage 1 — sans Supabase, sur l'IndexedDB existant (`CLV-47`)

- Suppression du `SiteNav` + copie home + breadcrumb.
- **Fusion des deux surfaces** en un composant (idle-orbe ↔ engagé-chat+board) — le gros morceau.
- Modèle : `mode → stage`, ajout `runId`/`engagedAt`, **bump `schemaVersion` 1→2** avec
  **migration paresseuse à la lecture** (cf. 3.3).
- Passerelle → **promotion en place** ; `?cadrer` → appel mémoire.
- Historique fusionné (badges de `stage`).
- `runStore` **reste en mémoire** (mono-instance Render, acceptable V1) ; `runId` sur l'objet
  permet de rouvrir le dashboard **tant que le run vit**. Après redémarrage du process, le run
  est perdu → prévoir un état **« run terminé/expiré — relancer »** quand `getRun()` renvoie
  `undefined` (pas de dashboard fantôme muet).

### Étage 2 — Supabase + auth + mémoire par projet (`CLV-48`, `CLV-MEM`)

- **Bloqueur externe** : quota Supabase gratuit (2 projets, déjà pris — `docs/06` §5). Rien à
  coder tant que le slot/budget n'est pas réglé.
- **Auth Google + `middleware.ts` + upsert par `id`** : les conversations locales (`userId:null`)
  sont **upsertées telles quelles** dans Supabase, le `id` client sert de clé — **pas de
  remapping** (`docs/13` §8, déjà conçu).
- **Mémoire par projet** : chaque projet = son fil + ses **faits distillés** réinjectés. Le point
  d'injection existe **déjà** : `prefsBlock()` dans `/api/brief` (aujourd'hui alimenté vide /
  `userContext`) est le **seul point de couplage runtime** (`docs/06` §3). V2 le remplit depuis
  le profil Supabase + la mémoire distillée du projet → **zéro réécriture**, on remplit un slot posé.
- `runStore` (mémoire) → table `runs` Supabase ; `runId` de l'objet devient une **FK durable**.

### 3.3 Chemin de migration SANS réécriture — oui, le squelette le permet

La question posée (« le `schemaVersion`/`userId:null` déjà posés le permettent-ils ? ») : **oui**,
à trois conditions déjà réunies + une à ajouter à l'étage 1 :

- `userId: string | null` **déjà présent** → l'upsert V2 renseigne `userId` sans changer le `id`.
- `schemaVersion` **déjà présent** → on **incrémente proprement** : l'étage 1 pose `2`
  (ajout `stage/runId/engagedAt`, **additif, non destructif**) ; l'étage 2 pourra poser `3`
  (champs de synchro fine, ex. tombstone `deletedAt` pour propager un delete multi-appareils) —
  toujours additif.
- **Migration paresseuse `1→2` à la lecture** (à écrire à l'étage 1, dans `getConversation`/
  `listConversations`) : un enregistrement `schemaVersion:1` lu est **remappé à la volée** —
  `mode:"echange"→stage:"echange"` ; `mode:"voice"` → `stage` **dérivé du contenu**
  (`board.kind==="maquette"→"maquette"` ; `board` présent →`"cadrage"` ; `runId` →`"prod"` ;
  sinon `"cadrage"`). `migrateLegacyVoice()` (qui écrivait `mode:"voice"`) doit produire du
  `schemaVersion:2 / stage` dérivé de la même façon.
- **Réconciliation de nommage à surveiller** : `docs/06` prévoit une table `projects`, `docs/13`
  §8 une table `conversations`. Comme **l'objet est désormais unifié** (la conversation *est* le
  projet), il faut **une seule table** côté Supabase (au choix `projects`, avec le fil dans une
  table `messages` liée + `runs`). Trancher au moment de brancher l'étage 2 ; le modèle local
  unifié rend ce choix indolore.

---

## 4. Ce qui casse / les pièges (à border avant de coder)

1. **Le protocole board `MODE:/VOIX:/BOARD:` reste fragile — mais ce n'est plus lui qui garde
   l'engagement.** En retirant le switch, l'**unique** rempart contre « un projet démarre sans
   GO » devient le `stage` de l'objet + la sélection d'ops par `stage`. Règle de conception à
   graver : **jamais** dériver l'engagement d'un `MODE:` parsé. Le vrai correctif de fond du
   routage interne reste **`CLV-5` (sortie structurée / tool use)** — indépendant mais
   complémentaire ; à prioriser après la fusion.

2. **Auto-cadrage `?cadrer=1`.** Aujourd'hui : param d'URL → `send({force:true})` après
   chargement d'un `?conv=<id>`, orchestré par `autoCadreRef`/`didAutoCadreRef` en attendant que
   les messages soient chargés — **fragile et dépendant de l'ordre des effets**. En promotion en
   place, ce cross-navigation disparaît au profit d'un appel mémoire, mais l'invariant à
   préserver est : **`engage()` produit la need card exactement une fois** (pas de double tour,
   pas de tour perdu). À re-tester finement, chemin démo inclus.

3. **AbortController de streaming — le risque n°1 de la fusion.** Chaque surface a **sa propre**
   machinerie : `/voice` = `sendAbortRef` + `maquetteAbortRef` + `ttsAbortRef` + le jeton
   `isCurrent()` ; `/echange` = `sendAbortRef` + `speakTokenRef` + la boucle demi-duplex
   (listening→thinking→speaking→listening). **Fusionner deux composants qui ont chacun leur modèle
   d'annulation est là où la corruption d'état se loge.** Deux boucles mains-libres différentes
   (démi-duplex `/echange` vs dictée-champ + auto-envoi `/voice`) doivent devenir **une**. Le
   patron « jeton `isCurrent()` = source unique de vérité du tour courant » doit **survivre** :
   un tour `echange` en vol doit être **proprement abandonné** si l'objet s'engage en cours de
   stream (transition de `stage` = changement de contexte, comme un changement de conversation
   l'est aujourd'hui). C'est le code à écrire avec le plus de soin et de tests.

4. **La passerelle « Transformer en projet ».** Passe de fork+navigation à `engageProject()` en
   place. Conserver le garde P0-2 : **si la sauvegarde de la transition échoue** (stockage bloqué),
   **ne pas demi-engager** ni perdre l'échange — prévenir et rester exploitable (bannière
   d'erreur, canal critique visible, jamais silencieux). `sourceConversationId` n'est plus produit
   (auto-promotion), mais reste lu pour compat.

5. **Fusion des sidebars.** Renverse `docs/13` §1 (cf. 2.2). Vérifier que `listConversations()`
   ne filtre plus par `mode` et que le badge `stage` reste lisible quand échanges et projets se
   côtoient (sectionner par `stage` si besoin).

6. **`runId` absent aujourd'hui.** Sans lui, un projet « prod » rouvert ne retrouve pas son
   dashboard, et après redémarrage serveur le run en mémoire est perdu → **prévoir l'état gracieux
   « run expiré, relancer »** (`getRun()` undefined). C'est un chemin critique : ne pas laisser un
   dashboard muet.

7. **Migration legacy.** `migrateLegacyVoice` + le flag `cleveria.history.migrated.v1` doivent
   cohabiter avec le remap `1→2`. Un enregistrement legacy migré doit ressortir en `schemaVersion:2`
   avec un `stage` cohérent (cf. 3.3), sinon il retombe dans le remap paresseux à chaque lecture
   (inoffensif mais inutile).

8. **Copie & marque (non-archi, à signaler).** Home 2-dalles retirée, logo « relais » à
   re-narrer sans le switch (`CLV-50`). Product/marketing, pas ce document.

---

## 5. Observabilité du chemin critique (exigence d'archi → `factory-devops`)

Le canal qui **porte la valeur** est la chaîne : `engage → tour cadrage forcé → need card rendue
→ GO → run produit une synthèse`. Elle repose sur **deux flux SSE bloquants** (`/api/brief` et
`/api/run/[id]/stream`). À poser **dès la conception**, pas en rustine :

- **Health-check de bout en bout, pas un 2xx intermédiaire.** Un canari synthétique en mode
  démo (`demo=1`, sans crédit) : `engage un projet démo → assert réception de l'événement need
  card (board) → GO → assert réception de l'événement synthèse`. Ce qui prouve que le chemin
  **vit** = **le signal de bout en bout reçu**, pas un simple `200` de `/api/brief`.
- **Échec du canal critique = visible.** Un tour cadrage/GO qui échoue ou est annulé doit
  **remonter une erreur rendue** (bannière existante), **jamais** être avalé silencieusement
  derrière une écriture IndexedDB secondaire. L'ordre de criticité : le tour LLM (valeur) est
  **devant** la persistance locale (best-effort, déjà non bloquante et remontée en P0-2).
- **Capacité à éprouver AVANT de fonder dessus** : le comportement de `getRun()` après
  redémarrage (run perdu) est une capacité runtime à **tester** (`factory-devops`), pas à
  supposer — l'état « run expiré » du point 6 en dépend.

Spécification à passer à `factory-devops` pour la mise en œuvre (le canari + l'alerte, pas ce
document).

---

## 6. Effort et risque (ordre de grandeur)

| Chantier | Effort (o.d.g.) | Risque | Où se loge le risque |
|---|---|---|---|
| **Étage 1** | | | |
| Supprimer `SiteNav` + copie home + breadcrumb | ~0,5 j | Faible | Cosmétique |
| Modèle `mode→stage` + `runId`/`engagedAt` + remap paresseux `1→2` | ~1 j | Faible | Isolé dans `lib/history.ts`, additif |
| **Fusion des deux surfaces (une boucle, un modèle d'abort)** | **~4–7 j** | **Élevé** | Streaming/abort/STT, protocole board — cf. §4.3 |
| Promotion en place + `?cadrer` en mémoire | ~1–2 j | Moyen | Need card « exactement une fois » |
| Historique fusionné + badges `stage` | ~1 j | Faible | Renverse `docs/13` §1 |
| État « run expiré » (`runId` + `getRun` undefined) | ~0,5 j | Faible | Chemin prod gracieux |
| **Total étage 1** | **~1,5–2,5 semaines** | **Élevé, concentré** sur la fusion ; **faible partout ailleurs** | |
| **Étage 2** (après déblocage Supabase) | | | |
| Auth Google + `middleware` + upsert par `id` | moyen | Faible (archi) | Chemin pré-conçu (`docs/06`/`13`) |
| Mémoire par projet distillée (`CLV-MEM`) | moyen | Moyen | Qualité/coût de la distillation (le vrai travail neuf) |
| `runStore` → table `runs` Supabase | moyen | Faible | Adaptateur, slots posés |
| **Total étage 2** | **multi-semaines, bloqué par un pré-requis EXTERNE** | **archi Faible** (`userId`/`schemaVersion`/`prefsBlock`/`runId` déjà posés) ; **produit Moyen** sur la mémoire | |

**Lecture** : l'étage 1 est **majoritairement cheap et sûr, sauf un noyau** (la fusion des
surfaces streamées) qui concentre presque tout le risque de régression — c'est là qu'il faut
mettre les tests (unitaires sur le store/stage, e2e sur engage→need card→GO). L'étage 2 est
**architecturalement dérisqué d'avance** par les slots posés en V1 ; son seul verrou est
**externe** (quota Supabase, `docs/06` §5), et son seul vrai chantier neuf est la **mémoire
distillée** (qualité produit, pas plomberie).

---

## 7. À valider (hors périmètre archi — PO / Ben, ou pro)

- **Home** : hero-pitch à un CTA (proposé) vs conversation directement en `/` — arbitrage
  produit/positionnement (PO). Recoupe `CLV-50` (histoire du logo).
- **Fusion des deux sidebars en une liste** : acter le renversement de `docs/13` §1 (PO).
- **Nom du chemin de la surface unique** (`/voice` conservé vs renommage) : cosmétique, à décider
  hors chemin critique.
- **Étage 2 = décision business** (payer Supabase ou libérer un slot, `docs/06` §5) — pas une
  décision technique. Aucune ligne d'étage 2 à coder avant.
