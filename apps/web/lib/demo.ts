// Mode DÉMO — rejoue tout le parcours sans appeler Claude (donc sans crédit).
// Réutilise la vraie plomberie (runStore + SSE + dashboard) ; seules les sorties LLM
// sont remplacées par du contenu scripté + un faux streaming. Marche aussi en prod.

import { emit, type Plan, type Run } from "./runStore";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Exemple pré-rempli proposé sur /brief?demo=1
export const DEMO_BRIEF_PREFILL =
  "Je veux transformer une ancienne grange en tiers-lieu : un café associatif ouvert à tous " +
  "+ des espaces de coworking, dans un village rural. Je ne sais pas par où commencer " +
  "(statut juridique, budget, travaux, comment attirer du monde).";

type DemoQuestion = {
  id: string;
  text: string;
  type: "single" | "multi" | "open";
  options?: string[];
  allowFreeText?: boolean;
};

const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: "q1",
    text: "Quel statut juridique envisages-tu ?",
    type: "single",
    options: ["Association loi 1901", "SAS / société", "SCIC (coopérative)", "Je ne sais pas"],
    allowFreeText: true,
  },
  {
    id: "q2",
    text: "Quel budget global as-tu en tête ?",
    type: "single",
    options: ["< 50 k€", "50–150 k€", "150–400 k€", "> 400 k€", "À définir"],
  },
  {
    id: "q3",
    text: "Le bâtiment t'appartient-il ?",
    type: "single",
    options: ["Oui", "Location / bail", "À acheter", "En négociation"],
  },
  {
    id: "q4",
    text: "Quelles activités veux-tu prioriser ?",
    type: "multi",
    options: ["Café / restauration", "Coworking", "Événements culturels", "Ateliers", "Épicerie locale"],
    allowFreeText: true,
  },
];

const DEMO_NOTE = `## 1. Compte rendu du besoin
Tu veux faire d'une **ancienne grange** un **tiers-lieu rural** mêlant **café associatif** ouvert à tous
et **espaces de coworking**. Tu démarres de zéro sur le statut, le budget, les travaux et l'attractivité.

## 2. Ce que j'ai compris
- **Objectif** : créer un lieu de vie villageois — convivialité (café) + activité économique douce (coworking).
- **Bénéficiaires** : habitants, télétravailleurs, associations locales, de passage.
- **Dans le périmètre** : montage juridique, mise aux normes du bâtiment, modèle économique, lancement.
- **Hors périmètre (pour l'instant)** : recrutement détaillé, travaux d'exécution, programmation culturelle fine.

## 3. Schéma fonctionnel
\`\`\`mermaid
flowchart TD
  A[Porteur de projet] --> B[Structure porteuse<br/>asso / SCIC]
  B --> C[Café associatif]
  B --> D[Espaces coworking]
  C --> E[Habitants & adhérents]
  D --> F[Télétravailleurs]
  C --> G[Événements / ateliers]
  G --> E
\`\`\`

## 4. Début de solution
| Piste | Effort | Risque |
|---|---|---|
| Statut **association** + activité café | Faible | Faible |
| Mise aux normes **ERP** du bâtiment | Élevé | **Élevé** (bloquant) |
| Modèle mixte adhésions + consommations + coworking | Moyen | Moyen |

> Prochaine étape : valider cette note, puis **lancer l'équipe** pour produire le montage, les contraintes
> réglementaires, le business plan et le plan de lancement.`;

/** Réponse scriptée de l'API /api/brief en mode démo. */
export function demoBriefResponse(historyLen: number, force: boolean) {
  // 1er tour → questions ; ensuite (ou si on force) → note de cadrage.
  if (historyLen === 0 && !force) {
    return {
      reply:
        "Super projet — un tiers-lieu, ça touche au juridique, au bâtiment, au modèle éco et à l'animation. " +
        "Quelques questions pour bien cadrer avant de mobiliser l'équipe :",
      isNote: false,
      questions: DEMO_QUESTIONS,
      userEcho: "",
    };
  }
  return { reply: DEMO_NOTE, isNote: true, questions: null, userEcho: "" };
}

// ---- Maquette démo (/api/maquette?demo=1) ----
// Sert à tester le rendu MockupFrame (sandbox, CSP, itération) sans crédit ni clé.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** HTML de démo, autonome et sans script — mêmes contraintes que le vrai factory-maquettiste.
 * `feedback` (fourni en itération) est visiblement intégré, pour prouver que la régénération
 * "prend" bien le retour (même en mode démo, sans appeler Claude). */
export function demoMaquetteHtml(seed: string, feedback?: string): string {
  const accent = feedback && /vert/i.test(feedback) ? "#16a34a" : "#4f46e5";
  const note = feedback
    ? `<p class="note">🎨 Retour intégré : ${escapeHtml(feedback)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Maquette (démo)</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: #1e293b; background: #fff; }
  header { background: linear-gradient(135deg, ${accent}, #7c3aed); color: #fff; padding: 3.2rem 2rem; text-align: center; }
  header h1 { margin: 0 0 0.6rem; font-size: 2rem; letter-spacing: -0.02em; }
  header p { margin: 0; opacity: 0.92; max-width: 34rem; margin-inline: auto; }
  main { padding: 2.2rem; max-width: 800px; margin: 0 auto; }
  h2 { font-size: 1.3rem; margin-bottom: 1rem; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.1rem; }
  .card h3 { margin: 0 0 0.4rem; font-size: 1rem; }
  .card p { margin: 0; font-size: 0.9rem; color: #475569; }
  .note { margin-top: 1.8rem; padding: 0.65rem 1rem; background: #fef3c7; border-radius: 8px; font-size: 0.85rem; }
  footer { text-align: center; padding: 1.6rem; color: #64748b; font-size: 0.82rem; border-top: 1px solid #e2e8f0; margin-top: 2rem; }
</style>
</head>
<body>
<header>
  <h1>Votre activité, une vitrine claire</h1>
  <p>${escapeHtml(seed).slice(0, 200) || "Maquette générée automatiquement (mode démo)"}</p>
</header>
<main>
  <h2>Ce que nous proposons</h2>
  <div class="grid">
    <div class="card"><h3>Un premier service</h3><p>Description concrète de l'offre principale, avec ses bénéfices.</p></div>
    <div class="card"><h3>Un second service</h3><p>Une deuxième prestation, complémentaire de la première.</p></div>
    <div class="card"><h3>Contact</h3><p>Coordonnées ou formulaire pour être recontacté rapidement.</p></div>
  </div>
  ${note}
</main>
<footer>Maquette de démonstration — Cleveria</footer>
</body>
</html>`;
}

// ---- Run démo (orchestration simulée) ----

export const DEMO_PLAN: Plan = {
  summary:
    "Sécuriser le cadre (montage + normes) puis prouver la viabilité (BP) et préparer le lancement.",
  steps: [
    { id: "s1", agent: "factory-architecte", title: "Montage juridique & structuration", task: "", dependsOn: [] },
    { id: "s2", agent: "factory-expert-conformite", title: "Contraintes ERP, sécurité & accessibilité", task: "", dependsOn: [] },
    { id: "s3", agent: "factory-finance", title: "Business plan simplifié & point mort", task: "", dependsOn: ["s1"] },
    { id: "s4", agent: "factory-marketing", title: "Positionnement & plan de lancement", task: "", dependsOn: ["s1"] },
  ],
};

const DEMO_OUTPUTS: Record<string, string> = {
  s1: `### Montage proposé
- **Structure porteuse** : **association loi 1901** pour démarrer (création rapide, gouvernance ouverte, éligible aux subventions). Bascule possible en **SCIC** en V2 si l'activité économique grossit.
- **Bâtiment** : porté via un **bail emphytéotique** ou une mise à disposition par la commune → on évite d'immobiliser la trésorerie de l'asso dans le foncier.
- **Café** : régime de **buvette associative** au lancement, puis licence si la restauration se développe.

### Flux
\`\`\`mermaid
flowchart LR
  Commune -- bail --> Asso
  Adherents -- cotisations --> Asso
  Clients -- consommations --> Asso
  Coworkers -- abonnements --> Asso
  Asso -- emploie --> Salarie
\`\`\`

> ⚠️ À faire valider par un avocat : régime de la buvette et seuils de la licence.`,
  s2: `### Le point bloquant : c'est un **ERP**
Un lieu accueillant du public = **Établissement Recevant du Public**, catégorie 5 probable (petit effectif).
Obligations à anticiper **avant ouverture** :
- **Sécurité incendie** : issues de secours, désenfumage, extincteurs, alarme.
- **Accessibilité PMR** : entrée de plain-pied ou rampe, sanitaire adapté, cheminement.
- **Passage de la commission de sécurité** avant ouverture au public.

### Recommandation
Faire chiffrer un **diagnostic ERP** par un bureau de contrôle **dès maintenant** : c'est le poste qui peut
faire dérailler le budget et le calendrier. Ne rien engager en travaux avant ce diagnostic.`,
  s3: `### Hypothèses (an 1, prudentes)
| Poste | Montant |
|---|---|
| Adhésions (250 × 15 €) | 3 750 € |
| Café (40 j/sem × 45 sem) | 36 000 € |
| Coworking (8 postes × 70 €/mois) | 6 720 € |
| Subventions / mécénat | 15 000 € |
| **Total recettes** | **≈ 61 k€** |

| Charges | Montant |
|---|---|
| 1 salarié (temps plein, chargé) | 32 000 € |
| Achats café & consommables | 14 000 € |
| Énergie, assurances, divers | 9 000 € |
| **Total charges** | **≈ 55 k€** |

### Lecture
**Point mort atteignable en année 1** à condition de tenir la fréquentation café et de décrocher
~15 k€ de financements. Le poste **travaux ERP** (cf. conformité) reste à intégrer en investissement,
financé par subventions/dons, pas par l'exploitation.`,
  s4: `### Positionnement
**« Le salon du village »** — un lieu où l'on vient pour le café et où l'on reste pour travailler,
se rencontrer, monter des projets. Chaleureux, local, ouvert.

### Plan de lancement (90 jours)
1. **Avant ouverture** : page Instagram + liste d'attente, 3 "cafés-tests" chez des partenaires.
2. **Ouverture** : week-end inaugural gratuit, presse locale, mot du maire.
3. **Fidélisation** : carte d'adhérent, "matinées coworking" hebdo, un événement culturel/mois.

### Premiers canaux
Bouche-à-oreille villageois, mairie & assos locales, groupes Facebook du territoire, télétravailleurs
des communes voisines.`,
};

const DEMO_SYNTHESIS = `## Synthèse — ton tiers-lieu, prêt à être instruit

L'équipe a transformé ton idée en un dossier cohérent et actionnable.

**Ce qui a été produit**
- **Montage** : asso loi 1901 + bail communal → simple, rapide, finançable (→ détail dans la carte Architecte).
- **Conformité** : le sujet **ERP** (sécurité incendie + accessibilité) est le **point critique** à chiffrer en premier.
- **Finance** : un BP qui **atteint le point mort en année 1** sous conditions de fréquentation et ~15 k€ de financements.
- **Marketing** : un positionnement « le salon du village » et un plan de lancement sur 90 jours.

**Comment les pièces s'articulent**
Le statut conditionne le financement ; les **travaux ERP** sont l'investissement à sécuriser **avant** tout
le reste ; l'exploitation (café + coworking) finance le fonctionnement courant.

**Points de vigilance**
1. **Ne rien engager en travaux** avant le diagnostic ERP.
2. Faire valider le régime buvette/licence par un avocat.
3. Le BP tient si la fréquentation café est au rendez-vous — à tester avant.

**Prochaines étapes recommandées**
1. Commander le **diagnostic ERP** (bureau de contrôle).
2. Déposer les **statuts de l'association**.
3. Rencontrer la **mairie** pour le bail.
4. Lancer la **liste d'attente** pour pré-tester la demande.`;

/** Émet un texte par fragments pour simuler le streaming d'un agent. */
async function streamInto(run: Run, kind: "step" | "synthesis", id: string, full: string) {
  const words = full.split(/(\s+)/); // garde les espaces
  let buf = "";
  for (let i = 0; i < words.length; i++) {
    buf += words[i];
    // pousse par paquets de ~4 tokens
    if (i % 4 === 3 || i === words.length - 1) {
      if (kind === "step") emit(run, { type: "step.delta", id, text: buf });
      else emit(run, { type: "synthesis.delta", text: buf });
      buf = "";
      await sleep(28);
    }
  }
}

async function demoStep(run: Run, id: string) {
  emit(run, { type: "step.status", id, status: "running" });
  await sleep(350);
  await streamInto(run, "step", id, DEMO_OUTPUTS[id]);
  emit(run, { type: "step.output", id, output: DEMO_OUTPUTS[id] });
  emit(run, { type: "step.status", id, status: "done" });
}

/** Orchestration scriptée : même séquence d'événements que la vraie, en plus court. À lancer SANS await. */
export async function demoOrchestrate(run: Run): Promise<void> {
  try {
    emit(run, { type: "run.status", status: "planning" });
    await sleep(900);
    emit(run, {
      type: "planned",
      plan: DEMO_PLAN,
      steps: DEMO_PLAN.steps.map((step) => ({
        step,
        status: "pending" as const,
        agentLabel: step.agent.replace(/^factory-/, ""),
      })),
    });
    emit(run, { type: "run.status", status: "running" });

    // Même garde que l'orchestrateur réel : avant chaque vague / la synthèse, on vérifie que
    // l'utilisateur n'a pas arrêté le run entretemps (bouton "Arrêter le travail").
    if (run.cancelled) return;
    // Vague 1 (parallèle) : montage + conformité (sans dépendances).
    await Promise.all([demoStep(run, "s1"), demoStep(run, "s2")]);
    if (run.cancelled) return;
    // Vague 2 (parallèle) : finance + marketing (dépendent du montage).
    await Promise.all([demoStep(run, "s3"), demoStep(run, "s4")]);

    if (run.cancelled) return;
    await sleep(300);
    if (run.cancelled) return;
    await streamInto(run, "synthesis", "", DEMO_SYNTHESIS);
    if (run.cancelled) return; // ne pas émettre la synthèse ni écraser le statut "cancelled"
    emit(run, { type: "synthesis", output: DEMO_SYNTHESIS });
    emit(run, { type: "run.status", status: "done" });
  } catch {
    if (run.cancelled) return; // ne jamais écraser "cancelled" par "error"
    emit(run, { type: "run.status", status: "error", error: "Erreur en mode démo." });
  }
}
