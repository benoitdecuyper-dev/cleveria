// Synchronise les définitions Claude Code (.claude/agents/*.md) dans le repo,
// sous forme d'un module généré (bundle-safe, pas de lecture disque au runtime).
//
//   node scripts/sync-agents.mjs
//   CLEVERIA_SOURCE_AGENTS="/chemin/vers/agents" node scripts/sync-agents.mjs
//
// À relancer quand tu améliores un agent dans Claude Code, pour propager à Cleveria.
//
// Volontairement AUTONOME : on ne ré-importe pas packages/factory (qui dépend du
// miroir généré ici → bootstrap impossible si le miroir manque). Le parsing du
// frontmatter est donc dupliqué a minima, en miroir de loadAgents.ts.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.CLEVERIA_SOURCE_AGENTS ?? resolve(repoRoot, "../.claude/agents");
const outFile = resolve(repoRoot, "packages/factory/src/agents.generated.ts");

/** Parse minimal du frontmatter YAML simple (clé: valeur) en tête de fichier. */
function parseFrontmatter(raw) {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(raw);
  if (!match) return { meta: {}, body: raw.trim() };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  }
  return { meta, body: match[2].trim() };
}

const files = readdirSync(source).filter((f) => f.startsWith("factory-") && f.endsWith(".md"));
const agents = files.map((file) => {
  const raw = readFileSync(join(source, file), "utf8");
  const { meta, body } = parseFrontmatter(raw);
  return {
    name: meta.name ?? file.replace(/\.md$/, ""),
    description: meta.description ?? "",
    tools: meta.tools ? meta.tools.split(",").map((t) => t.trim()).filter(Boolean) : [],
    model: meta.model,
    prompt: body,
  };
});

const out = `// AUTO-GÉNÉRÉ par scripts/sync-agents.mjs — ne pas éditer à la main.
// Source : ${source}
import type { FactoryAgent } from "./loadAgents";

export const AGENTS: FactoryAgent[] = ${JSON.stringify(agents, null, 2)};
`;

writeFileSync(outFile, out, "utf8");
console.log(`Synchronisé ${agents.length} agents → ${outFile}`);
