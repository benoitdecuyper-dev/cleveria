import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetForTests, check, sweep } from "./rateLimit";

describe("check", () => {
  beforeEach(() => {
    _resetForTests();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("autorise tant qu'on reste sous la limite", () => {
    const opts = { limit: 3, windowMs: 1000 };
    expect(check("k", opts)).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(check("k", opts)).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(check("k", opts)).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it("bloque au-delà de la limite, dans la même fenêtre", () => {
    const opts = { limit: 2, windowMs: 1000 };
    expect(check("k", opts).allowed).toBe(true);
    expect(check("k", opts).allowed).toBe(true);
    const third = check("k", opts);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
    expect(third.retryAfterMs).toBeLessThanOrEqual(1000);
  });

  it("se réarme une fois la fenêtre écoulée", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(check("k", opts).allowed).toBe(true);
    expect(check("k", opts).allowed).toBe(false);

    vi.setSystemTime(1001); // juste après l'expiration du 1er horodatage (t0 + windowMs)

    expect(check("k", opts).allowed).toBe(true);
  });

  it("fenêtre glissante : une requête plus ancienne sort progressivement de la fenêtre (pas un palier fixe)", () => {
    const opts = { limit: 2, windowMs: 1000 };
    expect(check("k", opts).allowed).toBe(true); // t=0

    vi.setSystemTime(600);
    expect(check("k", opts).allowed).toBe(true); // t=600, 2 requêtes dans la fenêtre [−400,600]

    vi.setSystemTime(900);
    // 3e requête : les 2 précédentes (t=0 et t=600) sont encore dans la fenêtre [−100,900] → bloqué
    expect(check("k", opts).allowed).toBe(false);

    vi.setSystemTime(1001);
    // la requête de t=0 est sortie de la fenêtre [1,1001], celle de t=600 y est toujours → 1 slot libre
    expect(check("k", opts).allowed).toBe(true);
    // le slot est repris immédiatement
    expect(check("k", opts).allowed).toBe(false);
  });

  it("des clés différentes sont comptabilisées indépendamment", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(check("a", opts).allowed).toBe(true);
    expect(check("a", opts).allowed).toBe(false);
    // "b" n'a subi aucune requête : pas affecté par l'épuisement de "a"
    expect(check("b", opts).allowed).toBe(true);
  });

  it("retryAfterMs correspond au temps jusqu'à la sortie du plus vieil horodatage", () => {
    const opts = { limit: 1, windowMs: 1000 };
    check("k", opts); // t=0
    vi.setSystemTime(300);
    const result = check("k", opts);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(700); // 0 + 1000 - 300
  });
});

describe("sweep", () => {
  beforeEach(() => {
    _resetForTests();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ne perturbe pas une clé encore active (dans maxAgeMs)", () => {
    const opts = { limit: 1, windowMs: 1000 };
    check("k", opts);
    vi.setSystemTime(500);
    sweep(1000);
    // la clé garde son horodatage → toujours épuisée
    expect(check("k", opts).allowed).toBe(false);
  });

  it("purge une clé entièrement inactive (au-delà de maxAgeMs), qui se réarme donc immédiatement", () => {
    const opts = { limit: 1, windowMs: 1000 };
    check("k", opts); // t=0
    vi.setSystemTime(5000);
    sweep(1000); // tout ce qui a plus de 1000ms d'inactivité est purgé
    expect(check("k", opts).allowed).toBe(true);
  });
});
