"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NoteView from "../brief/NoteView";
import Markdown from "../components/Markdown";
import MockupFrame from "../components/MockupFrame";
import HistoryPanel from "../components/HistoryPanel";
import { parseStream, speakable } from "../../lib/format";
import { parseReply } from "../../lib/parseReply";
import {
  autoTitle,
  deleteConversation,
  engageProject,
  getConversation,
  listAllConversations,
  migrateLegacyVoice,
  newId,
  nowIso,
  renameConversation,
  saveConversation,
  type ConversationSummary,
  type ProjectStage,
} from "../../lib/history";
import { stageForBrief, derivePersistStage, boardForStage } from "../../lib/briefStage";

// ── Types (alignés sur /api/brief et /api/plan) ───────────────────────────────
type Question = {
  id: string;
  text: string;
  type: "single" | "multi" | "open";
  options?: string[];
  allowFreeText?: boolean;
};
// "echange" ajouté (docs/26 §incrément 2) : /api/brief renvoie `mode:"echange"` pour un tour au
// stage non-engagé (ECHANGE_OPS) — jamais produit par le LLM lui-même (pas de ligne MODE: en
// ECHANGE_OPS), juste posé par le serveur sur l'événement "done" (route.ts).
type Mode = "direct" | "questions" | "cadrage" | "maquette" | "echange";
type Msg = {
  role: "user" | "assistant";
  text: string;
  mode?: Mode;
  isNote?: boolean;
  questions?: Question[];
  streaming?: boolean;
  spoken?: string;
  // Réponse qui a alimenté le board : le texte (= la phrase VOIX) est gardé pour l'historique/la
  // relecture, mais on ne le RÉ-AFFICHE pas dans le chat (déjà narré à voix haute + déjà dans le
  // board) → l'UI montre un indicateur discret à la place. Cf. finalize().
  boardUpdate?: boolean;
};
// kind absent ⇒ markdown (rétro-compat). Pour une maquette, content = le HTML complet ; seed =
// le brief d'origine du maquettiste, conservé pour pouvoir régénérer après un refresh (le board
// est stocké `unknown` en IndexedDB → kind/seed voyagent gratis, cf. lib/history.ts).
type Board = { title: string; content: string; kind?: "markdown" | "maquette"; seed?: string };
type BriefDone = {
  reply: string;
  mode?: Mode;
  isNote?: boolean;
  questions?: Question[];
  spoken?: string | null;
  board?: Board | null;
  maquetteSeed?: string | null;
  urlWarning?: string | null;
};
// Phase du parcours maquette-first (docs/18 §4) : "chat" = flux historique (markdown/cadrage
// classique) ; "maquette" = un projet visuel a été détecté, le board affiche une maquette HTML
// itérable. Dérivable de board.kind au chargement d'une conversation stockée.
type Phase = "chat" | "maquette";

const DEMO_PREFILL =
  "Je veux transformer une ancienne grange en tiers-lieu : un café associatif ouvert à tous, " +
  "plus des espaces de coworking, dans un village rural.";

const EXAMPLES = [
  "Un site vitrine pour mon activité de menuisier",
  "Une page pour mon association sportive",
  "Un site pour présenter mon food-truck",
  "Une boutique en ligne pour mes créations",
];

// Une bulle assistant "en frappe" = en streaming, sans contenu réel encore arrivé
// (placeholder "…" ou vide). On y affiche les 3 points animés plutôt qu'un "…" figé.
function isTyping(m: Msg): boolean {
  return !!m.streaming && (!m.text || !m.text.trim() || m.text.trim() === "…");
}

// ── Icônes (SVG inline, héritent de currentColor) ────────────────────────────
const svg = {
  base: { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const },
};
// Géométrie Lucide (icônes de référence).
const IcoClip = () => (
  <svg {...svg.base} aria-hidden>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);
const IcoMic = () => (
  <svg {...svg.base} aria-hidden>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);
const IcoSend = () => (
  <svg {...svg.base} aria-hidden>
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
    <path d="m21.854 2.147-10.94 10.939" />
  </svg>
);
const IcoStop = () => (
  <svg {...svg.base} aria-hidden>
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
  </svg>
);
const IcoPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7 5v14l12-7z" />
  </svg>
);
const IcoDownload = () => (
  <svg {...svg.base} aria-hidden>
    <path d="M12 3v12" />
    <polyline points="7 11 12 16 17 11" />
    <path d="M5 21h14" />
  </svg>
);
const IcoClose = () => (
  <svg {...svg.base} aria-hidden>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);
const IcoSpeaker = () => (
  <svg {...svg.base} aria-hidden>
    <path d="M11 4.7 6.5 8H3v8h3.5L11 19.3z" />
    <path d="M16 8.5a4 4 0 0 1 0 7" />
    <path d="M19.5 6a8 8 0 0 1 0 12" />
  </svg>
);
const IcoSpeakerOff = () => (
  <svg {...svg.base} aria-hidden>
    <path d="M11 4.7 6.5 8H3v8h3.5L11 19.3z" />
    <line x1="22" y1="9" x2="16" y2="15" />
    <line x1="16" y1="9" x2="22" y2="15" />
  </svg>
);
const IcoNewChat = () => (
  <svg {...svg.base} aria-hidden>
    <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
  </svg>
);
const IcoHistory = () => (
  <svg {...svg.base} aria-hidden>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </svg>
);
// Indicateur "il écrit…" : 3 points animés, comme dans une vraie messagerie.
const TypingDots = () => (
  <span className="typing-dots" aria-label="en train d'écrire" role="status">
    <span /><span /><span />
  </span>
);

export default function VoicePage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  // Voix ACTIVE par défaut : le chef de projet lit à voix haute sa ligne VOIX (une vraie
  // reformulation orale, différente du texte écrit). Coupable via le bouton 🔊/🔇.
  // playingIdx = index du message en cours de lecture.
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  // Accueil "Shazam du besoin" : édition de la carte d'écho, et provenance de la saisie
  // (micro → on propose une carte de confirmation ; texte tapé → envoi direct).
  const [editingCrystal, setEditingCrystal] = useState(false);
  const [fromMic, setFromMic] = useState(false);
  // Besoin validé à lancer = contenu de la need card (board) en cadrage projet, ou la
  // note en mode démo. Alimente la planification et le GO.
  const [launchNote, setLaunchNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  // Board : le brouillon de livrable que le bras droit projette et construit en live.
  const [board, setBoard] = useState<Board | null>(null);
  // URL optionnelle en entrée (service site, docs/19 §1) : rebranding — visible uniquement
  // avant le 1er message. Capturée côté serveur (readUrl) et injectée dans le brief.
  const [url, setUrl] = useState("");
  // Parcours maquette-first (docs/18) : phase courante + graine d'origine (pour régénérer après
  // un refresh) + indicateur "la maquette se construit" (on ne monte jamais l'iframe sur du HTML
  // partiel — on bufferise jusqu'au "done", cf. MockupFrame).
  const [phase, setPhase] = useState<Phase>("chat");
  const [mockupSeed, setMockupSeed] = useState("");
  const [mockupBuilding, setMockupBuilding] = useState(false);
  // Historique (docs/13)
  const [convList, setConvList] = useState<ConversationSummary[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [histOpen, setHistOpen] = useState(false);
  // Stage de la conversation courante (docs/23 §2.1, rail docs/26 §incrément 2). DÉFAUT
  // "cadrage" : une NOUVELLE conversation démarre toujours engagée (maquette-first, le chemin qui
  // vend) — comportement STRICTEMENT inchangé. Le stage "echange" n'est atteint qu'en ouvrant
  // depuis l'historique une conversation qui l'a déjà (rail dormant : aucun point d'entrée ne
  // crée encore de conversation "echange" sur /voice — posé pour les incréments 3 et 5).
  const [stage, setStage] = useState<ProjectStage>("cadrage");
  // Bouton « Transformer en projet » (docs/26 §incrément 3) : true pendant la promotion en place
  // (engageProject) — évite un double-clic pendant l'attente du verrou de stockage.
  const [engaging, setEngaging] = useState(false);

  const [launching, setLaunching] = useState(false);
  // Réponses sélectionnées au formulaire de questions (par id de question). On envoie la sélection,
  // on ne l'injecte PAS dans le champ de saisie.
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  // Flux SSE de /api/brief en cours (P0-1) : annulé à chaque nouveau tour ET quand on quitte
  // la conversation courante (nouvelle conv / ouverture d'une entrée d'historique), pour
  // qu'un flux périmé ne touche plus jamais l'état (messages/board) d'une AUTRE conversation.
  const sendAbortRef = useRef<AbortController | null>(null);
  // Idem pour /api/maquette (P0-1 étendu, docs/18 §4) : un nouveau tour ou un changement de
  // conversation annule aussi une génération de maquette en cours — sinon corruption inter-
  // conversations (le HTML d'une génération périmée écraserait le board d'une autre conv).
  const maquetteAbortRef = useRef<AbortController | null>(null);
  // Index du dernier message déjà auto-lu, pour ne pas le relire à chaque re-render.
  const autoPlayedRef = useRef(-1);
  // true tant que l'utilisateur est collé en bas du fil. Dès qu'il scrolle vers le
  // haut (pour relire pendant que ça réfléchit), on ARRÊTE l'auto-scroll qui le ramenait
  // de force en bas. Il reprend dès qu'il revient en bas.
  const stickToBottomRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const baseTextRef = useRef("");
  // Auto fin-de-parole (V2, docs/12) : après un silence, on envoie le tour tout seul —
  // plus besoin de finaliser à la main. Refs pour lire l'état frais dans le callback STT.
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognizingRef = useRef(false);
  const loadingRef = useRef(false);
  const sendRef = useRef<(opts?: { force?: boolean; override?: string }) => void>(() => {});
  // Boucle mains-libres (V2) : le tour courant vient-il de la voix ? Et faut-il ré-écouter
  // après la réponse ? On ne relance le micro QUE si l'échange est vocal ET qu'aucun geste
  // n'est requis (need card/GO ou formulaire de questions attend un clic → on rend la main).
  const handsFreeRef = useRef(false);
  const pendingAutoListenRef = useRef(false);
  // Historique : id + méta de la conversation courante pour la persistance.
  const convIdRef = useRef<string | null>(null);
  const convCreatedAtRef = useRef<string>("");
  const titleCustomRef = useRef(false);
  const titleRef = useRef("");
  const skipPersistRef = useRef(false); // saute la sauvegarde juste après un chargement/reset
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);

  const started = messages.length > 0;

  // ── TTS serveur (ElevenLabs), À LA DEMANDE. Pas de clé → silence (jamais de voix robot). ──
  const stopAudio = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
    setPlayingIdx(null);
  }, []);

  // Joue une réponse à la demande (clic "Écouter"). idx = message lu, pour l'état du bouton.
  const speak = useCallback(
    // silent = true pour l'auto-lecture : on ne montre PAS de bannière d'erreur si la
    // voix est indisponible (pas de clé, quota, autoplay bloqué) — ça resterait muet.
    // onDone = appelé À LA FIN NATURELLE (fin de lecture, ou voix indisponible) — PAS sur
    // interruption (abort). Sert à enchaîner la ré-écoute mains-libres sans se réécouter parler.
    async (raw: string, idx: number | null = null, silent = false, onDone?: () => void) => {
      const txt = speakable(raw);
      if (!txt) return void onDone?.();
      stopAudio(); // coupe toute lecture/chargement en cours
      setPlayingIdx(idx); // état IMMÉDIAT → un 2e clic = Stop, jamais une 2e lecture
      const ctrl = new AbortController();
      ttsAbortRef.current = ctrl;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: txt.slice(0, 1500) }),
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        if (!res.ok) {
          if (!silent) setError("Voix indisponible (clé ElevenLabs manquante ou quota atteint).");
          setPlayingIdx(null);
          onDone?.(); // pas de voix → on enchaîne quand même la ré-écoute
          return;
        }
        const audioUrl = URL.createObjectURL(await res.blob());
        if (ctrl.signal.aborted) return void URL.revokeObjectURL(audioUrl);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onplay = () => setSpeaking(true);
        audio.onended = () => {
          setSpeaking(false);
          setPlayingIdx(null);
          URL.revokeObjectURL(audioUrl);
          onDone?.();
        };
        audio.onerror = () => {
          setSpeaking(false);
          setPlayingIdx(null);
          onDone?.();
        };
        await audio.play();
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          setSpeaking(false);
          setPlayingIdx(null);
          onDone?.();
        }
      }
    },
    [stopAudio],
  );

  // Suit le scroll de la fenêtre : on n'est "collé en bas" que si on est à ~140px du bas.
  // (Un scroll programmatique atterrit en bas → reste collé ; un scroll manuel vers le
  // haut → se décolle, donc plus d'auto-scroll forcé.)
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      stickToBottomRef.current = window.innerHeight + window.scrollY >= doc.scrollHeight - 140;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll en bas du fil — UNIQUEMENT si l'utilisateur est resté en bas.
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, launchNote, loading]);

  // Auto-lecture : dès qu'une réponse finalisée arrive, on lit sa ligne VOIX (ou son
  // texte). Le clic "Envoyer"/micro juste avant fait office de geste utilisateur, donc
  // l'autoplay navigateur passe. Silencieux si la voix est indisponible.
  useEffect(() => {
    // Pas d'auto-lecture pendant que l'utilisateur dicte : on ne lui parle pas dessus
    // (et le micro ne capte pas la voix TTS). Dès qu'il arrête de dicter, on lit.
    if (recognizing) return;
    const idx = messages.length - 1;
    const m = messages[idx];
    if (!m || m.role !== "assistant" || m.streaming) return;
    if (autoPlayedRef.current >= idx) return; // déjà lu
    autoPlayedRef.current = idx;
    // Boucle mains-libres : après avoir parlé (ou tout de suite si la voix est coupée), on
    // ré-écoute — mais seulement si le tour venait de la voix et qu'aucun geste n'est requis.
    const relisten = () => {
      if (!pendingAutoListenRef.current) return;
      pendingAutoListenRef.current = false;
      if (recognizingRef.current || loadingRef.current) return;
      startRec();
    };
    if (voiceOn) {
      void speak(m.spoken ?? m.text, idx, true, relisten);
    } else if (pendingAutoListenRef.current) {
      // Voix coupée : pas de TTS à attendre, on relance après une courte pause.
      setTimeout(relisten, 350);
    }
  }, [messages, voiceOn, recognizing, speak]);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }, [text]);

  // État frais pour le callback STT (créé une fois au démarrage du micro).
  useEffect(() => {
    recognizingRef.current = recognizing;
  }, [recognizing]);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // ?demo=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      setDemo(true);
      setText((t) => t || DEMO_PREFILL);
    }
  }, []);

  // Historique UNIFIÉ (docs/26 §incrément 4) : TOUS les stages, échange compris — sinon les
  // conversations `echange` deviendraient invisibles/injoignables une fois `/echange` redirigé
  // (incr. 5). Une conversation promue (echange→cadrage) reste dans CETTE liste : `engageProject`
  // ne change que son `stage` sur le même objet, elle ne quitte jamais l'index (risque n°7).
  const refreshList = useCallback(async () => {
    setConvList(await listAllConversations());
  }, []);

  // Init au chargement : migration legacy → historique, liste, et (depuis la passerelle
  // Assistant) ouverture de ?conv=<id> + cadrage auto ?cadrer=1. PAS d'auto-restauration de la
  // dernière conversation : on démarre vierge, l'historique est accessible via le tiroir.
  const autoCadreRef = useRef(false);
  const didAutoCadreRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") return; // démo : pas d'historique
    const cadrer = params.get("cadrer") === "1";
    const openId = params.get("conv");
    const openHist = params.get("history") === "1"; // arrivée depuis « Retrouver mes projets »
    // Rail docs/26 §incrément 3 : entrée dédiée pour ATTEINDRE le stage "echange" sur /voice sans
    // passer par l'historique (c'est l'entrée que la redirection de /echange utilisera à
    // l'incrément 5 ; ici on la pose et on la teste). Un `?conv=` explicite reste PRIORITAIRE —
    // sa conversation stockée fait foi sur son propre stage (branche `openId` ci-dessous), jamais
    // l'URL : `?echange=1` ne joue que pour démarrer une conversation NEUVE.
    const echangeEntry = params.get("echange") === "1" && !openId;
    if (cadrer) autoCadreRef.current = true;
    if (openHist) setHistOpen(true);
    if (echangeEntry) setStage("echange");
    if (cadrer || openId || openHist || echangeEntry) window.history.replaceState(null, "", "/voice");
    void (async () => {
      await migrateLegacyVoice();
      if (openId) {
        const conv = await getConversation(openId);
        if (conv) {
          skipPersistRef.current = true;
          convIdRef.current = conv.id;
          convCreatedAtRef.current = conv.createdAt;
          titleCustomRef.current = conv.titleIsCustom;
          titleRef.current = conv.title;
          setConvId(conv.id);
          setStage(conv.stage);
          const msgs = conv.messages as Msg[];
          setMessages(msgs);
          autoPlayedRef.current = msgs.length - 1; // ne pas relire l'historique à voix haute
          // Garde de cohérence (revue reportée incr. 2, docs/26 §incrément 3) : un `?conv=`
          // pointant vers une conversation "echange" ouvre le rail échange PROPREMENT — jamais de
          // demi-état (board affiché alors que rien n'est engagé), même si l'objet stocké est
          // incohérent (legacy/corrompu). Cf. `boardForStage`.
          const loadedBoard = boardForStage(conv.stage, (conv.board as Board) ?? null);
          setBoard(loadedBoard);
          // La maquette survit au refresh : kind + seed voyagent gratis dans le board
          // (IndexedDB, unknown) — on redérive juste la phase pour router les tours suivants.
          setPhase(loadedBoard?.kind === "maquette" ? "maquette" : "chat");
          setMockupSeed(loadedBoard?.kind === "maquette" ? (loadedBoard.seed ?? "") : "");
        }
      }
      await refreshList();
    })();
    // au montage uniquement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cadrage auto (passerelle `?cadrer=1`, ET bouton « Transformer en projet » docs/26
  // §incrément 3) : quand la conversation ouverte est chargée (ou vient d'être engagée),
  // produire la carte récap. `stage` est dans les dépendances : le clic sur « Transformer »
  // change `stage` SANS changer `messages` — sans cette dépendance, l'effet ne re-tournerait
  // jamais après la bascule de stage (une ref seule ne déclenche pas de re-render). Crucial
  // aussi pour la CORRECTION du tour envoyé : `send()` lit `stage` depuis LA FERMETURE de ce
  // rendu — il faut donc que l'effet s'exécute APRÈS le rendu qui a commité "cadrage" (jamais un
  // appel synchrone juste après `setStage`, qui lirait encore l'ancienne valeur).
  useEffect(() => {
    if (!autoCadreRef.current || didAutoCadreRef.current || loading) return;
    if (messages.length === 0) return; // on attend la conversation ouverte
    didAutoCadreRef.current = true;
    void send({ force: true });
    // send est stable au runtime (fonction hoistée) ; on ne le met pas en dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading, stage]);

  // ── Bouton « Transformer en projet » (docs/26 §incrément 3, cœur §4.3 du plan de fusion) ────
  // Promotion en place INTRA-surface : sur /voice, une conversation au stage "echange" devient
  // "cadrage" SANS navigation, SANS fork, SANS changer de conversation. Séquence STRICTE et non
  // négociable (pré-mortem risque n°3, docs/26) :
  //   a. abort de TOUT flux en vol (SSE /api/brief, maquette, TTS, STT) — AVANT toute mutation de
  //      stage/id, pour qu'un delta périmé ne puisse plus jamais écrire une fois l'objet engagé ;
  //   b. engageProject(id) — même id, monotone, sérialisé par le verrou (lib/history) ;
  //   c. succès → setStage("cadrage") puis armement du MÊME mécanisme que `?cadrer=1` (un seul
  //      send({force:true}), jamais réinventé) ;
  //   d. échec → bannière, PAS de changement de stage, l'échange reste intact et exploitable.
  async function engageToProject() {
    // (a) Abandon de tout tour en vol — même patron que newConversation()/openConversation() :
    // on RÉ-ASSIGNE les refs à null (pas seulement .abort()) pour que isCurrent() des flux
    // encore en cours de traitement (delta déjà reçu, pas encore rendu) devienne faux à coup sûr.
    sendAbortRef.current?.abort();
    sendAbortRef.current = null;
    maquetteAbortRef.current?.abort();
    maquetteAbortRef.current = null;
    stopAudio();
    resetRecognition();
    // Le tour abandonné ne réinitialisera plus jamais `loading` lui-même (son `isCurrent()` est
    // désormais faux) — sans ce reset explicite, le composer resterait bloqué "Je réfléchis…" et
    // l'effet de cadrage auto ci-dessus ne se déclencherait JAMAIS (il exige `!loading`).
    setLoading(false);
    // Pas de bulle fantôme (docs/26 §incrément 3) : une bulle assistant encore `streaming:true`
    // (tour "echange" en vol, jamais finalisé) est retirée — le contenu RÉEL de l'échange (tours
    // déjà complets + la dernière question utilisateur) est conservé tel quel. On renvoie LA MÊME
    // référence quand il n'y a rien à retirer (rien en vol) : un nouveau tableau identique en
    // contenu re-déclencherait inutilement l'effet de persistance (dépendant de `messages`), ce
    // qui peut le faire courir contre l'écriture de CETTE fonction (deux bannières d'erreur qui se
    // disputent le même état `error` en cas d'échec de stockage).
    setMessages((prev) => (prev.some((m) => m.streaming) ? prev.filter((m) => !m.streaming) : prev));

    const id = convIdRef.current;
    if (!id) return; // rien à transformer — le bouton n'existe qu'une fois la conv persistée

    setError("");
    setEngaging(true);
    try {
      // (b) Promotion en place — monotone, sérialisée par id (lib/history, durcissement CLV-53).
      const updated = await engageProject(id);
      if (!updated) throw new Error("conversation introuvable");
      // (c) Bascule + UN SEUL tour de cadrage forcé, via le mécanisme EXISTANT (réarmé pour ce
      // nouveau cycle : `didAutoCadreRef` peut déjà avoir servi une fois dans cette session).
      didAutoCadreRef.current = false;
      autoCadreRef.current = true;
      setStage("cadrage");
    } catch {
      // (d) Échec (id introuvable après coup, ou stockage bloqué) : bannière, aucun changement de
      // stage, l'échange reste intact — jamais de demi-état.
      setError("Impossible de transformer cet échange en projet — le stockage du navigateur est peut-être bloqué.");
    } finally {
      setEngaging(false);
    }
  }

  // Persistance IndexedDB (docs/13) : à chaque état stabilisé, on enregistre la conversation
  // Projet (création à la volée au 1er message). Jamais en démo, jamais un message en streaming.
  useEffect(() => {
    if (demo) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    if (messages.some((m) => m.streaming)) return;
    if (messages.length === 0) return;
    void (async () => {
      let id = convIdRef.current;
      if (!id) {
        id = newId();
        convIdRef.current = id;
        convCreatedAtRef.current = nowIso();
        setConvId(id);
      }
      const firstUser = messages.find((m) => m.role === "user")?.text ?? "";
      const title = titleCustomRef.current ? titleRef.current : autoTitle(firstUser);
      titleRef.current = title;
      // P0-2 : saveConversation REMONTE l'échec (stockage bloqué/quota) — on ne l'avale pas,
      // on prévient l'utilisateur via la bannière d'erreur existante. On continue à travailler
      // (pas de blocage), juste sans persistance tant que le stockage reste indisponible.
      try {
        await saveConversation({
          id,
          // Le stage écrit suit l'ÉTAT du composant, jamais une ligne MODE: du LLM (docs/23
          // §2.2 règle 1). Par défaut (aucun point d'entrée ne pose encore "echange") une
          // conversation /voice reste toujours engagée — le stage fin (cadrage vs maquette) est
          // dérivé du board. Rail docs/26 §incrément 2 : si `stage` vaut "echange" (conversation
          // non-engagée ouverte depuis l'historique), on l'écrit tel quel, `board` restant null.
          stage: derivePersistStage(stage, board as { kind?: string } | null),
          title,
          titleIsCustom: titleCustomRef.current,
          messages: messages.map((m) => ({ ...m, streaming: undefined })),
          board,
          createdAt: convCreatedAtRef.current || nowIso(),
          updatedAt: nowIso(),
          userId: null,
          schemaVersion: 2,
        });
        await refreshList();
      } catch {
        setError("Impossible de sauvegarder cette conversation — le stockage du navigateur est peut-être bloqué.");
      }
    })();
  }, [messages, board, demo, refreshList, stage]);

  // ── STT navigateur : la transcription s'écrit dans le champ, ÉDITABLE ─────────
  function startRec() {
    setError("");
    pendingAutoListenRef.current = false; // démarrage explicite → annule une ré-écoute en attente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("La reconnaissance vocale n'est pas dispo sur ce navigateur (essayez Chrome ou Edge). Vous pouvez écrire votre réponse.");
      return;
    }
    stopAudio(); // ne pas se réécouter
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    baseTextRef.current = text.trim() ? text.trim() + " " : "";
    let finalChunk = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interim += r[0].transcript;
      }
      const next = (baseTextRef.current + finalChunk + interim).replace(/\s+/g, " ").trimStart();
      setText(next);
      // Fin de parole détectée par silence : on relance un minuteur à chaque salve de
      // parole ; quand ça se tait ~1,5 s, on envoie automatiquement (mains-libres).
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
      if (next.trim()) {
        autoSendTimerRef.current = setTimeout(() => {
          if (recognizingRef.current && !loadingRef.current) sendRef.current();
        }, 1500);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      setRecognizing(false);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed")
        setError("Micro refusé — autorisez l'accès au micro, ou écrivez votre réponse.");
    };
    rec.onend = () => setRecognizing(false);
    rec.start();
    recRef.current = rec;
    setRecognizing(true);
    setFromMic(true); // saisie issue du micro → on proposera une carte d'écho à valider
  }
  function stopRec() {
    if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
    recRef.current?.stop();
    setRecognizing(false);
    fieldRef.current?.focus();
  }
  function toggleRec() {
    recognizing ? stopRec() : startRec();
  }
  // Coupe net la dictée en JETANT tout résultat en attente. Sans ça, un dernier
  // onresult arrive juste après l'envoi et réécrit l'ancienne transcription dans
  // le champ (bug : le chat redémarre avec l'ancien texte). À utiliser à l'envoi —
  // stopRec(), lui, conserve volontairement le texte pour le toggle micro.
  const resetRecognition = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* déjà arrêtée */
      }
      recRef.current = null;
    }
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    baseTextRef.current = "";
    setRecognizing(false);
  }, []);

  // ── Brief complet pour la planification ──────────────────────────────────────
  // noteText = le besoin validé (contenu de la need card du board, ou la note en démo).
  const buildBrief = useCallback((msgs: Msg[], noteText: string): string => {
    const transcript = msgs
      .map((m) => `**${m.role === "user" ? "Client" : "Chef de projet"}** : ${m.text}`)
      .join("\n\n");
    return [
      "# Échange de cadrage",
      transcript || "(brief déposé directement)",
      "",
      "# Besoin validé par le client",
      noteText,
    ].join("\n");
  }, []);


  // ── Génération/itération de la maquette (docs/18 §2, §4, §5) ─────────────────
  // Régénération HTML INTÉGRALE à chaque appel (seed + previousHtml + feedback) — jamais de
  // patch côté client. On bufferise jusqu'au "done" : jamais d'iframe montée sur du HTML partiel.
  const callMaquette = useCallback(
    async (opts: { seed: string; previousHtml?: string; feedback?: string }) => {
      maquetteAbortRef.current?.abort();
      const ctrl = new AbortController();
      maquetteAbortRef.current = ctrl;
      const isCurrentMockup = () => maquetteAbortRef.current === ctrl;

      setMockupBuilding(true);
      setError("");
      try {
        const res = await fetch("/api/maquette", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...opts, demo }),
          signal: ctrl.signal,
        });

        const ct = res.headers.get("content-type") ?? "";

        // Mode démo : JSON direct (pas de flux), comme /api/brief.
        if (!ct.includes("event-stream")) {
          const data = await res.json();
          if (!isCurrentMockup()) return;
          if (!res.ok) throw new Error(data.error ?? "Erreur de génération de la maquette");
          setBoard({ title: "Maquette du site", content: data.html, kind: "maquette", seed: opts.seed });
          setMockupBuilding(false);
          return;
        }

        // Flux SSE : "delta" = signal de vie uniquement (on ne rend rien tant que ce n'est
        // pas complet) ; "done" porte le HTML final.
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let html = "";
        for (;;) {
          if (!isCurrentMockup()) {
            try {
              await reader.cancel();
            } catch {
              /* déjà fermé */
            }
            return;
          }
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            const payloadLine = chunk.startsWith("data:") ? chunk.slice(5).trim() : chunk.trim();
            if (!payloadLine) continue;
            let evt: { t?: string; text?: string; html?: string; error?: string };
            try {
              evt = JSON.parse(payloadLine);
            } catch {
              continue;
            }
            if (evt.t === "done") html = evt.html ?? "";
            else if (evt.t === "error") throw new Error(evt.error ?? "Erreur de génération de la maquette");
          }
        }
        if (!isCurrentMockup()) return;
        if (!html) throw new Error("La maquette générée est vide — réessaie.");
        setBoard({ title: "Maquette du site", content: html, kind: "maquette", seed: opts.seed });
        setMockupBuilding(false);
      } catch (e) {
        if (!isCurrentMockup() || (e instanceof Error && e.name === "AbortError")) return;
        setError(e instanceof Error ? e.message : "Erreur de génération de la maquette");
        setMockupBuilding(false);
      }
    },
    [demo],
  );

  // ── Retouche directe en phase maquette (fast-path, docs/18 §4/§7 — V2 anticipée) ────────────
  // Une fois en phase maquette, un message du composer (texte OU dictée) est TOUJOURS une
  // retouche visuelle : il part DIRECTEMENT au maquettiste (/api/maquette), sans repasser par
  // le bras droit (/api/brief, Opus) qui relirait toute la conversation pour rien à chaque tour.
  // Le bras droit ne sert plus qu'à l'ENTRÉE en phase maquette (1ère détection MODE: maquette,
  // gérée dans finalize() ci-dessous, flux `send()` classique inchangé).
  async function sendMaquetteFeedback(rawText: string) {
    handsFreeRef.current = recognizingRef.current;
    resetRecognition(); // jette toute dictée en attente avant de vider le champ
    setError("");
    const feedback = rawText.trim();
    if (!feedback) {
      setError("Décrivez la retouche à apporter (texte ou micro).");
      return;
    }
    // Cas limite : pas de graine (ne devrait pas arriver en phase maquette) ou 1ère génération
    // encore en cours (board sans HTML — ex. refresh en pleine génération initiale, cf. rendu du
    // board) : on ne peut pas itérer sur du vide, on prévient proprement plutôt que de planter
    // ou d'écraser la maquette en construction.
    if (!mockupSeed || mockupBuilding || !board?.content) {
      setError("La maquette est encore en cours de génération — patiente un instant avant de retoucher.");
      return;
    }
    const optimistic: Msg[] = [
      ...messages,
      { role: "user", text: feedback },
      // Trace chat discrète (comme à l'entrée en phase maquette, cf. finalize()) : pas de redite
      // du HTML dans le fil, pas de voix (le maquettiste ne narre pas une retouche).
      { role: "assistant", text: "", mode: "maquette", boardUpdate: true },
    ];
    setMessages(optimistic);
    setText("");
    setFiles([]);
    void callMaquette({ seed: mockupSeed, previousHtml: board.content, feedback });
  }

  // Bascule une option de réponse (single = remplace, multi = ajoute/retire).
  function toggleAnswer(q: Question, opt: string) {
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      if (q.type === "multi") {
        return { ...prev, [q.id]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt] };
      }
      return { ...prev, [q.id]: cur.includes(opt) ? [] : [opt] };
    });
  }

  // Envoie les réponses sélectionnées (formulaire) — pas via le champ de saisie.
  function submitAnswers(qs: Question[]) {
    const parts = qs
      .map((q) => {
        const sel = answers[q.id] ?? [];
        return sel.length ? `${q.text} → ${sel.join(", ")}` : null;
      })
      .filter(Boolean) as string[];
    const extra = text.trim();
    const payload = [parts.join(" ; "), extra].filter(Boolean).join(" ; ");
    if (!payload) {
      setError("Sélectionnez au moins une réponse (ou écrivez).");
      return;
    }
    setAnswers({});
    void send({ override: payload });
  }

  // ── Un tour de conversation (texte uniquement : la voix a déjà été transcrite) ─
  async function send(opts: { force?: boolean; override?: string } = {}) {
    const { force = false, override } = opts;
    // Stage figé pour TOUTE la durée de ce tour (docs/26 §incrément 2) : capté une fois ici,
    // jamais relu depuis l'état React pendant le flux — un changement de conversation en vol
    // annule déjà ce flux via `isCurrent()` avant qu'il ne touche l'état, donc ce figeage ne
    // risque aucune incohérence, il documente juste l'intention.
    const stageAtSend = stage;
    // Fast-path retouche (docs/18 §4/§7) : en phase maquette, tout texte du composer EST une
    // retouche → direct au maquettiste, jamais au bras droit. Cf. sendMaquetteFeedback ci-dessus.
    // Hors périmètre du stage "echange" par construction : une conversation "echange" n'a jamais
    // de board (donc jamais de phase "maquette", cf. openConversation/bootstrap).
    if (phase === "maquette") {
      await sendMaquetteFeedback(override ?? text);
      return;
    }
    // Le tour part-il de la voix ? (micro actif à l'instant de l'envoi = échange vocal en cours).
    // Capté AVANT resetRecognition, qui va couper le micro.
    handsFreeRef.current = recognizingRef.current;
    resetRecognition(); // jette toute dictée en attente avant de vider le champ
    setError("");
    setLaunchNote(""); // le GO ne réapparaît que si la nouvelle réponse cristallise un besoin
    const payload = (override ?? text).trim();
    const attached = files;
    if (!force && !payload && !demo && attached.length === 0 && !url.trim()) {
      setError("Parlez (🎤), écrivez, ou joignez un fichier.");
      return;
    }

    // P0-1 : un nouveau tour annule le flux SSE encore en cours (s'il y en a un). Sans ça,
    // un ancien fetch/lecture SSE continuerait à écrire dans l'état — voire dans la MAUVAISE
    // conversation si l'utilisateur en a changé entre-temps → corruption. `isCurrent()` sert de
    // jeton : toute écriture d'état issue de CE flux le vérifie d'abord.
    sendAbortRef.current?.abort();
    // Un nouveau tour de chat annule aussi une génération de maquette en cours (P0-1 étendu,
    // docs/18 §4) — sinon une réponse périmée pourrait écraser le board après coup.
    maquetteAbortRef.current?.abort();
    const ctrl = new AbortController();
    sendAbortRef.current = ctrl;
    const isCurrent = () => sendAbortRef.current === ctrl;

    setLoading(true);
    const capturedUrl = url.trim();
    const userLine =
      payload || (attached.length ? `📎 ${attached.length} pièce(s) jointe(s)` : capturedUrl ? `🔗 ${capturedUrl}` : "");
    const optimistic: Msg[] = userLine ? [...messages, { role: "user", text: userLine }] : messages;
    if (userLine) setMessages(optimistic);
    setText("");
    setFiles([]);
    setUrl(""); // capturée une seule fois, au 1er tour — jamais renvoyée aux tours suivants
    try {
      const fd = new FormData();
      // `stage` généralise `mode` côté serveur (docs/23 §2.2 règle 1). Par défaut (aucune
      // conversation "echange" n'est encore atteignable sur /voice, rail dormant docs/26
      // §incrément 2) on envoie toujours "cadrage" : /api/brief garde son triage MODE:/BOARD:
      // habituel (BRAS_DROIT_INSTRUCTIONS) — comportement identique à aujourd'hui. Seule une
      // conversation ouverte au stage "echange" envoie "echange" (bascule serveur ECHANGE_OPS).
      fd.append("stage", stageForBrief(stageAtSend));
      fd.append("history", JSON.stringify(messages.map((m) => ({ role: m.role, content: m.text }))));
      fd.append("text", payload);
      for (const f of attached) fd.append("files", f);
      if (force) fd.append("force", "1");
      if (demo) fd.append("demo", "1");
      if (capturedUrl) fd.append("url", capturedUrl);

      const res = await fetch("/api/brief", { method: "POST", body: fd, signal: ctrl.signal });

      // Finalisation commune (flux terminé OU réponse démo/JSON). Ne touche plus l'état si ce
      // flux est devenu périmé entre-temps (nouveau tour / changement de conversation).
      const finalize = (data: BriefDone) => {
        if (!isCurrent()) return;
        if (data.board) setBoard(data.board);
        if (data.urlWarning) setError(data.urlWarning); // URL morte : jamais d'échec silencieux
        const isMaquetteTurn = data.mode === "maquette" && !!data.maquetteSeed;
        // Le livrable vit dans le board, la voix le narre : pas de redite du texte oral dans le
        // chat. On garde `text` (= la phrase VOIX) pour l'historique/le bouton "Écouter", mais le
        // rendu affiche un indicateur discret plutôt que le texte (cf. render, `boardUpdate`).
        const chatText = data.board ? (data.spoken ?? "") : isMaquetteTurn ? (data.spoken ?? "") : data.reply;
        const next: Msg[] = [
          ...optimistic,
          {
            role: "assistant",
            text: chatText,
            mode: data.mode,
            isNote: data.isNote,
            questions: data.questions ?? undefined,
            spoken: data.spoken ?? undefined,
            boardUpdate: !!data.board || isMaquetteTurn,
          },
        ];
        setMessages(next);
        // Cadrage projet → le besoin est cristallisé (need card du board, ou note en
        // démo). On l'arme pour le GO ; le plan détaillé sera fait au lancement.
        if (data.isNote) {
          setLaunchNote(data.board?.content ?? data.reply);
        }
        // Projet visuel détecté (docs/18 §4) : génération AUTOMATIQUE de la maquette, sans
        // bouton. Ce tour est TOUJOURS l'ENTRÉE en phase maquette (1ère détection MODE: maquette
        // depuis phase "chat") — vu le fast-path retouche (sendMaquetteFeedback, plus haut), une
        // fois en phase maquette les tours suivants ne repassent plus jamais par ici.
        if (isMaquetteTurn) {
          const seed = data.maquetteSeed!;
          setMockupSeed(seed);
          setBoard({ title: "Maquette du site", content: "", kind: "maquette" });
          setPhase("maquette");
          void callMaquette({ seed });
        }
        // Ré-écoute mains-libres autorisée seulement si l'échange est vocal ET qu'aucun geste
        // n'attend un clic : need card/GO (isNote), formulaire de questions, ou maquette en
        // construction (le résultat arrive de façon asynchrone, hors de ce tour) → on rend la main.
        pendingAutoListenRef.current =
          handsFreeRef.current &&
          !data.isNote &&
          !(data.questions && data.questions.length > 0) &&
          !isMaquetteTurn;
      };

      const ct = res.headers.get("content-type") ?? "";

      // Démo / erreurs : JSON classique.
      if (!ct.includes("event-stream")) {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
        finalize(data);
        return;
      }

      // Flux SSE : le bras droit "écrit en live".
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let raw = "";
      let headerParsed = false;
      let liveMode: Mode | null = null;
      let finalData: BriefDone | null = null;
      let spokeEarly = false; // a-t-on déjà lancé la lecture de la ligne VOIX en cours de flux ?

      // Ne jamais laisser fuir un bloc ```json à l'écran (même partiel/en cours de frappe) :
      // les questions seront rendues en puces cliquables à la fin du flux. Hissé en dehors de
      // la boucle pour être réutilisable par le repli de fin de flux (P0-3, ci-dessous).
      const stripJson = (s: string) =>
        s.replace(/```json[\s\S]*?```/g, "").replace(/```json[\s\S]*$/, "").trimEnd();

      const showLive = (body: string) => {
        if (!isCurrent()) return;
        setMessages([...optimistic, { role: "assistant", text: body || "…", mode: liveMode ?? undefined, streaming: true }]);
      };
      showLive("");

      for (;;) {
        if (!isCurrent()) {
          // Flux périmé (nouveau tour / changement de conversation pendant la lecture) : on
          // abandonne sans plus toucher l'état, et on relâche le flux réseau.
          try {
            await reader.cancel();
          } catch {
            /* déjà fermé */
          }
          return;
        }
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          const payloadLine = chunk.startsWith("data:") ? chunk.slice(5).trim() : chunk.trim();
          if (!payloadLine) continue;
          let evt: { t?: string; text?: string; error?: string } & BriefDone;
          try {
            evt = JSON.parse(payloadLine);
          } catch {
            continue;
          }
          if (evt.t === "delta") {
            raw += evt.text ?? "";
            // Stage "echange" (docs/26 §incrément 2, rail dormant) : ECHANGE_OPS renvoie du
            // texte oral BRUT, SANS ligne MODE:/VOIX:/BOARD: (cf. route.ts) — on l'affiche en
            // live tel quel, sans tenter aucun parse board/questions/MODE. Le garde-fou stage se
            // lit sur `stageAtSend` (état figé au début du tour), JAMAIS sur une ligne MODE: du
            // LLM : cette branche ne dépend d'aucun contenu du flux.
            if (stageAtSend === "echange") {
              showLive(raw);
            } else {
              if (!headerParsed) {
                const nl = raw.indexOf("\n");
                if (nl >= 0) {
                  const mm = /^MODE:\s*(direct|questions|cadrage|maquette)/i.exec(raw.slice(0, nl));
                  liveMode = (mm?.[1]?.toLowerCase() as Mode) ?? "questions";
                  headerParsed = true;
                }
              }
              // Voix en premier : la ligne VOIX arrive tout au début du flux. Pour les réponses
              // LONGUES (board / questions), on la LIT dès qu'elle est complète, sans attendre la
              // fin de l'écriture (sinon la voix ne démarre qu'après ~20 s de génération du board).
              // Direct court : on laisse l'auto-lecture après coup (qui gère aussi la ré-écoute).
              if (!spokeEarly && voiceOn && isCurrent()) {
                const voixM = /^\s*VOIX\s*:\s*(.+)\n/im.exec(raw);
                const longReply = liveMode === "questions" || /^\s*BOARD\s*:/im.test(raw) || /```json/.test(raw);
                if (voixM && longReply) {
                  spokeEarly = true;
                  autoPlayedRef.current = optimistic.length; // pas de relecture en double après done
                  void speak(voixM[1].trim(), optimistic.length, true);
                }
              }
              // Affichage live hors mode "questions" (qui contient un bloc JSON à ne pas montrer brut).
              if (headerParsed && liveMode !== "questions") {
                const ps = parseStream(raw);
                if (ps.board) {
                  // Le livrable se construit dans le board ; le chat ne montre que la voix.
                  if (isCurrent()) setBoard({ title: ps.boardTitle || "Brouillon", content: stripJson(ps.body) });
                  showLive(ps.spoken || "Je rédige le brouillon dans le board…");
                } else {
                  showLive(stripJson(ps.body));
                }
              }
            }
          } else if (evt.t === "done") {
            finalData = evt;
          } else if (evt.t === "error") {
            throw new Error(evt.error ?? "Erreur serveur");
          }
        }
      }
      if (finalData) {
        finalize(finalData);
      } else if (isCurrent() && raw.trim()) {
        // P0-3 : le flux s'est coupé APRÈS des deltas mais AVANT l'événement "done". Sans ce
        // repli, la bulle resterait figée en `streaming:true` pour toujours et le tour ne
        // serait jamais persisté. Le repli se branche sur `stageAtSend` (garde-fou reporté de
        // l'incr. 2, docs/26 §incrément 3) — JAMAIS sur un contenu du flux : en stage "echange",
        // ECHANGE_OPS ne produit AUCUN protocole MODE:/VOIX:/BOARD:, donc passer `raw` dans
        // `parseReply` lui ferait déduire à tort `mode:"questions"` (son défaut faute de ligne
        // MODE:) — on finalise directement le texte oral brut, à l'identique de ce que le serveur
        // envoie sur l'événement "done" pour ce stage (cf. route.ts).
        if (stageAtSend === "echange") {
          finalize({ reply: raw.trim(), mode: "echange", isNote: false, questions: undefined, spoken: null, board: null });
        } else {
          // Hors stage "echange" : extraction via la MÊME logique que le serveur (parseReply) —
          // couvre aussi la ligne MAQUETTE.
          const parsed = parseReply(raw);
          finalize({
            reply: parsed.reply || raw.trim(),
            mode: parsed.mode,
            isNote: parsed.isNote,
            questions: (parsed.questions as Question[] | null) ?? undefined,
            spoken: parsed.spoken,
            board: parsed.board,
            maquetteSeed: parsed.maquetteSeed,
          });
        }
      }
    } catch (e) {
      if (!isCurrent() || (e instanceof Error && e.name === "AbortError")) return; // flux périmé/annulé : rien à afficher
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      // Échec : on retire la bulle utilisateur optimiste (et toute bulle en cours
      // de frappe) et on rend la saisie + les pièces jointes pour pouvoir réessayer.
      setMessages(messages);
      if (payload) setText(payload);
      if (attached.length) setFiles(attached);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }

  // ── GO : coordonne l'équipe sur le plan validé ───────────────────────────────
  async function confirmGo() {
    if (!launchNote) return;
    setLaunching(true);
    setError("");
    stopAudio();
    try {
      // Pas de plan pré-généré : /api/run planifie côté serveur et le détail s'affiche
      // sur /run/[id]. On envoie juste le besoin validé.
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: buildBrief(messages, launchNote), demo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur au lancement");
      router.push(`/run/${data.runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setLaunching(false);
    }
  }

  // Repart d'une conversation vierge SANS toucher à l'historique (la conversation en cours,
  // si elle a des messages, reste sauvegardée et accessible via le tiroir).
  function newConversation() {
    // P0-1 : abandonne tout flux SSE en cours AVANT de vider l'état — sinon ses "delta"/"done"
    // arriveraient encore et écriraient dans la conversation vierge qui vient de démarrer.
    // Idem pour une génération de maquette en cours (docs/18 §4).
    sendAbortRef.current?.abort();
    sendAbortRef.current = null;
    maquetteAbortRef.current?.abort();
    maquetteAbortRef.current = null;
    stopAudio();
    resetRecognition();
    setLoading(false); // P0-1 : le tour abandonné ne remettra plus loading=false (son finally est gardé par isCurrent)
    skipPersistRef.current = true;
    convIdRef.current = null;
    convCreatedAtRef.current = "";
    titleCustomRef.current = false;
    titleRef.current = "";
    setConvId(null);
    // Défaut STRICTEMENT inchangé (docs/26 §incrément 2) : une nouvelle conversation démarre
    // toujours engagée (cadrage/maquette-first) — le stage "echange" n'est jamais le point de
    // départ d'une conversation neuve.
    setStage("cadrage");
    setMessages([]);
    setBoard(null);
    setText("");
    setUrl("");
    setPhase("chat");
    setMockupSeed("");
    setMockupBuilding(false);
    setAnswers({});
    setFiles([]);
    setError("");
    setEditingCrystal(false);
    setFromMic(false);
    setLaunchNote("");
    autoPlayedRef.current = -1;
    pendingAutoListenRef.current = false;
    setHistOpen(false);
  }

  // ── Historique : ouvrir / renommer / supprimer ────────────────────────────────
  async function openConversation(id: string) {
    const conv = await getConversation(id);
    if (!conv) return;
    // P0-1 : idem newConversation — on quitte la conversation en cours, un flux SSE (ou une
    // génération de maquette) périmé ne doit plus jamais écrire dans celle qu'on va ouvrir.
    sendAbortRef.current?.abort();
    sendAbortRef.current = null;
    maquetteAbortRef.current?.abort();
    maquetteAbortRef.current = null;
    stopAudio();
    resetRecognition();
    setLoading(false); // P0-1 : idem newConversation — sinon le composer reste figé « Je réfléchis… » après ouverture
    skipPersistRef.current = true;
    convIdRef.current = conv.id;
    convCreatedAtRef.current = conv.createdAt;
    titleCustomRef.current = conv.titleIsCustom;
    titleRef.current = conv.title;
    setConvId(conv.id);
    // Rail docs/26 §incrément 2 : le stage suit celui de LA CONVERSATION OUVERTE (jamais dérivé
    // du contenu/LLM) — c'est le SEUL chemin par lequel /voice peut porter un stage "echange"
    // aujourd'hui (aucun point d'entrée ne crée encore une telle conversation depuis /voice).
    setStage(conv.stage);
    const msgs = conv.messages as Msg[];
    setMessages(msgs);
    autoPlayedRef.current = msgs.length - 1;
    // Garde de cohérence (revue reportée incr. 2, docs/26 §incrément 3) : ouvrir depuis
    // l'historique une conversation "echange" ouvre le rail échange PROPREMENT — jamais de
    // demi-état, même si l'objet stocké contient un board incohérent. Cf. `boardForStage`.
    const loadedBoard = boardForStage(conv.stage, (conv.board as Board) ?? null);
    setBoard(loadedBoard);
    // La maquette survit au refresh/à la réouverture : kind + seed voyagent gratis via le board
    // (IndexedDB, unknown) — on redérive juste la phase pour router les tours suivants.
    setPhase(loadedBoard?.kind === "maquette" ? "maquette" : "chat");
    setMockupSeed(loadedBoard?.kind === "maquette" ? (loadedBoard.seed ?? "") : "");
    setMockupBuilding(false);
    setText("");
    setUrl("");
    setAnswers({});
    setFiles([]);
    setError("");
    setLaunchNote("");
    pendingAutoListenRef.current = false;
    setHistOpen(false);
  }

  async function onRenameConv(id: string, title: string) {
    try {
      await renameConversation(id, title);
      if (id === convIdRef.current) {
        titleCustomRef.current = true;
        titleRef.current = title;
      }
      await refreshList();
    } catch {
      setError("Impossible de renommer — le stockage du navigateur est peut-être bloqué.");
    }
  }

  async function onDeleteConv(id: string) {
    try {
      await deleteConversation(id);
      if (id === convIdRef.current) newConversation();
      await refreshList();
    } catch {
      setError("Impossible de supprimer — le stockage du navigateur est peut-être bloqué.");
    }
  }

  function downloadBoard() {
    if (!board) return;
    const isMockup = board.kind === "maquette";
    const blob = new Blob([board.content], { type: isMockup ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${(board.title || "brouillon").replace(/[^\w-]+/g, "-").toLowerCase()}.${isMockup ? "html" : "md"}`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  // En phase maquette, une retouche est déjà en cours de génération → on bloque le composer
  // (évite un 2e feedback qui percuterait le premier ; callMaquette gère déjà l'abort, mais
  // autant éviter la confusion côté utilisateur).
  const maquetteBusy = phase === "maquette" && mockupBuilding;

  function onFieldKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && !maquetteBusy) void send();
    }
  }

  const statusText = recognizing
    ? "Je vous écoute…"
    : speaking
      ? "Je vous réponds…"
      : loading
        ? "Je réfléchis…"
        : "En ligne · prêt à lancer un projet";
  const busy = recognizing || speaking || loading;
  const avatarState = speaking ? "speaking" : recognizing ? "listening" : "";
  // Une bulle assistant est déjà en train d'afficher la frappe → pas de doublon en bas.
  const streamingActive = messages[messages.length - 1]?.streaming ?? false;
  // États de l'accueil Shazam : idle (geste) / listening (écoute) / crystal (carte d'écho
  // après dictée). Une fois la conversation lancée (started), l'accueil disparaît.
  const heroState = started
    ? "active"
    : recognizing
      ? "listening"
      : fromMic && text.trim()
        ? "crystal"
        : "idle";

  // Le minuteur d'auto-envoi appelle sendRef.current() → toujours le send() du dernier
  // rendu (donc le `text` à jour), jamais une closure figée au démarrage du micro.
  sendRef.current = send;

  return (
    <div className="voice" data-mode="projet">
      <HistoryPanel
        variant="drawer"
        open={histOpen}
        onClose={() => setHistOpen(false)}
        items={convList}
        activeId={convId}
        onNew={newConversation}
        onSelect={openConversation}
        onRename={onRenameConv}
        onDelete={onDeleteConv}
      />
      {/* En-tête : accueil (avant) / barre compacte (pendant) */}
      {!started ? (
        <div className="shazam" data-state={heroState}>
          <button
            type="button"
            className="cbtn hist-btn voice-hist-fab"
            onClick={() => setHistOpen(true)}
            aria-label="Historique des conversations"
            title="Historique"
          >
            <IcoHistory />
          </button>
          {heroState === "crystal" ? (
            <div className="sh-crystal">
              <p className="eyebrow">Voici ce que j'ai compris</p>
              {editingCrystal ? (
                <textarea
                  className="textarea sh-edit"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  autoFocus
                />
              ) : (
                <p className="sh-crystal-card">« {text} »</p>
              )}
              <div className="toolbar" style={{ justifyContent: "center", marginTop: "0.9rem" }}>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    setEditingCrystal(false);
                    void send();
                  }}
                  disabled={loading}
                >
                  Confirmer →
                </button>
                <button type="button" className="btn" onClick={() => setEditingCrystal((v) => !v)}>
                  {editingCrystal ? "OK" : "Modifier"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setEditingCrystal(false);
                    setText("");
                    startRec();
                  }}
                >
                  Redicter
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Eyebrow optionnel (docs/25 §1) : ancre "gratuit" avant même le titre. */}
              <p className="eyebrow sh-eyebrow">Maquette gratuite — sans engagement</p>
              <h1 className="sh-title">Voyons à quoi ressemble votre site.</h1>
              <p className="sh-sub">
                Décrivez votre activité, ou collez l'adresse de votre site actuel. Vous voyez la
                maquette avant de payer un centime.
              </p>
              {/* Pendant la dictée : juste l'indicateur d'écoute. La transcription live est déjà
                  visible dans le champ juste en dessous (source unique) — pas de doublon. */}
              {recognizing && <p className="sh-listening">J'écoute…</p>}
              {/* Chemin PRIMAIRE : décrire son activité (docs/25 §2). Le micro n'est plus le gros
                  bouton vedette de l'écran — il devient une icône compacte accolée au champ, mais
                  reste pleinement fonctionnel (toggle démarrer/arrêter la dictée). */}
              <div className="sh-write">
                <input
                  className="input"
                  value={text}
                  onChange={(e) => {
                    setFromMic(false);
                    setText(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && text.trim() && !loading) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Décrivez votre activité en une phrase…"
                  aria-label="Décrivez votre activité"
                />
                <button
                  type="button"
                  className={`sh-mic ${recognizing ? "rec" : ""}`}
                  onClick={toggleRec}
                  aria-label={recognizing ? "Arrêter de parler" : "Parler"}
                  title={recognizing ? "Arrêter" : "Appuyez et dites votre besoin"}
                >
                  <span className="sh-rings" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                  {recognizing ? <IcoStop /> : <IcoMic />}
                </button>
                <button
                  type="button"
                  className="cbtn send"
                  onClick={() => send()}
                  disabled={loading || (!text.trim() && !url.trim())}
                  aria-label="Envoyer"
                  title="Envoyer"
                >
                  <IcoSend />
                </button>
              </div>
              {!recognizing && (
                <>
                  <div className="chips sh-examples">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        className="chip"
                        onClick={() => {
                          setFromMic(false);
                          setText(ex);
                        }}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                  <div className="sh-or">
                    <span className="sh-or-line" /> ou, si vous avez déjà un site <span className="sh-or-line" />
                  </div>
                  {/* Chemin SECONDAIRE, optionnel : coller l'URL d'un site existant. Capture
                      d'URL (service site — création/rebranding, docs/19 §1) : si renseignée, on
                      capte le contenu réel du site existant côté serveur et on l'injecte dans le
                      brief de la maquette (jamais un écran séparé). */}
                  <div className="sh-url">
                    <input
                      className="input"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (text.trim() || url.trim()) && !loading) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      placeholder="Adresse de votre site actuel (si vous en avez un)"
                      aria-label="URL de votre site actuel"
                    />
                  </div>
                  <p className="muted sh-url-note">
                    On récupère son contenu pour vous proposer une nouvelle version.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="vbar">
          <button
            type="button"
            className="cbtn hist-btn"
            onClick={() => setHistOpen(true)}
            aria-label="Historique des conversations"
            title="Historique"
          >
            <IcoHistory />
          </button>
          <div className={`avatar ${avatarState}`}>CdP</div>
          <div className="id">
            <span className="name">Chef de projet</span>
            <span className="status-line">
              <span className={`live-dot ${busy ? "busy" : ""}`} /> {statusText}
            </span>
          </div>
          <span className="header-spacer" />
          {/* Visible UNIQUEMENT au stage "echange" (docs/26 §incrément 3) — jamais sur une
              conversation déjà engagée (cadrage/maquette/prod). */}
          {stage === "echange" && (
            <button
              type="button"
              className="btn"
              onClick={() => void engageToProject()}
              disabled={engaging}
              title="Transformer cet échange en projet (conserve tout l'historique, même fil)"
            >
              {engaging ? "Transformation…" : "Transformer en projet →"}
            </button>
          )}
          <button
            type="button"
            className="cbtn"
            onClick={newConversation}
            aria-label="Nouvelle conversation"
            title="Nouvelle conversation (garde l'échange en cours dans l'historique)"
          >
            <IcoNewChat />
          </button>
          <button
            type="button"
            className={`cbtn ${voiceOn ? "voice-on" : ""}`}
            onClick={() =>
              setVoiceOn((v) => {
                if (v) stopAudio(); // on coupe → on arrête une lecture en cours
                return !v;
              })
            }
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Couper la voix" : "Activer la voix"}
            title={voiceOn ? "Voix activée — cliquer pour couper" : "Voix coupée — cliquer pour activer"}
          >
            {voiceOn ? <IcoSpeaker /> : <IcoSpeakerOff />}
          </button>
        </div>
      )}

      {demo && !started && (
        <div className="banner info">
          ▶️ <strong>Démo</strong> — scénario pré-écrit, sans IA. Envoyez le brief, répondez, donnez le GO.
        </div>
      )}

      {started && (
      <div className={`workspace ${board ? "split" : ""}`}>
        {board && (
          <aside className="board-pane">
            <div className="board-head">
              <div className="board-titlewrap">
                <div className="board-eyebrow-row">
                  <div className="eyebrow">{board.kind === "maquette" ? "Board · maquette en live" : "Board · brouillon en live"}</div>
                  {/* Badge de réassurance (docs/25 §3) : la promesse "gratuit" du hero reste
                      visible pendant la construction de la maquette, pas seulement au souvenir. */}
                  {board.kind === "maquette" && <span className="pill soft">Gratuit</span>}
                </div>
                <div className="board-title">
                  {board.title}
                  {board.kind === "maquette" && mockupBuilding && (
                    <span className="muted" style={{ fontWeight: 500, fontSize: "0.85rem" }}> · en construction…</span>
                  )}
                </div>
              </div>
              <div className="board-actions">
                <button
                  type="button"
                  className="cbtn"
                  onClick={downloadBoard}
                  title={board.kind === "maquette" ? "Télécharger (.html)" : "Télécharger (.md)"}
                  aria-label="Télécharger"
                >
                  <IcoDownload />
                </button>
                <button type="button" className="cbtn" onClick={() => setBoard(null)} title="Fermer le board" aria-label="Fermer">
                  <IcoClose />
                </button>
              </div>
            </div>
            <div className={`board-body ${board.kind === "maquette" ? "board-body-mockup" : ""}`}>
              {board.kind === "maquette" ? (
                // mockupBuilding : génération en cours (on ne monte jamais l'iframe sur du HTML
                // partiel). !board.content : cas bord d'un refresh pendant la toute 1ère
                // génération (persisté avant que le HTML final n'arrive) — même indicateur plutôt
                // qu'un iframe vide.
                mockupBuilding || !board.content ? (
                  <div className="mockup-building">
                    <span className="dot running" /> La maquette se construit…
                  </div>
                ) : (
                  <MockupFrame html={board.content} />
                )
              ) : (
                <Markdown markdown={board.content || "…"} />
              )}
            </div>
          </aside>
        )}
        <div className="chat-pane">
      {/* Fil de conversation */}
      <div className="thread">
        {messages.map((m, i) =>
          // En cadrage réel, la need card EST dans le board → on n'affiche pas de note
          // dupliquée dans le chat. En démo (sans board), on garde la note de cadrage.
          m.role === "assistant" && m.isNote && !board ? (
            <div key={i} className="block">
              <NoteView markdown={m.text} />
              <button
                type="button"
                className="playbtn"
                style={{ marginTop: "0.55rem" }}
                onClick={() => (playingIdx === i ? stopAudio() : speak(m.spoken ?? m.text, i))}
              >
                {playingIdx === i ? <IcoStop /> : <IcoPlay />}
                {playingIdx === i ? "Stop" : "Écouter"}
              </button>
            </div>
          ) : (
            <div key={i} className={`msg ${m.role === "user" ? "me" : "bot"}${isTyping(m) ? " pending" : ""}`}>
              {m.role === "assistant" && <div className="who">Chef de projet</div>}
              {m.role === "assistant" && !m.streaming ? (
                m.boardUpdate ? (
                  <div className="muted" style={{ fontSize: "0.9rem" }}>
                    {m.mode === "maquette" ? "🎨 Maquette mise à jour" : "Mis à jour dans le board →"}
                  </div>
                ) : (
                  <Markdown markdown={m.text} />
                )
              ) : isTyping(m) ? (
                <TypingDots />
              ) : (
                <div>{m.text}</div>
              )}
              {m.role === "assistant" && !m.streaming && (
                <button
                  type="button"
                  className="playbtn"
                  style={{ marginTop: "0.45rem" }}
                  onClick={() => (playingIdx === i ? stopAudio() : speak(m.spoken ?? m.text, i))}
                >
                  {playingIdx === i ? <IcoStop /> : <IcoPlay />}
                  {playingIdx === i ? "Stop" : "Écouter"}
                </button>
              )}
              {m.questions && m.questions.length > 0 && i === messages.length - 1 && (
                <div
                  className="qform"
                  style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}
                >
                  {m.questions.map((q) => (
                    <div key={q.id}>
                      <div className="muted" style={{ fontSize: "0.9rem", marginBottom: "0.3rem" }}>
                        {q.text}
                        {q.type === "multi" ? " (plusieurs choix)" : ""}
                      </div>
                      {q.options && q.options.length > 0 && (
                        <div className="chips" style={{ marginTop: 0 }}>
                          {q.options.map((opt) => {
                            const sel = (answers[q.id] ?? []).includes(opt);
                            return (
                              <button
                                key={q.id + opt}
                                type="button"
                                className={`chip ${sel ? "selected" : ""}`}
                                aria-pressed={sel}
                                onClick={() => toggleAnswer(q, opt)}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => submitAnswers(m.questions!)}
                      disabled={loading}
                    >
                      Valider mes réponses
                    </button>
                  </div>
                </div>
              )}
            </div>
          ),
        )}

        {/* "il écrit…" — masqué si une bulle en streaming affiche déjà les points/le texte */}
        {loading && !streamingActive && (
          <div className="typing">
            <b>Chef de projet</b> <TypingDots />
          </div>
        )}
        {/* GO unique : dès que le besoin est cristallisé (need card), on lance l'équipe.
            Le plan détaillé "qui fait quoi" s'affiche après, sur la page du run. */}
        {launchNote && !loading && (
          <div className="card go-bar block">
            <div className="go-q">Ce besoin te convient&nbsp;? Sinon, dis-moi en un mot ce qu'il faut changer.</div>
            <button type="button" className="btn btn-primary btn-lg" onClick={confirmGo} disabled={launching}>
              {launching ? "Lancement…" : "✓ GO — lancer l'équipe"}
            </button>
          </div>
        )}

        {error && <div className="banner err block">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Composer — toujours dispo : on peut affiner le besoin / continuer à parler */}
        <div>
          {files.length > 0 && (
            <div className="chips" style={{ marginBottom: "0.4rem" }}>
              {files.map((f, idx) => (
                <span
                  key={f.name + idx}
                  className="chip filechip"
                  style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}
                >
                  <IcoClip /> {f.name}
                  <button
                    type="button"
                    aria-label="Retirer"
                    onClick={() => setFiles((prev) => prev.filter((_, k) => k !== idx))}
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit", fontSize: "1rem", lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length) setFiles((prev) => [...prev, ...picked]);
              e.target.value = "";
            }}
          />
          <div className="composer">
            <div className="composer-bar">
              <button
                type="button"
                className="cbtn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Joindre un fichier"
                title="Joindre un fichier"
              >
                <IcoClip />
              </button>
              <button
                type="button"
                className={`cbtn mic ${recognizing ? "rec" : ""}`}
                onClick={toggleRec}
                aria-label={recognizing ? "Arrêter la dictée" : "Dicter"}
                title={recognizing ? "Arrêter la dictée" : "Dicter à voix haute"}
              >
                {recognizing ? <IcoStop /> : <IcoMic />}
              </button>
              <textarea
                ref={fieldRef}
                className="cfield"
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onFieldKey}
                placeholder={recognizing ? "J'écoute… (vous pourrez corriger)" : started ? "Votre réponse…" : "Décrivez votre projet…"}
              />
              <button
                type="button"
                className="cbtn send"
                onClick={() => send()}
                disabled={
                  loading ||
                  (phase === "maquette" ? maquetteBusy || !text.trim() : !text.trim() && !demo && files.length === 0)
                }
                aria-label="Envoyer"
                title="Envoyer"
              >
                <IcoSend />
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
      )}
    </div>
  );
}
