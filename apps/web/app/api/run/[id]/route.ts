import { getRun } from "../../../../lib/runStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Snapshot JSON d'un run (chargement initial du dashboard, et repli si le SSE échoue).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "Run introuvable (peut-être expiré)." }, { status: 404 });

  return Response.json({
    id: run.id,
    status: run.status,
    error: run.error ?? null,
    plan: run.plan ?? null,
    steps: Object.values(run.steps).map((s) => ({
      id: s.step.id,
      agent: s.step.agent,
      agentLabel: s.agentLabel,
      title: s.step.title,
      dependsOn: s.step.dependsOn,
      status: s.status,
      output: s.output ?? null,
      error: s.error ?? null,
    })),
    synthesis: run.synthesis ?? null,
  });
}
