// Petites fonctions pures partagées par l'UI et testées unitairement.
// Aucune dépendance React/DOM ici → importable depuis les composants ET les tests.

export type ParsedStream = {
  board: boolean;
  boardTitle: string;
  spoken: string;
  body: string;
};

// Sépare les lignes de protocole (MODE, VOIX, BOARD) du corps pendant le streaming
// du bras droit. Les lignes d'en-tête n'apparaissent qu'en tête de flux ; dès qu'une
// ligne "normale" arrive, tout le reste est du corps.
export function parseStream(raw: string): ParsedStream {
  const lines = raw.split("\n");
  let i = 0;
  let board = false;
  let boardTitle = "";
  let spoken = "";
  for (; i < lines.length; i++) {
    const ln = lines[i];
    // Lignes vides en tête : on les saute (le modèle insère parfois un saut entre
    // MODE/VOIX/BOARD). Sinon on s'arrêterait avant un BOARD: qui suit une ligne
    // vide → le board n'apparaîtrait qu'à la fin du flux (bug "a posteriori").
    if (ln.trim() === "") continue;
    if (/^MODE:/i.test(ln)) continue;
    const vm = /^\s*VOIX\s*:\s*(.*)$/i.exec(ln);
    if (vm) {
      spoken = vm[1].trim();
      continue;
    }
    const bm = /^\s*BOARD\s*:\s*(.*)$/i.exec(ln);
    if (bm) {
      board = true;
      boardTitle = bm[1].trim();
      continue;
    }
    break;
  }
  return { board, boardTitle, spoken, body: lines.slice(i).join("\n").replace(/^\s+/, "") };
}

// Nettoyage du Markdown pour la lecture vocale (TTS) : on retire la syntaxe pour ne
// garder que du texte prononçable.
export function speakable(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|-]/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Post-traitement du HTML rendu par marked : les liens s'ouvrent dans un nouvel
// onglet. Sinon cliquer une URL quitte la SPA et fait perdre la conversation en
// cours (qui n'existe qu'en mémoire React). rel="noopener noreferrer" pour la
// sécurité des onglets ouverts. Idempotent : ne re-touche pas un <a> déjà ciblé.
export function enhanceLinks(html: string): string {
  return html.replace(/<a (?![^>]*\btarget=)/g, '<a target="_blank" rel="noopener noreferrer" ');
}
