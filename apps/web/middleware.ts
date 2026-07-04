import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME, isGateEnabled, verifyAccessToken } from "./lib/accessGate";

// Gate d'accès léger pendant le démarchage (cf. lib/accessGate.ts pour le détail du mécanisme
// et pourquoi ce n'est PAS une auth complète). Fichier volontairement nommé `middleware.ts`
// (pas `proxy.ts`, la nouvelle convention Next 16) : `proxy.ts` impose le runtime Node.js,
// alors qu'on veut ici pouvoir tourner en Edge runtime (accessGate.ts n'utilise que Web
// Crypto, compatible avec les deux). `middleware.ts` reste supporté (déprécié, pas retiré).
//
// RÈGLE D'OR : si CLEVERIA_ACCESS_CODE est absente ou vide, ce middleware ne fait STRICTEMENT
// RIEN (laisse tout passer) — c'est ce qui garantit que les 84 tests unitaires et les 19 e2e
// continuent de passer sans aucune modification (ils tournent sans cette variable).
// Fail-open visible (audit sécu, finding n°3) : si on tourne en PROD sans code posé, le gate est
// muet et l'app est OUVERTE (endpoints payants exposés). On le crie dans les logs Render pour que
// l'oubli de la variable ne passe pas inaperçu. (Ne s'active jamais en dev/CI : NODE_ENV ≠ production.)
if (process.env.NODE_ENV === "production" && !isGateEnabled()) {
  console.warn(
    "[cleveria] ⚠️ GATE D'ACCÈS DÉSACTIVÉ EN PRODUCTION — CLEVERIA_ACCESS_CODE absente/vide : " +
      "l'app est OUVERTE et les endpoints payants (Claude) sont exposés. Posez la variable sur Render.",
  );
}

export async function middleware(req: NextRequest) {
  if (!isGateEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // La page d'accès et sa route de vérification doivent rester joignables SANS cookie —
  // sinon personne ne peut jamais saisir le code (boucle de redirection infinie).
  if (pathname === "/acces" || pathname === "/api/access") {
    return NextResponse.next();
  }

  const code = process.env.CLEVERIA_ACCESS_CODE;
  const token = req.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (await verifyAccessToken(token, code)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/acces";
  url.search = "";
  // Pour ramener l'utilisateur là où il voulait aller une fois le code saisi.
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Exclut les assets statiques (_next/*, favicon, icon.svg — la page /acces et /api/access
  // sont exclues dans le corps du middleware ci-dessus, pas ici, pour rester joignables même
  // en cas d'ajustement futur du matcher).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
