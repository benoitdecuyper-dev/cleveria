// Runner de la suite d'évals comportementales (étape 6 du parcours, fiche 12).
//
//   node scripts/run-evals.mjs                    # suite complète, modèles réels
//   node scripts/run-evals.mjs --only s3-ux-intake
//   node scripts/run-evals.mjs --model haiku      # smoke-run économique (tous les scénarios)
//   node scripts/run-evals.mjs --log              # ajoute le résultat à evals/journal.jsonl
//
// Chaque scénario lance l'agent RÉEL en headless (`claude -p --agent … --max-turns …`) puis
// note sa réponse avec des graders code (regex). Verdict PASS/FAIL par grader et par scénario ;
// exit 1 si un scénario échoue — la suite est un garde-fou, pas un rapport.
// Usage rétro (canary de règle, factory-manager) : une règle n'est « gravée » qu'après
// rouge→vert sur son scénario ; la suite complète se rejoue à chaque rétro.

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENARIOS } from "../evals/scenarios.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const tag = args.includes("--tag") ? args[args.indexOf("--tag") + 1] : null;
const modelOverride = args.includes("--model") ? args[args.indexOf("--model") + 1] : null;
const doLog = args.includes("--log");

// tag absent sur un scénario = « noyau » (les fondateurs). --tag noyau|etendu filtre.
const selection = SCENARIOS.filter((s) => (!only || s.id === only) && (!tag || (s.tag ?? "noyau") === tag));
if (selection.length === 0) {
  console.error(`✗ Aucun scénario ne correspond à « ${only} ». Ids : ${SCENARIOS.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

// Pré-vol : un grader ayant laissé fuiter un nom réel après anonymisation ne peut
// pas devenir vert honnêtement (cf. scripts/check-graders.mjs). La suite refuse de
// tourner tant qu'un grader dérive — plutôt que d'accumuler des rouges trompeurs.
const graderCheck = spawnSync(process.execPath, [resolve(repoRoot, "scripts/check-graders.mjs")], { encoding: "utf8" });
process.stdout.write(graderCheck.stdout || "");
if (graderCheck.status !== 0) {
  process.stderr.write(graderCheck.stderr || "");
  process.exit(graderCheck.status || 1);
}

// Isolation d'environnement : les prompts sont des HYPOTHÈSES, mais le sous-agent a de VRAIS
// outils. Lancé dans HOME (qui EST un dépôt git réel), un CDP à qui on dit « mets en prod » va
// inspecter le vrai repo et dérailler (échec s23 du 2026-07-24 : « 6 commits non-pushés…
// clarification requise » au lieu de décrire la recette). On le lance donc dans un bac à sable
// HORS de tout dépôt : dossier neutre + GIT_CEILING_DIRECTORIES coupe la remontée git vers HOME.
// (C'est la leçon d'isolation de s14 — .next partagé — appliquée au harnais lui-même.)
const sandbox = join(tmpdir(), "cleveria-evals-sandbox");
mkdirSync(sandbox, { recursive: true });
const childEnv = { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() };

const results = [];
for (const s of selection) {
  const model = modelOverride ?? s.model;
  process.stdout.write(`\n■ ${s.id} — ${s.symptome}\n  agent=${s.agent} model=${model} maxTurns=${s.maxTurns}\n`);
  const t0 = Date.now();
  // MODE SOUS-AGENT (v2) : le premier run headless utilisait `--agent` (agent en fil principal)
  // — or les hooks SubagentStop (gate TRIAGE, gate fiche d'intake) n'y tirent pas : la suite
  // sous-testait la vraie pile. Désormais un fil principal haiku (relais mécanique bon marché)
  // SPAWNE le vrai sous-agent — même chemin que l'usage réel de la factory — et recopie sa
  // réponse verbatim pour les graders. Le modèle du sous-agent vient de son frontmatter.
  // Le prompt passe par STDIN, jamais en argument : avec `shell: true` (nécessaire pour
  // résoudre le shim claude.cmd sous Windows), Node ne quote pas les args — un prompt avec
  // espaces serait tronqué au premier mot (bug attrapé au premier run de la suite).
  const wrapper =
    `Lance le sous-agent « ${s.agent} » via l'outil Agent avec EXACTEMENT ce brief, sans le reformuler :\n` +
    `---\n${s.prompt}\n---\n` +
    `Quand il a terminé, recopie sa réponse finale INTÉGRALEMENT, mot pour mot, sans résumé ni commentaire.`;
  const run = spawnSync(
    "claude",
    ["-p", "--model", modelOverride ?? "haiku", "--max-turns", String(s.maxTurns)],
    { encoding: "utf8", input: wrapper, timeout: s.timeoutS * 1000, cwd: sandbox, env: childEnv, shell: true },
  );
  const out = (run.stdout ?? "") + (run.stderr ?? "");
  const secs = Math.round((Date.now() - t0) / 1000);
  // Un exit ≠ 0 avec sortie non vide (ex. plafond max-turns atteint) se NOTE quand même :
  // le plafond est notre borne de coût, pas un critère de comportement. Sortie vide = erreur.
  if (run.error || (run.status !== 0 && out.trim().length === 0)) {
    console.log(`  ✗ ERREUR d'exécution (${secs}s) : ${run.error?.message ?? `exit ${run.status}, sortie vide`}`);
    results.push({ id: s.id, pass: false, erreur: true, secs });
    continue;
  }
  if (run.status !== 0) console.log(`  ⚠ run coupé (exit ${run.status}) — notation sur la sortie partielle`);
  let pass = true;
  const graders = [];
  for (const g of s.must) {
    const ok = new RegExp(g.re, g.flags ?? "").test(out);
    graders.push({ type: "must", note: g.note, ok });
    if (!ok) pass = false;
    console.log(`  ${ok ? "✓" : "✗"} attendu : ${g.note}`);
  }
  for (const g of s.mustNot) {
    const ok = !new RegExp(g.re, g.flags ?? "").test(out);
    graders.push({ type: "mustNot", note: g.note, ok });
    if (!ok) pass = false;
    console.log(`  ${ok ? "✓" : "✗"} interdit : ${g.note}`);
  }
  console.log(`  → ${pass ? "PASS" : "FAIL"} (${secs}s, ${out.length} car.)`);
  if (!pass) console.log(`  extrait : ${out.slice(0, 400).replace(/\n/g, " ")}`);
  results.push({ id: s.id, pass, graders, secs });
}

const failed = results.filter((r) => !r.pass);
console.log(`\n═══ Bilan : ${results.length - failed.length}/${results.length} scénarios PASS ═══`);
if (doLog) {
  const line = JSON.stringify({ date: new Date().toISOString(), model: modelOverride ?? "réels", results });
  appendFileSync(resolve(repoRoot, "evals/journal.jsonl"), line + "\n", "utf8");
  console.log("Résultat consigné dans evals/journal.jsonl");
}
if (failed.length > 0) {
  console.error(`✗ Scénarios en échec : ${failed.map((f) => f.id).join(", ")}`);
  process.exit(1);
}
