import { describe, it, expect } from "vitest";
import { parseStream, speakable, enhanceLinks } from "./format";

describe("parseStream", () => {
  it("retourne tout en corps quand il n'y a pas d'en-tête de protocole", () => {
    const r = parseStream("Bonjour, voici ma réponse.");
    expect(r).toEqual({ board: false, boardTitle: "", spoken: "", body: "Bonjour, voici ma réponse." });
  });

  it("extrait la ligne VOIX et garde le reste en corps", () => {
    const r = parseStream("VOIX: Je te réponds à l'oral\nLe corps écrit ici.");
    expect(r.spoken).toBe("Je te réponds à l'oral");
    expect(r.body).toBe("Le corps écrit ici.");
    expect(r.board).toBe(false);
  });

  it("détecte un BOARD avec son titre", () => {
    const r = parseStream("BOARD: Brouillon de mail\n# Mail\nBonjour,");
    expect(r.board).toBe(true);
    expect(r.boardTitle).toBe("Brouillon de mail");
    expect(r.body).toBe("# Mail\nBonjour,");
  });

  it("gère MODE + VOIX + BOARD ensemble, dans n'importe quel ordre en tête", () => {
    const r = parseStream("MODE: direct\nVOIX: Voilà\nBOARD: Titre\nContenu du board");
    expect(r.spoken).toBe("Voilà");
    expect(r.board).toBe(true);
    expect(r.boardTitle).toBe("Titre");
    expect(r.body).toBe("Contenu du board");
  });

  it("est insensible à la casse des préfixes", () => {
    const r = parseStream("voix: salut\nboard: T\ncorps");
    expect(r.spoken).toBe("salut");
    expect(r.board).toBe(true);
  });

  it("arrête de lire l'en-tête dès la première ligne normale (un VOIX plus bas reste du corps)", () => {
    const r = parseStream("Première ligne\nVOIX: pas un en-tête");
    expect(r.spoken).toBe("");
    expect(r.body).toBe("Première ligne\nVOIX: pas un en-tête");
  });

  it("détecte un BOARD précédé d'une ligne vide (régression : sinon le board n'arrive qu'à la fin)", () => {
    const r = parseStream("MODE: direct\nVOIX: Voilà\n\nBOARD: Mail\n\nObjet : Merci");
    expect(r.board).toBe(true);
    expect(r.boardTitle).toBe("Mail");
    expect(r.spoken).toBe("Voilà");
    expect(r.body).toBe("Objet : Merci");
  });

  it("gère le streaming partiel (en-tête pas encore complet)", () => {
    expect(parseStream("BOARD: Titre en cours").body).toBe("");
    expect(parseStream("BOARD: Titre en cours").board).toBe(true);
  });
});

describe("speakable", () => {
  it("retire les liens markdown en gardant le libellé", () => {
    expect(speakable("Va voir [le site](https://exemple.fr) stp")).toBe("Va voir le site stp");
  });
  it("retire les blocs de code", () => {
    expect(speakable("Avant\n```js\nconst x = 1;\n```\nAprès")).toBe("Avant Après");
  });
  it("retire la ponctuation markdown (titres, gras, listes)", () => {
    expect(speakable("# Titre\n- **gras** et _italique_")).toBe("Titre gras et italique");
  });
  it("réduit aux espaces et trim", () => {
    expect(speakable("  trop    d'espaces  ")).toBe("trop d'espaces");
  });
});

describe("enhanceLinks", () => {
  it("ajoute target=_blank et rel sur les liens sans cible", () => {
    expect(enhanceLinks('<a href="https://x.fr">x</a>')).toBe(
      '<a target="_blank" rel="noopener noreferrer" href="https://x.fr">x</a>',
    );
  });
  it("ne double pas un lien qui a déjà un target", () => {
    const html = '<a target="_self" href="/a">a</a>';
    expect(enhanceLinks(html)).toBe(html);
  });
  it("traite plusieurs liens dans le même HTML", () => {
    const out = enhanceLinks('<a href="/1">1</a> et <a href="/2">2</a>');
    expect(out.match(/target="_blank"/g)).toHaveLength(2);
  });
  it("ne touche pas le texte sans lien", () => {
    expect(enhanceLinks("<p>aucun lien</p>")).toBe("<p>aucun lien</p>");
  });
});
