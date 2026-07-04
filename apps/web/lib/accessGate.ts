// Gate d'accès léger (démarchage) — PAS une auth complète (Supabase = plus tard, cf. mémoire
// "Cleveria — mémoire roadmap"). Objectif : Benoit envoie un lien à des assos/entreprises
// pendant la phase de démarchage sans laisser l'app ouverte à tout le monde. Un seul code
// d'accès PARTAGÉ, pas de compte, pas de mot de passe par utilisateur.
//
// Le gate ne s'active QUE si `CLEVERIA_ACCESS_CODE` est définie et non vide côté serveur :
//   - Render (prod) : Dashboard → service web → Environment → ajouter CLEVERIA_ACCESS_CODE.
//   - Local : facultatif, uniquement si Benoit veut tester le gate lui-même (apps/web/.env,
//     jamais commité — cf. .gitignore).
// Absente (dev par défaut, CI, Vitest, Playwright) → isGateEnabled() === false → l'app se
// comporte EXACTEMENT comme avant ce lot.
//
// Web Crypto (`crypto.subtle`), volontairement PAS `node:crypto` : ce module est importé à la
// fois par le middleware (Edge runtime — `middleware.ts` ne peut pas tourner en Node.js runtime,
// contrairement à `proxy.ts` introduit par Next 16) et par la route de vérification (Node.js
// runtime). `crypto.subtle` est disponible nativement dans les deux, `node:crypto` non.

export const ACCESS_COOKIE_NAME = "cleveria_access";

// Sel fixe : distingue ce jeton de tout autre usage possible d'HMAC-SHA256 sur ce code. Ce
// n'est PAS un secret en soi (le vrai secret est CLEVERIA_ACCESS_CODE, jamais exposé au client
// ni au bundle — lu uniquement via process.env côté serveur).
const TOKEN_INFO = "cleveria-access-v1";

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufToHex(digest);
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return bufToHex(sig);
}

// Comparaison en temps constant de deux chaînes de MÊME longueur (utilisée uniquement sur des
// empreintes SHA-256 hexadécimales, donc toujours 64 caractères) : pas de court-circuit dès la
// première différence, contrairement à `===`.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Le gate est actif si (et seulement si) CLEVERIA_ACCESS_CODE est définie et non vide. */
export function isGateEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.CLEVERIA_ACCESS_CODE && env.CLEVERIA_ACCESS_CODE.trim().length > 0;
}

/**
 * Compare le code saisi par le visiteur au code de référence, en temps constant. On hache les
 * deux chaînes avant de les comparer : ça donne des empreintes de longueur FIXE (32 octets),
 * donc pas de fuite de la longueur du code en clair, et pas de branche `===` qui court-circuite
 * dès le premier caractère différent.
 */
export async function verifyAccessCode(input: string, expected: string): Promise<boolean> {
  if (!input || !expected) return false;
  const [a, b] = await Promise.all([sha256Hex(input), sha256Hex(expected)]);
  return timingSafeEqualHex(a, b);
}

/**
 * Jeton opaque posé dans le cookie de session : HMAC-SHA256(code, sel), JAMAIS le code en
 * clair. Déterministe (même code → même jeton) : le middleware le revérifie sans état serveur
 * (pas de session store), juste en le recalculant depuis CLEVERIA_ACCESS_CODE.
 */
export async function deriveAccessToken(code: string): Promise<string> {
  return hmacSha256Hex(code, TOKEN_INFO);
}

/** Le cookie de session (jeton opaque) correspond-il au code actuellement configuré ? */
export async function verifyAccessToken(
  token: string | undefined | null,
  code: string | undefined | null,
): Promise<boolean> {
  if (!token || !code) return false;
  const expected = await deriveAccessToken(code);
  return timingSafeEqualHex(token, expected);
}
