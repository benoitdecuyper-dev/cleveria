// Recette locale avant déploiement — mécanisme de la Gate décideur nᵒ2
// (cf. process/cdp-methode.md §5). Modèle : SWEEP (scripts/sweep-adjacent.mjs).
//
// Une modif qui TOUCHE la prod (UI, parcours, déploiement) se recette SUR LE DEV
// EN LOCAL avant toute mise en prod : rendu observé au navigateur À LA SURFACE du
// changement (jamais un proxy compte/console), mise en page + responsive, pas de
// doublon d'UI, et un GO décideur explicite. Ce script fabrique l'artefact à
// statuer et le vérifie : une ligne « À STATUER », ou un GO décideur non « OK »,
// rend le --check ROUGE → pas de déploiement.
//
//   node scripts/recette-locale.mjs --out RECETTE-<ticket>.md          # génère l'artefact
//   node scripts/recette-locale.mjs --check RECETTE-<ticket>.md        # gate avant déploiement
//
// Verdicts admis (à substituer à « À STATUER ») : OK · N-A(<raison>)
// — sauf la ligne GO décideur, qui DOIT être « OK » (un déploiement exige un vrai GO).

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };

const CONTROLES = [
  "Rendu observé au NAVIGATEUR à la surface du changement (capture `scripts/capture-rendu.mjs` au viewport cible) — jamais un proxy (compte d'éléments / absence d'erreur console)",
  "Mise en page vérifiée à la surface du changement (grille, alignements, débordements/chevauchements)",
  "Responsive vérifié (viewport mobile de la fiche d'intake)",
  "Aucun doublon d'UI : le changement ne réintroduit pas un dispositif que l'UI porte déjà (réutiliser/étendre l'existant)",
  "Aucune erreur console au rendu",
  "GO décideur explicite obtenu AVANT déploiement",
];
const GO_LABEL = "GO décideur";

// ---------- mode --check : gate ----------
const checkFile = opt("--check");
if (checkFile) {
  if (!existsSync(checkFile)) { console.error(`✗ ${checkFile} introuvable — recette locale non faite.`); process.exit(1); }
  const txt = readFileSync(checkFile, "utf8");
  const rows = txt.match(/^\|(?!\s*(Contrôle|:?-)).*\|$/gm) ?? [];
  const dataRows = rows.filter((l) => /\| (OK|N-A\(|À STATUER)/.test(l) || /À STATUER/.test(l));
  if (dataRows.length === 0) { console.error(`✗ ${checkFile} : aucun contrôle inventorié — artefact vide/invalide.`); process.exit(1); }
  const aStatuer = dataRows.filter((l) => /À STATUER/.test(l)).length;
  if (aStatuer > 0) {
    console.error(`✗ ${checkFile} : ${aStatuer}/${dataRows.length} contrôle(s) « À STATUER » — la recette locale n'est pas close, pas de déploiement.`);
    process.exit(1);
  }
  const goRow = dataRows.find((l) => l.includes(GO_LABEL));
  if (!goRow) { console.error(`✗ ${checkFile} : ligne « ${GO_LABEL} » absente — artefact non conforme.`); process.exit(1); }
  if (!/\|\s*OK\s*\|?\s*$/.test(goRow)) {
    console.error(`✗ ${checkFile} : « ${GO_LABEL} » n'est pas « OK » — un déploiement exige un GO décideur explicite (N-A interdit ici).`);
    process.exit(1);
  }
  console.log(`✓ ${checkFile} : ${dataRows.length} contrôles statués, GO décideur OK — déploiement autorisé.`);
  process.exit(0);
}

// ---------- mode --out : génère l'artefact ----------
const outFile = opt("--out");
if (!outFile) {
  console.error("Usage : --out RECETTE-<ticket>.md  |  --check RECETTE-<ticket>.md");
  process.exit(1);
}
if (existsSync(outFile) && !args.includes("--force")) {
  console.error(`✗ ${outFile} existe déjà — --force pour écraser (les verdicts statués seraient perdus).`);
  process.exit(1);
}
const ticket = outFile.replace(/^.*RECETTE-/, "").replace(/\.md$/, "") || "sans-ticket";
const rows = CONTROLES.map((c) => `| ${c} | | À STATUER |`).join("\n");
const doc = `# RECETTE LOCALE — ${ticket}

> **Gate décideur nᵒ2** (process/cdp-methode.md §5) : à compléter AVANT tout déploiement.
> Verdicts : **OK** · **N-A(<raison>)** · À STATUER. Tout statué + GO décideur = OK ⇒ \`--check\` vert.

| Contrôle | Preuve / note | Verdict |
|---|---|---|
${rows}
`;
writeFileSync(outFile, doc);
console.log(`✓ ${outFile} généré (${CONTROLES.length} contrôles à statuer). Recette locale, puis \`--check\` avant déploiement.`);
