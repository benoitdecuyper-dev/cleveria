// Charge la Factory team depuis la source de vérité unique : `agents/*.md` à la
// racine du repo (versionnés git ; `~/.claude/agents` est une jonction vers ce
// dossier). Améliorer un agent dans Claude Code améliore donc Cleveria automatiquement.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface FactoryAgent {
  /** slug, ex. "factory-chef-de-projet" */
  name: string;
  /** description (sert au routage / à la sélection) */
  description: string;
  /** outils déclarés dans le frontmatter, ex. ["Read","Write",...] */
  tools: string[];
  /** modèle déclaré (souvent "opus") — Cleveria mappe vers un id concret au runtime */
  model?: string;
  /** corps du prompt système de l'agent */
  prompt: string;
}

/** Parse minimal du frontmatter YAML simple (clé: valeur) en tête de fichier. */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(raw);
  if (!match) return { meta: {}, body: raw.trim() };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  }
  return { meta, body: match[2].trim() };
}

/**
 * Lit tous les agents `factory-*.md` du dossier donné.
 * @param dir  défaut : $CLEVERIA_AGENTS_DIR ou agents/ (relatif au CWD = racine du repo)
 */
export function loadAgents(dir?: string): FactoryAgent[] {
  const agentsDir = resolve(
    dir ?? process.env.CLEVERIA_AGENTS_DIR ?? "agents",
  );

  const files = readdirSync(agentsDir).filter(
    (f) => f.startsWith("factory-") && f.endsWith(".md"),
  );

  return files.map((file) => {
    const raw = readFileSync(join(agentsDir, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    return {
      name: meta.name ?? file.replace(/\.md$/, ""),
      description: meta.description ?? "",
      tools: meta.tools
        ? meta.tools.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      model: meta.model,
      prompt: body,
    };
  });
}

/** Le point d'entrée unique : le chef de projet (depuis le disque — usage local/worker). */
export function loadChefDeProjet(dir?: string): FactoryAgent {
  const chef = loadAgents(dir).find((a) => a.name === "factory-chef-de-projet");
  if (!chef) throw new Error("factory-chef-de-projet introuvable dans CLEVERIA_AGENTS_DIR");
  return chef;
}

// --- Variante bundle-safe (pour le web / serverless) ---
// Lit le module généré par scripts/sync-agents.mjs : aucun accès disque au runtime.
import { AGENTS } from "./agents.generated";

export function getAgents(): FactoryAgent[] {
  return AGENTS;
}

export function getChefDeProjet(): FactoryAgent {
  const chef = AGENTS.find((a) => a.name === "factory-chef-de-projet");
  if (!chef) throw new Error("factory-chef-de-projet absent du bundle — lance `npm run sync:agents`");
  return chef;
}

// Exécution directe : `node src/loadAgents.ts` → liste les agents trouvés (sanity check).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const agents = loadAgents();
  console.log(`Factory team : ${agents.length} agents chargés depuis les définitions Claude Code`);
  for (const a of agents) console.log(`  - ${a.name}${a.model ? ` (${a.model})` : ""}`);
}
