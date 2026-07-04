# 12 — Deux modes : Échange & Projet

> Décidé avec Ben le 2026-07-03. Objectif : **booster le comportement et la cohérence**
> de l'outil en faisant du **mode un choix d'UX explicite** au lieu d'un triage deviné
> par le modèle.

## Le problème qu'on résout

Aujourd'hui `/voice` fait tout dans une seule page, et c'est le **modèle** qui décide en
1ʳᵉ ligne s'il est en `direct` / `questions` / `cadrage`. Ce classement est **non
déterministe** (cf. mémoire : « un projet part parfois en direct/board sans GO »). C'est la
fragilité n°1 du produit.

**La bascule** : l'utilisateur choisit lui-même son mode. Le mode choisit les instructions
du bras droit. Plus de devinette → cohérence.

## Les deux modes

### Mode Échange — parler, penser à voix haute
- **Vocal en direct**, mains-libres : on parle, le bras droit répond à l'oral, ça
  ré-écoute tout seul. Transcription **simple et efficace** affichée en direct.
- **Pas de board, pas de questionnaire cliquable** : c'est une conversation, pas une
  chaîne de production. Le bras droit *parle*, il ne *fabrique* pas d'artefact.
- Usage : brainstormer, dégrossir une idée, un avis, une question rapide, réfléchir.

### Mode Projet — produire, mobiliser l'équipe
- Le **board** (livrable projeté en live) + la **factory** (async) + le **dashboard**
  `/run/[id]`. C'est le flux actuel de `/voice`, mais **verrouillé sur le projet** (le
  modèle ne « décide » plus le mode : il est en projet, point).
- Usage : un vrai projet — build, business plan, montage, campagne…
- **Plus tard** : les agents mobilisés « prennent la parole » comme intervenants distincts
  (voix + identité) pendant le run. Gardé en tête, hors V1.

## Articulation (décidé : deux portes + passerelle)

- L'accueil propose explicitement **Échange** ou **Projet**.
- Depuis un échange, une **passerelle** « Transformer en projet » passe tout le contexte de
  la conversation vers le mode projet (board + GO). Séparation nette mais fluide.
- La passerelle est **toujours disponible** en échange (l'utilisateur décide) → **aucun
  marqueur de protocole** à faire émettre au modèle, donc rien de fragile à parser.

## Voix « en direct » : le niveau retenu (V1)

Trois niveaux possibles ; on prend le 1er, avec la porte ouverte au 3e :

1. **Boucle mains-libres (RETENUE)** — Web Speech (STT navigateur, gratuit) →
   détection de fin de phrase (debounce silence) → tour envoyé → LLM streame → TTS
   (ElevenLabs, repli `speechSynthesis` navigateur) → ré-écoute auto. **Marche avec le
   provider local gratuit** (`CLEVERIA_LLM_PROVIDER=claude-code`). Latence 2-4 s/tour
   (talkie-walkie fluide). Zéro nouvelle infra.
2. Temps réel LiveKit (payant, prod-only) — full-duplex <1s, mais exige LiveKit + Deepgram
   + Cartesia + crédit Anthropic, et **ne tourne pas en local gratuit**. Le worker
   `apps/voice-agent` est le scaffold prévu pour ça.
3. On structure le code de la boucle pour pouvoir **basculer sur LiveKit plus tard** sans
   réécrire la surface.

Pourquoi la boucle et pas LiveKit tout de suite : tout le projet est **gratuit-d'abord**
(on teste via le provider local sans crédit). Le vrai temps réel est un chantier prod à
brancher quand il y aura du crédit / de la prod.

## Impact technique (additif, non cassant)

- **Serveur `/api/brief`** : accepte un champ `mode`. `mode=echange` → système =
  `chef.prompt` + `prefsBlock` + **`ECHANGE_OPS`** (conversation orale, pas de board, pas
  de questions-JSON). Sans `mode` → comportement actuel inchangé (triage). Rien ne casse.
- **Front `/echange`** (nouveau) : la boucle mains-libres, transcription live, pas de
  board, bouton « Transformer en projet ».
- **Front `/voice`** : reste le mode Projet (à terme on le verrouille sur `cadrage`/board).
- **Accueil `/`** : deux portes claires (Échange / Projet) + démo.

## Reste à trancher par Ben (points de veto)

Les 3 défauts pris pendant qu'il était absent (2026-07-03) : (1) mains-libres now + LiveKit
plus tard, (2) deux portes + passerelle, (3) multi-agents-qui-parlent en phase 2. À
confirmer / corriger.
