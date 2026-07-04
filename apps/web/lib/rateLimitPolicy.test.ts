import { beforeEach, describe, expect, it } from "vitest";
import { _resetForTests } from "./rateLimit";
import {
  RATE_LIMITS,
  clientIp,
  enforceDailyBriefMaquette,
  enforceRateLimit,
  tooManyRequests,
} from "./rateLimitPolicy";

describe("clientIp", () => {
  it("prend cf-connecting-ip en priorité (posé par Cloudflare, non spoofable)", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "1.2.3.4, 10.0.0.1",
    });
    expect(clientIp(headers)).toBe("203.0.113.9");
  });

  it("prend le DERNIER hop de x-forwarded-for (posé par le proxy, pas le 1er = client spoofable)", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" });
    expect(clientIp(headers)).toBe("10.0.0.2");
  });

  it("retombe sur x-real-ip si x-forwarded-for est absent", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(clientIp(headers)).toBe("198.51.100.7");
  });

  it("retombe sur \"unknown\" si aucun des deux en-têtes n'est présent (jamais d'exception)", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("ignore un x-forwarded-for vide et se rabat sur x-real-ip", () => {
    const headers = new Headers({ "x-forwarded-for": "", "x-real-ip": "198.51.100.7" });
    expect(clientIp(headers)).toBe("198.51.100.7");
  });
});

describe("tooManyRequests", () => {
  it("renvoie un 429 JSON sobre avec l'en-tête Retry-After en secondes (arrondi au-dessus)", async () => {
    const res = tooManyRequests(1500);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("2");
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  it("Retry-After est au moins 1 seconde même si retryAfterMs est très petit", async () => {
    const res = tooManyRequests(10);
    expect(res.headers.get("Retry-After")).toBe("1");
  });
});

describe("enforceRateLimit", () => {
  beforeEach(() => {
    _resetForTests();
  });

  it("laisse passer (renvoie null) tant que la limite de l'endpoint n'est pas atteinte", () => {
    const req = new Request("http://localhost/api/access", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    for (let i = 0; i < RATE_LIMITS.access.limit; i++) {
      expect(enforceRateLimit(req, "access")).toBeNull();
    }
  });

  it("renvoie un 429 une fois la limite de l'endpoint dépassée", () => {
    const req = new Request("http://localhost/api/access", {
      headers: { "x-forwarded-for": "9.9.9.9" },
    });
    for (let i = 0; i < RATE_LIMITS.access.limit; i++) {
      enforceRateLimit(req, "access");
    }
    const blocked = enforceRateLimit(req, "access");
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it("deux IP distinctes ne se gênent pas sur le même endpoint", () => {
    const reqA = new Request("http://localhost/api/access", { headers: { "x-forwarded-for": "1.1.1.1" } });
    const reqB = new Request("http://localhost/api/access", { headers: { "x-forwarded-for": "2.2.2.2" } });
    for (let i = 0; i < RATE_LIMITS.access.limit; i++) enforceRateLimit(reqA, "access");
    expect(enforceRateLimit(reqA, "access")).not.toBeNull(); // A épuisée
    expect(enforceRateLimit(reqB, "access")).toBeNull(); // B intacte
  });

  it("deux endpoints distincts pour la même IP ont des compteurs indépendants", () => {
    const req = new Request("http://localhost/api/x", { headers: { "x-forwarded-for": "3.3.3.3" } });
    for (let i = 0; i < RATE_LIMITS.access.limit; i++) enforceRateLimit(req, "access");
    expect(enforceRateLimit(req, "access")).not.toBeNull(); // access épuisée
    expect(enforceRateLimit(req, "brief")).toBeNull(); // brief intacte pour la même IP
  });
});

describe("enforceDailyBriefMaquette", () => {
  beforeEach(() => {
    _resetForTests();
  });

  it("partage le même compteur journalier entre brief et maquette pour une IP donnée", () => {
    const req = new Request("http://localhost/api/brief", { headers: { "x-forwarded-for": "4.4.4.4" } });
    // Épuise le plafond journalier en simulant des appels alternés brief/maquette.
    const dailyLimit = 200; // cf. DAILY_BRIEF_MAQUETTE_LIMIT
    for (let i = 0; i < dailyLimit; i++) {
      expect(enforceDailyBriefMaquette(req)).toBeNull();
    }
    // Le 201e appel, qu'il vienne "logiquement" de brief ou de maquette, est bloqué.
    expect(enforceDailyBriefMaquette(req)).not.toBeNull();
  });

  it("n'affecte pas une autre IP", () => {
    const reqA = new Request("http://localhost/api/brief", { headers: { "x-forwarded-for": "5.5.5.5" } });
    const reqB = new Request("http://localhost/api/brief", { headers: { "x-forwarded-for": "6.6.6.6" } });
    for (let i = 0; i < 200; i++) enforceDailyBriefMaquette(reqA);
    expect(enforceDailyBriefMaquette(reqA)).not.toBeNull();
    expect(enforceDailyBriefMaquette(reqB)).toBeNull();
  });
});
