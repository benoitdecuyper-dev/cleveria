import { cancelRun, getRun } from "../../../../../lib/runStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demande d'arrêt d'un run en cours (bouton "Arrêter le travail" du dashboard).
// L'orchestrateur lit le flag `cancelled` avant chaque nouvelle étape / la synthèse finale et
// s'arrête proprement, sans écraser le statut "cancelled" par "done"/"error".
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getRun(id)) return Response.json({ error: "Run introuvable (peut-être expiré)." }, { status: 404 });

  cancelRun(id);
  return Response.json({ ok: true });
}
