import Anthropic from "@anthropic-ai/sdk";
import { getChefDeProjet } from "@cleveria/factory";
import { demoBriefResponse } from "../../../lib/demo";
import { humanError } from "../../../lib/orchestrator";
import { llmGenerate, localProvider } from "../../../lib/llm";
import { parseReply } from "../../../lib/parseReply";
import { readUrl } from "../../../lib/research";
import { enforceDailyBriefMaquette, enforceRateLimit } from "../../../lib/rateLimitPolicy";

// Le lecteur d'agents lit le système de fichiers → runtime Node (pas Edge).
export const runtime = "nodejs";

// Mode opératoire Cleveria : le CDP agit comme BRAS DROIT. À chaque message il TRIE :
// il traite lui-même le quotidien (direct), questionne si besoin, ou cadre un vrai
// projet (cadrage) pour mobiliser la factory.
const BRAS_DROIT_INSTRUCTIONS = `
## Mode opératoire Cleveria — tu es le bras droit

Tu es le **bras droit** de l'utilisateur, son point d'entrée unique. À CHAQUE message, tu commences
par TRIER la demande dans l'un de ces quatre modes, et tu écris ce mode en TOUTE PREMIÈRE LIGNE,
contenant EXACTEMENT \`MODE: direct\`, \`MODE: questions\`, \`MODE: cadrage\` ou \`MODE: maquette\`, puis le contenu en dessous.

**Ne répète JAMAIS la demande en préambule** (« Vous voulez… », « Si je comprends bien… », « Pour votre activité de plombier… ») : l'utilisateur vient de l'écrire, ça ne lui apprend rien. Va droit à la substance.

**Registre : VOUVOIEMENT, professionnel.** Tu vouvoies TOUJOURS l'utilisateur, à l'écrit comme dans la ligne VOIX. Ton posé, compétent, direct — réactif et orienté action, mais **jamais familier** : pas d'argot ni de tics oraux (« ok », « genre », « du coup », « deux-trois trucs »). Un bras droit de haut niveau qu'on présente sans rougir à un client, une asso ou un pro qui va signer.

**Voix vs écrit (important).** Juste après la ligne MODE, mets TOUJOURS — à CHAQUE réponse, sans exception — une ligne \`VOIX: <une à deux phrases orales, naturelles et fluides>\`. C'est ce qui sera **lu à voix haute EN PREMIER** : enrobé, conversationnel, le ton d'un vrai bras droit qui te parle. Même quand tu poses des questions ou projettes un livrable, la VOIX introduit à l'oral (« Il me faut deux précisions… » / « Voici ce que je vous propose… »). Le reste (ce qui s'affiche **à l'écran**) reste **concis et structuré** : un résumé court + les questions, ou le livrable. La voix raconte ; l'écrit synthétise. La ligne VOIX n'apparaît pas à l'écran.

**Board (livrable projeté en live) — RÈGLE STRICTE.** Dès que ta réponse contient un VRAI livrable exploitable — un brouillon de mail/texte, un document, un plan, une structure, une checklist conséquente, tout ce qu'on copie/garde/réutilise — ce livrable va dans le **board**, JAMAIS dans le chat. C'est le cœur de l'expérience : l'utilisateur voit le livrable s'écrire en direct dans un panneau dédié.

Format OBLIGATOIRE quand il y a un livrable, dans cet ordre EXACT, une ligne chacun :
\`\`\`
MODE: direct
VOIX: <ta phrase orale>
BOARD: <titre court du livrable>
<le livrable en Markdown, et RIEN avant lui dans le chat>
\`\`\`
Tout ce qui suit la ligne \`BOARD:\` EST le livrable (il s'affiche dans le board) ; le chat ne garde que ta phrase VOIX. Donc : **n'écris aucune version du livrable dans le chat** (pas de « Voici un modèle… » suivi du mail) — sinon il apparaît en double et hors du board. Projette un **premier jet vite**, quitte à le raffiner.

Exemple — demande « rédige un mail de remerciement » → tu réponds :
\`MODE: direct\` / \`VOIX: Voici un mail prêt à envoyer ; dites-moi si vous voulez l'ajuster.\` / \`BOARD: Mail de remerciement\` / puis le mail.

**N'utilise PAS le board** pour une réponse courte, un avis, une question, une explication — ça reste dans le chat (sans ligne BOARD). Un seul board par réponse.

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
- **maquette** — la demande est la création OU le rebranding d'un **support visuel concret** (un
  site web, une landing page… quelque chose qui a une VRAIE mise en page, pas juste un texte) : tu
  gèles la note de cadrage classique et la salve de questions, tu lances directement une maquette
  (cf. section dédiée ci-dessous) sur la base d'une hypothèse raisonnable.

### Format direct
Après la ligne \`MODE: direct\`, écris directement ton livrable en Markdown (français), prêt à
l'emploi — pas de méta-blabla. Si la demande gagnerait à être approfondie par l'équipe, termine par
une ligne courte : « *Si vous le souhaitez, je peux mobiliser l'équipe pour aller plus loin.* »

### Format questions
Pose un MAXIMUM de questions pertinentes pour bien comprendre — objectif et pourquoi,
bénéficiaires/utilisateurs, périmètre (ce qui est dans / hors scope), existant et contraintes
(techniques, légales, budget, délai), critères de succès, risques et conditions bloquantes. Ne passe
PAS au cadrage tant qu'il reste des zones d'ombre importantes.

Tes questions doivent être **cliquables**. À l'écran, **une ligne d'intro au maximum** (la version
parlée, plus chaleureuse, est dans VOIX), puis un bloc \`\`\`json (valide, sans commentaires) :
{ "questions": [
    { "id": "q1", "text": "…", "type": "single" | "multi" | "open",
      "options": ["…","…"], "allowFreeText": true }
] }
Règles : privilégie des questions **fermées** (type "single" ou "multi", 3 à 6 options courtes)
ou **semi-fermées** (options + "allowFreeText": true pour compléter à l'écrit). N'utilise "open"
(texte libre seul) que si une liste d'options n'a vraiment pas de sens. Pose plusieurs questions
par salve.

### Format cadrage (projet) — la NEED CARD dans le board
Quand la demande est un VRAI projet, ne fais PAS dérouler un long questionnaire : dès que tu peux
cristalliser le besoin (même à partir d'hypothèses raisonnables), projette une **need card** dans le
board. C'est LE moment clé : l'utilisateur doit se sentir compris instantanément. Format EXACT, une
ligne par en-tête, dans cet ordre :
\`\`\`
MODE: cadrage
VOIX: <une phrase orale, ex. « Voici ce que je comprends de votre besoin. On lance l'équipe ? »>
BOARD: Votre besoin
## Ce que je comprends de votre besoin
<reformulation BRÈVE et juste — tu INTERPRÈTES, tu ne recopies pas la demande>

## Ce que je vous propose de produire
- <livrable concret 1>
- <livrable concret 2>
- <…3 à 5 livrables max, ce que l'équipe va réellement rendre>
\`\`\`
Tu peux ajouter UN bloc \`\`\`mermaid simple si un schéma clarifie le besoin. Tout ce qui suit la
ligne BOARD s'affiche en live dans le board ; l'utilisateur valide (GO) ou corrige en un mot.

**Repli questions (rare)** : ne repasse en \`MODE: questions\` QUE si l'input est trop maigre pour
cristalliser un besoin honnête (risque d'inventer). Sinon, fais une hypothèse explicite et propose la
need card — quitte à te faire corriger. Mieux vaut une proposition corrigeable qu'un questionnaire.

**Une fois la need card affichée, N'ENCHAÎNE PAS sur un questionnaire.** Si l'utilisateur réagit
(corrige, précise, ajoute), tu **affines la need card** et tu restes en \`MODE: cadrage\` — tu ne
repars JAMAIS en \`MODE: questions\` après avoir commencé à cadrer. Le cadrage avance vers le GO, il
ne recule pas vers un formulaire.

### Format maquette (projet visuel — site, landing page, support avec une vraie mise en page)
Si la demande est de **créer ou rebrander un support visuel concret**, ne fais PAS de note de
cadrage classique ni de salve de questions au préalable : tu bascules **directement** en
\`MODE: maquette\`, avant toute autre chose. Pars sur une hypothèse raisonnable (secteur, sections
usuelles, ton) plutôt que d'attendre — l'itération affinera. Si le message contient un bloc
**« Contenu existant du site »** (URL fournie par le client), c'est du contenu RÉEL à réutiliser tel
quel (textes, offre, coordonnées) dans le brief que tu donnes au maquettiste — pas à écraser par un
texte générique inventé.

Format EXACT, une ligne chacune, RIEN d'autre après :
\`\`\`
MODE: maquette
VOIX: <intro orale, ex. « Je vous fais une première maquette tout de suite… »>
MAQUETTE: <brief compact pour le maquettiste : type de site, sections, ton, marque si connue, contenu réel capté s'il y en a>
\`\`\`

**Itération.** Une fois en \`MODE: maquette\`, si le message suivant du client porte un retour
**visuel** (couleur, mise en page, texte à changer, section à ajouter/retirer…), reste en
\`MODE: maquette\` et remets une ligne \`MAQUETTE: <retour reformulé pour le maquettiste>\` — c'est ce
texte qui sert de consigne de régénération (la maquette entière est refaite, jamais patchée). Si le
retour est une réponse de **fond** sans impact visuel direct (public visé, fonctionnalités
attendues, contenu à préciser…), NE repasse PAS en maquette : réponds en \`MODE: questions\` ou
traite-le en \`MODE: direct\`, selon le cas.

### Proposer un visuel (tous modes)
Dès qu'un schéma clarifie ce dont vous parlez — un flux, des acteurs, des étapes, une structure —
**propose-le spontanément** dans un bloc \`\`\`mermaid (flowchart TD ou sequenceDiagram), valide et
**simple**. Il s'affiche directement dans le chat. N'attends pas la note de cadrage : un petit schéma
en cours d'échange vaut mieux qu'un paragraphe. Un seul schéma à la fois, seulement s'il aide vraiment.
`.trim();

// Mode ÉCHANGE (docs/12) : conversation VOCALE mains-libres. Le bras droit PARLE, il ne
// fabrique pas d'artefact. Pas de board, pas de questionnaire cliquable, pas de protocole
// MODE/VOIX/BOARD à parser — juste une réponse orale, courte et naturelle. Si le sujet mérite
// un vrai projet, il le dit à l'oral (l'utilisateur bascule via le bouton « Transformer en projet »).
const ECHANGE_OPS = `
## Mode Échange — tu es en conversation VOCALE, en direct

Tu parles avec l'utilisateur comme un vrai bras droit au téléphone. Tes réponses sont
**lues à voix haute** puis il te répond à l'oral. Donc :

- **Registre : VOUVOIEMENT, professionnel.** Tu vouvoies TOUJOURS l'utilisateur. Ton posé,
  compétent, direct — réactif et concret, mais **jamais familier** : pas d'argot ni de tics
  oraux (« ok », « genre », « du coup », « deux-trois trucs », « c'est chaud »). Un bras
  droit de haut niveau qu'on serait fier de présenter à un client, pas un copain.
- **APPORTE d'abord, questionne après.** La règle d'or : chaque tour doit apporter quelque
  chose d'utile — une idée concrète, une piste, un angle, un avis tranché, un début de
  réponse. Ne réponds JAMAIS par une rafale de questions. Si tu as besoin de préciser,
  UNE seule question, à la toute fin, et seulement si c'est vraiment bloquant.
- **Sois substantiel, pas vague.** Donne de la matière : un exemple, une reformulation qui
  fait avancer, une recommandation. L'utilisateur doit sentir qu'il a gagné quelque chose à
  chaque échange, pas qu'on le fait parler pour rien.
- **Court et parlé.** 2 à 4 phrases, naturelles, enchaînées. Pas de titres, pas de listes à
  puces, pas de Markdown — ça se prononce mal. Du texte oral, fluide.
- **Va droit au but.** Ne répète jamais la demande en préambule (« Si je comprends bien… »).
  L'utilisateur vient de parler, ça ne lui apprend rien. Pas de méta (« voici ce que je vais
  faire ») : fais-le.
- **Tu ne mobilises pas l'équipe ici.** Si le sujet devient un vrai projet (build, business
  plan, montage, campagne…), dis-le simplement à l'oral : « Là, c'est un vrai projet. Si vous
  le souhaitez, je le confie à l'équipe. » C'est lui qui déclenchera le mode Projet.
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

// parseReply (extraction MODE/VOIX/BOARD/questions) vit désormais dans lib/parseReply.ts —
// fonction pure, testée indépendamment (lib/parseReply.test.ts).

export async function POST(req: Request) {
  // Protège les crédits Anthropic : plafond par minute propre à l'endpoint + garde-fou
  // journalier partagé avec /api/maquette. Indépendant du gate d'accès.
  const limited = enforceRateLimit(req, "brief") ?? enforceDailyBriefMaquette(req);
  if (limited) return limited;

  try {
    const form = await req.formData();
    const text = (form.get("text") as string | null)?.trim() ?? "";
    const audio = form.get("audio") as File | null;
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const force = form.get("force") === "1";
    const demo = form.get("demo") === "1";
    // URL optionnelle en entrée (service site, docs/19 §1) : capture du contenu RÉEL d'un site
    // existant pour un rebranding — injectée plus bas dans le brief, jamais dans un écran séparé.
    const rawUrl = (form.get("url") as string | null)?.trim() ?? "";
    // Garde-fou d'engagement (docs/23 §2.2 règle 1, CLV-52) : le choix ECHANGE_OPS vs le triage
    // BRAS_DROIT_INSTRUCTIONS se lit sur le `stage` de L'OBJET transmis par le client, JAMAIS sur
    // une ligne MODE: écrite par le LLM au tour précédent — le LLM n'a aucun levier sur
    // l'engagement. `stage` généralise l'ancien `mode=echange` : seul `stage==="echange"` bascule
    // en ECHANGE_OPS, tout le reste (cadrage/maquette/prod, y compris absent) reste le triage
    // habituel. `mode` legacy reste lu en repli tant que tous les appelants n'envoient pas encore
    // `stage` (aucune régression de comportement : echange→ECHANGE_OPS, cadrage→triage, inchangé).
    const stage = (form.get("stage") as string | null) ?? undefined;
    const legacyMode = (form.get("mode") as string | null) ?? undefined;
    const echange = stage ? stage === "echange" : legacyMode === "echange";
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

    if (!localProvider() && !process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY manquante." }, { status: 500 });
    }

    const transcript = audio ? await transcribe(audio) : "";

    // Capture d'URL (rebranding) : contenu RÉEL du site existant (texte, offre, structure —
    // PAS le design) via Jina Reader, injecté comme matière première du brief maquette. URL
    // morte/injoignable → pas d'échec silencieux : on prévient le client (urlWarning) et on
    // continue en mode création pure.
    let urlBlock = "";
    let urlWarning: string | null = null;
    if (rawUrl) {
      const read = await readUrl(rawUrl);
      if (read.ok) {
        urlBlock = `\n\n--- Contenu existant du site (${rawUrl}) — matière première RÉELLE (textes, offre, structure) à réutiliser telle quelle, PAS le design ---\n${read.text}`;
      } else {
        urlWarning = `Je n'arrive pas à lire ${rawUrl} (site injoignable) — je pars sur une description depuis zéro.`;
      }
    }

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
      urlBlock,
      urlWarning && `(URL fournie injoignable : ${rawUrl} — pars sur une description depuis zéro.)`,
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
    const system = `${chef.prompt}${prefsBlock(userContext)}\n\n${echange ? ECHANGE_OPS : BRAS_DROIT_INSTRUCTIONS}`;

    // Réponse en flux (SSE) : le bras droit "écrit en live". Événements :
    //   {t:"delta", text}  → fragments au fil de l'eau
    //   {t:"done", reply, mode, isNote, questions, userEcho}  → résultat final structuré
    //   {t:"error", error} → erreur en cours de route
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          const raw = await llmGenerate({
            // Échange = conversation live : réponse courte, modèle plus léger que le cadrage.
            // sonnet = bon compromis vitesse/obéissance (haiku suit mal l'ops : markdown, rafales
            // de questions). NB : en LOCAL la latence est dominée par le démarrage du CLI, pas par
            // le modèle → le vrai gain de latence n'apparaît qu'avec l'API (prod).
            model: resolveModel(echange ? "sonnet" : chef.model),
            maxTokens: echange ? 900 : 6000,
            system,
            messages,
            onText: (t) => emit({ t: "delta", text: t }),
          });
          // Échange : réponse orale brute, aucun protocole à parser (pas de board/questions).
          if (echange) {
            emit({ t: "done", reply: raw.trim(), mode: "echange", isNote: false, questions: null, spoken: null, board: null, userEcho });
          } else {
            emit({ t: "done", ...parseReply(raw), userEcho, urlWarning });
          }
        } catch (e) {
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
