// Stage transmis à /api/brief + stage à persister (docs/26 §incrément 2) — fonctions PURES,
// extraites de /voice pour rester testables indépendamment du composant (même patron que
// lib/parseReply.ts). Garde-fou central : le stage part TOUJOURS de l'état du composant (celui
// dérivé d'une conversation ouverte via l'historique, ou du défaut à la création) — JAMAIS d'une
// ligne MODE: écrite par le LLM. Ni `stageForBrief` ni `derivePersistStage` ne lisent la réponse
// du modèle : elles ne prennent en entrée QUE l'état déjà connu côté client.
import type { ProjectStage } from "./history";

type BoardKind = { kind?: string } | null;

/**
 * Stage à transmettre au serveur pour CE tour. Seul `"echange"` fait basculer /api/brief en
 * ECHANGE_OPS (réponse orale, pas de board/protocole MODE:/VOIX:/BOARD:) — tout le reste
 * (cadrage/maquette/prod) reste le triage engagé habituel (BRAS_DROIT_INSTRUCTIONS), à
 * l'identique du comportement actuel de /voice : une conversation qui n'est jamais passée par le
 * stage `"echange"` envoie toujours `"cadrage"`, comme avant l'introduction de ce rail.
 */
export function stageForBrief(stage: ProjectStage): "echange" | "cadrage" {
  return stage === "echange" ? "echange" : "cadrage";
}

/**
 * Stage à ÉCRIRE en persistance après un tour. Une conversation au stage `"echange"` le reste —
 * aucun tour ne l'engage tout seul, seul `engageProject()` (acte utilisateur explicite, incr. 3)
 * fait passer l'objet à un stage engagé. Une conversation déjà engagée affine son stage fin
 * depuis le CONTENU du board (maquette détectée, sinon cadrage) — jamais depuis une ligne MODE:
 * du LLM, qui n'a aucun levier sur l'engagement.
 */
export function derivePersistStage(stage: ProjectStage, board: BoardKind): ProjectStage {
  if (stage === "echange") return "echange";
  return board?.kind === "maquette" ? "maquette" : "cadrage";
}

/**
 * Board à CHARGER à l'ouverture d'une conversation (bootstrap `?conv=`, `openConversation`) —
 * garde-fou de cohérence (docs/26 §incrément 3, revue reportée de l'incrément 2) : un stage
 * `"echange"` n'affiche JAMAIS de board ni n'entre en phase maquette, MÊME si l'objet stocké en
 * contient un (donnée legacy ou incohérente) — un stage `"echange"` est par construction
 * non-engagé, jamais de livrable en cours. Sans cette garde, un `?conv=` pointant vers un objet
 * mal formé pourrait ouvrir un demi-état (rail échange + board affiché). Pure, ne modifie rien :
 * appelée à la LECTURE, jamais à l'écriture (qui reste `derivePersistStage`, ci-dessus).
 */
export function boardForStage<B>(stage: ProjectStage, board: B | null): B | null {
  return stage === "echange" ? null : board;
}
