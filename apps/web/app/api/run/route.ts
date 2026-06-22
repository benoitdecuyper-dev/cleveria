import { createRun } from "../../../lib/runStore";
import { orchestrate } from "../../../lib/orchestrator";

// Lit le miroir d'agents + lance des appels Claude longs → runtime Node, jamais Edge.
export const runtime = "nodejs";
// L'orchestration tourne en arrière-plan après la réponse : pas de mise en cache/optimisation statique.
export const dynamic = "force-dynamic";
export const maxDuration = 800; // Render = serveur Node persistant ; on laisse le temps au travail profond.

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY manquante." }, { status: 500 });
    }
    const body = (await req.json().catch(() => ({}))) as { brief?: string };
    const brief = (body.brief ?? "").trim();
    if (!brief) return Response.json({ error: "Brief / note de cadrage manquante." }, { status: 400 });

    const run = createRun(brief);
    // Fire-and-forget : on NE référence pas `req` ici, pour que le travail survive à la réponse.
    void orchestrate(run);

    return Response.json({ runId: run.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return Response.json({ error: msg }, { status: 500 });
  }
}
