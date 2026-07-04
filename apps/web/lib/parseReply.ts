// Extraction pure du protocole texte du bras droit (MODE/VOIX/BOARD/questions) — utilisée par
// app/api/brief/route.ts, testée indépendamment de la route HTTP (lib/parseReply.test.ts).
// Aucune dépendance réseau/Node ici → importable depuis les tests comme depuis la route.

export type Mode = "direct" | "questions" | "cadrage" | "maquette";

export type ParsedReply = {
  reply: string;
  mode: Mode;
  isNote: boolean;
  questions: unknown;
  spoken: string | null;
  board: { title: string; content: string } | null;
  // Ligne `MAQUETTE:` (mode "maquette" uniquement) : brief compact pour factory-maquettiste au
  // 1er tour, retour visuel reformulé en itération. Jamais affichée à l'écran (docs/18 §4).
  maquetteSeed: string | null;
};

// Extrait le mode (1re ligne `MODE: …`), la ligne `VOIX:` (texte parlé) et le bloc JSON de questions.
export function parseReply(input: string): ParsedReply {
  let reply = input.trim();
  const firstLine = reply.split("\n", 1)[0] ?? "";
  const modeMatch = /^MODE:\s*(direct|questions|cadrage|maquette)/i.exec(firstLine);
  let mode = (modeMatch?.[1]?.toLowerCase() ?? "questions") as Mode;
  if (modeMatch) reply = reply.slice(firstLine.length).trim();

  // Ligne VOIX : version orale (lue à voix haute), retirée de l'affichage écran.
  let spoken: string | null = null;
  const voix = /^VOIX\s*:\s*(.+?)(?:\n|$)/i.exec(reply);
  if (voix) {
    spoken = voix[1].trim();
    reply = reply.slice(voix[0].length).trim();
  }

  // Ligne MAQUETTE : le brief/retour destiné au maquettiste (protocole MODE: maquette, docs/18 §4).
  let maquetteSeed: string | null = null;
  const maq = /^MAQUETTE\s*:\s*(.+?)(?:\n|$)/i.exec(reply);
  if (maq) {
    maquetteSeed = maq[1].trim();
    reply = reply.slice(maq[0].length).trim();
  }

  // Questions cliquables : on extrait le bloc ```json {questions:[…]} QUEL QUE SOIT le mode, et
  // on le RETIRE du texte → jamais de JSON brut à l'écran, toujours des puces sélectionnables.
  // Extrait AVANT le board pour qu'un JSON glissé dans un cadrage ne finisse pas dans le board.
  let questions: unknown = null;
  const jm = /```json\s*\n([\s\S]*?)```/.exec(reply);
  if (jm) {
    try {
      const parsed = JSON.parse(jm[1]);
      if (Array.isArray(parsed?.questions)) questions = parsed.questions;
    } catch {
      /* JSON invalide → on retombe sur le texte libre */
    }
    // On ne retire le bloc QUE si ce sont des questions (sinon on garde un vrai livrable JSON en direct).
    if (questions) reply = (reply.slice(0, jm.index) + reply.slice(jm.index + jm[0].length)).trim();
  }

  // Ligne BOARD : le corps qui suit est un LIVRABLE à projeter dans le board (pas dans le chat).
  let board: { title: string; content: string } | null = null;
  const boardM = /^BOARD\s*:\s*(.*)(?:\n|$)/i.exec(reply);
  if (boardM) {
    const content = reply.slice(boardM[0].length).trim();
    if (content) {
      board = { title: boardM[1].trim() || "Brouillon", content };
      reply = ""; // le livrable part dans le board ; le chat ne garde que la voix
    }
  }

  // Un board prime (les questions éventuelles deviennent du bruit) ; sinon, des questions
  // cliquables = un tour de questions (pas une note finale) → rendu en puces dans le chat.
  if (board) questions = null;
  else if (questions) mode = "questions";
  const isNote = mode === "cadrage";
  return { reply, mode, isNote, questions, spoken, board, maquetteSeed };
}
