import { describe, it, expect } from "vitest";
import { parseReply } from "./parseReply";

describe("parseReply", () => {
  it("extrait MODE, VOIX et BOARD", () => {
    const r = parseReply("MODE: direct\nVOIX: Voilà\nBOARD: Mail\nObjet : Merci");
    expect(r.mode).toBe("direct");
    expect(r.spoken).toBe("Voilà");
    expect(r.board).toEqual({ title: "Mail", content: "Objet : Merci" });
    expect(r.reply).toBe(""); // le livrable part dans le board, pas dans le chat
    expect(r.isNote).toBe(false);
  });

  it("pas de ligne MODE → mode par défaut 'questions'", () => {
    const r = parseReply("Bonjour, comment puis-je aider ?");
    expect(r.mode).toBe("questions");
    expect(r.spoken).toBeNull();
    expect(r.board).toBeNull();
  });

  it("mode cadrage → isNote true", () => {
    const r = parseReply("MODE: cadrage\nVOIX: Ok\nBOARD: Ton besoin\n## Ce que je comprends\nBla");
    expect(r.mode).toBe("cadrage");
    expect(r.isNote).toBe(true);
    expect(r.board).toEqual({ title: "Ton besoin", content: "## Ce que je comprends\nBla" });
  });

  it("extrait un bloc ```json de questions quel que soit le mode, et force MODE=questions", () => {
    const input =
      'MODE: cadrage\nVOIX: ok\n```json\n{"questions":[{"id":"q1","text":"Quoi ?","type":"single","options":["A","B"]}]}\n```\n';
    const r = parseReply(input);
    expect(r.questions).toEqual([{ id: "q1", text: "Quoi ?", type: "single", options: ["A", "B"] }]);
    expect(r.mode).toBe("questions");
    expect(r.reply).toBe(""); // le bloc json est retiré du texte affiché
  });

  it("extrait le bloc questions AVANT de traiter le BOARD (pas swallow dans le board)", () => {
    const input =
      'MODE: cadrage\nVOIX: Ok\n```json\n{"questions":[{"id":"q1","text":"Précise ton besoin","type":"open"}]}\n```\nBOARD: Ton besoin\n## Ce que je comprends\nBla';
    const r = parseReply(input);
    // Le board ne doit contenir QUE ce qui suit BOARD:, pas le bloc json (preuve que
    // l'extraction des questions a bien eu lieu avant le découpage du board).
    expect(r.board).toEqual({ title: "Ton besoin", content: "## Ce que je comprends\nBla" });
    // Le board prime : les questions deviennent du bruit, remises à null.
    expect(r.questions).toBeNull();
  });

  it("le board prime sur des questions présentes en parallèle (mode conservé, questions à null)", () => {
    const input =
      'MODE: direct\nVOIX: Voilà\n```json\n{"questions":[{"id":"q1","text":"Une question ?","type":"open"}]}\n```\nBOARD: Titre\nContenu';
    const r = parseReply(input);
    expect(r.board).toEqual({ title: "Titre", content: "Contenu" });
    expect(r.questions).toBeNull();
    expect(r.mode).toBe("direct"); // pas forcé en "questions" puisque le board prime
  });

  it("ne retire PAS un vrai livrable JSON (sans clé 'questions'), même en mode direct", () => {
    const input = 'MODE: direct\nVOIX: Voilà la config\nBOARD: Config\n```json\n{"name":"demo","version":"1.0.0"}\n```';
    const r = parseReply(input);
    expect(r.board).toEqual({ title: "Config", content: '```json\n{"name":"demo","version":"1.0.0"}\n```' });
    expect(r.questions).toBeNull();
  });

  it("un bloc ```json invalide (JSON cassé) ne casse rien : reste en texte libre", () => {
    const input = 'MODE: direct\nVOIX: Voilà\n```json\n{ pas du json valide\n```\nSuite du texte';
    const r = parseReply(input);
    expect(r.questions).toBeNull();
    expect(r.reply).toContain("Suite du texte");
  });

  it("un bloc ```json sans clé 'questions' tableau n'est pas traité comme des questions", () => {
    const input = 'MODE: direct\nVOIX: Voilà\n```json\n{"other": 1}\n```\nSuite';
    const r = parseReply(input);
    expect(r.questions).toBeNull();
    expect(r.reply).toContain('```json\n{"other": 1}\n```');
  });

  it("MODE: maquette → extrait la ligne MAQUETTE (seed), sans board ni note", () => {
    const input = "MODE: maquette\nVOIX: Je vous fais une première maquette.\nMAQUETTE: site vitrine plombier, sections offre/contact, ton pro";
    const r = parseReply(input);
    expect(r.mode).toBe("maquette");
    expect(r.spoken).toBe("Je vous fais une première maquette.");
    expect(r.maquetteSeed).toBe("site vitrine plombier, sections offre/contact, ton pro");
    expect(r.isNote).toBe(false);
    expect(r.board).toBeNull();
    expect(r.reply).toBe("");
  });

  it("MAQUETTE absente → maquetteSeed reste null (autres modes)", () => {
    const r = parseReply("MODE: direct\nVOIX: Ok\nRéponse directe.");
    expect(r.maquetteSeed).toBeNull();
  });
});
