// Génère le module d'agents bundle-safe (pas de lecture disque au runtime) depuis
// la source de vérité unique : agents/*.md à la racine du repo (~/.claude/agents est
// une jonction vers ce dossier — Claude Code lit les mêmes fichiers).
//
//   node scripts/sync-agents.mjs
//   CLEVERIA_SOURCE_AGENTS="/chemin/vers/agents" node scripts/sync-agents.mjs
//
// Lancé automatiquement avant chaque build/dev (voir package.json) : le fichier
// généré est gitignoré, il n'y a plus de sync manuelle ni de dérive possible.
//
// Volontairement AUTONOME : on ne ré-importe pas packages/factory (qui dépend du
// miroir généré ici → bootstrap impossible si le miroir manque). Le parsing du
// frontmatter est donc dupliqué a minima, en miroir de loadAgents.ts.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.CLEVERIA_SOURCE_AGENTS ?? resolve(repoRoot, "agents");
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
  // Le pied de page « Principes communs » (après la sentinelle `<!-- @cc-only -->`) est réservé à
  // Claude Code, où l'agent peut LIRE ~/.claude/PRINCIPES-AGENTS.md. En one-shot Cleveria l'agent
  // n'a pas d'outils → on le retire du miroir pour ne pas injecter de contexte mort
  // (cf. docs/07-upgrade-agents.md §1 « zéro contexte mort »).
  const prompt = body.split("<!-- @cc-only -->")[0].trim();
  return {
    name: meta.name ?? file.replace(/\.md$/, ""),
    description: meta.description ?? "",
    tools: meta.tools ? meta.tools.split(",").map((t) => t.trim()).filter(Boolean) : [],
    model: meta.model,
    prompt,
  };
});

const out = `// AUTO-GÉNÉRÉ par scripts/sync-agents.mjs — ne pas éditer à la main.
// Source : ${source}
import type { FactoryAgent } from "./loadAgents";

export const AGENTS: FactoryAgent[] = ${JSON.stringify(agents, null, 2)};
`;

// Mode --check (CI / pré-commit) : n'écrit rien, échoue si le miroir a dérivé de la source.
// La synchro étant manuelle, ce garde-fou empêche un `.claude/agents` modifié sans `sync:agents`
// de laisser le runtime servir un roster périmé (cf. audit roster 2026-07-10).
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(outFile, "utf8");
  } catch {
    console.error(`✗ Miroir absent (${outFile}). Lance \`npm run sync:agents\`.`);
    process.exit(1);
  }
  if (current !== out) {
    console.error(
      `✗ Miroir désynchronisé (${agents.length} agents en source) : le miroir a dérivé de .claude/agents.\n` +
        `  Lance \`npm run sync:agents\` puis commite ${outFile}.`,
    );
    process.exit(1);
  }
  console.log(`✓ Miroir à jour (${agents.length} agents).`);
  process.exit(0);
}

writeFileSync(outFile, out, "utf8");
console.log(`Synchronisé ${agents.length} agents → ${outFile}`);
