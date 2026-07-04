import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  autoTitle,
  relativeDate,
  deriveLegacyStage,
  normalizeConversation,
  normalizeSummary,
  engageProject,
  saveConversation,
  getConversation,
  type StoredConversation,
} from "./history";

// ── Mock idb-keyval (CLV-52) ────────────────────────────────────────────────────
// Pas d'IndexedDB en environnement `node` (vitest.config.ts) : on remplace get/set/del par un
// Map en mémoire, remis à zéro à chaque test (cf. beforeEach plus bas). vi.hoisted() est
// nécessaire car vi.mock() est hoisté au-dessus des imports par Vitest.
const idbStore = vi.hoisted(() => new Map<string, unknown>());
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  set: vi.fn(async (key: string, val: unknown) => {
    idbStore.set(key, val);
  }),
  del: vi.fn(async (key: string) => {
    idbStore.delete(key);
  }),
}));

describe("autoTitle", () => {
  it("titre par défaut si le texte est vide", () => {
    expect(autoTitle("")).toBe("Nouvelle conversation");
    expect(autoTitle("   ")).toBe("Nouvelle conversation");
  });

  it("garde le texte tel quel s'il est court", () => {
    expect(autoTitle("Un site vitrine pour mon activité")).toBe("Un site vitrine pour mon activité");
  });

  it("normalise les espaces multiples et les bords", () => {
    expect(autoTitle("  Un   site   vitrine  ")).toBe("Un site vitrine");
  });

  it("tronque sur une frontière de mot au-delà de 48 caractères", () => {
    const long =
      "Je veux transformer une ancienne grange en tiers-lieu ouvert à tous, avec un café associatif.";
    const title = autoTitle(long);
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(49); // 48 + le « … »
    // Le titre (sans l'ellipse) est bien un préfixe du texte d'origine.
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
  });

  it("coupe brutalement si le premier « mot » dépasse 20 caractères sans espace", () => {
    const long = "a".repeat(60);
    expect(autoTitle(long)).toBe("a".repeat(48) + "…");
  });
});

describe("relativeDate", () => {
  const NOW = new Date("2026-07-03T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("chaîne vide si la date est invalide", () => {
    expect(relativeDate("pas une date")).toBe("");
  });

  it("« à l'instant » pour moins d'une minute", () => {
    expect(relativeDate(new Date(NOW.getTime() - 30_000).toISOString())).toBe("à l'instant");
  });

  it("en minutes sous l'heure", () => {
    expect(relativeDate(new Date(NOW.getTime() - 5 * 60_000).toISOString())).toBe("il y a 5 min");
  });

  it("en heures sous 24 h", () => {
    expect(relativeDate(new Date(NOW.getTime() - 3 * 3_600_000).toISOString())).toBe("il y a 3 h");
  });

  it("« hier » pour un jour plein", () => {
    expect(relativeDate(new Date(NOW.getTime() - 25 * 3_600_000).toISOString())).toBe("hier");
  });

  it("en jours sous 7 j", () => {
    expect(relativeDate(new Date(NOW.getTime() - 3 * 24 * 3_600_000).toISOString())).toBe("il y a 3 j");
  });

  it("date formatée au-delà de 7 jours", () => {
    const iso = new Date(NOW.getTime() - 10 * 24 * 3_600_000).toISOString();
    expect(relativeDate(iso)).toBe(new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }));
  });
});

// ── CLV-52 : remap schemaVersion 1→2 (mode → stage) ─────────────────────────────
describe("deriveLegacyStage", () => {
  it("mode echange → stage echange, quel que soit le contenu", () => {
    expect(deriveLegacyStage("echange", null)).toBe("echange");
    expect(deriveLegacyStage("echange", { kind: "maquette" })).toBe("echange");
  });

  it("mode voice sans board ni runId → cadrage (déjà engagé, cas par défaut)", () => {
    expect(deriveLegacyStage("voice", null)).toBe("cadrage");
  });

  it("mode voice avec board.kind maquette → maquette", () => {
    expect(deriveLegacyStage("voice", { kind: "maquette" })).toBe("maquette");
  });

  it("mode voice avec board markdown (pas maquette) → cadrage", () => {
    expect(deriveLegacyStage("voice", { kind: "markdown", title: "x", content: "y" })).toBe("cadrage");
  });

  it("mode voice avec runId posé → prod (prioritaire sur le contenu du board)", () => {
    expect(deriveLegacyStage("voice", { kind: "maquette" }, "run-1")).toBe("prod");
    expect(deriveLegacyStage("voice", null, "run-1")).toBe("prod");
  });
});

describe("normalizeConversation (migration paresseuse 1→2)", () => {
  const base = {
    id: "c1",
    title: "Un site vitrine",
    titleIsCustom: false,
    messages: [{ role: "user", text: "Bonjour" }],
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:05:00.000Z",
    userId: null as string | null,
  };

  it("un enregistrement déjà schemaVersion 2 traverse inchangé (identité)", () => {
    const v2: StoredConversation = { ...base, stage: "maquette", board: { kind: "maquette" }, schemaVersion: 2 };
    expect(normalizeConversation(v2)).toBe(v2); // même référence : pas de copie inutile
  });

  it("v1 mode:echange → stage:echange, schemaVersion:2, sans perte de données", () => {
    const v1 = { ...base, mode: "echange" as const, board: null, schemaVersion: 1 as const };
    const out = normalizeConversation(v1);
    expect(out.stage).toBe("echange");
    expect(out.schemaVersion).toBe(2);
    expect(out.runId).toBeNull();
    expect(out.engagedAt).toBeNull();
    // Rien n'est perdu : tous les champs d'origine survivent au remap.
    expect(out.id).toBe(base.id);
    expect(out.title).toBe(base.title);
    expect(out.messages).toBe(v1.messages);
    expect(out.mode).toBe("echange"); // legacy conservé, toléré
  });

  it("v1 mode:voice avec maquette → stage:maquette", () => {
    const v1 = { ...base, mode: "voice" as const, board: { kind: "maquette", content: "<html/>" }, schemaVersion: 1 as const };
    expect(normalizeConversation(v1).stage).toBe("maquette");
  });

  it("v1 mode:voice sans board → stage:cadrage (déjà engagé)", () => {
    const v1 = { ...base, mode: "voice" as const, board: null, schemaVersion: 1 as const };
    expect(normalizeConversation(v1).stage).toBe("cadrage");
  });

  it("le remap est paresseux : n'écrit rien, ne fait qu'une lecture pure", () => {
    const v1 = { ...base, mode: "echange" as const, board: null, schemaVersion: 1 as const };
    const frozen = Object.freeze({ ...v1 });
    expect(() => normalizeConversation(frozen)).not.toThrow();
  });
});

describe("normalizeSummary", () => {
  it("un résumé avec stage traverse inchangé", () => {
    const s = { id: "c1", stage: "prod" as const, title: "t", updatedAt: "now" };
    expect(normalizeSummary(s)).toBe(s);
  });

  it("un résumé legacy mode:echange → stage:echange", () => {
    expect(normalizeSummary({ id: "c1", mode: "echange", title: "t", updatedAt: "now" })).toEqual({
      id: "c1",
      stage: "echange",
      title: "t",
      updatedAt: "now",
    });
  });

  it("un résumé legacy mode:voice → stage:cadrage (approximation sans le contenu du board)", () => {
    expect(normalizeSummary({ id: "c1", mode: "voice", title: "t", updatedAt: "now" }).stage).toBe("cadrage");
  });
});

// ── CLV-52 : engageProject() — l'unique geste qui matérialise « je fabrique » ──────
describe("engageProject", () => {
  const mkConv = (over: Partial<StoredConversation> = {}): StoredConversation => ({
    id: "c1",
    stage: "echange",
    title: "Un besoin",
    titleIsCustom: false,
    messages: [{ role: "user", text: "Salut" }],
    board: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    userId: null,
    schemaVersion: 2,
    ...over,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T09:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fait passer echange → cadrage (défaut) et pose engagedAt", async () => {
    await saveConversation(mkConv());
    const out = await engageProject("c1");
    expect(out?.stage).toBe("cadrage");
    expect(out?.engagedAt).toBe("2026-07-04T09:00:00.000Z");
    expect(out?.updatedAt).toBe("2026-07-04T09:00:00.000Z");
    // La transition est bien persistée (relecture indépendante).
    const reloaded = await getConversation("c1");
    expect(reloaded?.stage).toBe("cadrage");
    expect(reloaded?.engagedAt).toBe("2026-07-04T09:00:00.000Z");
  });

  it("accepte un stage cible explicite (ex. maquette)", async () => {
    await saveConversation(mkConv({ id: "c2" }));
    const out = await engageProject("c2", "maquette");
    expect(out?.stage).toBe("maquette");
  });

  it("est monotone : no-op sur un objet déjà engagé, ne régresse jamais vers echange", async () => {
    await saveConversation(mkConv({ id: "c3", stage: "maquette", engagedAt: "2026-07-03T08:00:00.000Z" }));
    const out = await engageProject("c3"); // toStage par défaut ignoré : déjà engagé
    expect(out?.stage).toBe("maquette"); // pas rétrogradé vers "cadrage"
    expect(out?.engagedAt).toBe("2026-07-03T08:00:00.000Z"); // pas retracé, l'acte original reste
  });

  it("id inconnu → no-op silencieux (null), pas d'exception", async () => {
    const out = await engageProject("id-inexistant");
    expect(out).toBeNull();
  });

  it("préserve messages/board/title — additif, aucune perte de données", async () => {
    const conv = mkConv({ id: "c4", messages: [{ role: "user", text: "Un vrai projet" }] });
    await saveConversation(conv);
    const out = await engageProject("c4");
    expect(out?.messages).toEqual(conv.messages);
    expect(out?.title).toBe(conv.title);
    expect(out?.id).toBe("c4");
  });
});
