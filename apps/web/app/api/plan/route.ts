import { planForBrief, agentLabel, agentRole, humanError } from "../../../lib/orchestrator";
import { DEMO_PLAN } from "../../../lib/demo";
import type { Plan } from "../../../lib/runStore";
import { enforceRateLimit } from "../../../lib/rateLimitPolicy";

// Lit le miroir d'agents + appelle Claude (planificateur) → runtime Node, jamais Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Étape de plan enrichie pour l'affichage / la lecture vocale (« qui fait quoi »). */
type RichStep = {
  id: string;
  agent: string;
  /** libellé lisible, ex. "architecte" */
  agentLabel: string;
  /** rôle de l'agent en une phrase, ex. "Architecte de montage de la Factory team" */
  agentRole: string;
  title: string;
  task: string;
  dependsOn: string[];
};

function enrich(plan: Plan): { summary: string; steps: RichStep[] } {
  return {
    summary: plan.summary,
    steps: plan.steps.map((s) => ({
      id: s.id,
      agent: s.agent,
      agentLabel: agentLabel(s.agent),
      agentRole: agentRole(s.agent),
      title: s.title,
      task: s.task,
      dependsOn: s.dependsOn ?? [],
    })),
  };
}

/**
 * Restitution du plan d'actions AVANT exécution : à partir d'un brief / note de cadrage,
 * renvoie le plan « qui fait quoi » (sans rien lancer). Le client le présente, le lit à voix
 * haute, et n'appelle /api/run qu'après le GO de l'utilisateur (avec ce même plan).
 */
export async function POST(req: Request) {
  // Protège les crédits Anthropic (appel Claude planificateur). Indépendant du gate d'accès.
  const limited = enforceRateLimit(req, "plan");
  if (limited) return limited;

  try {
    const body = (await req.json().catch(() => ({}))) as { brief?: string; demo?: boolean };
    const demo = body.demo === true;
    const brief = (body.brief ?? "").trim();

    if (demo) return Response.json({ plan: enrich(DEMO_PLAN) });

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY manquante." }, { status: 500 });
    }
    if (!brief) {
      return Response.json({ error: "Brief / note de cadrage manquante." }, { status: 400 });
    }

    const plan = await planForBrief(brief);
    return Response.json({ plan: enrich(plan) });
  } catch (e) {
    return Response.json({ error: humanError(e) }, { status: 500 });
  }
}
