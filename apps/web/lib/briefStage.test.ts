import { describe, it, expect } from "vitest";
import { stageForBrief, derivePersistStage } from "./briefStage";

// CLV-53 incr. 2 : /voice sait porter un stage "echange" non-engagé (rail dormant, pas encore
// branché à l'UI). Ces deux fonctions pures décident (1) ce qu'on envoie au serveur pour CE tour,
// (2) ce qu'on écrit en persistance après le tour — jamais l'inverse (jamais depuis une ligne
// MODE: du LLM, qui n'est même pas en entrée de ces fonctions).

describe("stageForBrief", () => {
  it('stage "echange" → "echange" (bascule /api/brief en ECHANGE_OPS)', () => {
    expect(stageForBrief("echange")).toBe("echange");
  });

  it('stage "cadrage" → "cadrage" (triage engagé habituel, comportement par défaut inchangé)', () => {
    expect(stageForBrief("cadrage")).toBe("cadrage");
  });

  it('stage "maquette" → "cadrage" (le serveur ne distingue pas maquette/prod du cadrage)', () => {
    expect(stageForBrief("maquette")).toBe("cadrage");
  });

  it('stage "prod" → "cadrage" (jamais "echange" pour un objet déjà engagé)', () => {
    expect(stageForBrief("prod")).toBe("cadrage");
  });
});

describe("derivePersistStage", () => {
  it('stage "echange" reste "echange", quel que soit le board (aucun tour n\'engage tout seul)', () => {
    expect(derivePersistStage("echange", null)).toBe("echange");
    expect(derivePersistStage("echange", { kind: "maquette" })).toBe("echange");
    expect(derivePersistStage("echange", { kind: "markdown" })).toBe("echange");
  });

  it('stage engagé sans board maquette → "cadrage" (défaut d\'un objet déjà engagé)', () => {
    expect(derivePersistStage("cadrage", null)).toBe("cadrage");
    expect(derivePersistStage("cadrage", { kind: "markdown" })).toBe("cadrage");
  });

  it('stage engagé avec board.kind "maquette" → "maquette"', () => {
    expect(derivePersistStage("cadrage", { kind: "maquette" })).toBe("maquette");
    expect(derivePersistStage("maquette", { kind: "maquette" })).toBe("maquette");
  });

  it('stage déjà "prod" avec board maquette → redérivé "maquette" (dérivation lecture, pas de régression prod ici : c\'est saveConversation, pas engageProject)', () => {
    // Note : cette fonction alimente la persistance courante de /voice (stage cadrage/maquette),
    // pas la logique de run/prod (posée ailleurs, runId). Un stage "prod" n'est normalement
    // jamais recalculé par ce chemin en usage réel ; on documente juste le comportement pur.
    expect(derivePersistStage("prod", { kind: "maquette" })).toBe("maquette");
  });
});
