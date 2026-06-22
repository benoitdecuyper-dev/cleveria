import { getRun, subscribe, type RunEvent } from "../../../../../lib/runStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Flux SSE : rejoue le journal d'événements (backlog) puis pousse les nouveaux en direct.
// Le dashboard s'y abonne pour voir l'équipe travailler au fil de l'eau.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return new Response("Run introuvable", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: RunEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* contrôleur fermé */
        }
      };

      // 1) Backlog : tout ce qui s'est déjà passé.
      for (const e of run.events) send(e);
      // 2) Live : nouveaux événements.
      const unsub = subscribe(run, send);

      // Keep-alive (commentaire SSE) pour éviter les coupures de proxy.
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* ignoré */
        }
      }, 15000);

      const close = () => {
        clearInterval(ping);
        unsub();
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      };

      // Si le run est déjà terminé, on laisse le client fermer après réception du backlog.
      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
