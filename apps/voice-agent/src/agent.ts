// Cleveria — worker voix temps réel (LiveKit Agents JS).
// Couche conversationnelle RAPIDE : le chef de projet parle à l'utilisateur.
// Quand il décide de mobiliser l'équipe, il appelle l'outil `dispatch_to_factory`,
// qui lance le travail PROFOND en arrière-plan (couche factory, async) — sans bloquer la voix.
//
// ⚠️ Point de départ à valider au 1er run (avec les vraies clés) : l'API LiveKit Agents JS
//    évolue, et le routage du LLM Claude (LiveKit Inference vs nœud LLM custom) est à confirmer.
//    On ajuste ensemble latence, interruptions (barge-in) et choix du modèle voix.

import "dotenv/config";
import {
  cli,
  defineAgent,
  voice,
  type JobContext,
  WorkerOptions,
} from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as cartesia from "@livekit/agents-plugin-cartesia";
import * as silero from "@livekit/agents-plugin-silero";
import { loadChefDeProjet } from "@cleveria/factory";

const VOICE_MODEL = process.env.CLEVERIA_VOICE_MODEL ?? "claude-sonnet-4-6";

export default defineAgent({
  // Pré-charge le VAD une fois par worker (latence).
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    await ctx.connect();

    // Source de vérité unique : le prompt du chef de projet vient de .claude/agents.
    const chef = loadChefDeProjet();

    const agent = new voice.Agent({
      instructions:
        chef.prompt +
        "\n\nTu es en conversation VOCALE temps réel : réponses courtes et naturelles. " +
        "CHALLENGE d'abord le besoin en posant un maximum de questions ciblées (objectif, " +
        "bénéficiaires, périmètre in/out, contraintes, critères de succès, risques) avant tout cadrage. " +
        "Quand tu as assez d'éléments, propose une note de cadrage (compte rendu, ce que tu as compris, " +
        "schémas fonctionnels, début de solution). Pour tout travail profond, appelle dispatch_to_factory " +
        "puis explique à l'oral qui tu mobilises — n'attends pas le résultat en silence.",
      tools: {
        // TODO(V0+) : brancher sur l'orchestration Agent SDK (couche factory async)
        // et streamer l'avancement vers le dashboard via Supabase Realtime.
        dispatch_to_factory: {
          description:
            "Confie un besoin cadré à la Factory team (delivery tech et/ou business). " +
            "Le travail tourne en arrière-plan ; renvoie un accusé immédiat.",
          parameters: {
            type: "object",
            properties: {
              brief: { type: "string", description: "Le besoin cadré, en une à trois phrases." },
              pole: {
                type: "string",
                enum: ["tech", "business", "produit"],
                description: "Le pôle pressenti.",
              },
            },
            required: ["brief"],
          },
          execute: async ({ brief, pole }: { brief: string; pole?: string }) => {
            console.log(`[dispatch_to_factory] pôle=${pole ?? "?"} :: ${brief}`);
            return `C'est lancé côté ${pole ?? "équipe"}. Je reviens vers toi dès qu'il y a du concret.`;
          },
        },
      },
    });

    const session = new voice.AgentSession({
      stt: new deepgram.STT({ model: "nova-3", language: "fr" }),
      // Claude comme LLM. À confirmer au 1er run : route Inference `anthropic/${VOICE_MODEL}`
      // (sinon, repli sur un nœud LLM custom appelant l'API Messages en streaming).
      llm: VOICE_MODEL, // placeholder de modèle — remplacé par l'instance LLM validée au run
      tts: new cartesia.TTS({ language: "fr" }),
      vad: ctx.proc.userData.vad as silero.VAD,
    });

    await session.start({ agent, room: ctx.room });
    await session.say(
      "Bonjour, je suis le chef de projet de Cleveria. Dites-moi ce que vous voulez construire.",
    );
  },
});

cli.runApp(new WorkerOptions({ agent: import.meta.url }));
