// Moteur d'orchestration de la Factory team (V1).
//
//   note de cadrage validée
//        │
//   plan() ─ un agent planificateur choisit les agents pertinents et leurs dépendances
//        │   → un DAG d'étapes (Plan)
//   execute() ─ exécute le DAG (parallélisme + dépendances), chaque étape = 1 agent
//        │       les livrables des dépendances sont réinjectés en contexte
//   synthèse ─ le chef de projet consolide tout en une réponse pour l'utilisateur
//
// Tout est diffusé au dashboard via le bus d'événements de runStore (SSE).

import { getAgents, getChefDeProjet, type FactoryAgent } from "@cleveria/factory";
import { emit, type Plan, type PlanStep, type Run, type StepState } from "./runStore";
import { llmGenerate } from "./llm";
import { extractUrls, readUrl } from "./research";

const MAX_PARALLEL = 3;

// Couche « ops runtime » Cleveria, injectée dans le system de CHAQUE spécialiste (cf. runStep).
// L'agent.md porte l'IDENTITÉ (rôle, expertise, barre de qualité) ; cette couche porte les
// contraintes du contexte d'exécution (one-shot, sans outils) — cf. docs/07-upgrade-agents.md.
const CLEVERIA_DELIVERY_OPS = `
## Contexte d'exécution (Cleveria)
Tu interviens dans une agence **asynchrone, en UN SEUL passage** : tu reçois ta mission, la note de
cadrage et les livrables de tes dépendances, et tu rends TON livrable. Tu n'as **ni outils, ni accès
fichiers, ni second tour, ni dialogue** avec le client.

- **Produis un livrable Markdown autosuffisant et exploitable** — pas le plan de ce que tu ferais.
- **Quand une information manque, ne bloque pas : pose une hypothèse explicite** (« Hypothèse : … »)
  et continue. Récapitule tes hypothèses pour qu'elles restent discutables.
- **N'affirme jamais avoir exécuté, testé, lancé, vérifié ou consulté quoi que ce soit** — tu ne le
  peux pas ici. Si ton métier l'exige (tests, recette, revue d'un fichier réel), livre plutôt le
  matériel **prêt à exécuter** (tests écrits, plan de recette, points de contrôle) et dis ce qui
  reste à dérouler côté équipe.
- **Recherche : cite tes sources, ne bluffe pas les chiffres.** Toute affirmation factuelle (chiffre,
  fait, donnée marché) → indique sa **base/source** et **distingue le su de l'estimé**. Tu n'as pas
  d'accès web ici : ce qui devrait être recoupé, marque-le **« à confirmer »** plutôt que de l'asséner.
  Jamais de chiffre rond sorti de nulle part.
- Ton livrable peut être **réutilisé par un agent en aval** : sois précis, structuré, sans renvoyer
  à un échange que l'autre n'a pas vu.
- **Termine par un bloc \`## Passation\`** : décisions prises, conventions/identifiants à réutiliser
  tels quels en aval, hypothèses ouvertes, et ce qui reste à faire par les étapes suivantes. C'est le
  contrat qui fait que les livrables s'emboîtent au lieu d'être re-devinés.
`.trim();

// Variante pour la SYNTHÈSE finale du CDP : il agrège des livrables produits sans exécution réelle.
// Sans ça, la garde anti-hallucination saute au dernier mètre (le CDP peut requalifier « prêt à
// exécuter » en « fait/testé/déployé »). Cf. rétro manager 2026-06-30.
const CLEVERIA_SYNTHESIS_OPS = `
## Restitution (Cleveria)
Tu agrèges des livrables produits **sans exécution réelle** (agents one-shot, sans outils).
- Ne requalifie **jamais** un livrable « prêt à exécuter / à tester / à déployer » en « fait / testé /
  déployé ». Reste fidèle à ce que les agents ont réellement produit.
- **Conserve et regroupe les hypothèses ouvertes** des agents ; ne les gomme pas dans une conclusion lisse.
- Tu **restitues et recommandes** — tu ne promets pas un résultat que personne n'a constaté.
`.trim();

/** Transforme une erreur API brute en message lisible pour l'utilisateur. */
export function humanError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "Erreur inconnue");
  if (/credit balance is too low/i.test(raw))
    return "Crédit Anthropic insuffisant — ajoute du crédit sur console.anthropic.com → Plans & Billing.";
  if (/invalid x-api-key|authentication/i.test(raw))
    return "Clé Anthropic invalide ou manquante (vérifie ANTHROPIC_API_KEY).";
  if (/rate limit|429/i.test(raw)) return "Limite de débit Anthropic atteinte — réessaie dans un instant.";
  if (/overloaded|529/i.test(raw)) return "Service Claude momentanément surchargé — réessaie dans un instant.";
  return raw;
}

export function resolveModel(model: string | undefined): string {
  switch ((model ?? "").toLowerCase()) {
    case "opus":
      return "claude-opus-4-8";
    case "sonnet":
      return "claude-sonnet-4-6";
    case "haiku":
      return "claude-haiku-4-5";
    default:
      return model || "claude-opus-4-8";
  }
}

function findAgent(slug: string): FactoryAgent | undefined {
  return getAgents().find((a) => a.name === slug);
}

/** Le roster proposé au planificateur : les agents delivery, sauf le CDP (entrée/synthèse),
 * l'orchestrateur lui-même (il planifie, il n'est pas une étape de delivery), et le maquettiste
 * (appelé DIRECTEMENT par /api/maquette, hors orchestrate() — sinon le planificateur prod pourrait
 * doubler le travail de maquettage, cf. docs/18-maquette-archi.md §2). */
function deliveryRoster(): FactoryAgent[] {
  return getAgents().filter(
    (a) =>
      a.name !== "factory-chef-de-projet" &&
      a.name !== "factory-orchestrateur" &&
      a.name !== "factory-maquettiste",
  );
}

function rosterText(): string {
  return deliveryRoster()
    .map((a) => `- ${a.name} : ${a.description.split(".")[0]}.`)
    .join("\n");
}

const PLAN_SCHEMA_HINT = `
Réponds UNIQUEMENT par un objet JSON valide (sans texte autour, sans bloc \`\`\`), de la forme :
{
  "summary": "une phrase : la stratégie de l'équipe pour répondre au besoin",
  "steps": [
    {
      "id": "s1",
      "agent": "factory-product-owner",
      "title": "Découper le besoin en backlog",
      "task": "Consigne précise et autonome donnée à cet agent (2-4 phrases). Il ne voit que cette tâche + les livrables de ses dépendances.",
      "dependsOn": []
    }
  ]
}

Règles de format :
- **0 à 6 étapes.** Mobilise UNIQUEMENT des agents pertinents ; un plan minimal (0-1 étape) est permis et souhaitable si le besoin est déjà traité.
- "dependsOn" liste les id d'étapes dont le livrable est nécessaire en entrée. Les étapes indépendantes tournent en parallèle.
- Chaque "task" doit être autosuffisante : l'agent ne dispose que de sa tâche, de la note de cadrage et des livrables de ses dépendances.
- "agent" DOIT être un slug exact du roster fourni. N'invente aucun agent.
(La stratégie de planification et les invariants — ordre d'agence, chaîne dev→lead-tech→qa obligatoire — sont définis dans ton identité ci-dessus.)
`.trim();

// Repli si l'agent `factory-orchestrateur` n'est pas dans le miroir (sécurité ; normalement présent).
const ORCHESTRATEUR_FALLBACK =
  "Tu es l'orchestrateur de la Factory team. À partir d'une note de cadrage, tu établis le plan de travail (quels agents mobiliser, dans quel ordre, avec quelle consigne). Tu ne fais pas le travail toi-même. Mobilise uniquement les agents pertinents ; un plan minimal est permis. Si du logiciel est produit, la chaîne developpeur → lead-tech → qa est obligatoire.";

// L'identité du planificateur vit dans `factory-orchestrateur.md` (éditable comme un agent) ; le
// moteur n'y injecte au runtime que le roster dynamique + le contrat JSON. Cf. axe 2 rétro manager.
function plannerSystem(): string {
  const doctrine = findAgent("factory-orchestrateur")?.prompt ?? ORCHESTRATEUR_FALLBACK;
  return [
    doctrine,
    "",
    "Agents disponibles (roster) :",
    rosterText(),
    "",
    PLAN_SCHEMA_HINT,
  ].join("\n");
}

function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*\n([\s\S]*?)```/.exec(text);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

/** Plan de repli si le planificateur échoue : un seul agent généraliste traite tout le besoin. */
function fallbackPlan(): Plan {
  const agent = findAgent("factory-product-owner")
    ? "factory-product-owner"
    : deliveryRoster()[0]?.name ?? "factory-product-owner";
  return {
    summary: "Plan de repli : un agent généraliste traite le besoin de bout en bout.",
    steps: [
      {
        id: "s1",
        agent,
        title: "Traiter le besoin",
        task: "Le planificateur n'a pas pu découper la demande. Prends la note de cadrage et produis le livrable le plus utile possible (analyse, découpage, recommandations concrètes).",
        dependsOn: [],
      },
    ],
  };
}

async function plan(brief: string): Promise<Plan> {
  // Deux tentatives : un LLM peut renvoyer du JSON légèrement malformé sur un coup.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await llmGenerate({
        model: resolveModel("sonnet"),
        maxTokens: 2000,
        system: plannerSystem(),
        messages: [
          {
            role: "user",
            content: `Voici la note de cadrage validée par le client. Établis le plan de travail de l'équipe.\n\n${brief}`,
          },
        ],
      });

      const parsed = JSON.parse(extractJson(raw)) as Plan;
      // Ne garde que les étapes dont l'agent existe vraiment ; nettoie les dépendances orphelines.
      const valid = (parsed.steps ?? []).filter((s) => findAgent(s.agent));
      const ids = new Set(valid.map((s) => s.id));
      for (const s of valid) s.dependsOn = (s.dependsOn ?? []).filter((d) => ids.has(d));
      if (valid.length === 0) throw new Error("Aucune étape exploitable.");
      return { summary: parsed.summary ?? "Plan de travail de l'équipe.", steps: valid };
    } catch (e) {
      // Échec d'API (crédit, réseau) → on remonte ; échec de parsing → on retente une fois.
      const raw = e instanceof Error ? e.message : "";
      if (/credit balance|authentication|invalid x-api-key/i.test(raw)) throw e;
      if (attempt === 1) break;
    }
  }
  return fallbackPlan();
}

/** Libellé lisible d'un agent (sans le préfixe `factory-`). */
export function agentLabel(slug: string): string {
  return slug.replace(/^factory-/, "");
}

/** Première phrase de la description d'un agent (pour la restitution du plan). */
export function agentRole(slug: string): string {
  return findAgent(slug)?.description.split(".")[0] ?? "";
}

/**
 * Établit le plan de travail à partir d'un brief, SANS l'exécuter.
 * Sert à la restitution « qui fait quoi » avant le GO de l'utilisateur (page /voice).
 */
export async function planForBrief(brief: string): Promise<Plan> {
  return plan(brief);
}

// Pour le VÉRIFICATEUR : on récupère le contenu RÉEL des URLs citées dans les livrables à vérifier
// (Tier A, via research.ts — déterministe, gratuit) et on l'injecte dans son contexte. Il juge chaque
// affirmation sourcée contre ce contenu réel, jamais contre sa mémoire.
async function buildVerifierContext(depsOutputs: { title: string; output: string }[]): Promise<string> {
  const urls = extractUrls(depsOutputs.map((d) => d.output).join("\n")).slice(0, 10);
  if (urls.length === 0) {
    return "\n## Sources à vérifier\nAucune URL n'est citée dans les livrables. Vérifie les affirmations factuelles par recoupement si tu as un outil de recherche ; sinon marque chaque affirmation forte « à confirmer ». N'invente aucune source.";
  }
  const reads = await Promise.all(urls.map(readUrl));
  const block = reads
    .map((r) =>
      r.ok
        ? `### ${r.url} — ACCESSIBLE\n${r.text.slice(0, 1400)}`
        : `### ${r.url} — INJOIGNABLE (status ${r.status}${r.error ? ", " + r.error : ""})`,
    )
    .join("\n\n");
  return `\n## Sources citées — contenu RÉEL récupéré\nVoici le contenu réel des URLs citées (récupéré pour toi). Juge chaque affirmation sourcée **contre ce contenu uniquement** : si la source ne dit pas ce qui est prétendu → À CORRIGER ; si elle est INJOIGNABLE → NON CONFIRMÉ. Ne te fie jamais à ta mémoire pour ce qu'une source dit.\n\n${block}`;
}

async function runStep(
  run: Run,
  step: PlanStep,
  depsOutputs: { title: string; output: string }[],
  onDelta: (text: string) => void,
): Promise<string> {
  const agent = findAgent(step.agent)!;
  const isVerifier = step.agent === "factory-verificateur";
  const verifierBlock = isVerifier ? await buildVerifierContext(depsOutputs) : "";

  const context = [
    "## Note de cadrage du projet",
    run.brief,
    depsOutputs.length
      ? "\n## Livrables des étapes précédentes (tes entrées)\n" +
        depsOutputs.map((d) => `### ${d.title}\n${d.output}`).join("\n\n")
      : "",
    verifierBlock,
    "\n## Ta mission",
    step.task,
    "\nProduis ton livrable en Markdown (français), concret et directement exploitable. Tu peux inclure des schémas Mermaid si utile.",
  ]
    .filter(Boolean)
    .join("\n");

  // Streaming : on pousse chaque fragment au dashboard pour « voir l'agent taper ».
  return llmGenerate({
    model: resolveModel(agent.model),
    maxTokens: 4000,
    system: `${agent.prompt}\n\n${CLEVERIA_DELIVERY_OPS}`,
    messages: [{ role: "user", content: context }],
    onText: onDelta,
  });
}

async function synthesize(run: Run): Promise<string> {
  const chef = getChefDeProjet();
  const deliverables = run.plan!.steps
    .map((s) => {
      const st = run.steps[s.id];
      return `### ${st.agentLabel} — ${s.title}\n${st.output ?? "(pas de livrable)"}`;
    })
    .join("\n\n");

  return llmGenerate({
    model: resolveModel("opus"),
    maxTokens: 4000,
    system: `${chef.prompt}\n\n${CLEVERIA_SYNTHESIS_OPS}`,
    messages: [
      {
        role: "user",
        content: [
          "Tu es le chef de projet. L'équipe a produit les livrables ci-dessous à partir de la note de cadrage.",
          "Rédige la SYNTHÈSE finale pour le client (Markdown, français) : ce qui a été produit, comment les pièces s'articulent,",
          "les points de vigilance, et les prochaines étapes recommandées. Sois clair et orienté action. Ne recopie pas les livrables en entier — renvoie-y.",
          "",
          "## Note de cadrage",
          run.brief,
          "",
          "## Livrables de l'équipe",
          deliverables,
        ].join("\n"),
      },
    ],
    onText: (t) => emit(run, { type: "synthesis.delta", text: t }),
  });
}

/** Exécute le DAG : étapes prêtes (dépendances terminées) lancées par vagues, max MAX_PARALLEL en simultané. */
async function execute(run: Run): Promise<void> {
  const steps = run.plan!.steps;
  const done = new Set<string>();
  const failed = new Set<string>();
  const inFlight = new Map<string, Promise<void>>();

  // Une dépendance est "résolue" qu'elle ait réussi ou échoué : l'étape devient évaluable
  // (pour être lancée si toutes ses deps ont réussi, ou sautée si l'une a échoué).
  const resolved = (id: string) => done.has(id) || failed.has(id);
  const ready = () =>
    steps.filter(
      (s) =>
        !done.has(s.id) &&
        !failed.has(s.id) &&
        !inFlight.has(s.id) &&
        s.dependsOn.every(resolved),
    );

  while (done.size + failed.size < steps.length) {
    // Run arrêté par l'utilisateur : on ne lance plus aucune nouvelle vague. Les étapes déjà en
    // vol (inFlight) peuvent se terminer normalement, on les attend juste après la boucle.
    if (run.cancelled) break;
    for (const step of ready()) {
      if (run.cancelled) break;
      if (inFlight.size >= MAX_PARALLEL) break;
      // Une dépendance a échoué → on saute l'étape (pas de livrable d'entrée fiable).
      if (step.dependsOn.some((d) => failed.has(d))) {
        failed.add(step.id);
        emit(run, { type: "step.status", id: step.id, status: "error", error: "Dépendance échouée." });
        continue;
      }
      emit(run, { type: "step.status", id: step.id, status: "running" });
      const depsOutputs = step.dependsOn
        .map((d) => ({ title: run.steps[d].step.title, output: run.steps[d].output ?? "" }))
        .filter((d) => d.output);

      const p = runStep(run, step, depsOutputs, (text) =>
        emit(run, { type: "step.delta", id: step.id, text }),
      )
        .then((output) => {
          emit(run, { type: "step.output", id: step.id, output });
          emit(run, { type: "step.status", id: step.id, status: "done" });
          done.add(step.id);
        })
        .catch((e: unknown) => {
          emit(run, { type: "step.status", id: step.id, status: "error", error: humanError(e) });
          failed.add(step.id);
        })
        .finally(() => {
          inFlight.delete(step.id);
        });
      inFlight.set(step.id, p);
    }

    if (inFlight.size === 0 && ready().length === 0) break; // plus rien d'exécutable (deps cassées)
    if (inFlight.size > 0) await Promise.race(inFlight.values());
  }
  await Promise.allSettled(inFlight.values());
}

/**
 * Pilote complet d'un run : plan → exécution → synthèse. Émet tout au dashboard.
 * À lancer SANS await (background).
 *
 * `presetPlan` : plan DÉJÀ établi et validé par l'utilisateur (page /voice, restitution « qui fait
 * quoi » avant le GO). Fourni → on saute l'étape de planification pour exécuter exactement ce plan-là.
 */
export async function orchestrate(run: Run, presetPlan?: Plan): Promise<void> {
  try {
    emit(run, { type: "run.status", status: "planning" });
    const p = presetPlan ?? (await plan(run.brief));
    const steps: StepState[] = p.steps.map((step) => ({
      step,
      status: "pending",
      agentLabel: findAgent(step.agent)?.name.replace(/^factory-/, "") ?? step.agent,
    }));
    emit(run, { type: "planned", plan: p, steps });

    emit(run, { type: "run.status", status: "running" });
    await execute(run);

    // Arrêté pendant l'exécution : pas de synthèse, et surtout pas de statut "done"/"error"
    // par-dessus "cancelled" (déjà posé par cancelRun()).
    if (run.cancelled) return;

    const synthesis = await synthesize(run);
    if (run.cancelled) return; // arrêté pendant la synthèse elle-même : on n'émet pas le résultat
    emit(run, { type: "synthesis", output: synthesis });
    emit(run, { type: "run.status", status: "done" });
  } catch (e) {
    if (run.cancelled) return; // ne jamais écraser "cancelled" par "error"
    emit(run, { type: "run.status", status: "error", error: humanError(e) });
  }
}
