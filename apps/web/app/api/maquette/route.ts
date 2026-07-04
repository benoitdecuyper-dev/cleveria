import { getAgents } from "@cleveria/factory";
import { demoMaquetteHtml } from "../../../lib/demo";
import { buildUserMessage, stripHtmlFence } from "../../../lib/maquette";
import { humanError, resolveModel } from "../../../lib/orchestrator";
import { llmGenerate, localProvider } from "../../../lib/llm";

// Lit le miroir d'agents + appelle Claude → runtime Node, jamais Edge.
export const runtime = "nodejs";

// Plomberie calquée sur /api/brief (ReadableStream + llmGenerate({onText})) — JAMAIS de spawn
// maison ici (cf. docs/18-maquette-archi.md §2) : llmGenerate/viaClaudeCode retire déjà les
// clés API de l'env du CLI local (héritage de secrets), la logique de retry/EPIPE Windows y
// est déjà traitée. On ne la duplique pas. buildUserMessage/stripHtmlFence vivent dans
// lib/maquette.ts (fonctions pures, testées indépendamment — lib/maquette.test.ts).

type MaquetteBody = { seed?: string; previousHtml?: string; feedback?: string; demo?: boolean };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as MaquetteBody;
    const seed = (body.seed ?? "").trim();
    const previousHtml = (body.previousHtml ?? "").trim();
    const feedback = (body.feedback ?? "").trim();
    const demo = body.demo === true;

    if (!seed) return Response.json({ error: "Brief de maquette manquant." }, { status: 400 });

    // Mode démo : HTML statique scripté, aucun appel Claude (marche sans clé ni crédit).
    if (demo) return Response.json({ html: demoMaquetteHtml(seed, feedback || undefined) });

    if (!localProvider() && !process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY manquante." }, { status: 500 });
    }

    const agent = getAgents().find((a) => a.name === "factory-maquettiste");
    if (!agent) {
      return Response.json(
        { error: "Agent factory-maquettiste introuvable dans le miroir — lance `npm run sync:agents`." },
        { status: 500 },
      );
    }

    const userMessage = buildUserMessage(seed, previousHtml || undefined, feedback || undefined);

    // Réponse en flux (SSE) — calquée sur /api/brief. On ne monte l'iframe QUE côté client, au
    // "done" (jamais sur du HTML partiel, cf. docs/18 §1) : ici le "delta" sert de signal de vie.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          const raw = await llmGenerate({
            model: resolveModel(agent.model ?? "sonnet"),
            maxTokens: 8000,
            system: agent.prompt,
            messages: [{ role: "user", content: userMessage }],
            onText: (t) => emit({ t: "delta", text: t }),
          });
          emit({ t: "done", html: stripHtmlFence(raw) });
        } catch (e) {
          // Jamais de repli silencieux vers une maquette factice : l'erreur remonte telle quelle.
          emit({ t: "error", error: humanError(e) });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return Response.json({ error: humanError(e) }, { status: 500 });
  }
}
