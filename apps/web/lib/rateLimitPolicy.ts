// Glue HTTP au-dessus du limiteur pur (lib/rateLimit.ts) : extraction de l'IP client, limites
// par endpoint, et réponse 429 standard. Séparé de rateLimit.ts pour que ce dernier reste un
// module pur (aucune dépendance à Request/Headers), testable sans mock réseau.

import { check, type RateLimitOptions } from "./rateLimit";

/**
 * IP du client, pour usage SÉCURITÉ (clé de rate-limit) → on ne fait confiance qu'aux IP posées
 * par un proxy de confiance, jamais à une valeur fournie par le client (sinon spoofable → limite
 * contournée en changeant l'en-tête à chaque requête). Ordre :
 *  1. `cf-connecting-ip` — Render est fronté par Cloudflare, qui ÉCRASE cet en-tête (non spoofable).
 *  2. Repli `x-forwarded-for` : le client peut préfixer des hops bidon À GAUCHE ; le proxy appende
 *     l'IP réelle À DROITE → on prend le DERNIER hop (le plus à droite), pas le premier.
 *  3. Repli `x-real-ip`, puis `"unknown"` (jamais d'exception ; en local/CI ces en-têtes sont
 *     absents → clé commune "unknown:<endpoint>", sans incidence vu les limites généreuses).
 * NB : la fiabilité du right-most suppose un nombre de hops proxy constant ; à confirmer en prod en
 * logguant un XFF réel (si `cf-connecting-ip` arrive, il prime et la question ne se pose plus).
 */
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  const real = headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  return "unknown";
}

// Endpoints protégés (méthode POST) et leurs limites par défaut — ordres de grandeur, à ajuster
// selon l'usage réel constaté. Pensés pour laisser un usage normal tranquille et ne bloquer que
// l'abus : un aller-retour de conversation, quelques régénérations de maquette ou un plan avant
// de lancer l'équipe restent très en dessous de ces seuils.
export const RATE_LIMITS = {
  // Anti-brute-force du code d'accès partagé (finding sécu) — 10 essais/minute/IP.
  access: { limit: 10, windowMs: 60_000 },
  // Conversation avec le bras droit (chat + itérations de cadrage) — 30/minute/IP.
  brief: { limit: 30, windowMs: 60_000 },
  // Génération/régénération de maquette (appel Claude le plus lourd en tokens de sortie) — 20/minute/IP.
  maquette: { limit: 20, windowMs: 60_000 },
  // Restitution du plan avant exécution — 20/minute/IP.
  plan: { limit: 20, windowMs: 60_000 },
  // Lancement d'un run (mobilise toute l'équipe d'agents) : le plus cher, quota horaire — 10/heure/IP.
  run: { limit: 10, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitOptions>;

// Garde-fou journalier supplémentaire, partagé entre /api/brief et /api/maquette : ces deux
// endpoints sont appelés en boucle pendant une session normale (une conversation ou une itération
// de maquette peut légitimement dépasser la fenêtre minute plusieurs fois dans l'heure) ; ce
// plafond borne l'abus prolongé qui resterait sous les seuils par minute. 200/jour/IP est très
// large devant un usage normal (quelques dizaines d'allers-retours par session).
export const DAILY_BRIEF_MAQUETTE_LIMIT: RateLimitOptions = { limit: 200, windowMs: 24 * 60 * 60_000 };

/** Réponse 429 sobre et cohérente entre tous les endpoints, avec l'en-tête Retry-After (secondes). */
export function tooManyRequests(retryAfterMs: number): Response {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return Response.json(
    { error: "Trop de requêtes. Merci de réessayer dans un instant." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

/**
 * Applique la limite par minute d'un endpoint pour la requête courante. Renvoie la réponse 429
 * à retourner telle quelle si la limite est dépassée, ou `null` si la requête peut continuer.
 */
export function enforceRateLimit(req: Request, endpoint: keyof typeof RATE_LIMITS): Response | null {
  const ip = clientIp(req.headers);
  const result = check(`${ip}:${endpoint}`, RATE_LIMITS[endpoint]);
  return result.allowed ? null : tooManyRequests(result.retryAfterMs);
}

/**
 * Applique en plus le plafond journalier partagé brief+maquette. À appeler après
 * `enforceRateLimit` (qui pose déjà la limite par minute propre à l'endpoint) ; celui-ci utilise
 * une clé dédiée ("daily:brief-maquette") commune aux deux endpoints.
 */
export function enforceDailyBriefMaquette(req: Request): Response | null {
  const ip = clientIp(req.headers);
  const result = check(`${ip}:daily:brief-maquette`, DAILY_BRIEF_MAQUETTE_LIMIT);
  return result.allowed ? null : tooManyRequests(result.retryAfterMs);
}
