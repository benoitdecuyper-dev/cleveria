# 13 — Historique de conversations (réinitialiser + retrouver)

> Demande de Ben (verbatim) : « Je veux que les discussions soient réinitialisées mais
> qu'il y ait une gestion d'historique. Vois avec le PO pour faire un truc clean avec les
> outils du marché. On n'invente rien. »
> Cadrage PO — 2026-07-03. Portée : **V1 local-first, sans auth ni Supabase** (V2 = cf.
> mémoire `cleveria-memoire-roadmap`, épic `CLV-MEM`). Deux surfaces concernées :
> `/echange` (Mode Assistant, vocal mains-libres) et `/voice` (Mode Projet, chat + board).

## Convention (à réutiliser telle quelle par le dev et la QA)

- Projet **CLV** (déjà en usage dans [`BACKLOG.md`](./BACKLOG.md)). Tickets **`CLV-N`**,
  numérotation **contiguë et globale** (on ne repart pas à 1 par feature) — dernier ticket
  posé avant celui-ci : `CLV-13`. Cette feature part donc à **`CLV-14`**.
- Regroupement en épic pour la lisibilité de ce document : **`CLV-E-HIST`**. C'est une
  étiquette de regroupement, **pas** un nouveau schéma d'ID — les tickets restent des
  `CLV-N` plats, cohérents avec `BACKLOG.md`.
- État : ⬜ à faire · 🟦 en cours · ✅ fait · 🔶 à valider (Ben) — même code que
  `BACKLOG.md`.
- Ce document est la source de vérité fonctionnelle ; **`BACKLOG.md` est mis à jour en
  écho** (section ajoutée, voir en bas de ce fichier) avec un lien retour ici.

---

## 1. Décision de fond : une ou deux historiques ?

**Un seul mécanisme de stockage, deux vues filtrées.** Chaque conversation porte un champ
`mode: "echange" | "voice"`. `/echange` liste et affiche uniquement `mode=echange`,
`/voice` uniquement `mode=voice`. Un seul module de persistance, deux sidebars qui
filtrent — pas deux systèmes à maintenir.

Pourquoi pas un historique unique mélangé (comme ChatGPT, qui n'a qu'une liste) : ici les
deux modes ne sont **pas** la même expérience (`docs/12-deux-modes.md`) — Échange est une
conversation orale jetable-brainstorm sans livrable, Projet est un travail avec board +
équipe qu'on relance. Les mélanger dans une seule liste rendrait la sidebar illisible
(un « brainstorm vocal de 2 min » à côté d'un « projet en cours avec équipe lancée »).

Pourquoi pas deux systèmes de stockage séparés non plus : ça duplique tout le code
CRUD/migration pour deux formats qui sont déjà structurellement proches (`{messages,
board}`), et ça complique la passerelle existante « Transformer en projet ». Avec un
stockage unique, cette passerelle devient triviale : elle crée un nouvel enregistrement
`mode="voice"` avec `sourceConversationId` pointant vers l'échange d'origine, au lieu
d'écraser une clé `localStorage` partagée à l'aveugle (bug latent actuel : `toProject()`
écrase la conversation `/voice` en cours si elle n'était pas encore ouverte/vidée).

---

## 2. UX cible (alignée ChatGPT / Claude)

**Où vit la liste** : un **rail latéral gauche**, comme ChatGPT/Claude.
- `/voice` : rail persistant sur desktop (colonne fixe à gauche de la mise en page
  actuelle `chat-pane`/`board-pane` — la page passe à 2-3 colonnes : `sidebar | chat |
  board`), repliable (icône hamburger dans la `vbar`), et **tiroir en overlay** sur
  mobile/écran étroit (comme les deux références du marché).
- `/echange` : la page est volontairement minimaliste (orbe plein écran, cf. `docs/12`) —
  pas de rail persistant. Une icône « historique » dans la `vbar` ouvre le **même
  composant en tiroir** (overlay), filtré `mode=echange`. On ne casse pas l'esthétique
  actuelle du mode Échange, on ajoute une porte d'accès.

**Contenu de chaque entrée** : titre (1 ligne, tronqué), date relative (« il y a 2h »,
« hier », date au-delà de 7 jours — pattern standard). L'entrée active est visuellement
distinguée (fond différent), comme dans les deux références.

**Actions** :
- **Nouvelle conversation** : bouton en tête de sidebar (réutilise l'icône `IcoNewChat`
  déjà présente dans la `vbar` de `/voice`, déplacée en tête de rail). Vide la vue en
  cours, **sans** rien effacer de l'historique — crée un enregistrement quand le premier
  message part (pas avant, pour ne pas polluer la liste de conversations vides).
- **Ouvrir / switcher** : clic sur une entrée → charge `messages` + `board` de cette
  conversation dans la vue. Coupe proprement tout ce qui tourne (dictée en cours, audio en
  lecture) avant de charger — même logique que `newConversation()` existant.
- **Renommer** : clic sur le titre ou menu contextuel (icône `⋯` au survol/tap, comme
  ChatGPT/Claude) → édition inline. Un titre renommé manuellement **n'est plus jamais**
  écrasé par le titre auto (flag `titleIsCustom`).
- **Supprimer** : menu contextuel → confirmation (`window.confirm` suffit en V1, pas de
  modale maison à construire). Suppression immédiate et définitive (pas de corbeille en
  V1 — comme ChatGPT/Claude en V1 de leur historique, la corbeille est venue après). Si on
  supprime la conversation actuellement affichée, la vue retombe à l'état vide (pas de
  conversation fantôme affichée).
- **Recherche/filtre** : **pas en V1**. Le volume attendu est faible (usage individuel,
  pas un historique d'équipe). Ne pas construire une recherche qu'on n'a pas encore le
  volume pour justifier — c'est le genre de chose à ajouter *seulement* si le nombre de
  conversations le justifie réellement.

**État vide** : la sidebar affiche un message explicite (« Aucune conversation pour
l'instant — commence à parler ») plutôt qu'une liste blanche silencieuse.

---

## 3. Modèle de données

```ts
type ConversationMode = "echange" | "voice";

type Conversation = {
  id: string;                    // crypto.randomUUID()
  mode: ConversationMode;        // filtre de sidebar
  title: string;                 // auto-généré, éventuellement renommé
  titleIsCustom: boolean;        // true dès renommage manuel → plus jamais écrasé auto
  messages: Msg[];                // format INCHANGÉ (celui de /voice ou /echange selon mode)
  board: Board | null;           // toujours null en mode "echange"
  sourceConversationId?: string; // passerelle échange→projet : trace l'échange d'origine
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601 — tri de la sidebar (plus récent d'abord)
  userId: string | null;         // toujours null en V1 (pas d'auth) — posé pour V2
  schemaVersion: 1;
};

// Résumé léger pour la sidebar — évite de charger messages/board juste pour lister.
type ConversationSummary = Pick<Conversation, "id" | "mode" | "title" | "updatedAt">;
```

`Msg` et `Board` restent **exactement** les types déjà définis dans `app/voice/page.tsx`
et `app/echange/page.tsx` — aucune réécriture du format existant, on l'enveloppe.

### localStorage vs IndexedDB — tranché : IndexedDB

| | `localStorage` (actuel) | IndexedDB (recommandé) |
|---|---|---|
| Quota | ~5-10 Mo par origine, **fixe et bas** | Géré par le navigateur, un pourcentage du disque libre — en pratique des centaines de Mo à plusieurs Go |
| API | **Synchrone**, bloque le thread principal sur les gros payloads | Asynchrone, ne bloque jamais l'UI |
| Écriture | String-only (`JSON.stringify` de tout le blob à chaque sauvegarde) | Enregistrements structurés, indexables |
| Adapté à | Une seule petite valeur | Beaucoup d'enregistrements, chacun lu/écrit indépendamment |

Le code actuel de `/voice` sérialise **tout** `{messages, board}` à chaque changement
stabilisé (`useEffect` sur `[messages, board, demo]`) — viable pour **une** conversation.
Avec un historique de N conversations, deux options : (a) un seul blob JSON contenant
toutes les conversations → chaque frappe/réponse réécrit tout l'historique, ça grossit
vite au-delà du quota `localStorage` dès que quelques boards markdown volumineux
s'accumulent ; (b) une clé `localStorage` par conversation → contourne (a) mais reste
synchrone et le quota total reste partagé et bas. **IndexedDB stocke chaque conversation
comme un enregistrement indépendant** : on écrit uniquement la conversation qui change,
on lit l'index léger (`id/title/mode/updatedAt`) pour peindre la sidebar sans charger le
contenu complet de chaque conversation. C'est l'outil du marché conçu exactement pour ce
cas (stockage client structuré, volumineux, multi-enregistrements) — pas une
sur-ingénierie.

---

## 4. Outils du marché — ce qu'on reprend, ce qu'on n'invente pas

**Côté UX** : le pattern rail latéral + tiroir mobile + titre auto + renommer/supprimer
est **directement calqué sur ChatGPT et Claude**. Aucune UI originale à inventer — c'est
explicitement la demande de Ben.

**Côté stockage** : l'API IndexedDB native est bas-niveau, callback-based, notoirement
verbeuse et source de bugs si on l'écrit à la main — ce serait justement « inventer » une
couche de promesses maison. Le marché a un outil standard pour ça :

- **`idb-keyval`** (Jake Archibald, qui maintient aussi `idb` — les deux sont des
  wrappers de référence autour d'IndexedDB, utilisés très largement dans l'écosystème
  front, y compris par des outils Google/Chrome). API minimaliste `get/set/del/keys`,
  ~600 octets gzippés, **zéro dépendance**, zéro couplage React — donc compatible Next 16
  / React 19 sans friction (usage `"use client"` + import dynamique côté navigateur
  uniquement, comme tout accès `localStorage`/`IndexedDB` actuel dans ce code). C'est
  suffisant : on n'a besoin que de get/set par clé (`conv:<id>`, `conv:index`), pas de
  requêtes complexes.
  **À confirmer par le dev avant d'installer** (dernière version publiée, statut de
  maintenance sur npm) — je n'ai pas d'accès réseau live pour le recouper à l'instant T,
  mais c'est un projet stable et connu depuis plusieurs années, pas une trouvaille
  exotique.
- **Alternative si le besoin grossit** (recherche, requêtes par date, tri serveur-side
  plus tard) : **Dexie.js**, wrapper IndexedDB plus complet (TypeScript-first, très
  utilisé), avec `dexie-react-hooks` (`useLiveQuery`) pour re-render automatique React sur
  changement de données. **Pas nécessaire en V1** — over-engineering pour un `get/set` par
  id trié en mémoire côté client.
- **Pas de librairie d'état globale (Redux/Zustand/Jotai)** : le composant garde son
  `useState` local comme aujourd'hui ; le module de persistance est un simple ensemble de
  fonctions async (`listConversations`, `getConversation`, `saveConversation`,
  `renameConversation`, `deleteConversation`) appelées depuis les `useEffect` existants.
  Ajouter un state manager pour ça serait la définition même d'« inventer un truc » qu'on
  n'a pas demandé.

---

## 5. Titre automatique

**Retenu (V1)** : les **premiers mots du premier message utilisateur**, tronqués à ~48
caractères sur une frontière de mot (+ `…` si tronqué). Zéro coût, zéro latence, zéro
dépendance à l'IA — généré au moment où le premier message part, avant même la réponse.

**Pourquoi pas un titre généré par le LLM** (ce que fait ChatGPT en asynchrone) : ça
ajoute un appel réseau, un coût, une latence, et un point de défaillance pour un gain
cosmétique marginal — le premier message décrit déjà quasi toujours bien le sujet
(« Un site vitrine pour mon activité » *est* un bon titre). Si un jour on veut l'affiner,
c'est un ajout non-bloquant sur le champ `title` existant, pas une réécriture.

Règle : un titre auto ne s'affiche que si `titleIsCustom === false`. Dès qu'un utilisateur
renomme (ticket `CLV-20`), `titleIsCustom` passe à `true` et le titre n'est plus jamais
regénéré automatiquement (même si l'utilisateur continue la conversation).

---

## 6. Migration de `cleveria.voice.v1`

`/voice` persiste aujourd'hui l'unique conversation en cours sous la clé `localStorage`
`cleveria.voice.v1`. Au premier chargement après déploiement de cette feature :

1. Si la nouvelle base IndexedDB est vide **et** que `localStorage['cleveria.voice.v1']`
   existe et contient des messages → on crée une `Conversation` (`mode: "voice"`) à partir
   de ce contenu (titre auto-généré depuis le 1er message), on l'insère comme 1ère entrée
   de l'historique, **puis** on supprime la clé `localStorage` legacy.
2. Un flag de migration (une clé `localStorage` `cleveria.history.migrated.v1`) empêche de
   rejouer la migration à chaque chargement — y compris si le contenu legacy était
   illisible (JSON corrompu) : on marque quand même « migré » pour ne pas boucler dessus,
   et on démarre à vide (comportement identique au `catch` silencieux déjà présent dans le
   code actuel).
3. `/echange` n'a **aucune** persistance actuelle → rien à migrer côté Échange, l'historique
   y démarre simplement vide.

Résultat garanti : **aucun utilisateur ne perd la conversation qu'il avait en cours.**

---

## 7. Découpage épic `CLV-E-HIST` — V1 local-first d'abord

### Fondation (bloquant tout le reste)

**⬜ CLV-14 — Module de stockage multi-conversations (IndexedDB via `idb-keyval`)**
Expose `listConversations(mode?)`, `getConversation(id)`, `createConversation(mode)`,
`saveConversation(conv)`, `renameConversation(id, title)`, `deleteConversation(id)`.
*Fait* = chaque conversation vit dans son propre enregistrement IndexedDB ; un index léger
(`id/mode/title/updatedAt`) permet de peindre une sidebar sans charger le contenu complet
de chaque conversation ; le schéma inclut `userId` (toujours `null` en V1) et
`schemaVersion` sans les exploiter (posé pour la V2, cf. §8).

**⬜ CLV-15 — Migration `cleveria.voice.v1` → 1ère entrée d'historique**
*Fait* = un utilisateur qui avait une conversation `/voice` en cours la retrouve, au
premier chargement après déploiement, comme 1ère entrée de son historique, sans action de
sa part ; la clé legacy est supprimée après migration réussie ; JSON corrompu → démarrage
à vide sans erreur visible. **Dépend de** `CLV-14`.

**⬜ CLV-16 — Bouton « Nouvelle conversation » → crée un enregistrement (au lieu d'écraser)**
Généralise le bouton déjà présent dans `/voice` (`newConversation()` actuel efface la
clé unique). *Fait* = cliquer « Nouvelle conversation » vide la vue courante sans effacer
l'historique existant ; la nouvelle conversation apparaît dans la sidebar dès l'envoi du
premier message (pas avant, pour ne pas polluer la liste de conversations vides).
**Dépend de** `CLV-14`.

### Visible (usage quotidien)

**⬜ CLV-17 — Sidebar historique — mode Projet (`/voice`)**
*Fait* = un rail latéral liste les conversations `mode=voice` triées par dernière
activité (titre + date relative) ; cliquer une entrée restaure `messages` + `board` de
cette conversation dans la vue ; la conversation active est visuellement distinguée ;
switcher coupe proprement dictée/audio en cours avant de charger ; état vide = message
d'invite (pas de liste blanche) ; repliable sur desktop, tiroir en overlay sous un
breakpoint mobile. **Dépend de** `CLV-14`, `CLV-16`.

**⬜ CLV-18 — Sidebar historique — mode Échange (`/echange`)**
Même composant que `CLV-17`, filtré `mode=echange`, ouvert via une icône dédiée dans la
`vbar` (tiroir, pas de rail persistant — la scène orbe reste plein écran). *Fait* = idem
`CLV-17`, transcript vocal restauré correctement à l'ouverture d'une entrée passée.
**Dépend de** `CLV-14`, `CLV-17` (réutilise le composant).

**⬜ CLV-19 — Titre automatique de conversation**
*Fait* = dès l'envoi du 1er message utilisateur, un titre (premiers mots tronqués, pas
d'appel LLM) apparaît dans la sidebar sans action de l'utilisateur ; ce titre n'écrase
jamais un titre renommé manuellement (`titleIsCustom`). **Dépend de** `CLV-14`.

**⬜ CLV-20 — Renommer une conversation**
*Fait* = depuis la sidebar (clic titre ou menu `⋯`), édition inline du titre, sauvegarde
immédiate, persiste au refresh ; passe `titleIsCustom` à `true`. **Dépend de** `CLV-17`.

**⬜ CLV-21 — Supprimer une conversation**
*Fait* = suppression depuis la sidebar avec confirmation ; si c'est la conversation
active, la vue retombe à l'état vide (pas de conversation fantôme affichée) ; suppression
immédiate et définitive (pas de corbeille en V1). **Dépend de** `CLV-17`.

**⬜ CLV-22 — Adapter la passerelle « Transformer en projet » au multi-conversations**
La fonction `toProject()` de `/echange` écrit aujourd'hui en dur dans la clé partagée
`cleveria.voice.v1` — avec l'historique multi-conversations, ça risque d'écraser une
conversation `/voice` existante. *Fait* = cliquer « Transformer en projet » crée une
**nouvelle** conversation `mode="voice"` (jamais un écrasement d'une conversation projet
existante), pré-remplie avec les messages de l'échange, avec `sourceConversationId`
pointant vers l'échange d'origine ; `/voice?cadrer=1` s'ouvre dessus, comportement de
production de la carte récap inchangé. **Dépend de** `CLV-14`.

---

## 8. Pont vers V2 (auth + Supabase) — pensé pour ne pas réécrire

Le modèle `Conversation` porte déjà `userId: string | null` et `schemaVersion: 1`. En V2
(épic `CLV-MEM`, auth Google + Supabase — déjà cadré ailleurs) :

- À la connexion, les conversations locales (`userId: null`) sont **upsertées** dans une
  table Supabase `conversations` par `id` (le même `id` généré côté client sert de clé —
  pas de remapping). `userId` se renseigne à ce moment.
- IndexedDB devient un **cache offline** (lecture immédiate, pas d'écran blanc en attendant
  le réseau) ; Supabase devient la source de vérité multi-appareils.
- Un `schemaVersion: 2` ajouterait alors les champs nécessaires à la synchro fine
  (ex. tombstone de suppression `deletedAt` pour propager un delete entre appareils) —
  ajout de champ non-cassant, pas une migration destructive, parce que le squelette V1 est
  déjà pensé pour ça.
- Rien de tout ça n'est à construire maintenant — le seul travail V1 est de **ne pas
  fermer la porte**, ce que fait le modèle ci-dessus.

---

## Résumé — décisions clés

1. **Un seul mécanisme de stockage, deux vues filtrées** (`mode: echange | voice`) — pas
   deux systèmes, pas une liste fusionnée illisible.
2. **IndexedDB, pas `localStorage`** — quota bas et écriture synchrone du blob unique
   actuel ne tiennent pas la charge de plusieurs conversations avec board volumineux.
3. **`idb-keyval`** comme wrapper (pas d'API IndexedDB brute écrite à la main, pas de
   state manager global) — *à confirmer côté maintenance npm par le dev avant merge*.
4. **UX calquée ChatGPT/Claude** : rail latéral (`/voice`) + tiroir (`/echange`), titre
   auto par troncature (pas de LLM), renommer/supprimer via menu contextuel, pas de
   recherche en V1 (volume insuffisant pour la justifier).
5. **9 tickets** `CLV-14` → `CLV-22`, fondation (`14-16`) puis visible (`17-22`), migration
   de `cleveria.voice.v1` incluse et garantie sans perte.
6. **V2 pas réécrite** : `userId`/`schemaVersion` posés dès V1 pour un upsert Supabase
   sans remapping d'ID.
