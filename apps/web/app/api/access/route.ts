import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME, deriveAccessToken, isGateEnabled, verifyAccessCode } from "../../../lib/accessGate";
import { enforceRateLimit } from "../../../lib/rateLimitPolicy";

// Runtime Node.js (comme les autres routes de l'app) — la comparaison de code n'a besoin de
// rien de spécifique à Node, mais on reste cohérent avec le reste des API routes.
export const runtime = "nodejs";

// Vérifie le code d'accès saisi sur /acces. Le code de référence n'est JAMAIS envoyé au client
// ni au bundle : il est lu ici, côté serveur uniquement, via process.env.CLEVERIA_ACCESS_CODE.
//
//   - Render (prod) : Dashboard → service web → Environment → ajouter CLEVERIA_ACCESS_CODE.
//   - Local : facultatif, seulement si Benoit veut tester le gate lui-même (apps/web/.env).
export async function POST(req: NextRequest) {
  // Anti-brute-force (finding sécu) : indépendant du gate lui-même, pour que même un gate mal
  // configuré ou désactivé n'expose pas ce endpoint au martelage.
  const limited = enforceRateLimit(req, "access");
  if (limited) return limited;

  const configured = process.env.CLEVERIA_ACCESS_CODE;

  if (!isGateEnabled() || !configured) {
    // Le gate est désactivé côté serveur : rien à vérifier, on ne pose pas de cookie inutile.
    return NextResponse.json({ ok: false, error: "L'accès n'est pas protégé." }, { status: 400 });
  }

  let code = "";
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    code = "";
  }

  const valid = await verifyAccessCode(code, configured);
  if (!valid) {
    // Message sobre, aucune fuite d'info (pas de détail sur le format attendu, pas de compteur
    // d'essais exposé au client).
    return NextResponse.json({ ok: false, error: "Code incorrect." }, { status: 401 });
  }

  const token = await deriveAccessToken(configured);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    // `secure` conditionné à la prod : Render sert en HTTPS (next start → NODE_ENV=production),
    // donc le cookie y est bien Secure. En local (`next dev`, NODE_ENV=development), on reste
    // testable en http://localhost sans jonglage de certificat — le seul cas où ça compte
    // vraiment (le lien envoyé aux assos/entreprises) est TOUJOURS en HTTPS sur Render.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 jours — lien de démarchage, pas une session sensible
  });
  return res;
}
