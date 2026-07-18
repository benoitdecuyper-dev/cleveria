// Injecte le texte COURANT de ~/.claude/PRINCIPES-AGENTS.md dans le pied de page de chaque
// agents/factory-*.md, entre sentinelles `<!-- principes:start/end -->` (après `<!-- @cc-only -->`,
// donc invisible du miroir Cleveria one-shot que génère sync-agents.mjs).
//
//   node scripts/inline-principes.mjs            # régénère le bloc dans tous les agents
//   node scripts/inline-principes.mjs --check    # n'écrit rien, échoue (exit 1) si dérive
//
// Pourquoi (étape 1 du parcours, cf. docs/31-notions-methode-ia.md fiches 1-2) : un pointeur
// vers un fichier ne met RIEN dans le contexte d'un agent — seul le contenu du .md est garanti.
// Avant ce script, le pied de page était un digest manuel gelé : les leçons du manager
// n'atteignaient jamais les agents. Désormais la source unique reste le fichier du manager,
// et le pied de page est un artefact GÉNÉRÉ — plus de copie manuelle, plus de dérive silencieuse.
//
// Règles maison respectées : idempotent, échoue bruyamment (sentinelle absente = erreur,
// source introuvable = erreur en génération). En --check sans source (CI cloud sans ~/.claude),
// on avertit et on passe : la dérive ne peut naître que sur le poste où la source existe.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const agentsDir = process.env.CLEVERIA_SOURCE_AGENTS ?? resolve(repoRoot, "agents");
const principesFile =
  process.env.CLEVERIA_PRINCIPES ?? join(homedir(), ".claude", "PRINCIPES-AGENTS.md");

const SENTINEL = "<!-- @cc-only -->";
const CHECK = process.argv.includes("--check");

if (!existsSync(principesFile)) {
  if (CHECK) {
    console.warn(`⚠ Source des principes introuvable (${principesFile}) — check ignoré (environnement sans ~/.claude).`);
    process.exit(0);
  }
  console.error(`✗ Source des principes introuvable : ${principesFile}`);
  process.exit(1);
}

const src = readFileSync(principesFile, "utf8");
const p1 = src.indexOf("## Partie 1");
const p2 = src.indexOf("## Partie 2");
const endP2 = src.indexOf("\n---", p2);
if (p1 === -1 || p2 === -1 || endP2 === -1) {
  console.error(
    `✗ Structure inattendue dans ${principesFile} : sections « ## Partie 1 » / « ## Partie 2 » / « --- » final introuvables. Rien n'a été écrit.`,
  );
  process.exit(1);
}
// On retire la ligne de titre de chaque partie (remplacée par nos propres titres ci-dessous).
const partie1 = src.slice(p1, p2).trim().split("\n").slice(1).join("\n").trim();
const partie2 = src.slice(p2, endP2).trim().split("\n").slice(1).join("\n").trim();

function buildBlock(isManager, eol) {
  const lines = [
    SENTINEL,
    "",
    "---",
    "",
    "<!-- principes:start — bloc GÉNÉRÉ par scripts/inline-principes.mjs, ne pas éditer à la main.",
    "     Source unique : ~/.claude/PRINCIPES-AGENTS.md (toute leçon transverse s'ajoute LÀ-BAS),",
    "     puis `npm run principes:inline` régénère ce bloc dans tous les agents. -->",
    "",
    "## Principes communs de l'équipe Cleveria",
    "",
    partie1,
  ];
  if (isManager) {
    lines.push("", "### Écrire & faire évoluer un agent (mandat factory-manager)", "", partie2);
  }
  lines.push("", "<!-- principes:end -->", "");
  return lines.join(eol === "\r\n" ? "\r\n" : "\n");
}

// Budgets de mots par agent (process/budgets-agents.json) — le cliquet anti-accrétion de
// l'étape 7 : chaque règle ajoutée dilue toutes les autres (accuracy^n), donc le corps d'un
// agent ne peut pas dépasser son budget ; le manager peut BAISSER un budget, jamais le
// dépassement n'est toléré en silence. Contrôlé en --check (SessionStart + pré-commit).
let budgets = null;
try {
  budgets = JSON.parse(readFileSync(resolve(repoRoot, "process/budgets-agents.json"), "utf8"));
} catch {
  budgets = null; // repo sans budgets (contexte partiel) : contrôle sauté, signalé en --check
}

const files = readdirSync(agentsDir).filter((f) => f.startsWith("factory-") && f.endsWith(".md"));
const drifted = [];
const horsBudget = [];
let written = 0;

for (const file of files) {
  const path = join(agentsDir, file);
  const rawDisk = readFileSync(path, "utf8");
  // Un BOM UTF-8 (écriture PowerShell) rend le frontmatter illisible pour le chargeur d'agents
  // Claude Code ET pour sync-agents (incident du 2026-07-18 : 15 agents hors registre + miroir
  // runtime cassé). On le retire à la lecture → un fichier à BOM compte comme dérive, la
  // régénération l'écrit propre.
  const raw = rawDisk.replace(/^﻿/, "");
  const at = raw.indexOf(SENTINEL);
  if (at === -1) {
    console.error(`✗ ${file} : sentinelle « ${SENTINEL} » absente — fichier laissé intact, corrige-le d'abord.`);
    process.exit(1);
  }
  if (CHECK && budgets) {
    const bodyTxt = raw.slice(0, at).replace(/^---[\s\S]*?\n---\s*\n/, "").trim();
    const bodyWords = bodyTxt ? bodyTxt.split(/\s+/).length : 0;
    if (!(file in budgets)) horsBudget.push(`${file} : nouvel agent sans budget — ajoute-le à process/budgets-agents.json`);
    else if (bodyWords > budgets[file]) horsBudget.push(`${file} : ${bodyWords} mots > budget ${budgets[file]} — dégraisse ou passe la leçon en mécanisme (hook/template/skill/éval)`);
  }
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const expected = raw.slice(0, at) + buildBlock(file === "factory-manager.md", eol);
  if (rawDisk === expected) continue;
  if (CHECK) {
    drifted.push(file);
  } else {
    writeFileSync(path, expected, "utf8");
    written += 1;
  }
}

if (CHECK) {
  if (budgets === null) console.warn("⚠ process/budgets-agents.json introuvable — contrôle des budgets de mots sauté.");
  if (horsBudget.length > 0) {
    console.error(`✗ Budget de mots dépassé (accrétion = dilution de toutes les règles) :\n` + horsBudget.map((l) => `    ${l}`).join("\n"));
    process.exit(1);
  }
  if (drifted.length > 0) {
    console.error(
      `✗ ${drifted.length}/${files.length} agents ont un bloc principes qui a dérivé de la source :\n` +
        drifted.map((f) => `    ${f}`).join("\n") +
        `\n  Lance \`npm run principes:inline\` puis commite agents/.`,
    );
    process.exit(1);
  }
  console.log(`✓ Bloc principes à jour dans les ${files.length} agents.`);
  process.exit(0);
}

console.log(
  written === 0
    ? `✓ Rien à faire : les ${files.length} agents portaient déjà le bloc courant.`
    : `Injecté les principes dans ${written}/${files.length} agents (source : ${principesFile}).`,
);
