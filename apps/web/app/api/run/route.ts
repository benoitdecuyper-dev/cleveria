import { createRun, type Plan } from "../../../lib/runStore";
import { orchestrate } from "../../../lib/orchestrator";
import { demoOrchestrate } from "../../../lib/demo";

/** Ne garde que les champs du plan utiles à l'exécution (ignore agentLabel/role ajoutés côté API). */
function sanitizePlan(plan: unknown): Plan | undefined {
  if (!plan || typeof plan !== "object") return undefined;
  const p = plan as { summary?: unknown; steps?: unknown };
  if (!Array.isArray(p.steps) || p.steps.length === 0) return undefined;
  const steps = p.steps
    .map((s) => s as Record<string, unknown>)
    .filter((s) => typeof s.id === "string" && typeof s.agent === "string")
    .map((s) => ({
      id: s.id as string,
      agent: s.agent as string,
      title: typeof s.title === "string" ? s.title : "",
      task: typeof s.task === "string" ? s.task : "",
      dependsOn: Array.isArray(s.dependsOn) ? (s.dependsOn as unknown[]).filter((d): d is string => typeof d === "string") : [],
    }));
  if (steps.length === 0) return undefined;
  return { summary: typeof p.summary === "string" ? p.summary : "Plan validé.", steps };
}

// Lit le miroir d'agents + lance des appels Claude longs → runtime Node, jamais Edge.
export const runtime = "nodejs";
// L'orchestration tourne en arrière-plan après la réponse : pas de mise en cache/optimisation statique.
export const dynamic = "force-dynamic";
export const maxDuration = 800; // Render = serveur Node persistant ; on laisse le temps au travail profond.

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { brief?: string; demo?: boolean; plan?: unknown };
    const demo = body.demo === true;
    const brief = (body.brief ?? "").trim();
    // Plan déjà validé par l'utilisateur (page /voice) → on l'exécute tel quel, sans replanifier.
    const presetPlan = sanitizePlan(body.plan);

    // Le mode démo ne touche jamais à Claude → fonctionne même sans clé ni crédit.
    if (!demo && !process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY manquante." }, { status: 500 });
    }
    if (!demo && !brief) {
      return Response.json({ error: "Brief / note de cadrage manquante." }, { status: 400 });
    }

    const run = createRun(brief || "(démo)");
    // Fire-and-forget : on NE référence pas `req` ici, pour que le travail survive à la réponse.
    void (demo ? demoOrchestrate(run) : orchestrate(run, presetPlan));

    return Response.json({ runId: run.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return Response.json({ error: msg }, { status: 500 });
  }
}
