import { describe, it, expect } from "vitest";
import {
  ACCESS_COOKIE_NAME,
  deriveAccessToken,
  isGateEnabled,
  verifyAccessCode,
  verifyAccessToken,
} from "./accessGate";

describe("isGateEnabled", () => {
  it("désactivé si CLEVERIA_ACCESS_CODE absente", () => {
    expect(isGateEnabled({})).toBe(false);
  });

  it("désactivé si CLEVERIA_ACCESS_CODE est une chaîne vide ou blanche", () => {
    expect(isGateEnabled({ CLEVERIA_ACCESS_CODE: "" })).toBe(false);
    expect(isGateEnabled({ CLEVERIA_ACCESS_CODE: "   " })).toBe(false);
  });

  it("activé si CLEVERIA_ACCESS_CODE est définie et non vide", () => {
    expect(isGateEnabled({ CLEVERIA_ACCESS_CODE: "sesame" })).toBe(true);
  });
});

describe("verifyAccessCode", () => {
  it("accepte le code exact", async () => {
    expect(await verifyAccessCode("sesame", "sesame")).toBe(true);
  });

  it("refuse un code différent", async () => {
    expect(await verifyAccessCode("mauvais", "sesame")).toBe(false);
  });

  it("refuse un code de longueur différente (pas de fuite de longueur ni de crash)", async () => {
    expect(await verifyAccessCode("s", "sesame")).toBe(false);
    expect(await verifyAccessCode("sesame-mais-beaucoup-plus-long", "sesame")).toBe(false);
  });

  it("refuse une entrée ou un attendu vide", async () => {
    expect(await verifyAccessCode("", "sesame")).toBe(false);
    expect(await verifyAccessCode("sesame", "")).toBe(false);
    expect(await verifyAccessCode("", "")).toBe(false);
  });

  it("est sensible à la casse", async () => {
    expect(await verifyAccessCode("Sesame", "sesame")).toBe(false);
  });
});

describe("deriveAccessToken", () => {
  it("est déterministe (même code → même jeton)", async () => {
    const a = await deriveAccessToken("sesame");
    const b = await deriveAccessToken("sesame");
    expect(a).toBe(b);
  });

  it("des codes différents donnent des jetons différents", async () => {
    const a = await deriveAccessToken("sesame");
    const b = await deriveAccessToken("autre-code");
    expect(a).not.toBe(b);
  });

  it("le jeton n'est pas le code en clair", async () => {
    const token = await deriveAccessToken("sesame");
    expect(token).not.toBe("sesame");
    expect(token).not.toContain("sesame");
    // Empreinte HMAC-SHA256 hexadécimale : 32 octets → 64 caractères hex.
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyAccessToken", () => {
  it("accepte le jeton dérivé du code courant", async () => {
    const token = await deriveAccessToken("sesame");
    expect(await verifyAccessToken(token, "sesame")).toBe(true);
  });

  it("refuse un jeton dérivé d'un AUTRE code (le code a changé côté serveur)", async () => {
    const token = await deriveAccessToken("ancien-code");
    expect(await verifyAccessToken(token, "sesame")).toBe(false);
  });

  it("refuse un jeton absent, null ou vide", async () => {
    expect(await verifyAccessToken(undefined, "sesame")).toBe(false);
    expect(await verifyAccessToken(null, "sesame")).toBe(false);
    expect(await verifyAccessToken("", "sesame")).toBe(false);
  });

  it("refuse si le code de référence est absent (gate désactivé entre-temps)", async () => {
    const token = await deriveAccessToken("sesame");
    expect(await verifyAccessToken(token, undefined)).toBe(false);
    expect(await verifyAccessToken(token, "")).toBe(false);
  });

  it("refuse un jeton falsifié ou non hexadécimal sans lever d'exception", async () => {
    await expect(verifyAccessToken("pas-du-tout-un-jeton-hex", "sesame")).resolves.toBe(false);
    await expect(verifyAccessToken("0".repeat(64), "sesame")).resolves.toBe(false);
  });
});

describe("ACCESS_COOKIE_NAME", () => {
  it("est un nom de cookie stable, sans le code dedans", () => {
    expect(ACCESS_COOKIE_NAME).toBe("cleveria_access");
  });
});
