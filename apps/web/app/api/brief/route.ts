import Anthropic from "@anthropic-ai/sdk";
import { getChefDeProjet } from "@cleveria/factory";
import { demoBriefResponse } from "../../../lib/demo";
import { humanError } from "../../../lib/orchestrator";

// Le lecteur d'agents lit le système de fichiers → runtime Node (pas Edge).
export const runtime = "nodejs";

// Mode opératoire Cleveria : le CDP agit comme BRAS DROIT. À chaque message il TRIE :
// il traite lui-même le quotidien (direct), questionne si besoin, ou cadre un vrai
// projet (cadrage) pour mobiliser la factory.
const BRAS_DROIT_INSTRUCTIONS = `
## Mode opératoire Cleveria — tu es le bras droit

Tu es le **bras droit** de l'utilisateur, son point d'entrée unique. À CHAQUE message, tu commences
par TRIER la demande dans l'un de ces trois modes, et tu écris ce mode en TOUTE PREMIÈRE LIGNE,
contenant EXACTEMENT \`MODE: direct\`, \`MODE: questions\` ou \`MODE: cadrage\`, puis le contenu en dessous.

### Comment trier
- **direct** — la demande est à ta portée immédiate : tu peux la traiter TOI-MÊME, tout de suite,
  sans mobiliser l'équipe ni un travail profond. Ex : rédiger ou relire un mail/texte, répondre à une
  question, structurer une idée, donner un avis argumenté, faire une recherche simple, produire une
  checklist, un brouillon, un plan rapide. **Biais par défaut : si tu peux le faire bien toi-même,
  fais-le** (MODE: direct).
- **questions** — il te manque des éléments pour bien faire (pour traiter toi-même OU pour mobiliser
  l'équipe). Procède par salves de questions ciblées.
- **cadrage** — c'est un VRAI projet : il mobilise plusieurs métiers ou demande un travail profond
  (build logiciel, business plan, stratégie, montage juridique, campagne…). Avant de cadrer tu as en
  général CHALLENGÉ le besoin via \`questions\`. Tu produis la NOTE DE CADRAGE qui servira à mobiliser
  la factory.

### Format direct
Après la ligne \`MODE: direct\`, écris directement ton livrable en Markdown (français), prêt à
l'emploi — pas de méta-blabla. Si la demande gagnerait à être approfondie par l'équipe, termine par
une ligne courte : « *Si tu veux, je peux mobiliser l'équipe pour aller plus loin.* »

### Format questions
Pose un MAXIMUM de questions pertinentes pour bien comprendre — objectif et pourquoi,
bénéficiaires/utilisateurs, périmètre (ce qui est dans / hors scope), existant et contraintes
(techniques, légales, budget, délai), critères de succès, risques et conditions bloquantes. Ne passe
PAS au cadrage tant qu'il reste des zones d'ombre importantes.

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

### Format cadrage
Quand tu as assez d'éléments (ou si l'utilisateur te demande de conclure), produis la NOTE DE
CADRAGE (Markdown, en français, prête à publier) qui contient, dans cet ordre :

#### 1. Compte rendu du besoin
Synthèse de l'échange : ce qui a été demandé, les réponses clés obtenues.

#### 2. Ce que j'ai compris du besoin
Reformulation claire de l'objectif, des bénéficiaires, et du périmètre (in / hors scope).

#### 3. Schémas fonctionnels
Un ou plusieurs diagrammes **Mermaid** décrivant le fonctionnement visé (flux utilisateur, acteurs,
étapes…). Utilise des blocs \`\`\`mermaid valides et simples (flowchart TD ou sequenceDiagram).

#### 4. Début de solution proposée
Pistes concrètes, découpage V1/V2, et pour chaque piste un ordre de grandeur d'effort et de risque.
`.trim();

// Slot de contextualisation par utilisateur : intercalé entre l'IDENTITÉ (stable, unique) du bras
// droit et ses OPS. Comportement identique pour tous ; seul ce bloc change d'un utilisateur à l'autre.
// V2 : alimenté par les préférences Supabase (cf. docs/06). Aujourd'hui : ce que fournit l'appelant.
function prefsBlock(userContext: string): string {
  if (!userContext) return "";
  return `\n\n## Contexte de l'utilisateur que tu sers (à prendre en compte, sans changer ton comportement de fond)\n${userContext}`;
}

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
    // Contexte utilisateur (profil, projets passés, style, préfs delivery). Vide tant que l'auth V2
    // n'est pas branchée ; un appelant peut déjà l'injecter.
    const userContext = (form.get("userContext") as string | null)?.trim() ?? "";

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
      system: `${chef.prompt}${prefsBlock(userContext)}\n\n${BRAS_DROIT_INSTRUCTIONS}`,
      messages,
    });

    let reply = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // Détecte le mode via la 1re ligne `MODE: ...`, puis la retire de l'affichage.
    const firstLine = reply.split("\n", 1)[0] ?? "";
    const modeMatch = /^MODE:\s*(direct|questions|cadrage)/i.exec(firstLine);
    const mode = (modeMatch?.[1]?.toLowerCase() ?? "questions") as "direct" | "questions" | "cadrage";
    const isNote = mode === "cadrage";
    if (modeMatch) {
      reply = reply.slice(firstLine.length).trim();
    }

    // Bloc JSON de questions cliquables : uniquement en mode `questions`.
    let questions: unknown = null;
    if (mode === "questions") {
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

    return Response.json({ reply, mode, isNote, questions, userEcho });
  } catch (e) {
    return Response.json({ error: humanError(e) }, { status: 500 });
  }
}
