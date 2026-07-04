import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { autoTitle, relativeDate } from "./history";

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
