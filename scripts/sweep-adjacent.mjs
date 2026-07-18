// Sweep du périmètre adjacent (étape 5 du parcours, cf. docs/31-notions-methode-ia.md).
//
// Quand un parcours utilisateur est refondu, la QA teste la PROFONDEUR du chemin modifié ;
// personne ne balaie sa LARGEUR : les boutons, liens, menus et appels qui pointent VERS la
// zone touchée (cas vécu : bouton « ajout contact » orphelin survivant à une refonte).
// Ce script fabrique l'inventaire mécaniquement — un grep n'oublie pas — et impose un
// verdict par ligne. Une ligne sans verdict rend le fichier invalide (--check rouge).
//
//   node scripts/sweep-adjacent.mjs --repo <chemin> --zone <terme> [--zone <terme>…] --out <SWEEP-xxx.md>
//   node scripts/sweep-adjacent.mjs --check <SWEEP-xxx.md>
//
// Verdicts admis (à substituer à « À STATUER ») :
//   GARDER · ADAPTER · SUPPRIMER · HORS-PÉRIMÈTRE(<propriétaire>)

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, basename } from "node:path";

const args = process.argv.slice(2);
function opt(name) {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name) out.push(args[i + 1]);
  return out;
}

// ---------- mode --check : aucune ligne sans verdict ----------
const checkFile = opt("--check")[0];
if (checkFile) {
  const txt = readFileSync(checkFile, "utf8");
  const aStatuer = (txt.match(/^\|.*\| À STATUER \|$/gm) ?? []).length;
  const lignes = (txt.match(/^\| `/gm) ?? []).length;
  if (lignes === 0) {
    console.error(`✗ ${checkFile} : aucun élément inventorié — sweep vide ou fichier invalide.`);
    process.exit(1);
  }
  if (aStatuer > 0) {
    console.error(`✗ ${checkFile} : ${aStatuer}/${lignes} lignes encore « À STATUER » — la recette ne peut pas s'ouvrir.`);
    process.exit(1);
  }
  console.log(`✓ ${checkFile} : ${lignes} lignes, toutes statuées.`);
  process.exit(0);
}

// ---------- mode inventaire ----------
const repo = opt("--repo")[0];
const zones = opt("--zone").map((z) => z.toLowerCase());
const out = opt("--out")[0];
if (!repo || zones.length === 0 || !out) {
  console.error("Usage : --repo <chemin> --zone <terme> [--zone <terme>…] --out <SWEEP-xxx.md>  |  --check <SWEEP-xxx.md>");
  process.exit(1);
}

// Constat QA (recette étape 5) : sans ces deux gardes, une régénération EN PLACE ré-inventorie
// le SWEEP précédent (lignes fantômes auto-référentielles) et écrase en silence les verdicts
// déjà saisis. (1) Les SWEEP-*.md sont exclus du scan ; (2) un --out existant qui contient des
// verdicts statués n'est écrasé qu'avec --force explicite.
if (existsSync(out)) {
  const prev = readFileSync(out, "utf8");
  const statuees = (prev.match(/^\|.*\| (GARDER|ADAPTER|SUPPRIMER|HORS-PÉRIMÈTRE[^|]*) \|$/gm) ?? []).length;
  if (statuees > 0 && !args.includes("--force")) {
    console.error(
      `✗ ${out} existe et contient ${statuees} verdict(s) déjà statué(s) — les écraser serait une perte muette.\n` +
        `  Archive/renomme le fichier, ou relance avec --force si l'écrasement est voulu.`,
    );
    process.exit(1);
  }
}

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "vendor", "coverage"]);
const TEXT_EXT = /\.(html?|js|mjs|ts|tsx|jsx|css|json|md|py|sql|yml|yaml|txt)$/i;
const outAbs = resolve(out);
const ENTREE = /href=|onclick|onClick|addEventListener|fetch\(|route|location\.|window\.open|navigate|<a |<button|btn|menu|nav|data-action|action=/i;

function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/^SWEEP-.*\.md$/i.test(basename(p)) || resolve(p) === outAbs) continue;
    else if (TEXT_EXT.test(name) && st.size < 2_000_000) acc.push(p);
  }
  return acc;
}

const rows = [];
for (const file of walk(repo, [])) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const low = line.toLowerCase();
    if (!zones.some((z) => low.includes(z))) return;
    const type = ENTREE.test(line) ? "point d'entrée" : "occurrence";
    const extrait = line.trim().replace(/\|/g, "¦").slice(0, 110);
    rows.push({ loc: `${relative(repo, file).replace(/\\/g, "/")}:${i + 1}`, type, extrait });
  });
}

const doc = [
  `# SWEEP — zone : ${zones.join(" · ")}`,
  ``,
  `_Repo : ${repo} · Généré par scripts/sweep-adjacent.mjs le <date du run> · ${rows.length} lignes._`,
  ``,
  `> **Chaque ligne exige un verdict** : GARDER · ADAPTER · SUPPRIMER · HORS-PÉRIMÈTRE(<propriétaire>).`,
  `> Une ligne « À STATUER » restante = fichier invalide (\`--check\` rouge) = la recette ne s'ouvre pas.`,
  `> Les « points d'entrée » sont prioritaires : c'est là que vivent les boutons orphelins.`,
  ``,
  `| Localisation | Type | Extrait | Verdict |`,
  `|---|---|---|---|`,
  ...rows
    .sort((a, b) => (a.type === b.type ? a.loc.localeCompare(b.loc) : a.type === "point d'entrée" ? -1 : 1))
    .map((r) => `| \`${r.loc}\` | ${r.type} | \`${r.extrait}\` | À STATUER |`),
  ``,
].join("\n");

writeFileSync(out, doc, "utf8");
console.log(`${rows.length} lignes inventoriées (${rows.filter((r) => r.type === "point d'entrée").length} points d'entrée) → ${out}`);
if (rows.length === 0) console.warn("⚠ Inventaire vide : zone mal orthographiée, ou périmètre réellement sans adjacence — à vérifier avant de conclure.");
