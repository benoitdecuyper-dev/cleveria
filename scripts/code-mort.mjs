// Inventaire des CANDIDATS au code mort — même patron que sweep-adjacent : l'inventaire vient
// d'un outil (un grep n'oublie pas), le verdict est humain/LT et obligatoire par ligne.
//
//   node scripts/code-mort.mjs --repo <chemin> [--src public] --out <CODEMORT-xxx.md>
//   node scripts/code-mort.mjs --check <CODEMORT-xxx.md>
//
// Heuristiques (candidats, PAS des verdicts — un usage dynamique peut échapper au grep) :
//   css-classe  : classe définie dans un .css jamais mentionnée dans les .html/.js
//   js-fonction : fonction définie jamais référencée ailleurs que sa définition
//   fichier     : fichier html/js/css/img jamais référencé par son nom
// Verdicts admis : SUPPRIMER · GARDER(<raison : chargé dynamiquement, API publique…>) ·
// FAUX-POSITIF(<raison>). « Commenté » n'est pas « supprimé ».

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);

const checkFile = opt("--check");
if (checkFile) {
  const txt = readFileSync(checkFile, "utf8");
  const rows = (txt.match(/^\| `/gm) ?? []).length;
  const rest = (txt.match(/^\|.*\| À STATUER \|$/gm) ?? []).length;
  if (rows === 0) { console.error(`✗ ${checkFile} : aucun candidat inventorié — fichier vide ou invalide.`); process.exit(1); }
  if (rest > 0) { console.error(`✗ ${checkFile} : ${rest}/${rows} candidats encore « À STATUER ».`); process.exit(1); }
  console.log(`✓ ${checkFile} : ${rows} candidats, tous statués.`);
  process.exit(0);
}

const repo = opt("--repo");
const out = opt("--out");
const src = join(repo ?? "", opt("--src", "public"));
if (!repo || !out) {
  console.error("Usage : --repo <chemin> [--src public] --out <CODEMORT-xxx.md>  |  --check <fichier>");
  process.exit(1);
}

const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", "vendor", "coverage"]);
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (st.size < 2_000_000) acc.push(p);
  }
  return acc;
}

const files = walk(src);
const textFiles = files.filter((f) => /\.(html?|js|mjs|css)$/i.test(f));
const corpus = textFiles.map((f) => ({ f, txt: readFileSync(f, "utf8") }));
const all = corpus.map((c) => c.txt).join("\n");
const rows = [];

// css-classe : définies dans les .css, cherchées partout ailleurs
for (const { f, txt } of corpus.filter((c) => /\.css$/i.test(c.f))) {
  const defs = new Set([...txt.matchAll(/(?<![\w-])\.([a-zA-Z_][\w-]{2,})\s*[,{:]/g)].map((m) => m[1]));
  const others = corpus.filter((c) => c.f !== f).map((c) => c.txt).join("\n");
  for (const cls of defs) {
    if (!others.includes(cls)) rows.push({ loc: relative(repo, f).replace(/\\/g, "/"), type: "css-classe", sym: "." + cls });
  }
}
// js-fonction : définies, jamais référencées ailleurs que la ligne de définition
for (const { f, txt } of corpus.filter((c) => /\.(js|mjs)$/i.test(c.f))) {
  const defs = [...txt.matchAll(/(?:function\s+([a-zA-Z_$][\w$]{2,})\s*\(|(?:const|let|var)\s+([a-zA-Z_$][\w$]{2,})\s*=\s*(?:async\s*)?(?:function|\())/g)]
    .map((m) => m[1] ?? m[2]);
  for (const name of new Set(defs)) {
    const refs = (all.match(new RegExp("(?<![\\w$])" + name.replace(/\$/g, "\\$") + "(?![\\w$])", "g")) ?? []).length;
    if (refs <= defs.filter((d) => d === name).length) rows.push({ loc: relative(repo, f).replace(/\\/g, "/"), type: "js-fonction", sym: name + "()" });
  }
}
// fichier : jamais référencé par son nom de base
for (const f of files.filter((x) => /\.(html?|js|mjs|css|jpe?g|png|svg|webp|pdf)$/i.test(x))) {
  const name = basename(f);
  if (/^index\.html$/i.test(name)) continue;
  const refs = (all.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
  const own = /\.(html?|js|mjs|css)$/i.test(f) ? (readFileSync(f, "utf8").match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length : 0;
  if (refs - own <= 0) rows.push({ loc: relative(repo, f).replace(/\\/g, "/"), type: "fichier", sym: name });
}

const doc = [
  `# CODE MORT — candidats (${src})`,
  ``,
  `_Généré par scripts/code-mort.mjs · ${rows.length} candidats. **Heuristique** : un candidat n'est`,
  `pas un verdict (usage dynamique possible) — chaque ligne exige SUPPRIMER · GARDER(<raison>) ·`,
  `FAUX-POSITIF(<raison>). Une ligne « À STATUER » restante = fichier invalide (--check rouge).`,
  `« Commenté » n'est pas « supprimé »._`,
  ``,
  `| Localisation | Type | Symbole | Verdict |`,
  `|---|---|---|---|`,
  ...rows.sort((a, b) => a.type.localeCompare(b.type) || a.loc.localeCompare(b.loc))
    .map((r) => `| \`${r.loc}\` | ${r.type} | \`${r.sym.replace(/\|/g, "¦")}\` | À STATUER |`),
  ``,
].join("\n");
writeFileSync(out, doc, "utf8");
const n = (t) => rows.filter((r) => r.type === t).length;
console.log(`${rows.length} candidats (css-classe ${n("css-classe")} · js-fonction ${n("js-fonction")} · fichier ${n("fichier")}) → ${out}`);
