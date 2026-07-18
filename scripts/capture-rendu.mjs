// Capture du rendu réel d'un écran — les « yeux » de la revue UX (gate §5 de cdp-methode).
//
//   node scripts/capture-rendu.mjs --url <http://…|file:///…> --out <capture.png>
//        [--viewport 1440x900] [--full] [--attendre 800]
//
// Une revue UX sans capture regarde du code, pas des pixels : un texte désaligné, un bouton
// d'action trop petit, une hiérarchie cassée ne se voient QUE sur le rendu. La capture est
// l'artefact d'entrée obligatoire de la revue (checklist : process/checklist-rendu-ux.md) —
// l'agent UX la LIT (outil Read sur le PNG) et rend un verdict par item.
//
// Utilise le Chromium embarqué de Playwright (jamais le Chrome personnel de l'utilisateur).

import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const url = opt("--url");
const out = opt("--out");
const [w, h] = (opt("--viewport", "1440x900")).split("x").map(Number);
const attendre = Number(opt("--attendre", "800"));

if (!url || !out) {
  console.error("Usage : --url <adresse> --out <capture.png> [--viewport 1440x900] [--full] [--attendre ms]");
  process.exit(1);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(attendre); // animations/fonts — un canal d'observation doit se produire
  await page.screenshot({ path: out, fullPage: args.includes("--full") });
  console.log(`Capture ${w}x${h}${args.includes("--full") ? " (pleine page)" : ""} → ${out}`);
} finally {
  await browser.close();
}
