# 27 — Espace Projet (`/voice`) : board redimensionnable + en-tête « bras droit » (CLV-41/42/45)

Spec dev-ready. **Ne code pas** — ce document décrit le comportement, la structure DOM/CSS et les
points de vigilance pour que le dev implémente directement. Finalisé contre l'état **actuel** de
`/voice` (post-fusion CLV-53 : surface unique conversation + board + maquette + GO + rail échange
`?echange=1` + historique unifié avec badges Discussion/Projet), pas contre la maquette validée
avant la fusion.

Fichiers concernés : `apps/web/app/voice/page.tsx`, `apps/web/app/globals.css`,
`apps/web/app/components/HistoryPanel.tsx`.

---

## 1. Contexte — ce qui existe déjà (pour ne rien réinventer)

- `.voice` (racine) → si conversation démarrée (`started`) : `.vbar` (barre d'identité, UNE ligne :
  bouton historique icône seule, avatar, nom + statut, bouton « Transformer en projet » si
  `stage==="echange"`, nouvelle conversation, voix) puis `.workspace` (`.split` si un `board` existe).
- `.workspace.split` = **flex row** aujourd'hui : `.chat-pane` largeur **fixe** (420→460px selon
  breakpoint), `.board-pane` `flex:1`, `position:sticky; top:98px; max-height:calc(100vh - 88px)`
  (valeurs codées en dur, calées sur la hauteur actuelle de `.site-header`+`.crumbs-bar`).
- Scroll actuel : la **page** scrolle (le fil de conversation n'a pas son propre scroll interne,
  `stickToBottomRef` écoute `window`) ; le **board** scrolle en interne (`.board-body` ou, pour une
  maquette, l'iframe elle-même via `.board-body-mockup`).
- Mobile (≤860px) : colonnes empilées, chat **avant** board (`order:-1`, choix P1-6 volontaire :
  voir le fil sans scroller), board plafonné à `56vh`.
- Historique : tiroir overlay (`HistoryPanel`), déclenché par un bouton **icône seule** (`IcoHistory`,
  `aria-label` mais pas de libellé visible) — en `.vbar` pendant la conversation, en FAB flottant
  (`.voice-hist-fab`) sur l'accueil. Badges de stage (Discussion/Projet/En prod) existent **déjà**
  dans la liste (`HistoryPanel`, `STAGE_LABEL`) mais **pas** dans l'en-tête de la conversation ouverte.
- Machinerie fragile à ne jamais perturber : `sendAbortRef` / `maquetteAbortRef` / `ttsAbortRef`,
  jeton `isCurrent()`, bufferisation SSE (`showLive`/`finalize`), `MockupFrame` (iframe sandbox
  jamais montée sur du HTML partiel), `stickToBottomRef` (scroll page).

## 2. Objectifs de ce lot

1. **CLV-41** — le board (maquette ou brouillon) occupe une **grande surface exploitable**,
   redimensionnable board↔chat, scroll propre, sans casser le fil de conversation.
2. **CLV-42 / CLV-45** — une identité « bras droit » **lisible** en haut, avec le **fil courant**
   (titre de la conversation) visible, et un accès **historique évident** (pas juste une icône).
3. Cohérence stricte entre les deux états de la même page : **board absent** (stage `echange`,
   pur échange) et **board présent** (projet engagé) — aucun des deux ne doit paraître un
   sous-produit de l'autre.
4. Zéro régression sur le streaming/AbortController/scroll existants.

## 3. Layout desktop (> 860px)

### 3.1 Board présent (cas vitrine : le prospect regarde SON site)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [🕘 Historique]   🟪 Chef de projet · « Café associatif — la grange »    │  ← .vbar (§7)
│                     ● En ligne · prêt à lancer un projet     [🔊][+][→ Transformer en projet] │
├──────────────────────────────────────────────────────────────────────────┤
│  CHAT (largeur réglable : 320–560px, 400px par défaut)  ┊  BOARD (reste)  │
│ ┌────────────────────────────────────┐                  ┊ ┌─────────────┐│
│ │ fil de conversation (scroll page)  │                  ┊ │ Board · maquette en live · Gratuit │
│ │  bulle bot / bulle user            │                  ┊ │        [⤢ agrandir][⬇][✕]         │
│ │  …                                 │                  ┊ ├─────────────┤│
│ │                                    │                  ⋮ │             ││
│ │                                    │                  ⋮ │  maquette   ││
│ ├────────────────────────────────────┤                  ┊ │  (iframe,   ││
│ │ [📎][🎤][ Votre réponse…      ][➤] │                  ┊ │  scroll     ││
│ └────────────────────────────────────┘                  ┊ │  interne)   ││
│                                                           ┊ └─────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
                                                            ↑ poignée glissable (cursor: col-resize)
```

- La poignée est une bande verticale fine (~8px de zone de préhension, trait visuel ~1–2px) entre
  les deux colonnes. Curseur `col-resize`, léger surlignage `--primary` au survol/drag.
- Bornes : chat entre 320px et 560px (le board reste toujours majoritaire — c'est lui la valeur
  perçue). Pas de borne haute sur le board : il prend `1fr`, tout le reste.
- Double-clic sur la poignée = reset à la largeur par défaut (400px). *(Nice-to-have, pas bloquant.)*

### 3.2 Board « agrandi » (nouveau, recommandé)

Un bouton « Agrandir » dans `.board-actions` (avant télécharger/fermer) fait passer le board en
quasi plein écran : le chat disparaît visuellement, une pastille flottante en haut à gauche du
board permet de revenir. Utile quand le prospect veut vraiment scruter sa maquette sans la
distraction du fil.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [🕘 Historique]   🟪 Chef de projet · « Café associatif — la grange »    │
├──────────────────────────────────────────────────────────────────────────┤
│ [← Revenir à la discussion ●]        Board · maquette en live   [⤡][⬇][✕]│
│                                                                            │
│                         maquette plein écran                             │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

- `●` = pastille « nouveau message » si l'assistant a répondu pendant que le board était agrandi
  (la voix continue de narrer même board agrandi/chat masqué — ne jamais couper le TTS pour ça).
- Le composer disparaît avec le chat en mode agrandi (assumé : c'est un mode « lecture », pas
  « rédaction » — pour retoucher, on revient au fil via la pastille).

### 3.3 Board absent (stage `echange`, pur échange)

Inchangé : `.workspace` sans `.split`, `.chat-pane` prend toute la largeur (confort de lecture,
largeur de type article). Rien à faire ici — c'est déjà le comportement actuel via
`workspace ${board ? "split" : ""}`.

## 4. Layout mobile (≤ 860px)

### 4.1 Board présent → bascule par onglets, composer TOUJOURS actionnable

```
┌───────────────────────────────┐
│ [🕘] 🟪 Chef de projet          │  ← .vbar
│     « Café associatif… »  ●…   │
├───────────────────────────────┤
│ [ 💬 Discussion ] [ 🖥 Aperçu ●]│  ← .mtabs, segmented, sticky sous le vbar
├───────────────────────────────┤
│                                │
│  zone active = board OU fil,  │
│  plein écran (l'autre panneau │
│  reste MONTÉ, juste masqué —  │
│  voir §6, jamais démonté)      │
│                                │
├───────────────────────────────┤
│ [📎][🎤][ Votre réponse… ][➤] │  ← composer FIXE (position:fixed), visible sur les 2 onglets
└───────────────────────────────┘
```

- Onglet par défaut : **« Aperçu »** la toute première fois qu'un board apparaît dans la
  conversation (c'est la récompense — on la montre) ; ensuite, on respecte le choix manuel de
  l'utilisateur (pas de bascule automatique intempestive à chaque retouche).
- Pastille `●` sur « Aperçu » = la maquette vient d'être mise à jour pendant que l'utilisateur
  est sur « Discussion ». Pastille sur « Discussion » = un nouveau message est arrivé pendant que
  l'utilisateur regarde « Aperçu ». Purement informatif (pas de bascule forcée).
- Le composer reste réellement utilisable sur l'onglet « Aperçu » : on doit pouvoir dicter/écrire
  une retouche ("mets le header en bleu") **en regardant la maquette**, sans revenir sur
  « Discussion » d'abord.

### 4.2 Board absent

Inchangé : pas d'onglets, fil plein écran + composer sticky en bas (comportement actuel).

## 5. Mécanique de redimensionnement desktop

- Nouvelle petite pièce d'UI, un `<div className="split-handle" role="separator" aria-orientation="vertical">`
  insérée entre `.chat-pane` et `.board-pane`, **seulement rendue quand `board` est présent**
  (mêmes conditions que `.workspace.split` aujourd'hui). Cachée en CSS sous 861px (`display:none`),
  pas besoin de la démonter/remonter en JS.
- `.workspace.split` passe de `display:flex` à `display:grid` :
  `grid-template-columns: var(--chat-w, 400px) 8px minmax(0, 1fr);`
  `.chat-pane { grid-column: 1; }` / `.split-handle { grid-column: 2; }` / `.board-pane { grid-column: 3; }`.
- **Drag = manipulation DOM impérative, pas de re-render React à chaque pixel** : `onPointerDown`
  sur la poignée démarre l'écoute ; `onPointerMove` (sur `window`, tant que le pointeur est capturé)
  fait `workspaceEl.style.setProperty("--chat-w", `${clamp(px, 320, 560)}px`)` directement sur le
  nœud DOM — **aucun `setState` pendant le drag** (la page a déjà beaucoup d'état, un `setState` par
  `mousemove` créerait du jank et pourrait entrer en collision avec les effets de scroll/streaming).
  On ne commit dans un `useState`/`localStorage` (persistance de la largeur préférée, optionnel)
  qu'à `onPointerUp`.
- Bornes strictes 320–560px sur le chat ; le board n'a pas de borne haute (il absorbe le reste).

## 6. Mécanique de bascule mobile (onglets) — le piège à éviter

**Le piège** : si on cache l'onglet inactif avec `display:none` sur `.chat-pane`, ça cache AUSSI le
composer (même en `position:fixed`) puisqu'il est un descendant — `display:none` sur un ancêtre
masque tout descendant, `fixed` ou pas. Ça casserait l'exigence « composer toujours actionnable ».

**Mécanique recommandée** :
- `.workspace.split` (mobile) devient `position: relative`.
- `.chat-pane` et `.board-pane` passent en `position: absolute; inset: 0` (superposés, dans le
  même rectangle), **jamais démontés**.
- La bascule utilise `visibility` (jamais `display:none`) + `pointer-events: none` sur le panneau
  inactif : `[data-mobile-view="board"] .chat-pane { visibility: hidden; pointer-events: none; }`.
- Le composer, à l'intérieur de `.chat-pane`, **force explicitement** `visibility: visible` (la
  visibilité ne se propage pas si un enfant la réinitialise — comportement CSS standard, contrairement
  à `display`) : `.chat-pane .composer { visibility: visible; pointer-events: auto; }`. Il reste donc
  visible et cliquable même quand `.chat-pane` est visuellement masqué.
- Pas de restructuration du DOM (pas de sortie du composer hors de `.chat-pane`) → risque minimal
  sur la machinerie existante, rien n'est démonté, `MockupFrame` (iframe) et les refs de streaming
  restent intacts quel que soit l'onglet actif.
- Nouvel état UI **pur affichage**, isolé de tout le reste : `mobileView: "chat" | "board"`. Ne doit
  **jamais** conditionner l'exécution de `send()`, `sendMaquetteFeedback()`, `callMaquette()` —
  uniquement une classe/attribut CSS sur `.workspace.split`. Réinitialisé à `"chat"` par
  `newConversation()`/`openConversation()` (repasse à « board » automatiquement dès qu'un nouveau
  board apparaît, cf. §4.1).

## 7. En-tête d'identité — contenu, emplacement, microcopie

Objectif : qu'on sache d'un coup d'œil **qui** parle et **de quel fil** il s'agit, sans avoir à
ouvrir l'historique. On reste sobre — pas de tagline, pas de survente : c'est un repère
fonctionnel, pas un moment marketing.

`.vbar` (déjà positionnée au-dessus de `.workspace`, donc déjà « au-dessus de la discussion » —
ce qui manque aujourd'hui c'est la **lisibilité** et le **fil courant**, pas la position) :

```
[Historique]   Chef de projet · « Café associatif — la grange »        [voix] [+] [Transformer en projet]
                En ligne · pret a lancer un projet
```

Changements :
- **Bouton historique** : ajouter un libellé texte visible « Historique » à côté de l'icône
  (≥ 480px ; icône seule + `aria-label` conservé en dessous de 480px, cible tactile inchangée/
  élargie). Même traitement sur le FAB de l'accueil (`.voice-hist-fab`) — cohérence entre les deux
  états. C'est le cœur de CLV-45 : rendre l'accès **visible**, pas juste accessible.
- **Fil courant** : afficher le **titre de la conversation** juste après « Chef de projet »
  (tronqué avec ellipsis si long), ex. `Chef de projet · « Café associatif — la grange »`. Cette
  donnée existe déjà (`autoTitle()` / `titleRef.current`) mais n'est **jamais reflétée en React
  state** aujourd'hui (`titleRef` est une ref, jamais lue au rendu) — il faut promouvoir un état
  `convTitle` (ou dériver directement au rendu depuis les mêmes sources), mis à jour à **tous** les
  points où `titleRef.current` l'est déjà : chargement initial (`?conv=`), `openConversation()`,
  l'effet de persistance (1er message), et le renommage manuel. *(Cf. §12 — c'est un des points qui
  demande le plus de rigueur : plusieurs points d'écriture à garder synchronisés.)*
- **Badge de stage** (Discussion / Projet / En prod) : réutiliser tel quel `STAGE_LABEL` +
  le style `.hist-badge` déjà posé dans `HistoryPanel`, affiché juste après le titre. Ne **jamais**
  créer une deuxième source de vérité du stage — c'est un pur affichage du `stage` déjà porté par
  l'objet (aucune logique nouvelle, cf. consigne « le badge de mode reste porté par l'objet »).
- Le statut (`En ligne · prêt à lancer un projet` / `Je réfléchis…` / etc.) reste sous le nom,
  inchangé.
- Rien ne change pour le bouton « Transformer en projet » (visible uniquement au stage `echange`),
  ni pour les boutons voix/nouvelle conversation à droite.

## 8. Historique (CLV-45) — visibilité

- Le tiroir (`HistoryPanel`, `variant="drawer"`) et ses badges de stage restent tels quels — ils
  sont déjà bien faits. Le seul manque est la **découvrabilité du bouton d'ouverture** (§7).
- Pas de nouvelle mécanique : même `histOpen`, même `HistoryPanel`, on ne fait que rendre son point
  d'entrée plus visible (libellé + position stable identique dans les deux états de la page).

## 9. Cohérence board présent / board absent

- Cas 1 — **stage `echange`** (pur échange, jamais de board) : `.workspace` sans `.split`, pas
  d'onglets mobile, pas de poignée de redimensionnement. Layout inchangé par rapport à
  aujourd'hui — ce lot ne touche RIEN à ce cas.
- Cas 2 — **projet engagé, board actif** : tout ce document.
- La transition entre les deux (bouton « Transformer en projet », `engageToProject()`) ne change
  pas de mécanique : elle abort les flux en vol, promeut le stage, puis un seul tour de cadrage
  forcé produit le board — à ce moment-là le layout bascule naturellement en `.split` (desktop) ou
  fait apparaître les onglets (mobile) dès que `board` devient non-null. Aucune transition
  supplémentaire à coder pour ce cas — c'est déjà géré par la condition `board ? "split" : ""`.

## 10. Liste précise des changements CSS/DOM pour le dev

**CSS (`globals.css`)**
- `.workspace.split` : `display:flex` → `display:grid`, `grid-template-columns: var(--chat-w, 400px) 8px minmax(0,1fr)`.
- `.chat-pane` dans `.split` : retirer `flex:0 0 420px/440px/400px` (breakpoints 720/1080/1500px),
  remplacer par `grid-column:1` (la largeur vient de `--chat-w`, plus des breakpoints fixes).
- Nouveau `.split-handle` : largeur ~8px, `cursor:col-resize`, trait central 1–2px en `var(--border)`
  au repos / `var(--primary)` au survol-drag, `grid-column:2`.
- `.board-pane` : `grid-column:3` (sticky/max-height existants **conservés** — voir alerte ci-dessous).
- Nouveau bouton « agrandir » dans `.board-actions` (même style que les `.cbtn` existants).
- Nouvelle classe `.board-max` (posée sur `.workspace.split` quand agrandi) : masque `.chat-pane`
  et étend `.board-pane` sur toute la largeur ; pastille flottante `.board-back-pill` (même patron
  visuel que `.voice-hist-fab`).
- Mobile (≤860px), remplacer intégralement le bloc actuel `@media (max-width:860px) { .workspace.split {...} }` :
  nouveau `.mtabs` (segmented control, 2 boutons, sticky sous `.vbar`), `.workspace.split { position:relative }`,
  `.chat-pane`/`.board-pane` en `position:absolute; inset:0`, bascule par `visibility`/`pointer-events`
  via `[data-mobile-view]` (jamais `display:none`, cf. §6), `.composer` en `position:fixed; bottom:0`
  avec `visibility:visible` explicite (règle plus spécifique, pas de `!important` si évitable),
  padding de sécurité (`env(safe-area-inset-bottom)`).
- `.vbar` : ajouter le fil courant (titre) + badge de stage dans `.id` ; libellé texte à côté de
  `IcoHistory` (`.hist-btn` gagne un `<span>` texte, caché sous 480px via `display:none`).

**DOM/JSX (`page.tsx`)**
- Nouvel élément `.split-handle` entre `.chat-pane` et `.board-pane`, seulement si `board`.
- Nouveaux boutons : « agrandir/restaurer le board » (state `boardMaximized`), pastille retour
  (`board-back-pill`) affichée seulement si `boardMaximized`.
- Nouveaux éléments mobile : `.mtabs` (2 boutons, seulement si `board`), attribut
  `data-mobile-view={mobileView}` posé sur `.workspace.split`.
- `.vbar` : span texte « Historique » ; span titre du fil (`convTitle`) ; badge de stage
  (`<span className="hist-badge" data-stage={stage}>{STAGE_LABEL[stage]}</span>` — importer
  `STAGE_LABEL` depuis `HistoryPanel` ou le remonter dans un module partagé pour éviter la
  duplication de la table de libellés).

**Nouveaux états React (purement UI, isolés du streaming)**
- `boardWidthPx` (optionnel, persistance de la largeur préférée — lu une fois au montage,
  écrit `onPointerUp` seulement).
- `boardMaximized: boolean` (reset `false` par `newConversation()`/`openConversation()`).
- `mobileView: "chat" | "board"` (reset `"chat"` par `newConversation()`/`openConversation()`,
  passe à `"board"` automatiquement au premier board reçu sur viewport mobile).
- `pulseBoard` / `pulseChat` : booléens dérivés (effet qui observe `board`/`messages` et l'onglet
  actif), remis à `false` quand l'utilisateur regarde l'onglet concerné.
- `convTitle: string` — reflet React de ce que `titleRef.current` contient déjà (cf. §7, §12).

## 11. Microcopie

- Bouton historique : **« Historique »** (label) — inchangé sur le fond, juste rendu visible.
- Onglets mobile : **« Discussion »** / **« Aperçu du site »** si `board.kind === "maquette"`,
  sinon **« Discussion »** / **« Le document »** (un board markdown n'est pas un « site »).
- Bouton agrandir : title `"Agrandir l'aperçu"` / une fois actif `"Revenir à la taille normale"`.
- Pastille retour (desktop agrandi) : **« ← Revenir à la discussion »**, `aria-label`
  `"Revenir à la discussion — un nouveau message vous attend"` quand `pulseChat` est vrai.
- Rien d'autre ne change de ton : on reste dans le registre déjà en place (vouvoiement, sobre,
  pas de tagline).

## 12. Points de vigilance — conflits avec la machinerie fragile

1. **Le décalage `sticky` du board est codé en dur** (`top:98px`, `max-height:calc(100vh - 88px)`),
   calé sur la hauteur ACTUELLE de `.site-header` (58px) + `.crumbs-bar` (40px). Si l'en-tête
   d'identité (§7) gagne en hauteur (ex. le titre du fil sur une 2e ligne), ce nombre devient faux
   et le board sera mal calé ou rogné en haut/bas. **À vérifier explicitement** après implémentation
   (pas juste supposé correct) — soit en gardant la hauteur de `.vbar` strictement inchangée (le
   titre/badge tiennent sur la ligne du nom, pas une ligne en plus), soit en rendant l'offset
   dynamique (mesure réelle, `ResizeObserver`, ou variable CSS calculée). Ne PAS re-choisir cette
   valeur au hasard.
2. **`mobileView`/`boardMaximized`/le drag de la poignée sont des états 100% UI**, qui ne doivent
   jamais entrer dans les dépendances des effets qui pilotent `send()`, la persistance
   (`useEffect` sur `[messages, board, demo, refreshList, stage]`), ou les refs d'abort
   (`sendAbortRef`, `maquetteAbortRef`). Le risque concret : un dev pressé pourrait être tenté de
   coupler la bascule d'onglet à un `useEffect` qui touche `board`/`messages` — à proscrire, la
   bascule est un pur affichage.
3. **Ne jamais démonter `MockupFrame`** (l'iframe sandbox de la maquette) pendant une bascule
   d'onglet mobile ou un redimensionnement desktop. C'est pourquoi §6 impose `visibility`/`position:
   absolute` plutôt que du rendu conditionnel (`{mobileView === "board" && <MockupFrame .../>}`) —
   ce dernier remonterait l'iframe à chaque bascule (rechargement visuel, perte de tout état interne
   de l'iframe).
4. **Le composer en `position:fixed` mobile ne doit pas se superposer au clavier virtuel** ni au
   tiroir d'historique (`z-index:60`, au-dessus) — vérifier l'empilement des z-index (composer
   ~12, tabs ~11, tiroir 60 reste au-dessus, c'est le comportement voulu).
5. **`stickToBottomRef` (scroll de page)** n'est pas touché par ce lot (scroll du fil = scroll page,
   comportement conservé, cf. §3 note sur l'option écartée pour ce tour). Si un jour on bascule
   vers un scroll interne par panneau (plus « vrai split-pane »), il faudra réécrire l'écouteur de
   scroll (`window` → conteneur du fil) — **hors scope de ce lot**, à ne pas faire « en même temps »
   sous peine de complexifier une PR déjà sensible.
6. **Drag de la poignée = pas de `setState` par `pointermove`** (cf. §5) — à re-vérifier en revue de
   code, c'est le genre de raccourci qui se glisse facilement et dégrade les perfs sur une page déjà
   chargée en état (messages, streaming, TTS).

## 13. Hors scope de ce lot (proposé pour plus tard, pas bloquant)

- Scroll interne « vrai split-pane » (cf. §12 point 5).
- Redimensionnement vertical (hauteur) — seule la largeur board/chat est réglable ici.
- Persistance de la largeur préférée par conversation (on ne fait qu'une préférence globale
  navigateur, optionnelle).
- Raccourcis clavier pour redimensionner la poignée (accessibilité renforcée) — recommandé mais
  pas bloquant pour ce lot.
- CLV-54 (écran « Mes projets ») — traité par un autre ticket.

## 14. Critères d'acceptation suggérés (pour la recette QA)

1. Desktop, board présent : je peux glisser la poignée, le chat reste entre 320 et 560px, le board
   absorbe le reste, aucun jank visible, le fil de conversation garde son scroll (auto-scroll bas
   toujours actif quand on est resté en bas).
2. Desktop, bouton « agrandir » : le board passe en quasi plein écran, une pastille permet de
   revenir, la voix continue de narrer une réponse qui arrive pendant ce temps, revenir au chat
   n'a perdu aucun message ni cassé le streaming en cours.
3. Mobile, board présent : je bascule entre « Discussion » et « Aperçu » sans que la maquette ne se
   recharge (même scroll interne, même état) ; je peux écrire/dicter une retouche **en étant sur
   l'onglet Aperçu** et elle part bien (le composer répond).
4. Mobile/desktop, board absent (stage `echange`) : layout strictement identique à avant ce lot.
5. L'en-tête affiche le titre du fil courant et le bon badge de stage, y compris juste après
   « Transformer en projet » (le badge passe de Discussion à Projet sans recharger la page).
6. Le bouton Historique est repérable au premier coup d'œil (libellé visible, pas juste une icône)
   dans les deux états (accueil et conversation démarrée).
7. Aucune régression sur les tests existants (Vitest + Playwright, cf. `docs/BACKLOG.md` — flake
   connu du canari « panne de stockage » sous 6 workers, indépendant de ce lot).
