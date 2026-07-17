# Cleveria

IA conversationnelle web **en voix temps réel** qui rend accessible une **Factory team** d'agents,
sur la métaphore d'une agence. Le `factory-chef-de-projet` est le **point d'entrée unique** : il cadre
le besoin avec l'utilisateur, puis passe la balle à la delivery tech (factory) et/ou à la business team.

## Architecture (les deux vitesses)

La voix veut des tours rapides (1-2 s) ; l'orchestration factory est du travail profond (minutes).
Cleveria sépare donc deux couches :

- **Couche conversationnelle (rapide)** — le chef de projet te parle, te cadre, te dit qui il mobilise.
  Tours courts. Modèle rapide (`claude-sonnet-4-6` / `claude-haiku-4-5`).
- **Couche factory (profonde, async)** — quand il dispatche un agent (dev, finance, conformité…),
  ce travail tourne en arrière-plan et **stream dans le dashboard**. Modèle `claude-opus-4-8`.

```
Navigateur (Next.js, UI épurée)
   │  WebRTC (LiveKit)
   ▼
voice-agent (Node, LiveKit Agents JS)
   Deepgram STT → Claude (chef de projet, streaming) → Cartesia TTS
   │  outil: dispatch_to_factory(brief)
   ▼
packages/factory  ──lit──▶  ../.claude/agents/*.md   (source de vérité unique, 22 agents)
   │  orchestration profonde (Claude Opus 4.8)
   ▼
Supabase (auth multi-tenant, projets, état des runs)  ──Realtime──▶  dashboard
```

## Stack (verrouillée)

| Couche | Techno |
|---|---|
| Front web | Next.js + LiveKit JS client + Supabase Realtime |
| Voix temps réel | LiveKit Agents **JS** : `@livekit/agents` + Deepgram (STT) + Cartesia (TTS) + Silero VAD |
| LLM voix | Claude via LiveKit Inference (`anthropic/claude-sonnet-4-6`) — repli : nœud LLM custom sur l'API Messages |
| Cerveau / orchestration | Claude Agent SDK lisant `../.claude/agents/*.md` |
| Données / SaaS | Supabase (auth, projets, état des runs) |

Tout est **Node/TypeScript** (pas de Python). Source de vérité des agents : `../.claude/agents/*.md`.

## Roadmap

Le front propose **2 approches** d'entrée :

- **Approche A — dépôt de brief (async)** *(V0, principale)* : entrée **vocale enregistrée OU écrite**
  + **pièces jointes** → transmis au chef de projet, qui renvoie un cadrage. Pas de conversation live.
- **Approche B — échange IA temps réel** *(gardée)* : worker voix LiveKit (`apps/voice-agent`).

Jalons :

- **V0 — fonctionnel d'abord** *(fait)* : front **très simple et statique** (esthétique plus tard) ;
  approche A de bout en bout (brief écrit/vocal + PJ → cadrage du chef de projet).
- **V1 — dispatch factory + dashboard** *(en place)* : après validation de la note de cadrage,
  l'utilisateur clique **« Valider et lancer l'équipe »** → un **orchestrateur** établit un plan
  (DAG d'agents factory) → les agents produisent les livrables **en arrière-plan**, **en parallèle**
  quand c'est possible → le chef de projet en fait la **synthèse**. Tout est suivi en direct sur un
  **dashboard async** (`/run/[id]`) alimenté par **SSE**. Aucune base : store de runs **en mémoire**
  (Render = serveur Node persistant mono-instance ; un redémarrage perd les runs en cours — OK en V1).
- **V2 — SaaS** : auth multi-tenant, projets clients, persistance des runs (Supabase), facturation.

## Clés / comptes à créer (gratuit pour démarrer)

Copier `.env.example` vers `.env` et remplir :

1. **Anthropic** — `ANTHROPIC_API_KEY` (console.anthropic.com)
2. **LiveKit Cloud** — `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (cloud.livekit.io, free tier)
3. **Deepgram** — `DEEPGRAM_API_KEY` (STT, crédits gratuits)
4. **Cartesia** — `CARTESIA_API_KEY` (TTS faible latence ; alternative : ElevenLabs)

> **Supabase n'est PAS nécessaire en V0** (pas de persistance/auth). Il revient en V2.

Pour l'**approche A (dépôt de brief)**, seule `ANTHROPIC_API_KEY` est obligatoire
(`DEEPGRAM_API_KEY` en plus si tu réponds à la voix).

> LiveKit Inference peut router STT/LLM/TTS sans clés provider séparées selon le plan — à confirmer au 1er run.

## Lancer (une fois les clés en place)

```bash
npm install
npm run dev:web      # client web Next.js  (approche A : dépôt de brief)
npm run dev:voice    # worker voix LiveKit Agents (approche B, à valider au 1er run)
```

L'**approche A** (dépôt de brief) ne nécessite que `ANTHROPIC_API_KEY` (et `DEEPGRAM_API_KEY`
pour le message vocal). C'est le chemin fonctionnel de bout en bout du V0.

> Windows : si `next` n'est pas trouvé, lance via `npx next dev` ; si le binaire natif SWC
> refuse de se charger, `next build --webpack` (ou un `npm install` propre) règle le souci.

## Déployer (Render)

L'app web tourne sur **Render** (vrai serveur Node ; pas de base de données en V0).
La source de vérité des agents est **`agents/*.md` à la racine du repo** (versionnés git ;
`~/.claude/agents` est une jonction vers ce dossier, Claude Code lit donc les mêmes fichiers).
Le module `packages/factory/src/agents.generated.ts` est régénéré automatiquement à chaque
`build`/`dev:web` et **gitignoré** — aucune synchro manuelle, aucune dérive possible.

Puis, côté Render (`render.yaml` fourni) :
1. Pousser le repo sur GitHub.
2. Render → New → Blueprint → pointer sur le repo (il lit `render.yaml`).
3. Renseigner les variables d'env **secrètes** dans le dashboard : `ANTHROPIC_API_KEY`
   (et `DEEPGRAM_API_KEY` pour le vocal).
4. Déployer → URL publique.

> ⚠️ Le worker voix (`apps/voice-agent`) est un point de départ : l'API LiveKit Agents JS évolue,
> on le valide ensemble au premier run avec les vraies clés (latence, interruptions, choix du modèle voix).
