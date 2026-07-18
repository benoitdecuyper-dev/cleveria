// Hook SubagentStop — garde-fou « bloc TRIAGE » du chef de projet (étape 3 du parcours,
// cf. docs/31-notions-methode-ia.md fiches 6-7).
//
// Règle mécanisée : un sous-agent factory-chef-de-projet ne peut pas terminer sans avoir
// rendu son bloc TRIAGE (profondeur / signaux / décision / questions). L'A/B de l'étape 2
// a montré que la consigne en prompt reste probabiliste, même courte : ici elle devient un
// mécanisme qui échoue — exit 2 renvoie le message au sous-agent, qui doit se conformer
// avant de pouvoir terminer.
//
// Anti-boucle : `stop_hook_active` est vrai quand l'agent a déjà été relancé par ce hook —
// on laisse alors passer (UN rappel forcé, jamais une boucle infinie). Branché dans
// ~/.claude/settings.json (hooks.SubagentStop). Test d'existence joué le 2026-07-18 :
// réponse sans TRIAGE → bloquée puis conformée ; réponse avec TRIAGE → passe en silence.

import { readFileSync } from "node:fs";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // payload illisible → ne jamais bloquer un agent sur un bug du garde-fou
}

const msg = input.last_assistant_message ?? "";

// Gate TRIAGE — chef de projet : pas de fin de tour sans bloc TRIAGE.
if (input.agent_type === "factory-chef-de-projet") {
  const triageRendu = /TRIAGE/.test(msg) && /profondeur/i.test(msg) && /d[ée]cision/i.test(msg);
  if (triageRendu || input.stop_hook_active) process.exit(0);
  console.error(
    "Gate TRIAGE : ta réponse finale ne contient pas le bloc TRIAGE exigé par ton identité " +
      "(profondeur / signaux / décision / questions). Rends le bloc TRIAGE en tête de ta réponse " +
      "finale, puis termine.",
  );
  process.exit(2);
}

// Gate fiche d'intake — UX : pas de fin de tour sans la fiche à champs étiquetés
// (constat éval s3 du 2026-07-18 : sonnet applique la règle dure mais oublie les étiquettes).
if (input.agent_type === "factory-ux-ui") {
  const ficheRendue = /fiche d'intake/i.test(msg) && /\[(hypothèse|réponse-utilisateur|mémoire)/i.test(msg);
  if (ficheRendue || input.stop_hook_active) process.exit(0);
  console.error(
    "Gate fiche d'intake : ta réponse finale ne contient pas la Fiche d'intake à champs étiquetés " +
      "[réponse-utilisateur] / [mémoire: source] / [hypothèse] exigée en tête de tout livrable UX. " +
      "Rends la fiche (les 6 champs, chacun étiqueté), puis termine.",
  );
  process.exit(2);
}

process.exit(0);
