// Rate-limiting EN MÉMOIRE (V1) — protège les crédits Anthropic sur les endpoints qui coûtent
// et freine le brute-force du code d'accès (finding sécu). Render tourne en mono-instance
// persistante (cf. lib/runStore.ts) → une Map en mémoire suffit, pas besoin de Redis.
//
// Indépendant du gate (lib/accessGate.ts) : protège même si le gate est désactivé, et un
// utilisateur authentifié via le cookie d'accès ne peut pas non plus marteler les endpoints.

export interface RateLimitOptions {
  /** nombre de requêtes autorisées par fenêtre */
  limit: number;
  /** durée de la fenêtre glissante, en millisecondes */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** si refusé, temps à attendre avant de réessayer (0 si autorisé) */
  retryAfterMs: number;
}

// Journal d'horodatages par clé (fenêtre glissante "log-based", pas de compteur à paliers fixes
// — évite l'effet de bord classique des fenêtres fixes, où 2×limit passe en franchissant une
// frontière de minute). Survit au Hot-Reload de Next en dev, comme runStore.ts.
const g = globalThis as unknown as {
  __cleveriaRateLimitHits?: Map<string, number[]>;
  __cleveriaSweepStarted?: boolean;
};
const hits: Map<string, number[]> = (g.__cleveriaRateLimitHits ??= new Map());

/**
 * Vérifie et enregistre une requête pour `key` selon la fenêtre glissante `opts`. Fonction pure
 * vis-à-vis de son résultat (déterministe pour un `Date.now()` donné) ; l'état vit dans le
 * module, comme runStore.ts. Purge à la volée les horodatages expirés de la clé consultée —
 * pas de fuite mémoire pour les clés actives ; cf. `sweep()` pour les clés devenues inactives.
 */
export function check(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  const previous = hits.get(key);
  const kept = previous ? previous.filter((t) => t > windowStart) : [];

  if (kept.length >= opts.limit) {
    hits.set(key, kept); // on garde la purge même en cas de refus
    const oldest = kept[0];
    const retryAfterMs = Math.max(0, oldest + opts.windowMs - now);
    return { allowed: false, retryAfterMs };
  }

  kept.push(now);
  hits.set(key, kept);
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Purge les clés dont TOUS les horodatages ont expiré (aucune requête depuis `maxAgeMs`). Non
 * indispensable au fonctionnement (check() purge déjà par clé à chaque appel) : ça borne juste
 * la taille de la Map si beaucoup d'IP distinctes se présentent une fois puis disparaissent.
 */
export function sweep(maxAgeMs: number): void {
  const now = Date.now();
  for (const [key, timestamps] of hits) {
    const kept = timestamps.filter((t) => t > now - maxAgeMs);
    if (kept.length === 0) hits.delete(key);
    else hits.set(key, kept);
  }
}

// Ordonnancement du balayage : sans ça, `sweep` n'est jamais appelé → les clés d'IP vues une seule
// fois restent À VIE dans la Map = fuite mémoire non bornée sur un serveur long-vivant (amplifiée
// par un attaquant qui ferait varier son IP). Enregistré UNE fois au chargement du module (garde
// globalThis contre le double-enregistrement au hot-reload Next), `.unref()` pour ne pas maintenir
// le process en vie. Pas en test (Vitest) pour éviter un handle ouvert.
if (!g.__cleveriaSweepStarted && typeof process !== "undefined" && !process.env.VITEST) {
  g.__cleveriaSweepStarted = true;
  setInterval(() => sweep(24 * 60 * 60_000), 60 * 60_000).unref?.();
}

/** Test-only : réinitialise tout l'état pour isoler les tests entre eux. */
export function _resetForTests(): void {
  hits.clear();
}
