# 10 — Provider LLM local (Claude Code) : éprouver la vraie app sans crédit API

> Idée de Ben (2026-06-30). Faire tourner **la vraie app Cleveria en local** (pipeline complet :
> brief → orchestrateur → dashboard → SSE → synthèse) **sans payer l'API**, en routant les appels
> Claude vers le **CLI `claude`** (abonnement local, auth OAuth, gratuit) au lieu de l'API facturée.

## Comment ça marche
Abstraction `apps/web/lib/llm.ts` avec deux backends, choisis par variable d'env :

| `CLEVERIA_LLM_PROVIDER` | Backend | Usage |
|---|---|---|
| *(absent)* / `anthropic` | API Anthropic (SDK), facturée | **prod (Render)** — défaut |
| `claude-code` | CLI `claude -p` sur l'abonnement local | **dev local**, gratuit |

Les 4 points d'appel (brief, agents de run, synthèse, planner) passent tous par `llmGenerate()` →
le backend est transparent pour le reste du code.

Le backend `claude-code` lance, par appel :
```
claude -p  --system-prompt-file <tmp>  --model <opus|sonnet|haiku>
        --allowedTools ""  --exclude-dynamic-system-prompt-sections
        --output-format stream-json --include-partial-messages --verbose
```
System prompt → fichier temp ; prompt user → stdin (args simples = robuste sur Windows). Le
streaming est parsé depuis les événements `content_block_delta` → le dashboard garde le « voir
l'agent taper ». Le texte final vient de l'événement `result`.

## Comment l'activer
Dans `apps/web/.env` (gitignored) :
```
CLEVERIA_LLM_PROVIDER=claude-code
```
puis `npm run dev:web`. Aucune `ANTHROPIC_API_KEY` requise dans ce mode (le check est sauté). Il faut
juste que le CLI `claude` soit installé et connecté (ton abonnement).

Pour repasser en mode API réel : retirer la variable (ou la mettre à `anthropic`).

## Limites assumées
1. **Local uniquement.** Sur Render, pas de CLI `claude` → l'API réelle (`ANTHROPIC_API_KEY`) reste
   obligatoire en prod. Ce provider ne sert qu'à éprouver/tuner gratuitement en local.
2. **Quota d'abonnement** (limite de débit « five_hour » du plan), pas de coût en $. Le champ
   `total_cost_usd` du CLI est informatif — rien n'est facturé sur l'abonnement OAuth.
3. **Ne mesure pas le coût réel** en tokens → le chiffrage unit-economics (chantier finance, `docs/08`)
   a toujours besoin de vrais appels API.
4. **Pièces jointes (image/PDF) non supportées** en local (le CLI prend une entrée texte unique) ;
   elles sont remplacées par un marqueur. Le reste (texte, voix transcrite) marche.
5. **Fidélité ~95 %** : `--system-prompt-file` remplace le prompt système par défaut et
   `--exclude-dynamic-system-prompt-sections` retire l'essentiel du contexte Claude Code ; une légère
   enveloppe du harnais peut subsister. Suffisant pour tester comportement/UX/qualité.
6. **Note technique** : `spawn(..., {shell:true})` sur Windows émet un avertissement DEP0190 — sans
   risque ici (les arguments ne contiennent aucune donnée utilisateur ; tout le contenu passe par
   fichier/stdin).

## Pourquoi c'est le meilleur banc d'essai
Contrairement à la commande `/bras-droit` (qui *réimplémente* le bras droit dans Claude Code), ce
provider fait tourner **le produit réel** de bout en bout, gratuitement. C'est l'outil pour valider
l'UX, le triage, le visuel, et tuner les agents (avec la rubrique du `factory-manager`) **sans crédit**.
