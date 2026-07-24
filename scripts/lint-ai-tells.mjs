// Linter « tells IA » — détecte, dans un livrable AVANT envoi à un tiers, les marqueurs qui
// trahissent une rédaction par le modèle (tirets cadratins en prose, formules signature) et le
// remplissage qui crame des tokens sans servir le lecteur (préambules, formules de politesse,
// méta-narration). C'est le MÉCANISME des deux règles « Voix humaine » et « Économie du livrable »
// de PRINCIPES-AGENTS.md (Partie 1) : un garde-fou qui ÉCHOUE, pas une phrase qui prévient.
//
//   node scripts/lint-ai-tells.mjs <fichier.md|.txt>   # lint un livrable ; exit 1 si tells trouvés
//   cat livrable.md | node scripts/lint-ai-tells.mjs -  # lint stdin
//   node scripts/lint-ai-tells.mjs --selftest           # canary rouge→vert (déterministe, 0 API)
//
// PORTÉE : outil à passer sur un DÉLIVRABLE destiné à un tiers (mail, dossier, page, note externe).
// PAS un gate repo-wide : le tiret cadratin est légitime en typo FR interne et dans le code — ce
// linter juge un texte qu'on s'apprête à ENVOYER, où le tell décrédibilise. Le juge est le rédacteur ;
// le linter lui rend une liste localisée, il tranche au cas par cas (un `—` dans une citation reste
// un `—`). Zéro modèle, zéro réseau : regex objectives, comme les graders d'evals.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// —————————————————————————————————————————————————————————————————————————————
// Règles. Chaque règle = { id, note, re }. `re` porte le flag global : on compte les occurrences.
// Précision > rappel : on ne grave que des motifs à très faible taux de faux positifs dans un
// livrable soigné. Un tell douteux non listé vaut mieux qu'un linter qu'on finit par ignorer.
// —————————————————————————————————————————————————————————————————————————————

const TELLS_LEXICAUX = [
  { id: "tiret-cadratin", note: "tiret cadratin/demi-cadratin en prose → virgule, parenthèse ou deux-points (retour récurrent de Benoit : signature IA la plus voyante)", re: /[—–]/g },
  { id: "pas-seulement-mais", note: "« il ne s'agit pas seulement de … mais de … » — balancement signature", re: /ne s'?agit pas seulement|n'est pas seulement[^.]{0,60}c'est|non seulement[^.]{0,60}mais aussi/gi },
  { id: "il-est-important", note: "« il est important/essentiel de noter/souligner » — méta vide", re: /il (est|convient) (important|essentiel|utile|crucial|intéressant) de (noter|souligner|rappeler|préciser|mentionner)|il convient de noter/gi },
  { id: "en-resume", note: "« en résumé / en conclusion / pour résumer » en tête de bloc — récap souvent redondant", re: /(^|\n)\s*(en résumé|en conclusion|pour résumer|pour conclure)\b/gi },
  { id: "nhesitez-pas", note: "« n'hésitez pas à … » — politesse de remplissage", re: /n'?hésit(ez|e) pas (à|si)/gi },
  { id: "jespere-que", note: "« j'espère que cela vous aide / répond à … » — clôture creuse", re: /j'?espère que (cela|ceci|ça)/gi },
  { id: "plongeons", note: "« plongeons dans / plongée dans / explorons » — accroche modèle", re: /plonge(ons|z|r) dans|plongée dans|explorons ensemble/gi },
  { id: "a-l-ere", note: "« à l'ère de / dans le paysage de / dans un monde où » — décor grandiloquent", re: /à l'?ère (du|de la|de l'|des)|dans le paysage (du|de la|des)|dans un monde où/gi },
  { id: "force-de-constater", note: "« force est de constater » — tic rhétorique", re: /force est de constater/gi },
  // Tells anglophones (livrables EN) — sous-ensemble à haute précision.
  { id: "en-delve", note: "EN: « delve / in the realm of / a testament to / navigating the » — tells GPT classiques", re: /\bdelve\b|in the realm of|a testament to|navigating the|in today's (fast-paced|digital)/gi },
  { id: "en-worth-noting", note: "EN: « it's worth noting / it is important to note »", re: /it'?s worth noting|it is (important|worth) to note/gi },
];

const REMPLISSAGE = [
  { id: "meta-je-vais", note: "« je vais maintenant / dans cette réponse, je … » — méta-narration : fais, ne raconte pas que tu vas faire", re: /je vais (maintenant|vous|te|d'?abord|ensuite)|dans cette réponse,?\s+je|commençons par|avant tout,? (laisse|permet)/gi },
  { id: "flatterie-ouverture", note: "« excellente/bonne question, bien sûr !, absolument ! » — ouverture flatteuse jetable", re: /(^|\n)\s*(excellente|bonne|très bonne) question|(^|\n)\s*(bien sûr|absolument|tout à fait|avec plaisir)\s*[!.]/gi },
  { id: "recap-voici-ce-que", note: "« voici ce que j'ai fait / un récapitulatif de ce qui précède » — récap de ce que le lecteur vient de lire", re: /voici (ce que j'?ai fait|un (récapitulatif|résumé) de|un aperçu de ce qui)|comme (mentionné|indiqué|dit) (précédemment|plus haut|ci-dessus)/gi },
  { id: "disclaimer-remplissage", note: "disclaimer de remplissage (« il est à noter que je ne suis qu'une IA », « note honnête : ») hors désaccord réel", re: /note honnête\s*:|en toute (honnêteté|transparence),|je (tiens|voudrais) à (préciser|souligner) que je/gi },
];

const ALL = [...TELLS_LEXICAUX, ...REMPLISSAGE];

function lint(text) {
  const findings = [];
  for (const rule of ALL) {
    const matches = [...text.matchAll(rule.re)];
    if (matches.length === 0) continue;
    // localisation : n° de ligne de la 1re occurrence + total
    const idx = matches[0].index ?? 0;
    const line = text.slice(0, idx).split("\n").length;
    findings.push({ id: rule.id, note: rule.note, count: matches.length, line, sample: matches[0][0].slice(0, 40) });
  }
  return findings;
}

function render(findings) {
  if (findings.length === 0) return "✓ Aucun tell IA / remplissage détecté.";
  const lines = findings
    .sort((a, b) => b.count - a.count)
    .map((f) => `  ✗ [${f.id}] ×${f.count} (1re occ. l.${f.line} « ${f.sample.trim()} »)\n      → ${f.note}`);
  return `${findings.reduce((n, f) => n + f.count, 0)} occurrence(s) de tell/remplissage :\n` + lines.join("\n");
}

// —————————————————————————————————————————————————————————————————————————————
// Canary rouge→vert (déterministe, sans API) : prouve que le linter mord le rouge et passe le vert.
// —————————————————————————————————————————————————————————————————————————————
function selftest() {
  const red = readFileSync(resolve(repoRoot, "evals/fixtures/ai-tells-red.md"), "utf8");
  const green = readFileSync(resolve(repoRoot, "evals/fixtures/ai-tells-green.md"), "utf8");
  const fRed = lint(red);
  const fGreen = lint(green);
  const okRed = fRed.length > 0;
  const okGreen = fGreen.length === 0;
  console.log(`ROUGE  (ai-tells-red.md)   : ${fRed.length} tell(s) → attendu >0  → ${okRed ? "OK" : "ÉCHEC"}`);
  console.log(`VERT   (ai-tells-green.md) : ${fGreen.length} tell(s) → attendu 0   → ${okGreen ? "OK" : "ÉCHEC"}`);
  if (!okGreen) console.log("  Détail vert (faux positifs à corriger) :\n" + render(fGreen));
  if (okRed && okGreen) {
    console.log("✓ Canary rouge→vert prouvé.");
    process.exit(0);
  }
  console.error("✗ Canary cassé : le linter ne distingue pas rouge et vert.");
  process.exit(1);
}

// —————————————————————————————————————————————————————————————————————————————

const arg = process.argv[2];
if (arg === "--selftest") {
  selftest();
} else if (!arg) {
  console.error("Usage : node scripts/lint-ai-tells.mjs <fichier> | - (stdin) | --selftest");
  process.exit(2);
} else {
  const text = arg === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(arg), "utf8");
  const findings = lint(text);
  console.log(render(findings));
  process.exit(findings.length > 0 ? 1 : 0);
}
