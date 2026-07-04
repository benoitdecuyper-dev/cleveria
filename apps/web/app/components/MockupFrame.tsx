"use client";

// Rendu de la maquette générée par factory-maquettiste — HTML 100 % autonome, traité comme
// contenu NON FIABLE (sortie LLM). La barrière de sécurité est le SANDBOX, pas un nettoyage
// regex. Cf. docs/18-maquette-archi.md §1.
//
// ⚠️ `sandbox=""` DOIT rester VIDE — aucun flag, JAMAIS `allow-scripts` + `allow-same-origin`
// ensemble : combinés, ils ANNULENT le bac à sable (le JS de l'iframe pourrait retirer
// l'attribut sandbox du DOM parent puis se recharger dé-sandboxé). Notre maquette est du
// HTML/CSS statique sans JS : sandbox="" suffit (origine opaque, scripts/formulaires/popups/
// navigation bloqués).

const MAX_HTML_SIZE = 400_000;

// Défense en profondeur : même si le sandbox tombait, la CSP bloque toute fuite réseau
// (aucune ressource externe autorisée — le maquettiste doit tout inliner).
const CSP_META =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; font-src data:;">';

/** Injecte la CSP juste après <head> (ou en tête du document si <head> est absent/mal formé). */
function withCsp(html: string): string {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${CSP_META}`);
  }
  return `${CSP_META}\n${html}`;
}

export default function MockupFrame({ html }: { html: string }) {
  // Garde-fou de taille : une maquette anormalement énorme (génération dégénérée) est tronquée
  // plutôt que de charger un iframe démesuré.
  const safe = html.length > MAX_HTML_SIZE ? html.slice(0, MAX_HTML_SIZE) : html;
  const doc = withCsp(safe);
  return (
    <iframe
      title="Maquette du site"
      srcDoc={doc}
      sandbox=""
      className="mockup-frame"
    />
  );
}
