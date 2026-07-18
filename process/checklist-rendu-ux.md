# Checklist de revue du rendu UX — verdict par item, sur CAPTURE réelle

> **Intrants obligatoires** : (1) la capture du rendu réel (`scripts/capture-rendu.mjs`, au
> viewport de l'appareil prioritaire de la fiche d'intake), lue par l'agent UX ; (2) la maquette
> validée, à comparer côte à côte. Pas de capture = pas de revue = gate rouge.
> Chaque item reçoit **PASS / FAIL / N/A(raison)** — un item sans verdict invalide la revue.
> Sources des standards : heuristiques NN/g (visibilité, cohérence, prévention d'erreur),
> WCAG 2.x AA (contraste), loi de Fitts (taille des cibles).

| # | Item | Ce qu'on regarde sur la capture |
|---|---|---|
| 1 | **Fidélité à la maquette validée** | Structure, blocs, ordre — tout écart est listé et justifié ou FAIL |
| 2 | **Alignements** | Titres/textes/champs sur les mêmes lignes de force ; pas de texte décalé de son titre |
| 3 | **Hiérarchie visuelle** | L'œil tombe d'abord sur l'essentiel ; tailles/graisses cohérentes avec l'importance |
| 4 | **Actions primaires proéminentes** | Le bouton important est GROS et visible (loi de Fitts) — un bouton critique ratable par l'utilisateur réel est un FAIL, pas un détail |
| 5 | **Contraste** | Texte et actions lisibles (repère WCAG AA ≈ 4.5:1 pour le texte courant) |
| 6 | **Densité conforme au registre** | Celle de la fiche d'intake (progiciel dense pour l'expert / aéré pour le grand public) — jamais l'inverse |
| 7 | **Tokens DA** | Couleurs et typos de l'écran ∈ palette actée du projet ; zéro teinte héritée d'ailleurs |
| 8 | **États non nominaux** | Vide, erreur, chargement : capturés ou explicitement N/A(hors périmètre du ticket) |
| 9 | **Viewport cible** | La capture est au format de l'appareil prioritaire ; rien de coupé/chevauché |

**Format du verdict** (en tête du livrable de revue) : tableau des 9 items + captures référencées
+ liste des FAIL avec localisation précise (« bouton Valider, ~24px de haut, sous la ligne de
flottaison ») → chaque FAIL retourne au dev, la recette QA ne s'ouvre qu'après revue verte.
