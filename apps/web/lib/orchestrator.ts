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

import Anthropic from "@anthropic-ai/sdk";
import { getAgents, getChefDeProjet, type FactoryAgent } from "@cleveria/factory";
import { emit, type Plan, type PlanStep, type Run, type StepState } from "./runStore";

const MAX_PARALLEL = 3;

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

/** Le roster proposé au planificateur : tous les agents delivery sauf le CDP (point d'entrée/synthèse). */
function deliveryRoster(): FactoryAgent[] {
  return getAgents().filter((a) => a.name !== "factory-chef-de-projet");
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

Règles de planification :
- Choisis 2 à 6 étapes, en mobilisant UNIQUEMENT des agents pertinents pour CE besoin (un montage juridique n'a pas besoin d'un développeur).
- Mets les agents dans un ordre d'agence réaliste via "dependsOn" : cadrage/découpage (product-owner, architecte) → production (développeur, finance, conformité, marketing, ux-ui, business-dev…) → contrôle (lead-tech, qa, security-auditor) quand c'est du logiciel.
- "dependsOn" liste les id d'étapes dont le livrable est nécessaire en entrée. Les étapes indépendantes tourneront en parallèle.
- Chaque "task" doit être autosuffisante : l'agent ne dispose que de sa tâche, de la note de cadrage et des livrables de ses dépendances.
- "agent" DOIT être un slug exact de la liste ci-dessous. N'invente aucun agent.
`.trim();

function plannerSystem(): string {
  return [
    "Tu es l'orchestrateur de la Factory team — une agence d'agents spécialisés.",
    "À partir d'une note de cadrage, tu établis le PLAN DE TRAVAIL : quels agents mobiliser, dans quel ordre, et avec quelle consigne chacun.",
    "Tu ne fais PAS le travail toi-même ; tu le distribues aux bons agents.",
    "",
    "Agents disponibles :",
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

async function plan(client: Anthropic, run: Run): Promise<Plan> {
  const message = await client.messages.create({
    model: resolveModel("sonnet"),
    max_tokens: 2000,
    system: plannerSystem(),
    messages: [
      {
        role: "user",
        content: `Voici la note de cadrage validée par le client. Établis le plan de travail de l'équipe.\n\n${run.brief}`,
      },
    ],
  });
  const raw = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const parsed = JSON.parse(extractJson(raw)) as Plan;
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error("Plan vide ou invalide renvoyé par le planificateur.");
  }
  // Ne garde que les étapes dont l'agent existe vraiment ; nettoie les dépendances orphelines.
  const valid = parsed.steps.filter((s) => findAgent(s.agent));
  const ids = new Set(valid.map((s) => s.id));
  for (const s of valid) s.dependsOn = (s.dependsOn ?? []).filter((d) => ids.has(d));
  if (valid.length === 0) throw new Error("Aucune étape ne référence un agent connu.");
  return { summary: parsed.summary ?? "Plan de travail de l'équipe.", steps: valid };
}

async function runStep(
  client: Anthropic,
  run: Run,
  step: PlanStep,
  depsOutputs: { title: string; output: string }[],
  onDelta: (text: string) => void,
): Promise<string> {
  const agent = findAgent(step.agent)!;
  const context = [
    "## Note de cadrage du projet",
    run.brief,
    depsOutputs.length
      ? "\n## Livrables des étapes précédentes (tes entrées)\n" +
        depsOutputs.map((d) => `### ${d.title}\n${d.output}`).join("\n\n")
      : "",
    "\n## Ta mission",
    step.task,
    "\nProduis ton livrable en Markdown (français), concret et directement exploitable. Tu peux inclure des schémas Mermaid si utile.",
  ]
    .filter(Boolean)
    .join("\n");

  // Streaming : on pousse chaque fragment au dashboard pour « voir l'agent taper ».
  const stream = client.messages.stream({
    model: resolveModel(agent.model),
    max_tokens: 4000,
    system: agent.prompt,
    messages: [{ role: "user", content: context }],
  });
  stream.on("text", (t) => onDelta(t));
  const message = await stream.finalMessage();
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function synthesize(client: Anthropic, run: Run): Promise<string> {
  const chef = getChefDeProjet();
  const deliverables = run.plan!.steps
    .map((s) => {
      const st = run.steps[s.id];
      return `### ${st.agentLabel} — ${s.title}\n${st.output ?? "(pas de livrable)"}`;
    })
    .join("\n\n");

  const stream = client.messages.stream({
    model: resolveModel("opus"),
    max_tokens: 4000,
    system: chef.prompt,
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
  });
  stream.on("text", (t) => emit(run, { type: "synthesis.delta", text: t }));
  const message = await stream.finalMessage();
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Exécute le DAG : étapes prêtes (dépendances terminées) lancées par vagues, max MAX_PARALLEL en simultané. */
async function execute(client: Anthropic, run: Run): Promise<void> {
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
    for (const step of ready()) {
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

      const p = runStep(client, run, step, depsOutputs, (text) =>
        emit(run, { type: "step.delta", id: step.id, text }),
      )
        .then((output) => {
          emit(run, { type: "step.output", id: step.id, output });
          emit(run, { type: "step.status", id: step.id, status: "done" });
          done.add(step.id);
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : "Erreur agent";
          emit(run, { type: "step.status", id: step.id, status: "error", error: msg });
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

/** Pilote complet d'un run : plan → exécution → synthèse. Émet tout au dashboard. À lancer SANS await (background). */
export async function orchestrate(run: Run): Promise<void> {
  const client = new Anthropic();
  try {
    emit(run, { type: "run.status", status: "planning" });
    const p = await plan(client, run);
    const steps: StepState[] = p.steps.map((step) => ({
      step,
      status: "pending",
      agentLabel: findAgent(step.agent)?.name.replace(/^factory-/, "") ?? step.agent,
    }));
    emit(run, { type: "planned", plan: p, steps });

    emit(run, { type: "run.status", status: "running" });
    await execute(client, run);

    const synthesis = await synthesize(client, run);
    emit(run, { type: "synthesis", output: synthesis });
    emit(run, { type: "run.status", status: "done" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur d'orchestration";
    emit(run, { type: "run.status", status: "error", error: msg });
  }
}
