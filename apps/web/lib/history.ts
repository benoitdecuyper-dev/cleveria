// Historique de conversations (docs/13) — stockage local multi-conversations.
// IndexedDB via idb-keyval (pas localStorage : quota bas + écriture synchrone du blob unique
// ne tiennent pas plusieurs conversations avec board volumineux). Un enregistrement par
// conversation (clé `conv:<id>`) + un index léger (`conv:index`) pour peindre la sidebar sans
// charger tout le contenu. Tout s'exécute côté navigateur (appelé depuis des composants client).
import { get, set, del } from "idb-keyval";

// Legacy (schemaVersion 1) : confondait surface d'UX et état d'engagement. Conservé en lecture
// (compat) et encore accepté en écriture pendant la transition (CLV-52), mais n'est plus la
// source de vérité — cf. `stage` ci-dessous (docs/23 §2.1).
export type ConversationMode = "echange" | "voice";

// Cycle de vie de l'objet (docs/22 CLV-46, docs/23 §2.1) — remplace `mode` comme discriminant de
// vérité. "echange" = état zéro, pas de board, jetable. "cadrage"/"maquette"/"prod" = ENGAGÉ (un
// board existe / un run a été lancé). La transition echange→engagé n'est JAMAIS dérivée d'une
// ligne MODE: du LLM : elle passe uniquement par `engageProject()` (acte utilisateur explicite).
export type ProjectStage = "echange" | "cadrage" | "maquette" | "prod";

// messages/board restent au format de chaque page (on enveloppe, on ne réécrit pas) → unknown,
// caste côté page au chargement. userId/schemaVersion posés pour le pont Supabase V2 (docs/13 §8).
export type StoredConversation = {
  id: string;
  stage: ProjectStage;          // REMPLACE `mode` comme source de vérité (schemaVersion 2)
  mode?: ConversationMode;      // legacy — plus écrit à dessein par le code neuf, encore lu/toléré
  title: string;
  titleIsCustom: boolean;
  messages: unknown[];
  board: unknown | null;
  runId?: string | null;        // lien vers /run/[id] (posé par le GO prod — hors périmètre CLV-52)
  engagedAt?: string | null;    // horodatage de l'acte echange→engagé, posé par engageProject()
  sourceConversationId?: string;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  schemaVersion: 2;
};

export type ConversationSummary = Pick<StoredConversation, "id" | "stage" | "title" | "updatedAt">;

// ── Forme legacy sur disque (schemaVersion 1) — décrit ce qu'on peut lire, jamais ce qu'on écrit.
type StoredConversationV1 = {
  id: string;
  mode: ConversationMode;
  title: string;
  titleIsCustom: boolean;
  messages: unknown[];
  board: unknown | null;
  sourceConversationId?: string;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  schemaVersion: 1;
};
type ConversationSummaryV1 = { id: string; mode: ConversationMode; title: string; updatedAt: string };

/**
 * Dérive un `stage` depuis un `mode` legacy + le contenu déjà présent (docs/23 §3.3) :
 * `mode:"echange"` → `"echange"` ; `mode:"voice"` → engagé, affiné par le contenu
 * (`runId` posé → `"prod"` ; maquette dans le board → `"maquette"` ; sinon `"cadrage"`, le cas
 * par défaut d'un objet déjà engagé). Pure, ne modifie rien : le remap est appliqué à la LECTURE.
 */
export function deriveLegacyStage(mode: ConversationMode, board: unknown, runId?: string | null): ProjectStage {
  if (mode === "echange") return "echange";
  if (runId) return "prod";
  const b = board as { kind?: string } | null;
  if (b && b.kind === "maquette") return "maquette";
  return "cadrage";
}

/**
 * Remap paresseux `schemaVersion` 1→2 (docs/23 §2.1/§3.3) : additif, non destructif — un
 * enregistrement v1 est traduit à la volée à chaque lecture, RIEN n'est réécrit sur disque tant
 * que l'appelant ne resauvegarde pas explicitement (`saveConversation`). `mode` reste présent
 * (legacy, toléré) pour ne perdre aucune donnée existante.
 */
export function normalizeConversation(raw: StoredConversation | StoredConversationV1): StoredConversation {
  if (raw.schemaVersion === 2) return raw;
  return {
    ...raw,
    stage: deriveLegacyStage(raw.mode, raw.board, undefined),
    runId: null,
    engagedAt: null,
    schemaVersion: 2,
  };
}

export function normalizeSummary(raw: ConversationSummary | ConversationSummaryV1): ConversationSummary {
  if ("stage" in raw) return raw;
  return { id: raw.id, stage: raw.mode === "echange" ? "echange" : "cadrage", title: raw.title, updatedAt: raw.updatedAt };
}

const INDEX_KEY = "cleveria:conv:index";
const convKey = (id: string) => `cleveria:conv:${id}`;
const LEGACY_KEY = "cleveria.voice.v1";
const MIGRATED_FLAG = "cleveria.history.migrated.v1";

// ── Verrou asynchrone par id (durcissement CLV-53, pré-mortem risques n°1 et n°6) ──────────────
// saveConversation / engageProject / renameConversation / deleteConversation mutent toutes la
// MÊME clé (`conv:<id>`), sans autre garde que celle d'IndexedDB — qui ne sérialise RIEN entre
// deux appels JS distincts. Deux mutations concurrentes sur un même id peuvent donc committer
// dans le désordre (dernier `set` gagnant, sans rapport avec l'ordre d'appel) :
//   - régression de stage : un `saveConversation({stage:"echange"})` encore « en vol » commit
//     APRÈS le `saveConversation({stage:"cadrage"})` d'engageProject → retour à echange/board
//     perdu (docs/23 — le « casser » redouté) ;
//   - fausse alerte stockage : le `getConversation(id)` interne d'engageProject peut lire `null`
//     si un persist a posé l'id mais pas encore committé son `set` → « introuvable » à tort.
//
// Le verrou ci-dessous sérialise les opérations PAR id : chaque appel sur un id chaîne derrière
// la fin (succès OU échec) du précédent appel sur ce MÊME id, dans l'ordre où les appels ont été
// FAITS (pas dans l'ordre où ils finissent). Deux ids différents ont chacun leur propre chaîne :
// ils ne se bloquent jamais l'un l'autre.
const locks = new Map<string, Promise<unknown>>();

function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  // `run` porte le résultat RÉEL (succès ou échec) de CET appel : c'est lui qu'on renvoie tel
  // quel à l'appelant, donc une erreur de stockage (P0-2) n'est JAMAIS avalée par le verrou.
  const run = previous.catch(() => undefined).then(fn);
  // `chained` ne sert qu'à faire progresser la chaîne pour les appels SUIVANTS, même si CET
  // appel échoue — sinon un premier échec bloquerait indéfiniment tout appel ultérieur sur le
  // même id.
  const chained = run.then(
    () => undefined,
    () => undefined,
  );
  locks.set(id, chained);
  return run.finally(() => {
    // Nettoyage : si aucun appel plus récent n'a chaîné après nous, la chaîne est retombée au
    // repos → on retire l'entrée pour ne pas faire grossir la Map indéfiniment.
    if (locks.get(id) === chained) locks.delete(id);
  });
}

// Garde de session (module-level) contre le double-appel de migrateLegacyVoice : React 19
// StrictMode double-invoque les effets en dev, et l'id migré est régénéré à chaque essai
// (donc un 2e essai dans la même session créerait un doublon). Le flag persistant ci-dessus
// couvre les sessions suivantes ; ce garde couvre la session en cours.
let migrationRan = false;

// ── Index ─────────────────────────────────────────────────────────────────────
async function readIndex(): Promise<ConversationSummary[]> {
  try {
    const idx = await get<(ConversationSummary | ConversationSummaryV1)[]>(INDEX_KEY);
    return Array.isArray(idx) ? idx.map(normalizeSummary) : [];
  } catch {
    return [];
  }
}

async function writeIndex(idx: ConversationSummary[]): Promise<void> {
  await set(INDEX_KEY, idx);
}

function upsertSummary(idx: ConversationSummary[], conv: StoredConversation): ConversationSummary[] {
  const summary: ConversationSummary = { id: conv.id, stage: conv.stage, title: conv.title, updatedAt: conv.updatedAt };
  const without = idx.filter((s) => s.id !== conv.id);
  return [summary, ...without];
}

// ── API publique ──────────────────────────────────────────────────────────────
/**
 * Résumés d'une des deux surfaces, triés par activité récente (plus récent d'abord).
 * Le paramètre garde son nom historique (`ConversationMode`) — les deux sidebars filtrées ne
 * fusionnent PAS ici (renversement de docs/13 §1 explicitement hors périmètre CLV-52, cf.
 * CLV-54) — mais le filtre lui-même tourne désormais sur `stage`, plus sur `mode` :
 * `"echange"` = stage zéro non engagé, `"voice"` = tout stage engagé (cadrage/maquette/prod).
 */
export async function listConversations(mode: ConversationMode): Promise<ConversationSummary[]> {
  const idx = await readIndex();
  const engaged = mode === "voice";
  return idx
    .filter((s) => (engaged ? s.stage !== "echange" : s.stage === "echange"))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getConversation(id: string): Promise<StoredConversation | null> {
  try {
    const raw = await get<StoredConversation | StoredConversationV1>(convKey(id));
    return raw ? normalizeConversation(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Écriture brute (sans verrou) : réservée aux appelants internes qui exécutent DÉJÀ dans une
 * section critique `withLock(id, …)` (engageProject, renameConversation). Ne PAS appeler
 * directement depuis l'extérieur — passer par `saveConversation`, qui pose le verrou.
 * NE PAS avaler l'échec (IndexedDB bloqué en navigation privée stricte, quota…) : on
 * REMONTE une erreur claire pour que l'appelant puisse prévenir l'utilisateur (P0-2).
 */
async function writeConversation(conv: StoredConversation): Promise<void> {
  try {
    await set(convKey(conv.id), conv);
    const idx = await readIndex();
    await writeIndex(upsertSummary(idx, conv));
  } catch (e) {
    throw new Error("Impossible de sauvegarder la conversation (stockage du navigateur indisponible).", { cause: e });
  }
}

/**
 * Crée + persiste (ou met à jour) une conversation, et rafraîchit l'index.
 * Sérialisé par id (CLV-53) : deux appels concurrents sur le même id committent dans l'ordre
 * d'appel, jamais en dernier-write-gagnant arbitraire. NE PAS avaler l'échec — remonté tel quel
 * par le verrou (P0-2, cf. withLock).
 */
export async function saveConversation(conv: StoredConversation): Promise<void> {
  return withLock(conv.id, () => writeConversation(conv));
}

export async function renameConversation(id: string, title: string): Promise<void> {
  return withLock(id, async () => {
    const conv = await getConversation(id);
    if (!conv) return;
    const updated: StoredConversation = { ...conv, title, titleIsCustom: true, updatedAt: nowIso() };
    await writeConversation(updated); // remonte déjà l'erreur (cf. writeConversation)
  });
}

/**
 * L'UNIQUE point qui matérialise « je fabrique » (docs/23 §2.2 règle 2) : fait passer une
 * conversation `echange` à un stage engagé. Monotone — ne régresse JAMAIS un stage déjà engagé
 * vers `echange` (un appel sur un objet `cadrage`/`maquette`/`prod` est un no-op silencieux,
 * cf. docs/23 §2.1 « ne régresse jamais »). Doit être déclenché UNIQUEMENT par un acte
 * utilisateur explicite (bouton « Transformer en projet », ou le GO qui implique un objet déjà
 * engagé) — JAMAIS par une ligne `MODE:` du LLM ni par un effet de bord du parsing de flux.
 * Remonte l'échec (P0-2) : pas de conversation trouvée → no-op ; sauvegarde bloquée → l'appelant
 * est prévenu (comme saveConversation).
 *
 * Sérialisé par id (CLV-53) : la lecture (`getConversation`) ET l'écriture s'exécutent dans la
 * MÊME section critique — un `saveConversation` encore « en vol » sur ce id (appelé avant) a
 * donc TOUJOURS fini de committer avant que cette lecture n'ait lieu. Élimine à la fois la
 * régression de stage (risque n°1) et la fausse alerte « introuvable » (risque n°6).
 */
export async function engageProject(
  id: string,
  toStage: Exclude<ProjectStage, "echange"> = "cadrage",
): Promise<StoredConversation | null> {
  return withLock(id, async () => {
    const conv = await getConversation(id);
    if (!conv) return null;
    if (conv.stage !== "echange") return conv; // déjà engagé : pas de régression, pas de double-trace
    const now = nowIso();
    const updated: StoredConversation = {
      ...conv,
      stage: toStage,
      engagedAt: now,
      updatedAt: now,
    };
    await writeConversation(updated); // remonte déjà l'erreur (cf. writeConversation)
    return updated;
  });
}

async function removeConversation(id: string): Promise<void> {
  try {
    await del(convKey(id));
    const idx = await readIndex();
    await writeIndex(idx.filter((s) => s.id !== id));
  } catch (e) {
    throw new Error("Impossible de supprimer la conversation (stockage du navigateur indisponible).", { cause: e });
  }
}

export async function deleteConversation(id: string): Promise<void> {
  return withLock(id, () => removeConversation(id));
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  // randomUUID dispo dans les navigateurs modernes ; repli si absent.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "c-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Titre auto : premiers mots du 1er message utilisateur, tronqués sur une frontière de mot. */
export function autoTitle(text: string): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "Nouvelle conversation";
  if (clean.length <= 48) return clean;
  const cut = clean.slice(0, 48);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

/** Date relative façon marché : « à l'instant », « il y a 2 h », « hier », date au-delà. */
export function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/**
 * Migration unique de la clé legacy `cleveria.voice.v1` (conversation /voice unique) vers une
 * 1ère entrée d'historique. Idempotente (flag anti-rejeu). Renvoie l'id créé, ou null.
 *
 * P0-2bis : le flag persistant (MIGRATED_FLAG) et la suppression de la clé legacy ne sont posés
 * qu'APRÈS le succès de saveConversation. Si la sauvegarde échoue (stockage bloqué), on ne pose
 * RIEN → une prochaine visite retentera, au lieu de perdre la conversation legacy pour toujours.
 */
export async function migrateLegacyVoice(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (migrationRan) return null; // déjà tenté cette session (StrictMode double-invoque les effets)
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return null;
    migrationRan = true;

    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATED_FLAG, "1");
      return null;
    }

    let messages: unknown[];
    let board: unknown;
    try {
      const data = JSON.parse(raw) as { messages?: unknown[]; board?: unknown };
      messages = Array.isArray(data.messages) ? data.messages : [];
      board = data.board ?? null;
    } catch {
      // JSON corrompu : rien à récupérer, retenter n'aiderait pas → on marque migré.
      localStorage.setItem(MIGRATED_FLAG, "1");
      localStorage.removeItem(LEGACY_KEY);
      return null;
    }

    if (messages.length === 0) {
      localStorage.setItem(MIGRATED_FLAG, "1");
      localStorage.removeItem(LEGACY_KEY);
      return null;
    }

    const firstUser = messages.find(
      (m): m is { role: string; text: string } =>
        typeof m === "object" && m !== null && (m as { role?: string }).role === "user",
    );
    const id = newId();
    const now = nowIso();
    try {
      // Legacy migrée = un `mode:"voice"` de fait → produit directement du schemaVersion 2
      // avec un stage dérivé (docs/23 §4 point 7) : pas la peine de la faire retomber dans le
      // remap paresseux à chaque lecture suivante.
      await saveConversation({
        id,
        stage: deriveLegacyStage("voice", board),
        title: autoTitle(firstUser?.text ?? ""),
        titleIsCustom: false,
        messages,
        board,
        createdAt: now,
        updatedAt: now,
        userId: null,
        schemaVersion: 2,
      });
    } catch {
      // Échec de sauvegarde → flag NON posé, clé legacy conservée : on retentera à la
      // prochaine visite (le garde `migrationRan` évite juste un doublon dans CETTE session).
      return null;
    }
    localStorage.setItem(MIGRATED_FLAG, "1");
    localStorage.removeItem(LEGACY_KEY);
    return id;
  } catch {
    // localStorage indisponible (accès bloqué) : on démarre à vide sans erreur visible.
    return null;
  }
}
