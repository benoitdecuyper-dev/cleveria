// Fonctions pures pour l'endpoint /api/maquette — extraites pour être testées indépendamment
// de la route HTTP (même convention que lib/parseReply.ts). Aucune dépendance réseau/Node ici.

/** Construit le message envoyé au maquettiste : 1er jet (seed seul) ou itération
 * (previousHtml + feedback → régénération intégrale, jamais un patch). */
export function buildUserMessage(seed: string, previousHtml?: string, feedback?: string): string {
  if (previousHtml && feedback) {
    return [
      "## Brief initial",
      seed,
      "",
      "## Maquette précédente (HTML complet à FAIRE ÉVOLUER intégralement — pas un patch)",
      previousHtml,
      "",
      "## Retour du client à intégrer",
      feedback,
      "",
      "Régénère le document HTML ENTIER en intégrant ce retour. Réponds UNIQUEMENT par le document HTML complet, de <!DOCTYPE html> à </html>.",
    ].join("\n");
  }
  return [
    "## Brief",
    seed,
    "",
    "Génère une première maquette. Réponds UNIQUEMENT par le document HTML complet, de <!DOCTYPE html> à </html>.",
  ].join("\n");
}

/** Nettoyage défensif de la sortie du maquettiste : le contrat de l'agent interdit fence/
 * préambule, mais on se protège quand même d'un écart (fence ```html, texte avant/après). */
export function stripHtmlFence(raw: string): string {
  const fenced = /```(?:html)?\s*\n([\s\S]*?)```/i.exec(raw);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/<!DOCTYPE/i);
  const endMatch = /<\/html\s*>/i.exec(body);
  if (start === -1 || !endMatch) return body;
  return body.slice(start, endMatch.index + endMatch[0].length).trim();
}
