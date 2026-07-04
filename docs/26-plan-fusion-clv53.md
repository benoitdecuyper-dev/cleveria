# 26 — Plan d'exécution dé-risqué de CLV-53 : promotion en place + fusion des surfaces

> **Statut : PLAN D'EXÉCUTION, prêt à câbler.** Traduit l'archi cible `docs/23` en une suite
> d'**incréments petits, indépendants et réversibles**. Décision produit déjà prise (GO Benoit).
> Objectif opérationnel explicite : *« max de monde sur le pont, je ne veux pas casser »* → **aucun
> incrément ne doit laisser l'arbre rouge** (tsc + 68 tests unitaires + 4 e2e) ; chacun se **revert
> par un simple `git revert` du commit**.
>
> Socle déjà en place (CLV-52, commit `c973279`) : `stage` (`echange|cadrage|maquette|prod`),
> `engageProject()` monotone dans `lib/history.ts`, routage `/api/brief` sur `stage`. **`engageProject`
> n'est PAS encore câblé à l'UI** — c'est le point de départ.

---

## 0. Le principe de dé-risquage (lire avant de coder)

Le risque n°1 de la fusion (`docs/23` §4.3) est de **fusionner deux machines d'annulation de flux
streamé** : `/echange` (demi-duplex `speakTokenRef` + `sendAbortRef` + boucle
listening→thinking→speaking) et `/voice` (`sendAbortRef` + `maquetteAbortRef` + `ttsAbortRef` +
jeton `isCurrent()`). **On ne les fusionne pas.** On garde **la machinerie de `/voice`** (le
sur-ensemble, déjà testée, déjà porteuse du board/maquette/GO) comme **unique** moteur, et on
**retire** celle de `/echange` plutôt que de la coudre à l'autre. La boucle mains-libres survit :
`/voice` a déjà `handsFreeRef`/`pendingAutoListenRef` (dictée + VAD auto-envoi + ré-écoute après
TTS). Ce qu'on **ne porte pas en V1** : le visuel « orbe » demi-duplex toujours-à-l'écoute de
`/echange` — c'est un **polish produit**, isolable derrière le stage `echange`, à ré-introduire plus
tard si le PO le veut. **Cette décision retire la quasi-totalité du risque §4.3 de la table.**

Corollaire : on **ne code jamais** deux boucles voix en parallèle dans le même composant. Une seule
source de vérité du tour courant (`isCurrent()` sur `sendAbortRef`), déjà en place dans `/voice`.

---

## 1. Ordre des incréments (du moins risqué au plus structurant)

| # | Incrément | Effort | Risque |
|---|---|---|---|
| 1 | Passerelle `/echange` en **promotion en place** (fin du fork) | ~0,5 j | Faible-Moyen |
| 2 | `/voice` sait **porter un stage `echange`** non-engagé (rail + rendu live oral) | ~1–1,5 j | Moyen |
| 3 | Bouton **« Transformer en projet » sur `/voice`** + abandon propre du tour en vol | ~1 j | Moyen (cœur §4.3, mais 1 seule machinerie) |
| 4 | **Historique unifié** sur `/voice` (tous stages + badge) | ~0,5 j | Faible |
| 5 | **Rediriger `/echange` → `/voice`** (entrée « échange libre » préservée) | ~0,5 j | Faible |
| 6 | **Nettoyage** (code mort du fork, libellés, orbe) | ~0,5 j | Faible |

Transversal (hors arbre applicatif, à `factory-devops`) : **canari démo de bout en bout** + test de
`getRun()` après redémarrage — cf. §3.

Chaque incrément est **un commit** (ou une petite série), livrable et revert-able seul. L'ordre est
choisi pour que **chaque étape réduise la surface de la suivante** : on tue d'abord le vecteur de
corruption le plus grave (le fork inter-conversations), puis on outille `/voice`, puis on y déplace
la bascule, puis on sécurise l'historique, puis seulement on redirige, puis on nettoie.

---

## 2. Détail par incrément

### Incrément 1 — Passerelle `/echange` en promotion en place (fin du fork)

**Pourquoi en premier.** C'est le geste le moins cher qui retire **immédiatement** le vecteur que
Benoit craint : aujourd'hui `toProject()` (`echange/page.tsx` ~ligne 577) **forke** une nouvelle
conversation (`newId()` + `saveConversation` stage `cadrage` + `sourceConversationId`) puis navigue
`/voice?cadrer=1&conv=<nouvel id>`. Ce fork = un échange orphelin possible + une **navigation
inter-conversations** = le terrain exact de la corruption SSE. On le remplace par
`engageProject(memeId)` : **le même objet est promu sur place**, on navigue sur le **même `id`**.
C'est aussi la preuve de bout en bout que `engageProject` marche, sur la surface la plus simple,
avant de toucher `/voice`.

**Ce qu'on change** — `apps/web/app/echange/page.tsx`, fonction `toProject()` uniquement :
- S'assurer que l'échange courant est **persisté** (il l'est déjà via `persist()` au 1er message ;
  garde : si `convIdRef.current` est `null`, persister d'abord en stage `echange`, puis engager).
- Remplacer le bloc `saveConversation({... new id ..., stage:"cadrage", sourceConversationId ...})`
  par `await engageProject(convIdRef.current)` (échange→cadrage **en place**, `engagedAt` posé).
- Naviguer `router.push(\`/voice?cadrer=1&conv=${convIdRef.current}\`)` (**même id**, plus de fork).
- **Garde P0-2 conservé** : si `engageProject` remonte une erreur (stockage bloqué), on **ne
  navigue pas** et on affiche la bannière — pas de demi-engagement, l'échange reste exploitable.

**Ce qu'on vérifie après** (prouve que rien n'a cassé) :
- `tsc` + `68 tests` + `4 e2e` verts (aucun e2e ne touche `/echange` → intacts par construction).
- `lib/history.test.ts` couvre déjà `engageProject` (monotonie, `engagedAt`, no-op si déjà engagé).
- Manuel : un échange → « Transformer en projet » → `/voice` ouvre **le même fil**, la need card
  sort **une seule fois** ; l'historique **ne montre pas** de doublon échange+projet (un seul objet
  qui a changé de stage) ; l'objet **quitte** la liste `/echange` (stage ≠ echange) et **apparaît**
  dans la liste `/voice`.

**Point de rollback :** `git revert` → `toProject()` reforke comme avant. Aucune autre surface
touchée.

**Effort ~0,5 j · Risque Faible-Moyen** — la seule subtilité est la course « conv pas encore
persistée avant d'engager » (couverte par le garde ci-dessus).

> Note : ce code est **transitoire** (il disparaît à l'incrément 5 quand `/echange` redirige). On le
> livre quand même : il ship une sécurité réelle tout de suite, isolée et revert-able, et valide
> `engageProject` avant le gros œuvre.

---

### Incrément 2 — `/voice` sait porter un stage `echange` non-engagé

**Pourquoi.** Pour que `/voice` devienne la surface unique, elle doit savoir **héberger une
conversation non-engagée** (pas de board, `ECHANGE_OPS`, réponse orale). Aujourd'hui `/voice` envoie
**toujours** `fd.append("stage","cadrage")` (ligne ~776) et se persiste toujours en `cadrage|maquette`
(ligne ~469). On introduit un **stage porté par le state**, **dormant par défaut** : une **nouvelle**
conversation démarre **inchangée** (engagée, maquette-first — le chemin qui vend, `docs/24/25`). Le
stage `echange` n'est atteint que par une conv `echange` **ouverte depuis l'historique** (rail posé
pour les incréments 3–5).

**Ce qu'on change** — `apps/web/app/voice/page.tsx` :
- Ajouter `const [stage, setStage] = useState<ProjectStage>("cadrage")` (+ un `stageRef` si lu dans
  un callback de flux). Dérivé à l'ouverture d'une conv : `setStage(conv.stage)` dans
  `openConversation()` et le bootstrap `?conv=`. `newConversation()` remet `"cadrage"` (défaut
  actuel préservé).
- `send()` : `fd.append("stage", stage === "echange" ? "echange" : "cadrage")` (au lieu du
  littéral). En stage `echange`, **ne pas** entrer dans le fast-path maquette ni armer le GO.
- Persistance (effet ligne ~442) : écrire `stage: stage === "echange" ? "echange" : (board maquette
  ? "maquette" : "cadrage")` — le garde-fou reste **jamais dérivé d'une ligne `MODE:`**.
- **Rendu live d'un tour oral sans ligne `MODE:`** (le point à soigner) : `ECHANGE_OPS` renvoie du
  **texte oral brut**, sans `MODE:`/`VOIX:`/`BOARD:`. Dans la boucle SSE de `send()`, `headerParsed`
  reste `false` (pas de `MODE:`) → aujourd'hui `showLive()` ne s'appelle jamais pendant le flux.
  Ajouter : si `stage === "echange"`, afficher le texte brut en live (`showLive(raw)`) sans tenter le
  parse board/questions. `finalize()` reçoit déjà `mode:"echange"`, `board:null`, `isNote:false` →
  rend simplement le texte, pas de GO, pas de board. **Rien à changer côté serveur** (déjà géré,
  `route.ts` ligne ~348).

**Ce qu'on vérifie après :**
- e2e `chat` + `maquette` **verts** (ils partent tous en engagé, ne touchent jamais `echange`).
- Nouveau test (unit sur le payload `send`, ou e2e) : une conv stage `echange` ouverte → les tours
  s'affichent **en live**, **aucun board**, **aucun GO**, `fd stage="echange"`.
- Manuel démo : chemin maquette-first **strictement identique** (nouvelle conv toujours engagée).

**Point de rollback :** `git revert` → `/voice` toujours engagé (stage figé). Le défaut n'ayant
jamais changé, aucun utilisateur n'est impacté même avant revert.

**Effort ~1–1,5 j · Risque Moyen** — concentré sur le rendu live du tour oral et le routage
`finalize()` en stage `echange`.

---

### Incrément 3 — Bouton « Transformer en projet » sur `/voice` + abandon propre du tour en vol

**Pourquoi.** C'est la **promotion en place intra-surface** : sur `/voice`, une conversation
`echange` porte un bouton « Transformer en projet » qui **promeut le même objet** puis produit la
need card — sans navigation, sans fork, **sans changer de conversation**. C'est le **cœur §4.3**,
mais désormais sur **une seule** machinerie d'annulation (celle de `/voice`), pas deux cousues.

**Ce qu'on change** — `apps/web/app/voice/page.tsx` :
- Afficher le bouton « Transformer en projet → » **uniquement si `stage === "echange"`** (dans la
  `vbar`, à côté de l'historique).
- Handler `engage()` :
  1. `sendAbortRef.current?.abort()` + `maquetteAbortRef.current?.abort()` — **abandonner tout tour
     `echange` en vol** (un delta périmé ne doit plus écrire une fois l'objet engagé ; c'est un
     changement de contexte, comme un changement de conversation).
  2. `const updated = await engageProject(convIdRef.current)` — échange→cadrage **en place**.
     Garde P0-2 : échec → bannière, **on ne bascule pas** le stage.
  3. `setStage("cadrage")`.
  4. `void send({ force: true })` — **un seul** tour cadrage forcé → need card sous
     `BRAS_DROIT_INSTRUCTIONS`.
- **Invariant à tenir (`docs/23` §4.2)** : la need card est produite **exactement une fois** — pas
  de double tour, pas de tour perdu. La séquence abort→engage(await)→setStage→send garantit qu'aucun
  ancien flux ne survit à la bascule.

**Ce qu'on vérifie après :**
- Manuel démo : conv `echange` sur `/voice` → « Transformer » → la need card sort **une fois**,
  **même fil**, board affiché ; le GO apparaît ; un tour `echange` **en cours de stream** au moment
  du clic est **proprement abandonné** (pas de bulle fantôme, pas de delta après bascule).
- `tsc` + tous tests verts (le bouton n'existe qu'en stage `echange`, jamais atteint par les e2e
  engagés).

**Point de rollback :** `git revert` → bouton absent, une conv `echange` reste `echange`.

**Effort ~1 j · Risque Moyen** — la course abort/engage/send est le vrai point dur ; il est **borné
à une seule machinerie**, ce qui est tout l'intérêt de l'ordre choisi.

---

### Incrément 4 — Historique unifié sur `/voice` (tous stages + badge)

**Pourquoi, et pourquoi AVANT le redirect.** Une fois `/echange` redirigé (incr. 5), sa liste
d'historique disparaît. Or `/voice` filtre aujourd'hui `listConversations("voice")` → **stage ≠
echange** : les conversations `echange` deviendraient **invisibles et injoignables**. Il faut donc
**unifier la liste AVANT** de rediriger, sinon on orpheline des données. Ceci **acte le renversement
de `docs/13` §1** (deux listes filtrées → une liste badgée), comme prévu par `docs/23` §2.2 règle 3.

**Ce qu'on change :**
- `apps/web/lib/history.ts` : ajouter `listAllConversations(): Promise<ConversationSummary[]>` (tous
  stages, tri récent) — additif, ne touche pas `listConversations(mode)` existant (donc `/echange`
  reste vert tant qu'il vit).
- `apps/web/app/voice/page.tsx` : `refreshList` → `listAllConversations()`.
- `apps/web/app/components/HistoryPanel.tsx` : afficher un **badge de stage** discret (« Échange » vs
  « Projet » / « En prod ») via `ConversationSummary.stage` (déjà présent). Sectionnement optionnel.

**Ce qu'on vérifie après :**
- `/voice` → tiroir historique montre **échanges ET projets**, badge correct ; ouvrir une conv
  `echange` la charge en stage `echange` (dépend de l'incr. 2) ; e2e verts (le badge n'altère pas le
  parcours, `.hist-open` inchangé).
- `lib/history.test.ts` : ajouter un cas `listAllConversations` (mélange de stages, tri).

**Point de rollback :** `git revert` → `/voice` liste engagés-seuls. À faire **avant** l'incr. 5 ;
ne jamais rediriger `/echange` tant que cet incrément n'est pas en place (sinon orphelinage).

**Effort ~0,5 j · Risque Faible.**

---

### Incrément 5 — Rediriger `/echange` → `/voice` (entrée « échange libre » préservée)

**Pourquoi maintenant.** À ce stade `/voice` est le sur-ensemble complet : il porte l'`echange`
(incr. 2), la promotion en place (incr. 3), l'historique unifié (incr. 4). On peut **fermer
`/echange` sans lien mort**.

**Ce qu'on change :**
- `apps/web/app/echange/page.tsx` → **redirect client** vers `/voice` (`useRouter().replace`), avec
  `?echange=1` pour **démarrer une conversation non-engagée** et **préserver l'entrée « discuter »**
  (sinon l'entrée « échange libre » disparaîtrait du produit). Côté `/voice`, bootstrap : si
  `?echange=1`, `setStage("echange")` sur une conv vierge.
- `apps/web/app/components/Breadcrumb.tsx` : `/echange` n'a plus de libellé propre (il redirige) ;
  `/voice` garde son libellé (renommage cosmétique du chemin = **hors périmètre**, `docs/23` §7).
- **Aucun lien entrant cassé** : la home (`app/page.tsx`) pointe déjà `/voice` ; `layout.tsx` n'a pas
  de lien `/echange` (le `SiteNav`/switch n'existe déjà plus dans ce repo). Un ancien favori
  `/echange` atterrit proprement sur `/voice`.

**Ce qu'on vérifie après :**
- Ouvrir `/echange` → arrive sur `/voice` (non-engagé si `?echange=1`) ; les conversations `echange`
  existantes restent ouvrables via l'historique unifié ; **aucune route morte**, aucun 404.
- `tsc` + tous tests verts.

**Point de rollback :** `git revert` → `/echange` redevient la page orbe complète (le code n'est pas
encore supprimé — la suppression est l'incr. 6). Rollback **sans perte**.

**Effort ~0,5 j · Risque Faible** — le filet : l'entrée « discuter » est **préservée** via
`?echange=1`, donc pas de régression produit silencieuse ; si le PO tranche l'entrée/home autrement
(`docs/23` §7), c'est un ajustement de ce paramètre, pas du chemin critique.

---

### Incrément 6 — Nettoyage (soustractif, après stabilisation)

**Ce qu'on change** (uniquement de la **suppression**, une fois les incréments 1–5 stables) :
- Retirer le code mort de la passerelle-fork (l'ancien `toProject` de l'incr. 1 est caduc puisque le
  bouton vit sur `/voice`) et cesser de produire `sourceConversationId` (reste **lu** pour compat
  legacy, `docs/23` §2.3).
- Réduire `apps/web/app/echange/page.tsx` à un pur redirect (supprimer boucle demi-duplex, orbe,
  `speakTokenRef`, STT dédié) — **ou** garder le fichier redirect minimal si on veut préserver l'URL.
- Unifier les libellés/breadcrumb résiduels.
- **Ne PAS toucher** au CSS (dark mode / magenta `--primary` restent intouchés — aucun incrément ne
  modifie `globals.css`).

**Ce qu'on vérifie après :** `tsc` + tous tests verts ; `grep` sur `toProject`/`fork`/`speakTokenRef`
= plus de références vivantes ; aucune régression visuelle (thème inchangé).

**Point de rollback :** `git revert`. Purement soustractif → rollback trivial.

**Effort ~0,5 j · Risque Faible.**

---

## 3. Ce qui NE DOIT PAS casser — et comment chaque incrément le préserve

| Invariant | Comment il est préservé |
|---|---|
| **Les 2 boucles voix** | On **ne les fusionne pas** : la demi-duplex `/echange` est **retirée** (incr. 5–6), la dictée+VAD `/voice` (déjà mains-libres via `handsFree`/`pendingAutoListen`) devient l'unique boucle. Jamais deux machines d'annulation dans le même composant → §4.3 neutralisé. |
| **Streaming SSE + AbortController + `isCurrent()`** | On garde **intacte** la machinerie `/voice` (`sendAbortRef`/`maquetteAbortRef` + jeton `isCurrent()`). Incr. 3 : la bascule de stage `abort → engage(await) → setStage → send({force})` traite la transition comme un changement de contexte (même patron qu'`openConversation`). |
| **Protocole board (MODE/VOIX/BOARD/MAQUETTE)** | Inchangé côté serveur et `parseReply`. En stage `echange` le serveur envoie `ECHANGE_OPS` (pas de protocole) ; `/voice` route sur `stage`, **jamais** sur une ligne `MODE:` du LLM. |
| **Flux maquette-first + fast-path retouche** | Le stage `echange` est **hors** du fast-path (incr. 2) ; en `cadrage`/`maquette` le comportement `/voice` est **inchangé** (défaut préservé). e2e maquette verts à chaque incrément. |
| **Auto-cadrage `?cadrer=1`** | Incr. 1 : navigation sur le **même id** (plus de synchro inter-conv). Incr. 3 : `?cadrer` devient un **appel mémoire** (`engage()` + un seul `send({force})`), plus dépendant de l'ordre des effets. Invariant : need card **exactement une fois**. |
| **Historique IndexedDB + sauvegarde au 1er message** | `saveConversation`/`persist` inchangés ; garde P0-2 (échec → bannière, jamais silencieux) conservé partout. Incr. 4 unifie la **liste** (lecture), pas l'écriture ni le schéma. |
| **Garde-fou stage (jamais le MODE LLM)** | Aucun incrément ne dérive l'engagement d'un `MODE:` parsé. La bascule passe **uniquement** par `engageProject()` sur acte utilisateur (bouton). |
| **Dark mode / magenta** | Aucun incrément ne touche `globals.css` ni le `THEME_SCRIPT` de `layout.tsx`. |

**Observabilité (exigence d'archi → `factory-devops`, `docs/23` §5)** — hors arbre applicatif, en
parallèle : un **canari démo** (`demo=1`, sans crédit) qui exécute la chaîne de valeur de bout en
bout — `engage → tour cadrage forcé → need card reçue (board) → GO → synthèse reçue` — et **assert
le signal de bout en bout**, pas un simple `200`. Plus : **éprouver** `getRun()` après redémarrage du
process (run en mémoire perdu → état « run expiré, relancer », `docs/23` §6) **avant** de fonder
dessus. Spéc à passer à `factory-devops` ; ne bloque aucun incrément 1–6.

---

## 4. Sort des routes (séquencé, jamais de lien mort)

```
Route          Avant                    Après CLV-53 (fin incr. 6)
─────          ─────                    ──────────────────────────
/              hero-pitch → /voice      inchangé (CTA → /voice)          [jamais touché]
/echange       orbe demi-duplex         redirect → /voice(?echange=1)    [incr. 5, puis vidé incr. 6]
/voice         Projet engagé            SURFACE UNIQUE (echange + engagé) [incr. 2-4]
/run/[id]      dashboard du run         inchangé (vue « prod » de l'objet) [hors périmètre CLV-53*]
```

*`/run/[id]` : le lien `runId` sur l'objet + l'état « run expiré » (`docs/23` §6) sont **hors
périmètre de ce plan** (chantier prod séparé) — CLV-53 ne le régresse pas (le GO navigue déjà vers
`/run/[data.runId]` comme aujourd'hui). Le redirect `/echange` (incr. 5) est posé **après**
l'historique unifié (incr. 4) → **aucune conversation orphelinée, aucun 404** à aucun moment.

---

## 5. Principal risque résiduel

Après avoir sorti la fusion des deux boucles voix de la table (§0), le risque résiduel se concentre
en **un seul point** : la **transition de stage pendant un flux `echange` en vol** (incr. 3). Si le
`send({force:true})` de cadrage part **avant** que le flux `echange` précédent soit proprement
abandonné et que `engageProject` ait écrit, on peut obtenir un **double tour** ou un **delta périmé**
qui écrit dans l'objet fraîchement engagé (need card en double / bulle fantôme). Mitigation : séquence
stricte `abort → await engageProject → setStage → send({force})`, sur **une seule** machinerie
`isCurrent()`, couverte par un test (manuel démo + e2e « transformer pendant un tour en vol »). C'est
le seul endroit à écrire avec le maximum de soin et de tests — tout le reste est additif ou
soustractif.

Risque **produit** (pas une casse technique, à trancher PO/Benoit) : la V1 **retire l'UX orbe
demi-duplex** de `/echange` au profit de la boucle dictée+VAD de `/voice`. Le mains-libres survit ;
seul le « feel » orbe toujours-à-l'écoute disparaît, ré-introductible plus tard, isolé derrière le
stage `echange`. À signaler, pas à trancher ici.

---

## 6. Recommandation — premier incrément à lancer

**Lancer l'incrément 1 (passerelle `/echange` en promotion en place, fin du fork).** C'est le geste
le moins cher, le plus indépendant et le plus réversible qui **retire immédiatement** le vecteur que
Benoit craint (fork + navigation inter-conversations = terrain de la corruption SSE), **prouve
`engageProject` de bout en bout** sur la surface la plus simple, et **ne touche pas** le chemin qui
vend (maquette-first `/voice`). Un commit, un revert, zéro e2e impacté.
</content>
</invoke>
