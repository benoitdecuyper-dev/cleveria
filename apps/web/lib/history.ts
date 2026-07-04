// Historique de conversations (docs/13) — stockage local multi-conversations.
// IndexedDB via idb-keyval (pas localStorage : quota bas + écriture synchrone du blob unique
// ne tiennent pas plusieurs conversations avec board volumineux). Un enregistrement par
// conversation (clé `conv:<id>`) + un index léger (`conv:index`) pour peindre la sidebar sans
// charger tout le contenu. Tout s'exécute côté navigateur (appelé depuis des composants client).
import { get, set, del } from "idb-keyval";

export type ConversationMode = "echange" | "voice";

// messages/board restent au format de chaque page (on enveloppe, on ne réécrit pas) → unknown,
// caste côté page au chargement. userId/schemaVersion posés pour le pont Supabase V2 (docs/13 §8).
export type StoredConversation = {
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

export type ConversationSummary = Pick<StoredConversation, "id" | "mode" | "title" | "updatedAt">;

const INDEX_KEY = "cleveria:conv:index";
const convKey = (id: string) => `cleveria:conv:${id}`;
const LEGACY_KEY = "cleveria.voice.v1";
const MIGRATED_FLAG = "cleveria.history.migrated.v1";

// Garde de session (module-level) contre le double-appel de migrateLegacyVoice : React 19
// StrictMode double-invoque les effets en dev, et l'id migré est régénéré à chaque essai
// (donc un 2e essai dans la même session créerait un doublon). Le flag persistant ci-dessus
// couvre les sessions suivantes ; ce garde couvre la session en cours.
let migrationRan = false;

// ── Index ─────────────────────────────────────────────────────────────────────
async function readIndex(): Promise<ConversationSummary[]> {
  try {
    const idx = await get<ConversationSummary[]>(INDEX_KEY);
    return Array.isArray(idx) ? idx : [];
  } catch {
    return [];
  }
}

async function writeIndex(idx: ConversationSummary[]): Promise<void> {
  await set(INDEX_KEY, idx);
}

function upsertSummary(idx: ConversationSummary[], conv: StoredConversation): ConversationSummary[] {
  const summary: ConversationSummary = { id: conv.id, mode: conv.mode, title: conv.title, updatedAt: conv.updatedAt };
  const without = idx.filter((s) => s.id !== conv.id);
  return [summary, ...without];
}

// ── API publique ──────────────────────────────────────────────────────────────
/** Résumés d'un mode, triés par activité récente (plus récent d'abord). */
export async function listConversations(mode: ConversationMode): Promise<ConversationSummary[]> {
  const idx = await readIndex();
  return idx
    .filter((s) => s.mode === mode)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getConversation(id: string): Promise<StoredConversation | null> {
  try {
    return (await get<StoredConversation>(convKey(id))) ?? null;
  } catch {
    return null;
  }
}

/**
 * Crée + persiste (ou met à jour) une conversation, et rafraîchit l'index.
 * NE PAS avaler l'échec (IndexedDB bloqué en navigation privée stricte, quota…) : on
 * REMONTE une erreur claire pour que l'appelant puisse prévenir l'utilisateur (P0-2).
 */
export async function saveConversation(conv: StoredConversation): Promise<void> {
  try {
    await set(convKey(conv.id), conv);
    const idx = await readIndex();
    await writeIndex(upsertSummary(idx, conv));
  } catch (e) {
    throw new Error("Impossible de sauvegarder la conversation (stockage du navigateur indisponible).", { cause: e });
  }
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const conv = await getConversation(id);
  if (!conv) return;
  const updated: StoredConversation = { ...conv, title, titleIsCustom: true, updatedAt: nowIso() };
  await saveConversation(updated); // remonte déjà l'erreur (cf. saveConversation)
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    await del(convKey(id));
    const idx = await readIndex();
    await writeIndex(idx.filter((s) => s.id !== id));
  } catch (e) {
    throw new Error("Impossible de supprimer la conversation (stockage du navigateur indisponible).", { cause: e });
  }
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
      await saveConversation({
        id,
        mode: "voice",
        title: autoTitle(firstUser?.text ?? ""),
        titleIsCustom: false,
        messages,
        board,
        createdAt: now,
        updatedAt: now,
        userId: null,
        schemaVersion: 1,
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
