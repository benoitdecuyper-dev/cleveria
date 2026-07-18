# 31 — Notions de méthode IA : le manuel d'apprentissage

> **Pourquoi ce doc.** L'audit du 2026-07-18 (4 diagnostics sur les fichiers de la factory +
> 5 recherches web à sources vérifiées) a montré que les problèmes de la factory ont des causes
> structurelles précises. Benoit veut corriger **étape par étape, en comprenant chaque notion**
> plutôt que de tout refondre d'un coup. Ce document est le support de formation : une notion =
> une fiche courte, toujours reliée à un endroit précis où la factory s'est fait mordre.
>
> **Comment le lire.** Chaque fiche suit le même gabarit : *l'idée en une phrase* → l'explication
> → *où ça nous a mordus* (l'exemple réel dans NOS fichiers) → les références. Les références ont
> été ouvertes et recoupées pendant l'audit (2 sources indépendantes sauf mention « à confirmer »).
> Le parcours de correction en fin de document renvoie aux fiches.

---

## Fiche 1 — La fenêtre de contexte : le modèle ne sait que ce qu'on lui montre

**L'idée en une phrase.** Un modèle de langage ne « sait », au moment où il répond, que ce qui est
physiquement présent dans sa fenêtre de contexte — et **pointer un fichier n'est pas le charger**.

Le contexte d'un agent, c'est : son prompt système (le `.md` de l'agent), la conversation, et ce
qu'il a explicitement lu avec ses outils. Rien d'autre. Une phrase comme « référence :
`~/.claude/PRINCIPES-AGENTS.md` » ne met **rien** dans le contexte : elle donne à l'agent la
*possibilité* d'aller lire, jamais l'*obligation* — et un agent lancé sur une tâche ne dépense pas
son premier tour à lire de la doctrine.

**Où ça nous a mordus.** C'est LA trouvaille de l'audit. Le pied de page des 26 agents pointe
`PRINCIPES-AGENTS.md` sans forcer sa lecture, et le petit résumé qu'il contient est un digest
manuel **gelé à 9 principes sur 19**. Conséquence : toutes les leçons gravées par le manager les
15 et 17/07 (portée d'une preuve, garde-fou-mécanisme, passation…) n'ont jamais atteint le
contexte d'un seul agent. « Le manager améliore en continu et rien ne change » : c'était
littéralement ça.

**Références.** Anthropic, *Effective context engineering for AI agents* (29/09/2025) —
https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents ; doc Claude
Code *Best practices* (« CLAUDE.md is a special file that Claude reads at the start of every
conversation » — le seul contenu garanti est celui qui est injecté) —
https://code.claude.com/docs/en/best-practices

---

## Fiche 2 — Prompt engineering vs context engineering

**L'idée en une phrase.** Bien rédiger un prompt est un acte ponctuel ; le *context engineering*
est la **curation continue** de ce qui entre dans la fenêtre, refaite à chaque appel.

La vidéo que tu as vue s'arrête au pilier « soigner la rédaction ». Les sources définissent autre
chose : choisir dynamiquement, à chaque moment, le bon sous-ensemble d'informations (fichiers,
mémoire, résultats d'outils) — « *the curation phase happens each time we decide what to pass to
the model* » (Anthropic). LangChain formule la hiérarchie : « *prompt engineering is a subset of
context engineering* ».

**L'image à retenir : le curateur de musée.** Il dispose de réserves immenses et d'une salle
minuscule ; son métier est de **choisir** les quelques œuvres qui servent l'exposition en cours,
pas d'accrocher le plus de tableaux possible. La salle = la fenêtre de contexte (limitée, et qui
se dégrade quand on la remplit — fiche 3). Les réserves = tout ce qu'on *pourrait* donner au
modèle (fichiers agents, historique, principes, mémoire, docs). Et « continue » signifie que ce
choix est **refait à chaque appel**, parce que la bonne sélection change avec la tâche : la
checklist UX est précieuse au moment de dessiner un écran, et du bruit pendant un debug de base
de données. Concrètement : un skill qui ne charge la checklist qu'au moment où la tâche la
déclenche (fiche 10), un sous-agent qui lit 26 fichiers et ne fait entrer que sa synthèse, un
`/clear` entre deux tâches — c'est de la curation. Un prompt permanent de 2 800 mots où tout est
exposé tout le temps — c'est l'absence de curation.

**Où ça nous a mordus.** Nos règles sont **bien rédigées** — l'audit l'a confirmé — mais mal
*livrées* : le problème n'était pas la qualité d'écriture, c'était ce qui atteint réellement le
contexte au bon moment. Optimiser encore la rédaction n'aurait rien corrigé.

**Références.** Anthropic (lien fiche 1) ; LangChain, *The rise of context engineering*
(23/06/2025) — https://www.langchain.com/blog/the-rise-of-context-engineering

---

## Fiche 3 — Context rot : le contexte se dégrade en grossissant

**L'idée en une phrase.** Plus la fenêtre se remplit, moins le modèle exploite fiablement ce
qu'elle contient — même quand tout y est.

Le mécanisme : l'attention du modèle est un budget fini réparti sur n² relations entre tokens.
Le rapport Chroma (18 modèles testés, dont GPT-4.1, Claude 4, Gemini 2.5) le mesure : « *their
performance grows increasingly unreliable as input length grows* ». Ajouter du texte, même
pertinent, a un coût pour tout le reste.

**Où ça nous a mordus.** Chaque rétro ajoutait de la prose aux prompts « pour être sûr ». Chaque
ajout rendait tous les précédents un peu moins lus. L'amélioration continue **fabriquait** la
dégradation (voir fiche 14).

**Références.** Anthropic (lien fiche 1, section « context rot ») ; Chroma Research, *Context
Rot* (14/07/2025) — https://research.trychroma.com/context-rot

---

## Fiche 4 — Lost in the Middle : la position d'une règle compte

**L'idée en une phrase.** L'information placée au début ou à la fin du contexte est bien
exploitée ; celle du **milieu** est largement perdue (courbe en U mesurée expérimentalement).

**Où ça nous a mordus.** Dans `factory-chef-de-projet.md`, l'état d'esprit « closer — tue le
sujet dès qu'il arrive » ouvre le prompt (position forte), tandis que « Ne remplace pas les
spécialistes par le CDP » arrive ligne 65, au ~20e paragraphe (position faible), après 40 lignes
qui installent le réflexe inverse. À force d'impératifs égaux, c'est la position qui tranche —
et elle tranchait contre nous.

**Références.** Liu et al., *Lost in the Middle* — https://arxiv.org/abs/2307.03172 ; doc
Anthropic *Long context tips* (placer les instructions critiques au début ET les rappeler à la
fin) — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/long-context-tips

---

## Fiche 5 — La loi du nombre de règles : accuracy^n et l'omission silencieuse

**L'idée en une phrase.** Le respect global d'un prompt ≈ (respect d'une règle)^n : **chaque
règle ajoutée dégrade toutes les autres**, et sous charge une règle n'est pas déformée — elle est
**ignorée sans bruit**.

Trois résultats convergents : la décroissance exponentielle avec le nombre d'instructions
(« Curse of Instructions », ICLR 2025) ; ~68 % de suivi seulement à forte densité d'instructions,
même sur les meilleurs modèles, avec des erreurs qui deviennent des *omissions* pures (IFScale) ;
et une dégradation du raisonnement dès que l'entrée s'allonge, même avec du remplissage
non pertinent (Levy et al., ACL 2024).

**Où ça nous a mordus.** Le prompt du CDP fait **2 822 mots** là où notre propre cadrage
(`docs/07-upgrade-agents.md`) fixe la cible « lean » à ~250-340 mots. La ligne « Cadrer » fait à
elle seule 325 mots et empile 8 règles. Côté UX, « demande pour qui est l'outil » est noyé dans
un bullet de ~500 mots. Aucune de ces règles n'était mauvaise : elles étaient **trop nombreuses
pour survivre ensemble**.

**Références.** ManyIFEval / *Curse of Instructions* (ICLR 2025) —
https://openreview.net/forum?id=R6q67CDBCH ; IFScale — https://arxiv.org/abs/2507.11538 ;
Levy et al., *Same Task, More Tokens* — https://arxiv.org/abs/2402.14848

---

## Fiche 6 — Prompt vs harnais : le probabiliste et le déterministe

**L'idée en une phrase.** Une consigne dans un prompt est suivie *souvent* ; un contrôle dans le
**harnais** — le logiciel autour du modèle (hooks, permissions, schémas, scripts de build) — est
appliqué *toujours*.

C'est la distinction la plus importante de tout ce document. Un prompt est une influence
statistique ; le harnais est du code. La doc officielle des hooks le dit : « *deterministic
control… ensuring certain actions always happen rather than relying on the LLM to choose to run
them* ». Notre propre doctrine l'avait déjà formulé (`PRINCIPES-AGENTS.md:68`) : « **un garde-fou
est un mécanisme qui échoue, pas une phrase qui prévient** » — avec son test d'existence : casse
ce que le contrôle surveille, vérifie que ça devient rouge, restaure.

**Où ça nous a mordus.** La factory a TOUT mis dans les prompts et RIEN dans le harnais :
22 971 mots de règles écrites, zéro règle mécanisée. Les hooks `Stop`, `PostToolUse`,
`UserPromptSubmit` de `~/.claude/settings.json` sont des tableaux vides. Test d'existence
appliqué à notre propre fichier de principes : supprime `PRINCIPES-AGENTS.md`, **rien ne devient
rouge nulle part**. Selon nos propres termes, la factory n'avait pas de gates — elle avait des vœux.

**Références.** Doc Claude Code *Hooks* — https://code.claude.com/docs/en/hooks-guide ;
`~/.claude/PRINCIPES-AGENTS.md:68-73` (notre propre énoncé du principe).

---

## Fiche 7 — Les hooks Claude Code : à quoi ça ressemble concrètement

**L'idée en une phrase.** Un hook est un petit script que le harnais exécute à un moment précis
du cycle de travail, et qui peut **bloquer** l'action (exit code 2).

Les moments utiles pour nous : `PreToolUse` (avant qu'un outil s'exécute — peut interdire un
Write sur certains chemins), `PostToolUse` (après — peut vérifier ce qui vient d'être écrit),
`Stop` (quand l'agent veut terminer son tour — peut refuser la clôture si un livrable est
incomplet), `UserPromptSubmit` (à chaque message — peut injecter un rappel ciblé),
`SessionStart` (au démarrage — le seul que nous utilisions, pour vérifier la jonction agents).

Exemples de ce que ça permettra chez nous, au fil du parcours : refuser la fin de tour d'un agent
factory si son livrable n'a pas de bloc `## Passation` ; interdire au CDP d'écrire du code
projet (production = déléguer) tout en l'autorisant sur `CADRAGE.md`/`PLAN.md` ; bloquer le dev
d'une feature UI tant que l'artefact maquette validée n'existe pas.

**Références.** https://code.claude.com/docs/en/hooks-guide

---

## Fiche 8 — Artefacts typés : le formulaire bat la prose

**L'idée en une phrase.** On oublie une nuance noyée dans un paragraphe ; on n'oublie **jamais un
champ vide dans un formulaire** — et un champ vide peut rendre l'étape suivante impossible.

Deux niveaux. (a) Les *sorties structurées* au sens strict : quand on force un modèle à répondre
dans un schéma, l'adhérence passe de <40 % (consigne en prose) à 100 % (contrainte de décodage) —
chiffres OpenAI sur leurs modèles. (b) Les *artefacts à champs typés* : un `CADRAGE.md` avec des
champs obligatoires (pour qui / device / échelle / hors-périmètre), chaque champ étiqueté
`[réponse-utilisateur]`, `[mémoire: source]` ou `[hypothèse]`. La règle « pose des questions »
devient vérifiable : un champ critique marqué `[hypothèse]` est **visible et bloquant**, au lieu
d'une vertu qu'on espère.

**Où ça nous a mordus.** Le cadrage du CDP est un paragraphe de 325 mots : personne — ni toi, ni
la QA, ni le Contradicteur — ne peut vérifier qu'il a été fait. L'intake UX (pour qui ? quel
appareil ? quelles références marché ?) existe en prose et n'a jamais produit un artefact qu'on
aurait pu exiger.

**Références.** OpenAI, *Introducing Structured Outputs* —
https://openai.com/index/introducing-structured-outputs-in-the-api/ ; notation EARS de Kiro
(critères d'acceptation formatés « WHEN… THE SYSTEM SHALL… ») — https://kiro.dev/docs/specs/

---

## Fiche 9 — Spec-driven development : la spec comme source de vérité

**L'idée en une phrase.** Au lieu de dialoguer jusqu'à ce que « ça ait l'air bon » (vibe coding),
on investit l'intelligence en amont dans une **spécification persistée et versionnée**, puis
l'exécution devient quasi mécanique — « le code sert la spec ».

Le cycle canonique (GitHub Spec Kit) : Specify → Plan → Tasks → Implement, avec des étapes de
contrôle dédiées (`/clarify` pour lever les zones floues, `/analyze` pour vérifier la cohérence
entre artefacts). Amazon Kiro impose trois fichiers par feature : `requirements.md`,
`design.md`, `tasks.md`. Limites documentées à connaître : sur-spécification (la spec devient du
pseudo-code), « spec rot » (la spec dérive du code), effet waterfall — et Spec Kit est optimisé
pour du neuf, moins pour l'existant.

**Où ça nous concerne.** Notre chaîne `CADRAGE.md` → plan orchestrateur → tickets est déjà une
ébauche de spec-driven — c'est une force. Ce qui manque : les champs typés (fiche 8), les
checkpoints de clarification, et le caractère **bloquant** (aujourd'hui on peut sauter le cadrage
sans que rien n'échoue).

**Références.** GitHub Blog (02/09/2025) —
https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/ ;
https://github.com/github/spec-kit ; https://kiro.dev/docs/specs/ ; limites : Birgitta Böckeler
(martinfowler.com) et issue spec-kit #1191.

---

## Fiche 10 — Agent Skills : la connaissance juste-à-temps

**L'idée en une phrase.** Ranger le savoir procédural en **modules chargés seulement quand la
tâche les déclenche**, au lieu de tout empiler dans un prompt permanent.

Un skill est un dossier (`SKILL.md` + ressources) avec un déclencheur décrit dans son en-tête :
le harnais ne charge le contenu que quand la tâche correspond. Conséquence directe sur les fiches
3-5 : une règle chargée *au moment où elle s'applique* échappe à la dilution (elle n'occupe pas la
fenêtre en permanence) et à la loi accuracy^n (elle n'est pas en concurrence avec 40 autres).
C'est la réponse d'Anthropic au problème exact de notre symptôme « les règles ne sont pas prises
en compte » — et c'était absent de ta liste ET de ma première cartographie.

**Application chez nous.** Les candidats naturels : la checklist d'intake UX, le protocole de
passation, le sweep d'impact — chacun devient un module court à déclencheur, que le manager
améliore isolément au lieu d'engraisser un prompt.

**Références.** Anthropic, *Agent Skills* (oct. 2025) et doc Claude Code (section skills) —
https://code.claude.com/docs/en/ ; écosystème communautaire (ex. obra/superpowers).

---

## Fiche 11 — Multi-agent : quand ça aide, quand ça nuit

**L'idée en une phrase.** La **lecture** se parallélise très bien (recherche, audit, review) ;
l'**écriture couplée** (coder une feature) exige un contexte partagé — et les personas métiers
sont la variable la **moins** corrélée au succès.

Les trois faits à retenir. (a) Anthropic mesure +90,2 % sur ses tâches de *recherche* avec un
orchestrateur + subagents parallèles… pour ~15× le coût en tokens, et classe explicitement le
*coding* comme mauvais candidat au multi-agent. (b) Cognition (Devin) démontre l'inverse pour
l'écriture : des subagents parallèles prennent des décisions implicites divergentes qu'ils ne se
voient pas prendre (l'exemple Flappy Bird), et le multi-tour fragmenté coûte −39 % (Laban et al.).
(c) Les agences simulées académiques (ChatDev, MetaGPT — l'équivalent de notre factory) affichent
**41 à 87 % d'échec** en conditions réelles (étude MAST, 1 600 traces annotées).

**Où ça nous concerne — et ça recadre ton diagnostic.** « Le bras droit fait le travail
lui-même » n'est pas toujours un bug : pour une tâche d'écriture couplée, c'est parfois le
comportement *optimal*. Le vrai bug, c'est qu'il le fait **sans cadrage en amont ni gates en
aval**. Ce n'est pas un hasard si dev, QA et analyse marché fonctionnent bien chez nous : ce sont
les rôles dont la sortie est **vérifiable** (tests, critères, sources). Le critère de triage à
graver : lecture → paralléliser ; écriture → un exécutant + gates.

**Références.** Anthropic, *How we built our multi-agent research system* —
https://www.anthropic.com/engineering/built-multi-agent-research-system ; Cognition, *Don't
Build Multi-Agents* — https://cognition.com/blog/dont-build-multi-agents ; LangChain, *How and
when to build multi-agent systems* —
https://www.langchain.com/blog/how-and-when-to-build-multi-agent-systems ; MAST, *Why Do
Multi-Agent LLM Systems Fail?* — https://arxiv.org/abs/2503.13657

---

## Fiche 12 — Evals : transformer les échecs en tests rejouables

**L'idée en une phrase.** Chaque vrai échec devient un scénario qu'on **rejoue** pour prouver
qu'une correction corrige — et qu'elle ne re-casse pas plus tard (anti-régression).

La recommandation de démarrage (Anthropic) : 20-50 tâches tirées de *vrais* échecs, pas de
scénarios inventés. Trois façons de noter : un script (rapide, objectif), un LLM juge (souple
mais biaisé — biais de position, de verbosité, d'auto-préférence : ne jamais faire juger un
livrable par le modèle qui l'a produit, calibrer sur un échantillon noté à la main), un humain
(référence, mais ne passe pas à l'échelle).

**Application chez nous.** Tes 6 symptômes sont nos 6 premiers cas d'éval : brief ambigu → le CDP
pose-t-il la question de cadrage ? demande UX sans destinataire → l'agent demande-t-il pour qui ?
refonte de parcours → le sweep détecte-t-il le bouton orphelin ? Et le **canary de règle** pour le
manager : une règle n'est déclarée « gravée » que quand son scénario de violation passe de rouge
à vert. Sans ça, on optimise des textes dont l'effet n'est jamais mesuré — c'est exactement ce
qui nous est arrivé.

**Références.** Anthropic, *Demystifying evals for AI agents* (01/2026) —
https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents ; OpenAI, *Evaluation
best practices* — https://platform.openai.com/docs/guides/evaluation-best-practices ; Zheng et
al. (biais des juges LLM) — https://arxiv.org/abs/2306.05685 ; contrepoint utile : Hamel Husain,
*Evals FAQ* (« Write evaluators for errors you discover, not errors you imagine ») —
https://hamel.dev/blog/posts/evals-faq/

---

## Fiche 13 — Mesurer sans se raconter d'histoires

**L'idée en une phrase.** La perception ment : dans l'étude METR, des développeurs experts se
sont *sentis* accélérés de 20 % par l'IA alors qu'ils étaient *mesurés* ralentis de 19 % — un
écart de 39 points entre ressenti et réalité.

Les principes de mesure honnête, tous issus de cadres établis : toujours apparier une métrique de
vitesse avec une métrique de qualité (principe DORA — la vitesse sans stabilité, c'est de la
dette) ; jamais de métriques d'activité seules (lignes de code, commits — le cadre SPACE les
proscrit, et l'IA les gonfle mécaniquement : GitClear mesure l'explosion du copié-collé et du
churn dans le code assisté). Nos 6 métriques par lot, si un jour on veut mesurer : taux de
reprise, défauts échappés, passes de correction avant « Livré », temps de cycle médian, % d'effort
sur du neuf vs correctif, écart estimation/réel. (Note : METR a nuancé l'ampleur dans sa mise à
jour de février 2026 ; l'écart perception/mesure, lui, tient.)

**Références.** METR (07/2025) —
https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/ ; DORA —
https://dora.dev/guides/dora-metrics-four-keys/ ; SPACE — https://queue.acm.org/detail.cfm?id=3454124 ;
GitClear — https://www.gitclear.com/ai_assistant_code_quality_2025_research

---

## Fiche 14 — La méta-boucle : pourquoi la factory a régressé en s'améliorant

**L'idée en une phrase.** Si chaque leçon de rétro devient de la prose dans un prompt,
l'amélioration continue **fabrique** la dilution : plus le manager travaille, moins chaque règle
est suivie (fiches 3 et 5 combinées).

C'est le diagnostic le plus contre-intuitif de l'audit. Le prompt du CDP est devenu « le journal
des accidents passés » — en contradiction avec notre propre règle d'écriture (« ne grave jamais
un incident isolé »). Et la règle anti-duplication du manager (tout va dans PRINCIPES-AGENTS.md,
rien dans les prompts) était juste dans l'intention, mais sans canal de livraison (fiche 1) elle
a produit exactement la copie divergente qu'elle voulait éviter : le digest gelé.

**Le remède est un changement de contrat, pas une règle de plus** : toute leçon de rétro sort en
*mécanisme* — un hook (fiche 7), un champ d'artefact (fiche 8), un skill (fiche 10), un cas
d'éval (fiche 12) — et la prose devient l'exception réservée au pur jugement. Complété par deux
gardes : un plafond de mots par fichier agent vérifié en CI, et le canary de règle.

---

# Le parcours de correction — étape par étape

**Le principe.** Une étape = une ou deux notions appliquées + un résultat observable + **ta
validation avant de passer à la suivante**. On ne touche à rien d'autre pendant l'étape. Chaque
étape se clôt par : ce que tu dois avoir compris (les fiches), ce qui a changé dans les fichiers,
et comment le vérifier toi-même.

| # | Ce qu'on corrige | Fiches | Preuve observable de réussite |
|---|---|---|---|
| ✅ 1 | **Livrer les principes aux agents** : script d'inline à la compilation (frère de `sync-agents.mjs`) + mode `--check` — *fait le 18/07 (`inline-principes.mjs`, hook SessionStart)* | 1, 2 | Jouée : leçon-test apparue dans les 26 `.md`, `--check` rouge sur dérive puis vert |
| ✅ 2 | **Dégraisser le CDP** : identité 2 822 → 424 mots, méthode relogée dans `process/cdp-methode.md` (JIT en Claude Code, inlinée au build pour le runtime) — *fait le 18/07* | 3, 4, 5 | Jouée : A/B même brief, comportement égal ou meilleur ; le TRIAGE restait probabiliste → étape 3 |
| ✅ 3 | **Premier hook bloquant** : gate TRIAGE du CDP sur `SubagentStop` (`hook-triage-cdp.mjs`) — *fait le 18/07 ; la maquette-avant-dev reste candidate pour un hook ultérieur* | 6, 7 | Jouée : violation forcée bloquée (exit 2, trace vérifiée), omission spontanée rattrapée, réponse conforme passée en silence |
| ✅ 4 | **Artefacts typés** — *fait le 18/07* : `template-cadrage.md` + `template-intake-ux.md` (champs à provenance `[réponse-utilisateur]`/`[mémoire]`/`[hypothèse]`, règles dures), câblés dans `cdp-methode` (§1, §3, gate §5) et `factory-ux-ui` ; critique adversariale passée, 4 bloquants corrigés | 8, 9 | Jouée : brief ambigu CDP → questions bloquantes sans production (juge : conforme) ; brief UX → fiche d'intake + 5 questions au lieu d'un design. **Bonus majeur** : la sonde a révélé l'incident BOM — 15 agents hors registre + miroir prod cassé depuis le 17/07 — réparé et immunisé dans les scripts |
| 5 | **Sweep adjacent + matrice de complétude** (PO) | 8 | Rejeu du cas Sporae « bouton ajout contact » : le sweep le détecte |
| 6 | **Les 6 symptômes en evals rejouables** + canary de règle pour le manager | 12 | La suite passe verte, et se rejoue à chaque rétro |
| 7 | **Triage lecture/écriture du CDP + nouveau contrat du manager** (leçon → mécanisme) | 10, 11, 14 | À la rétro suivante, les leçons sortent en hooks/champs/skills, pas en prose |

L'ordre n'est pas arbitraire : l'étape 1 répare le canal de livraison (sinon tout le reste
s'écrit dans le vide), les étapes 2-3 appliquent la distinction prompt/harnais, les étapes 4-5
installent les artefacts, les étapes 6-7 ferment la boucle de preuve et empêchent la rechute.

---

# Annexe — Lexique

Les mots de jargon utilisés dans ce manuel et dans les travaux de la factory, en une ou deux
phrases chacun.

- **Sweep** (« coup de balai ») — balayage systématique d'une zone entière pour n'oublier aucun
  élément, par opposition à « regarder là où on pense qu'il y a un problème ». Chez nous :
  l'inventaire mécanique (script `grep`) des points d'entrée qui pointent vers un parcours
  refondu — boutons, liens, menus — avec verdict obligatoire par ligne (`GARDER` / `ADAPTER` /
  `SUPPRIMER` / `HORS-PÉRIMÈTRE`). C'est ce qui aurait attrapé le bouton « ajout contact » de
  Sporae. La QA couvre la *profondeur* du parcours modifié ; le sweep couvre sa *largeur*.
- **Gate** (« porte ») — point de contrôle qui doit être franchi pour continuer (revue, recette,
  validation de maquette). Une gate qui ne peut pas bloquer n'est pas une gate (fiche 6).
- **Harnais** (*harness*) — le logiciel autour du modèle : outils, permissions, hooks, scripts.
  Ce qui y est câblé s'applique toujours ; ce qui est dans le prompt s'applique souvent (fiche 6).
- **Hook** (« crochet ») — script que le harnais exécute automatiquement à un moment précis du
  cycle de travail, et qui peut bloquer l'action (fiche 7).
- **Intake** (« accueil ») — le questionnaire d'entrée avant de produire : pour qui, quel
  problème, quel appareil, quelles références. L'intake UX est l'exemple type (fiche 8).
- **DAG** (*directed acyclic graph*, graphe orienté sans cycle) — la forme du plan de travail de
  l'orchestrateur : des étapes reliées par des dépendances, sans boucle. « L'étape QA dépend de
  l'étape dev » = une flèche du DAG.
- **Frontmatter** — l'en-tête d'un fichier `.md` entre deux lignes `---` : les métadonnées (nom,
  outils, description) que le harnais lit pour router et outiller l'agent.
- **Eval** — scénario de test rejouable qui note le comportement d'un agent, pour prouver qu'une
  correction corrige et ne régresse pas (fiche 12).
- **Canary** (« canari ») — comme le canari dans la mine : un signal d'alerte précoce. Chez nous,
  le scénario qui prouve qu'une règle gravée change réellement le comportement — sans canari
  vert, la règle n'est pas déclarée « gravée » (fiche 12).
- **Churn** — code réécrit peu de temps après avoir été livré ; mesure le travail à refaire, donc
  la fausse vitesse (fiche 13).
- **Persona** — personnage-métier donné à un agent (PM, dev, QA…). Fiche 11 : c'est la variable
  la moins corrélée au succès des systèmes multi-agents.
- **Greenfield / brownfield** (« terrain vierge / friche ») — projet neuf, sans existant / projet
  qui doit composer avec un existant. L'effet de l'IA varie fortement entre les deux (fiche 13).

---

*Créé le 2026-07-18 à la demande de Benoit (formation étape par étape plutôt que refonte en
bloc). Sources vérifiées lors de l'audit du même jour. Ce doc s'enrichit si de nouvelles notions
apparaissent au fil du parcours — fiche 2 enrichie (curation continue) et lexique ajouté le
2026-07-18 suite aux premières questions.*
