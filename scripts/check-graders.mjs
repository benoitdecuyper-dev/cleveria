#!/usr/bin/env node
/**
 * Filet anti « canary cassé » (rétro 2026-07-18).
 * Un scénario « etendu » est anonymisé (projet/personne réels → fictifs : Sporae →
 * Mycelia, Emmanuelle → Claire). Le bug qui l'a motivé : le BRIEF est anonymisé
 * mais un GRADER garde EN DUR l'ancien nom réel. Le canary devient doublement
 * faux — il échoue la bonne réponse (« Claude pour Mycelia ») ET passerait au vert
 * une mauvaise (« Claude pour Sporae » halluciné). Un canary qui ne peut pas
 * devenir vert honnêtement n'est pas un garde-fou, c'est un vœu rouge.
 *
 * Règle vérifiée : aucun NOM RÉEL (liste ci-dessous) ne doit apparaître dans un
 * grader s'il est ABSENT du brief de ce scénario. Un scénario « noyau » qui parle
 * vraiment de Sporae a « Sporae » dans son brief → non signalé ; un scénario
 * anonymisé qui l'a laissé fuiter dans un grader → signalé.
 *
 * ÉCHOUE (exit 1) au moindre drift : mécanisme, pas rappel. Câblé en pré-vol de
 * `npm run evals` (run-evals.mjs) — la suite refuse de tourner avec un grader dérivé.
 * ⚠️ Tenir REELS à jour quand un projet/personne réel entre dans les briefs.
 */
import { SCENARIOS } from "../evals/scenarios.mjs";

const REELS = ["Sporae", "Emmanuelle", "Lumignis", "Billy", "Cleveria", "Wikifluence", "IApluK"];

const problems = [];
for (const s of SCENARIOS) {
  const brief = `${s.prompt || ""} ${s.symptome || ""}`.toLowerCase();
  for (const g of [...(s.must || []), ...(s.mustNot || [])]) {
    const re = String(g.re || "");
    for (const name of REELS) {
      if (new RegExp(name, "i").test(re) && !brief.includes(name.toLowerCase())) {
        problems.push({ id: s.id, name, re });
      }
    }
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} grader(s) référencent un nom réel absent de leur brief (grader resté en dur après anonymisation ?) :`);
  for (const p of problems) console.error(`  ${p.id} : « ${p.name} » dans /${p.re}/`);
  console.error("→ Anonymise le grader EN MÊME TEMPS que le brief.");
  process.exit(1);
}
console.log(`✓ ${SCENARIOS.length} scénarios : aucun grader ne laisse fuiter un nom réel absent de son brief.`);
