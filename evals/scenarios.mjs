// Les 6 symptômes fondateurs de l'audit méthode (2026-07-18) convertis en scénarios d'évals
// rejouables — cf. docs/31-notions-methode-ia.md fiche 12. Chaque scénario rejoue un échec RÉEL
// observé par Benoit, avec des graders code (regex objectives) : pas de juge, pas d'opinion.
//
// Convention graders : `must` = motifs qui DOIVENT apparaître dans la réponse de l'agent ;
// `mustNot` = motifs interdits (signature d'une production faite au lieu d'être demandée).
// Modèles = ceux de l'usage réel (frontmatter des agents) ; `--model` du runner permet un
// smoke-run économique.

export const SCENARIOS = [
  {
    id: "s1-cdp-mobilise",
    symptome: "Le bras droit fait le travail lui-même au lieu de mobiliser l'équipe",
    agent: "factory-chef-de-projet",
    model: "opus",
    maxTurns: 12,
    timeoutS: 540,
    prompt:
      "Ajoute la gestion des devis dans Sporae : un client pro demande un devis, Emmanuelle le prépare, il peut devenir une commande. Vas-y.",
    must: [
      { re: "TRIAGE", note: "le bloc TRIAGE est rendu" },
      { re: "profondeur\\s*:", flags: "i", note: "champ profondeur présent" },
      { re: "mobilise|équipe", flags: "i", note: "décision de mobiliser l'équipe" },
      { re: "cadrage|CADRAGE", note: "passe par le cadrage avant de produire" },
    ],
    mustNot: [
      { re: "```(html|css|jsx?|tsx?|sql)", flags: "i", note: "aucun code produit en direct" },
    ],
  },
  {
    id: "s2-cdp-questionne",
    symptome: "Le bras droit ne pose presque jamais de questions de cadrage",
    agent: "factory-chef-de-projet",
    model: "opus",
    maxTurns: 12,
    timeoutS: 540,
    prompt: "Il nous faudrait un tableau de bord pour suivre l'activité. Fais avancer le sujet.",
    must: [
      { re: "TRIAGE", note: "le bloc TRIAGE est rendu" },
      { re: "\\?", note: "au moins une vraie question posée" },
      { re: "bloquant|questions\\s*:", flags: "i", note: "les questions sont marquées comme telles" },
    ],
    mustNot: [
      { re: "```(html|css|jsx?|tsx?|sql)", flags: "i", note: "pas de dashboard inventé sur hypothèses" },
    ],
  },
  {
    id: "s3-ux-intake",
    symptome: "L'UX ne demande jamais pour qui est l'outil (traitement générique)",
    agent: "factory-ux-ui",
    model: "sonnet",
    maxTurns: 8,
    timeoutS: 360,
    prompt: "Dessine-moi l'écran principal d'un outil de gestion pour une association.",
    must: [
      { re: "Fiche d'intake", flags: "i", note: "la fiche d'intake ouvre le livrable" },
      { re: "\\[hypothèse\\]", note: "les inconnues sont étiquetées [hypothèse]" },
      { re: "\\?", note: "des questions sont posées" },
    ],
    mustNot: [
      { re: "```(html|css)", flags: "i", note: "pas de maquette produite sur triple hypothèse" },
    ],
  },
  {
    id: "s4-cdp-maquette-avant-code",
    symptome: "Les maquettes sont sautées ou bâclées avant le dev",
    agent: "factory-chef-de-projet",
    model: "opus",
    maxTurns: 12,
    timeoutS: 540,
    prompt:
      "Code-moi directement l'écran de suivi des adhésions en HTML, on verra le design après. C'est pour un nouveau petit projet associatif.",
    must: [
      { re: "maquette", flags: "i", note: "exige la maquette / le cadrage UX avant le code" },
    ],
    mustNot: [
      { re: "```html", flags: "i", note: "ne code pas l'écran en direct malgré l'injonction" },
    ],
  },
  {
    id: "s5-orchestrateur-sweep",
    symptome: "Le périmètre adjacent n'est pas rebalayé lors d'une refonte (bouton orphelin)",
    agent: "factory-orchestrateur",
    model: "sonnet",
    maxTurns: 6,
    timeoutS: 600,
    prompt:
      "Établis le plan de travail pour le ticket SPO-42, tagué refonte-de-parcours : refonte complète du parcours de commande côté client pro. Cadrage validé, GO donné.",
    must: [
      { re: "sweep", flags: "i", note: "l'étape sweep adjacent est dans le plan" },
      { re: "SWEEP-", note: "l'artefact SWEEP-<ticket> est nommé" },
      { re: "qa", flags: "i", note: "le sweep est relié à la recette" },
    ],
    mustNot: [],
  },
  {
    id: "s7-formateur-schema",
    symptome: "Le formateur explique un flux en texte seul au lieu de schématiser (règle du 18/07)",
    agent: "factory-formateur",
    model: "opus",
    maxTurns: 8,
    timeoutS: 420,
    prompt:
      "Explique-moi comment une demande complexe traverse la factory Cleveria, du brief à la livraison.",
    must: [
      { re: "mermaid|flowchart|──|→", flags: "i", note: "un schéma est produit (Mermaid ou ASCII), pas seulement du texte" },
    ],
    mustNot: [],
  },
  {
    id: "s6-po-absence",
    symptome: "Personne ne détecte qu'un workflow attendu N'EXISTE PAS (défaut d'absence)",
    agent: "factory-product-owner",
    model: "sonnet",
    maxTurns: 6,
    timeoutS: 300,
    prompt:
      "Construis le backlog d'un petit CRM : on doit pouvoir consulter, modifier et lister les clients, avec un fil d'échanges par client.",
    must: [
      { re: "cr[ée]er|création", flags: "i", note: "l'absence du « créer » est repérée" },
      { re: "matrice|MODELE-FONCTIONNEL|cycle de vie", flags: "i", note: "le modèle fonctionnel est convoqué" },
    ],
    mustNot: [],
  },
];
