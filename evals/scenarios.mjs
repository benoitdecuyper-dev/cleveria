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
    id: "s8-ux-revue-capture",
    symptome:
      "La revue UX laisse passer les défauts visuels — Benoit fait 15 retours à faible valeur par refonte (classes réelles : alignement, bouton trop petit, couleur sémantique cassée, contraste, contenu résiduel)",
    agent: "factory-ux-ui",
    model: "sonnet",
    maxTurns: 8,
    timeoutS: 420,
    prompt:
      "Revue du rendu réel : LIS la capture C:/Users/Ben/cleveria/evals/fixtures/capture-defauts.png (outil Read). Fiche d'intake déjà tranchée : QUI = acheteur professionnel [réponse-utilisateur] ; appareil = bureau 1200px [réponse-utilisateur] ; surface = catalogue client externe [réponse-utilisateur]. La maquette validée prévoyait : un header avec le logo seul (le logo porte déjà le nom de la marque), une accroche factuelle sans promesse, un vocabulaire client (« certificat d'analyse », « analyses labo », « DDM »), une description alignée sous son titre, un bouton « Demander un devis » primaire et proéminent, un CTA « Voir le catalogue » au texte lisible, un badge Bio VERT (sémantique), un prix parfaitement lisible, aucun contenu de test. Contrainte projet : aucune allégation de santé (réglementation). Rends ta revue : verdict par item de la checklist rendu (process/checklist-rendu-ux.md), chaque FAIL localisé précisément.",
    must: [
      { re: "FAIL", note: "des FAIL sont rendus (l'écran a 9 défauts plantés)" },
      { re: "align|désalign", flags: "i", note: "le texte désaligné de son titre est vu" },
      { re: "bouton|devis", flags: "i", note: "le bouton d'action minuscule est vu" },
      { re: "bio", flags: "i", note: "le badge Bio gris (couleur sémantique cassée) est vu" },
      { re: "contraste|lisib", flags: "i", note: "les contrastes illisibles (prix, texte du CTA) sont vus" },
      { re: "HPLC|CoA|DLUO|jargon", flags: "i", note: "le jargon interne (CoA/HPLC/DLUO) est vu" },
      { re: "santé|allégation", flags: "i", note: "l'allégation santé interdite est vue" },
      { re: "redondan|doublon|deux fois|doublé", flags: "i", note: "la marque doublée logo+texte est vue" },
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
    id: "s9-leadtech-code-mort",
    symptome: "La revue laisse le code mort s'accumuler jusqu'à la rétro (règle du 18/07 : le mort se supprime dans le même lot)",
    agent: "factory-lead-tech",
    model: "sonnet",
    maxTurns: 6,
    timeoutS: 360,
    prompt:
      "Revue de ce diff (résumé fidèle) : la fonction renderCatalog() remplace renderOldCatalog() dans public/js/catalogue.js — mais renderOldCatalog() reste définie (80 lignes, plus aucun appelant) ; le bloc CSS .old-card / .old-card__badge n'est plus référencé par aucun HTML/JS ; le fichier public/js/catalogue-v1.js n'est plus chargé par aucune page. Les tests passent, le nouveau rendu fonctionne. Verdict de revue ?",
    must: [
      { re: "mort|orphelin|inutilis|plus (appelée|référencé|chargé)", flags: "i", note: "le code mort est identifié comme tel" },
      { re: "supprim", flags: "i", note: "la suppression est exigée (pas « on verra plus tard »)" },
      { re: "renderOldCatalog", note: "le symbole mort précis est nommé" },
      { re: "même lot|avant (de valider|livraison)|bloquant|ce lot", flags: "i", note: "la suppression est exigée dans CE lot, pas remise à la rétro" },
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
  {
    id: "s10-qa-recette-rendu",
    symptome: "Une modif UI est déclarée recettée sur un PROXY (compte d'éléments / absence d'erreur console) au lieu du rendu réel — un défaut de mise en page (grille cassée) passe en prod (incident catalogue Sporae, 2026-07-18).",
    agent: "factory-qa",
    model: "sonnet",
    maxTurns: 3,
    timeoutS: 360,
    prompt:
      "Un développeur a ajouté un bandeau au-dessus d'une liste de produits, sur une page dont la mise en page est une grille CSS (colonne de filtres à gauche, grille de produits à droite). Il dit : « c'est bon, la bonne quantité de cartes s'affiche et il n'y a aucune erreur console. » Rédige ton PLAN de recette de cette modification avant mise en production : que vérifies-tu exactement, et comment ? (décris-le, ne l'exécute pas.)",
    must: [
      { re: "rendu|navigateur|capture|visuel|à l'écran", flags: "i", note: "la recette observe le RENDU réel, pas le proxy annoncé" },
      { re: "mise en page|layout|grille|colonne|aligne|déborde|wrap|chevauch|décal", flags: "i", note: "la recette contrôle la MISE EN PAGE (surface du défaut)" },
      { re: "mobile|responsive|petit écran|360|375", flags: "i", note: "la recette couvre le responsive" },
    ],
    mustNot: [
      { re: "(recette|c'est)\\s*(verte|ok|bon|validé)[^\\n.]{0,60}(compt|nombre|quantité|erreur console)", flags: "i", note: "ne valide pas sur le seul proxy (compte / console)" },
    ],
  },
];
