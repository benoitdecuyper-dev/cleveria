// Vérification de sources — lib applicative DÉTERMINISTE (indépendante du LLM, marche sur les 2 backends).
//
//  Tier A — lire/valider une URL citée via Jina Reader (GRATUIT, sans clé). Tue le vrai risque :
//           l'URL inventée. Toujours actif.
//  Tier B — recherche ouverte multi-moteurs INDÉPENDANTS (triangulation), activés par clé d'env.
//           Sans clé → résultats vides → le vérificateur conclut « à confirmer », JAMAIS d'invention.
//
// Le vérificateur (agent) appelle ces primitives et produit les verdicts ; il ne cherche pas lui-même.

const FETCH_TIMEOUT_MS = 15000;

async function fetchT(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ── Tier A : lecture/validation d'URL via Jina Reader (gratuit, sans clé) ─────
export type UrlRead = { url: string; ok: boolean; status: number; text: string; error?: string };

const readCache = new Map<string, UrlRead>();

/** Lit le contenu d'une URL (markdown propre, JS-rendu) via Jina Reader. ok=false ⇒ morte/injoignable. */
export async function readUrl(url: string): Promise<UrlRead> {
  const cached = readCache.get(url);
  if (cached) return cached;
  let result: UrlRead;
  try {
    const res = await fetchT(`https://r.jina.ai/${url}`, { headers: { Accept: "text/plain" } });
    const text = res.ok ? (await res.text()).slice(0, 12000) : "";
    result = { url, ok: res.ok && text.trim().length > 0, status: res.status, text };
  } catch (e) {
    result = { url, ok: false, status: 0, text: "", error: e instanceof Error ? e.message : "fetch error" };
  }
  readCache.set(url, result);
  return result;
}

/** Extrait les URLs http(s) d'un texte (pour valider les sources citées par un agent). */
export function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>()"'`\]]+/g;
  return Array.from(new Set((text.match(re) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ""))));
}

// ── Tier B : recherche ouverte multi-moteurs INDÉPENDANTS (triangulation) ────
export type SearchResult = { title: string; url: string; snippet: string };
type RawItem = { title?: string; url?: string; link?: string; content?: string; snippet?: string };
type Backend = { name: string; available: boolean; search: (q: string) => Promise<SearchResult[]> };

// Tavily — index propre, free tier mensuel récurrent sans CB.
function tavily(): Backend {
  const key = process.env.TAVILY_API_KEY;
  return {
    name: "tavily",
    available: !!key,
    search: async (q) => {
      if (!key) return [];
      const res = await fetchT("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, query: q, max_results: 5 }),
      });
      if (!res.ok) return [];
      const d = (await res.json()) as { results?: RawItem[] };
      return (d.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: r.content ?? "" }));
    },
  };
}

// Serper — résultats Google réels (index INDÉPENDANT de Tavily → vraie triangulation). Très bon marché.
function serper(): Backend {
  const key = process.env.SERPER_API_KEY;
  return {
    name: "serper",
    available: !!key,
    search: async (q) => {
      if (!key) return [];
      const res = await fetchT("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q, num: 5 }),
      });
      if (!res.ok) return [];
      const d = (await res.json()) as { organic?: RawItem[] };
      return (d.organic ?? []).map((r) => ({ title: r.title ?? "", url: r.link ?? "", snippet: r.snippet ?? "" }));
    },
  };
}

function backends(): Backend[] {
  return [tavily(), serper()];
}

/** Moteurs réellement disponibles (clé présente). 0 → aucune recherche possible (mode « à confirmer »). */
export function availableEngines(): string[] {
  return backends()
    .filter((b) => b.available)
    .map((b) => b.name);
}

const searchCache = new Map<string, Record<string, SearchResult[]>>();

/**
 * Interroge en parallèle les moteurs INDÉPENDANTS disponibles (triangulation). Renvoie les résultats
 * PAR moteur → le vérificateur compare : concordance = confiance ; divergence = à signaler. Caché + dédup.
 */
export async function searchMulti(query: string): Promise<{ engines: string[]; byEngine: Record<string, SearchResult[]> }> {
  const key = query.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit) return { engines: Object.keys(hit), byEngine: hit };

  const active = backends().filter((b) => b.available);
  const byEngine: Record<string, SearchResult[]> = {};
  await Promise.all(
    active.map(async (b) => {
      try {
        byEngine[b.name] = await b.search(query);
      } catch {
        byEngine[b.name] = [];
      }
    }),
  );
  searchCache.set(key, byEngine);
  return { engines: active.map((b) => b.name), byEngine };
}
