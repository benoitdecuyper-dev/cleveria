# Backlog Cleveria

Convention : projet **CLV**, tickets `CLV-N`. État : ⬜ à faire · 🟦 en cours · ✅ fait.
Mis à jour le **2026-07-03 (soir)**.

---

## 📌 REPRISE — état au 2026-07-03 (soir) · À LIRE EN PREMIER

**Décision de fond prise aujourd'hui (GO Benoit) :** on **tue le switch Assistant/Projet**. Une seule surface = **la conversation** (le bras droit) ; le **Projet est un objet de 1er niveau créé DEPUIS la conversation**. Avis UNANIME (bras droit + direction + business-dev) : ne surtout PAS externaliser l'Assistant — c'est la **douve** (mémoire/relation/habitude) ET le **tunnel de conversion** (hypothèse n°1 = quotidien→projet, doc 08). « Plusieurs assistants » = **un fil + une mémoire PAR PROJET**, pas des rivaux. Home/pitch = mener par le **Projet** (le site se vend, l'assistant seul non). → épic **CLV-E-ARCHI** en bas. À cadrer PO + architecte **avant** de coder.

**Fait aujourd'hui (tout vert : typecheck + 50 tests + e2e) :** 2 modes (Assistant `/echange` + Projet `/voice`) · auto fin-de-parole (VAD silence) · historique IndexedDB (`idb-keyval`) · dark mode · nav + fil d'Ariane · accueil 2 dalles · **marque VIOLETTE** (Projet en magenta) + **logo « relais »** + **i violet** + favicon · **maquette-first** (génération + itération HTML sandbox) · **fast-path retouche** (une retouche ne repasse plus par le bras droit) · **prompt caching** (prod) · fixes (arrêt run, `/brief`→`/voice`, voix pas réécrite dans le chat).

**À reprendre demain, dans l'ordre :**
1. **Cadrer CLV-E-ARCHI** (PO + `factory-architecte`) — la conversation comme surface unique, le Projet comme objet ; étage 1 (retirer le switch, cheap) vs étage 2 (fil+mémoire par projet, V2/Supabase).
2. **Refonte espace Projet** (CLV-41/42/44/45) — proposition **VALIDÉE** (board pleine hauteur redimensionnable, identité au-dessus du chat, historique visible ; NB le switch de mode sera retiré cf. archi). → UX/UI fin puis dev.
3. **CLV-43** — maquettiste : imposer la structure « vrai site » (À propos, Tarifs, Contact…).
4. **CLV-50** — reformuler l'histoire du logo « relais » sans référence au switch (il survit : relais = « toi → l'équipe qui livre »).
5. **Étude de marché + tarifs** (produite en fond ce soir par business-dev + finance) → lire **`docs/20-etude-marche-cleveria.md`** (marché, concurrence + tarifs réels recoupés, positionnement, packaging) et **`docs/21-tarifs-cleveria.md`** (grille tarifaire chiffrée, unit economics, marges, point mort, garde-fous quotas).

**Artifacts du jour :** couleur `https://claude.ai/code/artifact/e4b74af9-4a91-474a-b721-48a4f27e65f1` · logos `https://claude.ai/code/artifact/c2e48373-ba18-4f9f-8e6e-3ac6504e72fa` · refonte Projet `https://claude.ai/code/artifact/d1f2e267-aab5-4385-9a5b-81ef336cf766`. **Docs clés :** marque `docs/14`, pitch `docs/17`, service site `docs/19`, archi maquette `docs/18`.

---

## ✅ Fait le 2026-06-30 — refonte « Shazam du besoin »

- ✅ **CLV-1** — Accueil `/voice` minimaliste (micro plein écran + repli texte).
- ✅ **CLV-2** — Need card interprétée dans le board au 1er message projet (au lieu du qform).
- ✅ **CLV-3** — Confirmation directe (plus de note dupliquée dans le chat).
- ✅ **CLV-4** — GO unique : plus de plan-card pré-GO, lancement direct vers `/run/[id]`.
- ✅ Persistance locale (V1 mémoire) + correctifs UX (typing, liens, images board, dictée, board live, voix auto).

---

## 🔴 Priorité haute

### ⬜ CLV-5 — Sortie structurée pour le tri & le board (fiabilité du moment magique)
Remplacer le protocole par marqueurs texte (`MODE:`/`VOIX:`/`BOARD:`) par une **sortie structurée** (tool use / JSON validé) : le modèle renvoie `{ mode, voix, board?: {title, content}, needCard?: {besoin, livrables[]}, questions? }`.
**Pourquoi** : aujourd'hui le classement projet-vs-direct et l'émission du board sont **non déterministes** → le moment magique n'est pas garanti.
**AC** : sur 10 inputs projet variés, ≥ 9 produisent une need card + GO (mesuré). Plus de livrable projet qui tombe dans le chat. Le front ne parse plus de marqueurs.

### ⬜ CLV-6 — Repli STT pour Safari/Firefox (hero vocal universel)
Le STT navigateur est Chrome/Edge only. Ajouter un repli **STT serveur (Deepgram, déjà dans l'env)** ou un fallback gracieux mis en avant.
**AC** : sur Safari/Firefox, le micro fonctionne (serveur) OU bascule visiblement sur « écris ton besoin » sans cul-de-sac. Détection de support testée.

### ⬜ CLV-7 — Finir la coupe du qform (chips de correction sur la need card)
Le `qform` subsiste comme repli quand l'input est trop vague. Le remplacer par des **chips de correction** rattachés à la need card (correction en un mot), conformément à la vision PO.
**AC** : zéro formulaire séquentiel dans le fil. Une correction = 1 interaction (chip ou < 10 mots).

---

## 🟠 Priorité moyenne

### ⬜ CLV-8 — Persister le cadrage (ne pas perdre le GO au refresh)
`launchNote` (et l'état GO) ne sont pas persistés → un refresh en plein cadrage perd le bouton GO (le board, lui, est restauré).
**AC** : après refresh sur un besoin cristallisé, la need card ET le GO réapparaissent.

### ⬜ CLV-9 — Panneau « voir l'équipe » (21 spécialistes)
Réintroduire l'étendue de l'équipe (retirée de l'accueil) en **post-GO** ou via un lien discret du hero, sans polluer le moment magique.
**AC** : l'équipe n'apparaît jamais avant le 1er message ; accessible en 1 clic ensuite.

### ⬜ CLV-10 — Instrumenter la métrique d'activation
Tracker le **taux « premier message → GO »** (funnel) sur les nouvelles sessions. Cible ≥ 30 % / 50 premières sessions organiques.
**AC** : événements `first_message`, `need_card_shown`, `go_clicked` remontés ; tableau de funnel consultable.

### ⬜ CLV-11 — Mode test déterministe pour l'IA (E2E hermétiques)
Provider mockable (réponses scriptées par scénario) pour couvrir en E2E : need card, GO→run, et idéalement `listening`/`crystal`.
**AC** : E2E need card + GO verts en CI sans appel LLM.

---

## 🟢 Cleanup / dette

### ⬜ CLV-12 — Nettoyer le code mort post-refonte
CSS `plan-card`/`plan-step` inutilisé ; `NoteView` désormais démo-only (clarifier ou isoler dans le chemin démo).

### ⬜ CLV-13 — Polir les micro-interactions UX restantes
Détails listés par l'UX non encore faits (rebond du mic au relâchement, collapse animé hero→vbar, fade-in du 1er token). Cohérence du wording de statut.

---

## 🟣 Historique de conversations — épic CLV-E-HIST

Cadrage complet : [`13-historique-conversations.md`](./13-historique-conversations.md).
Réinitialiser une conversation + retrouver/renommer/supprimer ses conversations passées,
sur `/echange` et `/voice`, en local (IndexedDB via `idb-keyval`), sans perdre la
conversation en cours des utilisateurs actuels (`cleveria.voice.v1`).

### ⬜ CLV-14 — Module de stockage multi-conversations (IndexedDB via `idb-keyval`)
CRUD `listConversations`/`getConversation`/`createConversation`/`saveConversation`/`renameConversation`/`deleteConversation`, un enregistrement par conversation + index léger pour la sidebar.

### ⬜ CLV-15 — Migration `cleveria.voice.v1` → 1ère entrée d'historique
Aucune conversation en cours perdue au déploiement. Dépend de CLV-14.

### ⬜ CLV-16 — Bouton « Nouvelle conversation » → crée un enregistrement (au lieu d'écraser)
Dépend de CLV-14.

### ⬜ CLV-17 — Sidebar historique — mode Projet (`/voice`)
Rail latéral, liste triée par activité, switch, état vide. Dépend de CLV-14, CLV-16.

### ⬜ CLV-18 — Sidebar historique — mode Échange (`/echange`)
Même composant que CLV-17, filtré, en tiroir. Dépend de CLV-14, CLV-17.

### ⬜ CLV-19 — Titre automatique de conversation
Troncature du 1er message, pas d'appel LLM. Dépend de CLV-14.

### ⬜ CLV-20 — Renommer une conversation
Dépend de CLV-17.

### ⬜ CLV-21 — Supprimer une conversation
Dépend de CLV-17.

### ⬜ CLV-22 — Adapter la passerelle « Transformer en projet » au multi-conversations
`toProject()` ne doit plus écraser une conversation `/voice` existante. Dépend de CLV-14.

---

## 🟠 Maquette avant prod — épic CLV-E-MAQUETTE

Cadrage complet : [`16-maquette-avant-prod.md`](./16-maquette-avant-prod.md).
Entre le cadrage validé et le lancement de l'équipe de prod : générer une maquette
visuelle (site web) dans le board, l'affiner par itération dans le chat, et ne lancer
la prod qu'une fois la maquette validée.

### ⬜ CLV-23 — Nouvel agent `factory-maquettiste`
Produit une page HTML/CSS autonome (un seul fichier, sans script, sans dépendance externe) à partir d'un besoin cadré, régénérable sur feedback.

### ⬜ CLV-24 — Endpoint `POST /api/maquette` (génération + itération)
Sur le modèle streamé de `/api/brief`, PAS de `runStore`/DAG. Dépend de CLV-23.

### ⬜ CLV-25 — Rendu HTML sandboxé dans le board (`MockupFrame`)
Iframe/isolation à trancher par l'architecte (cf. doc §3). Aucun script exécuté, aucune fuite de style.

### ⬜ CLV-26 — Extension du type `Board` (`kind: "markdown" | "html"`) + persistance
Propagé à `lib/history.ts` et à l'export. Recoupe CLV-8 (persistance du cadrage/GO). Dépend de CLV-25.

### ⬜ CLV-27 — Le GO cadrage bascule vers « générer la maquette » (projets visuels)
Le bouton GO existant appelle `/api/maquette` au lieu de `/api/run` si le projet est classé visuel. Dépend de CLV-24, CLV-25, CLV-26, CLV-28.

### ⬜ CLV-28 — Classification « projet visuel ? » au cadrage
Indicateur déterministe sur la need card. À mutualiser avec CLV-5 (sortie structurée).

### ⬜ CLV-29 — Itération de la maquette dans le chat
Tout message pendant la revue de maquette = feedback de régénération, pas un nouveau cadrage. Dépend de CLV-24, CLV-27.

### ⬜ CLV-30 — Barre de validation de la maquette → GO PROD dédié
Nouveau bouton, seul à déclencher `/api/run` pour les projets visuels. Dépend de CLV-27, CLV-29.

### ⬜ CLV-31 — La maquette validée est injectée dans le run prod
`buildBrief()` inclut la maquette validée ; un agent du run prod la référence explicitement dans son livrable (pas juste comme texte informatif). Dépend de CLV-30.

---

## 🔵 V2 — épic séparé

### ⬜ CLV-MEM — Mémoire V2 (auth + Supabase + faits distillés)
Persistance locale = **faite** (V1). V2 : **auth** (rattacher au compte) + **Supabase** (cross-appareils) + **mémoire distillée** (faits sur l'utilisateur/ses projets réinjectés dans le prompt). Bloqueur : quota Supabase. Cf. mémoire `cleveria-memoire-roadmap`.
Le modèle `Conversation` de l'historique (`CLV-E-HIST`, `userId`/`schemaVersion` posés dès V1) est pensé pour un **upsert Supabase par id sans remapping** à l'activation de l'auth — détail dans `13-historique-conversations.md` §8.

---

## 🎨 UX / affinages — retours Ben (2026-07-03)

### ⬜ CLV-41 — Board : redimensionnement + scroll
Le board « colle en bas » et quand on veut le scroller, la discussion est contrainte/mal ajustée. Rendre le board **redimensionnable** (ou lui donner sa propre zone de scroll indépendante du chat) pour qu'on lise confortablement une maquette/un livrable long sans que le chat mange la place.

### ⬜ CLV-42 — Barre « Chef de projet » : la remonter au-dessus de la discussion
La barre d'identité en haut (`vbar`) est un peu illisible. La repositionner **au-dessus de la discussion** (en-tête clair) pour libérer de la hauteur et **remonter le board**. Revoir la hiérarchie verticale : header identité → board/chat.

### ⬜ CLV-43 — Maquette : structure de vrai site d'exploitation
Les maquettes générées manquent de sections standard : **À propos de nous, Nos tarifs/Services, Contact** — bref un vrai site vitrine d'exploitation avec du contexte. Renforcer le prompt de `factory-maquettiste` pour **imposer un jeu de sections crédible par défaut** (Hero, À propos, Offre/Services, Tarifs, Preuve sociale, Contact, Footer) adapté au type de site.

### ⬜ CLV-44 — Repenser le switch Assistant / Projet (header)
Le sélecteur de mode `SiteNav` en haut « n'est pas dingue ». Le redesigner (lisibilité, désirabilité) — voir avec l'UX/UI.

### ⬜ CLV-45 — Historisation peu découvrable
L'historique EXISTE (bouton horloge + tiroir) mais il est noyé dans la barre du haut → l'utilisateur ne le trouve pas (« j'ai pas d'historisation »). Rendre l'accès **visible et évident** (à traiter avec CLV-42 : la refonte de la barre du haut).

---

## 🧭 CLV-E-ARCHI — Une seule surface : la conversation ; le Projet = objet (DÉCIDÉ 2026-07-03, GO Benoit)

Décision d'**identité/positionnement** (avis unanime bras droit + `factory-direction` + `factory-business-dev`, cf. Reprise en tête). On supprime le switch Assistant/Projet ; la conversation devient la surface par défaut ; le Projet est un objet créé depuis la conversation ; l'Assistant N'EST PAS externalisé (c'est la douve + le tunnel de conversion). Home/pitch = mener par le Projet.

### ⬜ CLV-46 — Cadrage produit + archi cible (PO + `factory-architecte`)
Traduire la décision en structure : conversation = surface unique ; passerelle « transformer en projet » = geste central ; Projet = objet de 1er niveau avec **état explicite** (échange / maquette / devis / prod). **Garde-fou non négociable** : l'état « je fabrique » est porté par **l'objet projet** (a-t-il un board actif ?), JAMAIS par une reclassification LLM phrase-par-phrase (sinon on rouvre le bug que le switch réglait — cf. doc 12, fragilité n°1). Séquencer étage 1 (V1) / étage 2 (V2). Livrable : spec + schéma d'états.

### ⬜ CLV-47 — Étage 1 (V1, cheap) : retirer le switch, conversation = atterrissage
Supprimer le sélecteur Assistant/Projet du header (`SiteNav`). L'échange devient l'atterrissage par défaut = l'**état zéro d'un projet pas encore engagé**. « Projet » n'est plus un onglet : c'est un objet **créé DEPUIS la conversation** (via « transformer en projet »). Petit chantier front, zéro nouvelle infra. Dépend de CLV-46. Se combine avec la refonte de l'espace Projet (CLV-41/42/44/45).

### ⬜ CLV-48 — Étage 2 (V2) : projets first-class + fil & mémoire par projet
Chaque projet = son propre **fil de conversation + sa mémoire** (résout « plusieurs assistants » sans assistants rivaux). Touche auth/Supabase → séquencer avec **CLV-MEM** (mémoire V2). Poser l'archi dès la V1 pour ne pas fermer la porte (le modèle `Conversation` de `CLV-E-HIST` est déjà prêt, cf. `13-...` §8).

### ⬜ CLV-49 — Upsell / B2B2C (PARKÉ) : assistant scopé post-vente + marque blanche agences
Post-vente : un assistant **scopé au site vendu** (connaît l'offre/le contenu) = upsell naturel. Angle **agences/freelances** : « un assistant par mandat client » en marque blanche (récurrence, valeur par siège). À explorer **après** validation de l'hypothèse n°1. Parké (idée business-dev).

### ⬜ CLV-50 — Reformuler l'histoire du logo « relais » (marketing)
Le logo « relais » (`docs/15` Concept 4) était narré sur la bascule Échange→Projet. Il **survit** (relais = « toi → l'équipe qui prend le relais pour livrer »), mais reformuler son histoire dans `docs/17`/`docs/15` **sans référence au switch** qui disparaît.
