import Anthropic from "@anthropic-ai/sdk";
import { getChefDeProjet } from "@cleveria/factory";
import { demoBriefResponse } from "../../../lib/demo";
import { humanError } from "../../../lib/orchestrator";

// Le lecteur d'agents lit le système de fichiers → runtime Node (pas Edge).
export const runtime = "nodejs";

// Mode opératoire V0 : le CDP challenge le besoin AVANT de cadrer, puis livre une note.
const V0_CDP_INSTRUCTIONS = `
## Mode opératoire Cleveria (V0)

Tu reçois un besoin (écrit/vocal + pièces jointes). Avant TOUT cadrage, tu CHALLENGES le besoin.

1) **Phase questions (par défaut)** : pose un MAXIMUM de questions pertinentes pour bien comprendre —
   objectif et pourquoi, bénéficiaires/utilisateurs, périmètre (ce qui est dans / hors scope),
   existant et contraintes (techniques, légales, budget, délai), critères de succès, risques et
   conditions bloquantes. Procède par salves de questions ciblées. Ne produis PAS la note tant qu'il
   reste des zones d'ombre importantes.

   Tes questions doivent être **cliquables**. Après la ligne \`MODE: questions\`, écris 1-2 phrases
   d'intro, puis un bloc \`\`\`json (valide, sans commentaires) :
   { "questions": [
       { "id": "q1", "text": "…", "type": "single" | "multi" | "open",
         "options": ["…","…"], "allowFreeText": true }
   ] }
   Règles : privilégie des questions **fermées** (type "single" ou "multi", 3 à 6 options courtes)
   ou **semi-fermées** (options + "allowFreeText": true pour compléter à l'écrit). N'utilise "open"
   (texte libre seul) que si une liste d'options n'a vraiment pas de sens. Pose plusieurs questions
   par salve.

2) **Phase cadrage** : quand tu as assez d'éléments (ou si l'utilisateur te demande de conclure),
   produis la NOTE DE CADRAGE.

**Format OBLIGATOIRE** : commence ta réponse par une première ligne contenant EXACTEMENT
\`MODE: questions\` ou \`MODE: cadrage\`, puis le contenu en dessous.

La NOTE DE CADRAGE (Markdown, en français, prête à publier) contient, dans cet ordre :

### 1. Compte rendu du besoin
Synthèse de l'échange : ce qui a été demandé, les réponses clés obtenues.

### 2. Ce que j'ai compris du besoin
Reformulation claire de l'objectif, des bénéficiaires, et du périmètre (in / hors scope).

### 3. Schémas fonctionnels
Un ou plusieurs diagrammes **Mermaid** décrivant le fonctionnement visé (flux utilisateur, acteurs,
étapes…). Utilise des blocs \`\`\`mermaid valides et simples (flowchart TD ou sequenceDiagram).

### 4. Début de solution proposée
Pistes concrètes, découpage V1/V2, et pour chaque piste un ordre de grandeur d'effort et de risque.
`.trim();

function resolveModel(model: string | undefined): string {
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

async function transcribe(audio: File): Promise<string> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return "";
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&language=fr&smart_format=true",
    {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": audio.type || "audio/webm" },
      body: Buffer.from(await audio.arrayBuffer()),
    },
  );
  if (!res.ok) return "";
  const data = await res.json();
  return data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
}

type ContentBlocks = Exclude<Anthropic.MessageParam["content"], string>;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const text = (form.get("text") as string | null)?.trim() ?? "";
    const audio = form.get("audio") as File | null;
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const force = form.get("force") === "1";
    const demo = form.get("demo") === "1";

    // Historique de la conversation (tours précédents, texte seul).
    let history: { role: "user" | "assistant"; content: string }[] = [];
    try {
      history = JSON.parse((form.get("history") as string | null) ?? "[]");
    } catch {
      history = [];
    }

    // Mode démo : réponse scriptée, aucun appel à Claude (marche sans clé ni crédit).
    if (demo) {
      const userEcho = text || (files.length ? "[pièces jointes envoyées]" : force ? "Produire la note." : "");
      return Response.json({ ...demoBriefResponse(history.length, force), userEcho });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY manquante." }, { status: 500 });
    }

    const transcript = audio ? await transcribe(audio) : "";

    // Nouveau tour utilisateur : pièces jointes (1er tour surtout) + brief / réponse.
    const content: ContentBlocks = [];
    for (const file of files) {
      const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      const type = file.type;
      if (type === "application/pdf") {
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: b64 },
        });
      } else if (type.startsWith("image/")) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: type as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
            data: b64,
          },
        });
      } else {
        const asText = Buffer.from(b64, "base64").toString("utf8");
        content.push({ type: "text", text: `--- Pièce jointe ${file.name} ---\n${asText}` });
      }
    }

    // `echo` = ce que l'utilisateur a réellement dit (pour l'historique et l'affichage).
    const echo = [text, transcript && `(message vocal) ${transcript}`].filter(Boolean).join("\n\n");
    const userEcho = echo || (files.length ? "[pièces jointes envoyées]" : "");
    const userText = [
      echo,
      force &&
        "(L'utilisateur demande de PRODUIRE LA NOTE DE CADRAGE maintenant, avec les éléments disponibles.)",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!userText && content.length === 0) {
      return Response.json({ error: "Message vide." }, { status: 400 });
    }
    content.push({ type: "text", text: userText || "(rien de plus à ajouter pour l'instant.)" });

    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content },
    ];

    const chef = getChefDeProjet();
    const client = new Anthropic();

    const message = await client.messages.create({
      model: resolveModel(chef.model),
      max_tokens: 6000,
      system: `${chef.prompt}\n\n${V0_CDP_INSTRUCTIONS}`,
      messages,
    });

    let reply = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // Détecte le mode via la 1re ligne `MODE: ...`, puis la retire de l'affichage.
    const firstLine = reply.split("\n", 1)[0] ?? "";
    const isNote = /^MODE:\s*cadrage/i.test(firstLine);
    if (/^MODE:\s*(questions|cadrage)/i.test(firstLine)) {
      reply = reply.slice(firstLine.length).trim();
    }

    // En phase questions : extrait le bloc JSON cliquable (si présent).
    let questions: unknown = null;
    if (!isNote) {
      const m = /```json\s*\n([\s\S]*?)```/.exec(reply);
      if (m) {
        try {
          const parsed = JSON.parse(m[1]);
          if (Array.isArray(parsed?.questions)) questions = parsed.questions;
        } catch {
          /* JSON invalide → on retombe sur le texte libre */
        }
        reply = (reply.slice(0, m.index) + reply.slice(m.index + m[0].length)).trim();
      }
    }

    return Response.json({ reply, isNote, questions, userEcho });
  } catch (e) {
    return Response.json({ error: humanError(e) }, { status: 500 });
  }
}
