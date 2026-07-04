# 18 — Maquette-first : architecture technique & plan de build

> Suite de [`16-maquette-avant-prod.md`](./16-maquette-avant-prod.md) (cadrage PO). Ce
> document **tranche les décisions techniques** et fixe l'ordre de build. Décisions du
> factory-lead-tech, 2026-07-03. **Benoit a RÉORDONNÉ le flux** : la maquette vient EN
> PREMIER (avant les questions, avant « ce que je propose de produire »). Cet ordre prévaut
> sur le doc 16.

## 0. Flux cible (ordre Benoit)

`Chat` → (projet visuel détecté, `MODE: maquette`) → **génération AUTO de la maquette** (pas
de bouton) → itération visuelle + questions d'affinage + cahier des charges, tout dans la
phase maquette → **« ✓ Valider la maquette — lancer la prod »** (seul déclencheur `/api/run`)
→ `/run/[id]` inchangé. Le **devis/signature** (assos/pros) s'intercale entre le CDC et le GO
prod — **phase future, différée**.

Différence clé avec le doc 16 : plus de bouton « GO cadrage → générer la maquette ». La
maquette apparaît **automatiquement** dès que le bras droit comprend que c'est un projet
visuel, AVANT la need card. La need card devient le **cahier des charges** produit APRÈS la
maquette + les questions, et sert de `launchNote` au GO PROD.

## 1. Rendu de la maquette dans le board — DÉCISION

**`<iframe srcdoc={html} sandbox="">` (sandbox VIDE, aucun flag), HTML 100 % autonome, aucune
ressource externe, + CSP `<meta>` en défense en profondeur.**

- **Piège à éviter** : `allow-scripts` + `allow-same-origin` combinés **annulent** le bac à
  sable (le JS de l'iframe peut retirer l'attribut `sandbox` du DOM parent et se recharger
  dé-sandboxé). Notre maquette est du **HTML/CSS statique sans JS** → **aucun flag** nécessaire.
  `sandbox=""` = origine opaque, scripts bloqués, formulaires/popups/navigation bloqués.
- **Ressources externes interdites** : pas de Tailwind CDN, pas de `<link>`/`<script src>`/
  `<img src="https://…">`. Le maquettiste **inline tout** : CSS dans un `<style>`, visuels en
  CSS/SVG inline/emoji/`data:`. Une maquette juge la **structure et la mise en page**, pas la
  photo finale (doctrine « structure avant forme »).
- **CSP défense en profondeur** : le composant préfixe le HTML d'un
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:;">`.
  Le sandbox bloque les scripts ; la CSP bloque toute fuite réseau. Le HTML LLM est traité
  comme **contenu non fiable** ; la barrière est le sandbox, PAS un nettoyage regex.
- **Composant `app/components/MockupFrame.tsx`** (nouveau) : reçoit `html`, injecte la CSP
  après `<head>` (ou en tête), garde-fou de taille (`MAX = 400_000`), `sandbox=""`,
  `srcDoc={doc}`, `height:100%` + **scroll interne** (pas d'auto-resize, qui exigerait de
  rouvrir le sandbox).
- **Streaming** : on **ne monte pas** l'iframe sur du HTML partiel → on bufferise et on monte
  au `done`. Pendant la génération, le board affiche « la maquette se construit… » (pulse). Le
  SSE sert au signal de vie + à l'annulation, pas au rendu incrémental.

## 2. Agent `factory-maquettiste` + endpoint `/api/maquette`

- **Agent** `~/.claude/agents/factory-maquettiste.md` (frontmatter `model: sonnet`, `tools:`
  vide) → **`npm run sync:agents`** régénère le miroir `agents.generated.ts`. Contrat de
  sortie STRICT : **un seul document HTML** de `<!DOCTYPE html>` à `</html>`, RIEN d'autre (pas
  de fence ```html, pas de préambule) ; **aucun `<script>`/`on*=`/ressource externe** ;
  contenu réaliste (pas de lorem) ; en itération, **régénère le document ENTIER** (pas de patch).
- ⚠️ **Exclure `factory-maquettiste` de `deliveryRoster()`** (`lib/orchestrator.ts`) — il est
  appelé HORS `orchestrate()` ; sinon le planificateur prod pourrait doubler le travail.
- **Endpoint** `app/api/maquette/route.ts` (`runtime nodejs`), plomberie **calquée sur
  `/api/brief`** (`ReadableStream` + `llmGenerate({ onText })`) — **jamais un spawn maison**
  (héritage de secrets ; `llmGenerate`/`viaClaudeCode` retire déjà les clés de l'env du CLI).
  Body `{ seed, previousHtml?, feedback?, demo? }` → SSE `delta` puis `done: { html }`.
  `maxTokens: 8000`. `stripHtmlFence()` défensif. Erreurs via `humanError` → **jamais** de
  repli silencieux vers la prod. Mode démo = HTML statique scripté (test sans crédit).

## 3. `Board.kind`

- `type Board = { title; content; kind?: "markdown" | "maquette" }`. Absent ⇒ markdown
  (rétro-compat). Pour une maquette, `content` = le HTML complet.
- Propagation : `app/voice/page.tsx` (type + `setBoard` de `/api/maquette` pose
  `kind:"maquette"` ; rendu = `board.kind === "maquette" ? <MockupFrame html={board.content}/> :
  <Markdown .../>`). **`lib/parseReply.ts` inchangé** (le HTML ne transite jamais par le bras
  droit). **`lib/history.ts` inchangé** (`board` stocké en `unknown` → `kind` voyage gratis via
  IndexedDB, survit au refresh, aucune migration). `downloadBoard()` bascule `.html` si maquette.

## 4. Branchement du flux réordonné dans `/voice`

- **État** `phase: "chat" | "maquette"` (dérivable de `board.kind === "maquette"` au chargement).
- **Entrée auto** : le bras droit gagne un 4ᵉ mode `MODE: maquette`, émis dès qu'il détecte un
  projet visuel, AVANT questions/need card. Protocole (dans `BRAS_DROIT_INSTRUCTIONS`) :
  ```
  MODE: maquette
  VOIX: <intro orale, ex. « Je vous fais une première maquette tout de suite… »>
  MAQUETTE: <brief compact pour le maquettiste : type de site, sections, ton, marque si connue>
  ```
  `parseReply`/`parseStream` extraient la ligne `MAQUETTE:` → `maquetteSeed`. `finalize()` : si
  `mode === "maquette"` → `setPhase("maquette")`, board « construction… », **déclenche
  immédiatement** `callMaquette({ seed })`. Automatique, **sans bouton**.
- **Entrée = un seul canal** : le 1er tour (détection) passe par `/api/brief`, qui route
  `MODE: maquette` → `finalize()` bascule `phase: "maquette"` et déclenche `callMaquette({
  seed })`. `MODE: questions`/`cadrage` inchangés pour les projets non visuels.
- **Itération = fast-path direct (implémenté, ex-V2)** : une fois `phase === "maquette"`, tout
  message du composer (texte ou dictée) est une retouche et part **directement** vers
  `/api/maquette({ seed: mockupSeed, previousHtml: board.content, feedback })` —
  `sendMaquetteFeedback()` dans `app/voice/page.tsx`, **sans repasser par le bras droit**. Le
  compromis V1 (2 tours opus+sonnet par retouche) a été abandonné pour le coût/la latence ; la
  ligne `MAQUETTE:` d'itération du prompt bras droit (`app/api/brief/route.ts`) devient
  inatteignable côté client — laissée telle quelle (dead prompt text, sans risque), à retirer
  au prochain nettoyage du prompt.
- **Deux GO** : voir/affiner = automatique (plus de bouton « générer ») ; **final** =
  `phase === "maquette" && launchNote` → bouton **« ✓ Valider la maquette — lancer la prod »**
  (seul appel `/api/run`). Le GO actuel reste inchangé pour les projets NON visuels (`phase chat`).
- **Passage de la maquette au run (non négociable, CLV-31)** : `buildBrief(msgs, noteText,
  maquetteHtml?)` ajoute une section **« # MAQUETTE VALIDÉE — structure de référence NON
  NÉGOCIABLE »** (+ le HTML) ; addendum dans `factory-orchestrateur.md` : si une maquette
  validée est fournie, `ux-ui`/`developpeur` l'implémentent (pas de repart de zéro). *Limite V1*
  : `runStep` injecte `run.brief` dans chaque étape → HTML vu par tous (bloat accepté ; V2 =
  champ `Run.maquetteHtml` injecté sélectivement).
- **Anti-flux-périmé** : `/api/maquette` réutilise la discipline `AbortController` +
  `isCurrent()` de `send()` (P0-1) — un nouveau tour / changement de conv annule la génération
  en cours. **Bloquant si oublié** (corruption inter-conversations).

## 5. Itération
Régénération HTML **intégrale** à chaque feedback (`seed` + `previousHtml` + `feedback`) — plus
robuste qu'un patch LLM. Trace chat discrète « 🎨 Maquette mise à jour : … » (comme
`boardUpdate`). Régénération ciblée par section = V2.

## 6. Ordre de build
- **P0-A** `Board.kind` + `MockupFrame` (sandbox="") + switch de rendu + `downloadBoard` html +
  persistance (gratuite). *Fait =* un `<script>` injecté ne s'exécute pas ; pas de fuite de
  style ; maquette survit au refresh.
- **P0-B** agent `factory-maquettiste` + `sync:agents` + exclusion `deliveryRoster()` +
  `/api/maquette` (génération + itération, SSE, démo). *Fait =* HTML complet sans script ;
  itération intègre visiblement le changement.
- **P1-A** `MODE: maquette` + ligne `MAQUETTE:` dans `BRAS_DROIT_INSTRUCTIONS` + extraction
  `parseReply`/`parseStream`.
- **P1-B** état `phase` + entrée auto + 1ʳᵉ génération + rendu.
- **P1-C** itération (feedback → `/api/maquette`, discipline Abort) — **fait, fast-path direct**
  (`sendMaquetteFeedback()`, plus de tour bras droit par retouche, cf. §4).
- **P1-D** bouton « ✓ Valider la maquette — lancer la prod » (phase maquette only) + `buildBrief`
  section MAQUETTE VALIDÉE + addendum planificateur. **Pas encore fait** : dans ce build, la
  phase maquette = itérer uniquement (le devis/la validation/le lancement d'équipe restent un
  build ultérieur ; l'échappatoire actuelle = « Nouvelle conversation »).
- **Phase 2 — DIFFÉRÉE** : CDC formalisé ; **DEVIS/SIGNATURE** (gate CDC→Devis→Prod, paiement +
  statut de signature + back-office — aucune ligne V1, juste réservé) ; injection sélective
  `Run.maquetteHtml` ; bascule responsive.

## 7. Risques
Sécu HTML LLM (maîtrisé par `sandbox=""` + CSP + zéro ressource externe + garde-fou taille) ;
coût (opus routeur + sonnet maquettiste par itération → sonnet + `maxTokens` plafonné +
instrumenter le nb d'itérations) ; cohérence orchestrateur (exclusion roster) ; bloat tokens
prod (V1 accepté) ; flux périmés (Abort obligatoire) ; échec génération (nouvel essai, jamais
de repli prod) ; streaming (bufferiser jusqu'au done).

## Un point à escalader
- **Architecte/manager** (Phase 2) : le devis+signature (paiement, statut, back-office) = brique
  structurelle à concevoir séparément, non ouverte en V1.

*(Le point produit sur le fast-path retouche est tranché : implémenté directement, cf. §4/§6 —
le coût/la latence d'un tour opus par retouche l'a emporté sur la cohérence "un seul cerveau".)*
