// Store de runs EN MÉMOIRE (V0 : pas de Supabase).
// Render = serveur Node mono-instance et persistant → un run vit dans ce Map
// le temps de l'orchestration, et le dashboard s'y abonne via SSE.
// Si le process redémarre, les runs en cours sont perdus — acceptable en V1.

export type StepStatus = "pending" | "running" | "done" | "error";

export interface PlanStep {
  id: string;
  /** slug d'agent factory, ex. "factory-product-owner" */
  agent: string;
  /** libellé court affiché dans le dashboard */
  title: string;
  /** la consigne concrète passée à l'agent */
  task: string;
  /** ids des étapes dont celle-ci dépend (leurs livrables sont injectés en contexte) */
  dependsOn: string[];
}

export interface Plan {
  /** une phrase : la stratégie de l'équipe pour répondre au besoin */
  summary: string;
  steps: PlanStep[];
}

export interface StepState {
  step: PlanStep;
  status: StepStatus;
  /** nom lisible de l'agent (depuis le roster) */
  agentLabel: string;
  output?: string;
  error?: string;
}

export type RunStatus = "planning" | "running" | "done" | "error";

// Événements diffusés au dashboard (SSE). Le backlog est rejoué à la connexion.
export type RunEvent =
  | { type: "run.status"; status: RunStatus; error?: string }
  | { type: "planned"; plan: Plan; steps: StepState[] }
  | { type: "step.status"; id: string; status: StepStatus; error?: string }
  // streaming : chaque fragment de texte produit par l'agent, au fil de l'eau
  | { type: "step.delta"; id: string; text: string }
  // livrable complet (autorité finale, réconcilie d'éventuels deltas manqués)
  | { type: "step.output"; id: string; output: string }
  | { type: "synthesis.delta"; text: string }
  | { type: "synthesis"; output: string };

export interface Run {
  id: string;
  createdAt: number;
  brief: string;
  status: RunStatus;
  plan?: Plan;
  steps: Record<string, StepState>;
  synthesis?: string;
  error?: string;
  /** journal complet, rejoué aux nouveaux abonnés */
  events: RunEvent[];
  subscribers: Set<(e: RunEvent) => void>;
}

// Survit au Hot-Reload de Next en dev (sinon un nouveau Map à chaque recompile).
const g = globalThis as unknown as { __cleveriaRuns?: Map<string, Run> };
const runs: Map<string, Run> = (g.__cleveriaRuns ??= new Map());

function makeId(): string {
  // Pas de dépendance crypto requise ; suffisant pour un id de run éphémère.
  return "run_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function createRun(brief: string): Run {
  const run: Run = {
    id: makeId(),
    createdAt: Date.now(),
    brief,
    status: "planning",
    steps: {},
    events: [],
    subscribers: new Set(),
  };
  runs.set(run.id, run);
  return run;
}

export function getRun(id: string): Run | undefined {
  return runs.get(id);
}

/** Applique l'effet de l'événement sur l'état du run, le journalise, et notifie les abonnés. */
export function emit(run: Run, event: RunEvent): void {
  switch (event.type) {
    case "run.status":
      run.status = event.status;
      if (event.error) run.error = event.error;
      break;
    case "planned":
      run.plan = event.plan;
      for (const s of event.steps) run.steps[s.step.id] = s;
      break;
    case "step.status": {
      const st = run.steps[event.id];
      if (st) {
        st.status = event.status;
        if (event.error) st.error = event.error;
      }
      break;
    }
    case "step.delta": {
      const st = run.steps[event.id];
      if (st) st.output = (st.output ?? "") + event.text;
      break;
    }
    case "step.output": {
      const st = run.steps[event.id];
      if (st) st.output = event.output;
      // Compaction : le livrable complet remplace ses deltas dans le backlog rejoué au SSE.
      run.events = run.events.filter((e) => !(e.type === "step.delta" && e.id === event.id));
      break;
    }
    case "synthesis.delta":
      run.synthesis = (run.synthesis ?? "") + event.text;
      break;
    case "synthesis":
      run.synthesis = event.output;
      run.events = run.events.filter((e) => e.type !== "synthesis.delta");
      break;
  }
  run.events.push(event);
  for (const cb of run.subscribers) {
    try {
      cb(event);
    } catch {
      /* abonné mort : ignoré, sera nettoyé au unsubscribe */
    }
  }
}

/** S'abonne aux événements futurs. Renvoie une fonction de désabonnement. */
export function subscribe(run: Run, cb: (e: RunEvent) => void): () => void {
  run.subscribers.add(cb);
  return () => run.subscribers.delete(cb);
}
