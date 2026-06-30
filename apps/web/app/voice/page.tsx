"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NoteView from "../brief/NoteView";
import Markdown from "../components/Markdown";

// ── Types (alignés sur /api/brief et /api/plan) ───────────────────────────────
type Question = {
  id: string;
  text: string;
  type: "single" | "multi" | "open";
  options?: string[];
  allowFreeText?: boolean;
};
type Mode = "direct" | "questions" | "cadrage";
type Msg = { role: "user" | "assistant"; text: string; mode?: Mode; isNote?: boolean; questions?: Question[]; streaming?: boolean; spoken?: string };
type Board = { title: string; content: string };
type BriefDone = { reply: string; mode?: Mode; isNote?: boolean; questions?: Question[]; spoken?: string | null; board?: Board | null };
type RichStep = {
  id: string;
  agent: string;
  agentLabel: string;
  agentRole: string;
  title: string;
  task: string;
  dependsOn: string[];
};
type Plan = { summary: string; steps: RichStep[] };

const DEMO_PREFILL =
  "Je veux transformer une ancienne grange en tiers-lieu : un café associatif ouvert à tous, " +
  "plus des espaces de coworking, dans un village rural.";

// Les pôles de la DSI = les agents de la Factory team regroupés par métier.
// Le chiffre affiché = nb de spécialistes du pôle ; le détail apparaît au survol.
// 21 spécialistes + le chef de projet = 22 agents au total.
const POLES: { label: string; members: string[] }[] = [
  { label: "Delivery tech", members: ["développeur", "lead tech", "devops", "QA", "debugger", "perf", "sécurité"] },
  { label: "Produit & cadrage", members: ["product owner", "scrum master", "architecte"] },
  { label: "Business & ventes", members: ["direction", "business dev", "marketing", "finance", "levée de fonds"] },
  { label: "Design & com", members: ["UX/UI", "documentation"] },
  { label: "Ops & RH", members: ["operations", "RH", "manager"] },
  { label: "Risques & conformité", members: ["expert conformité"] },
];

const EXAMPLES = [
  "Relis et corrige ce mail client",
  "Aide-moi à structurer mon idée",
  "Monter une asso et la financer",
  "Un site vitrine pour mon activité",
];

// Sépare les lignes de protocole (MODE, VOIX, BOARD) du corps pendant le streaming.
function parseStream(raw: string): { board: boolean; boardTitle: string; spoken: string; body: string } {
  const lines = raw.split("\n");
  let i = 0;
  let board = false;
  let boardTitle = "";
  let spoken = "";
  for (; i < lines.length; i++) {
    const ln = lines[i];
    if (/^MODE:/i.test(ln)) continue;
    const vm = /^\s*VOIX\s*:\s*(.*)$/i.exec(ln);
    if (vm) {
      spoken = vm[1].trim();
      continue;
    }
    const bm = /^\s*BOARD\s*:\s*(.*)$/i.exec(ln);
    if (bm) {
      board = true;
      boardTitle = bm[1].trim();
      continue;
    }
    break;
  }
  return { board, boardTitle, spoken, body: lines.slice(i).join("\n").replace(/^\s+/, "") };
}

// Nettoyage du Markdown pour la lecture vocale (TTS).
function speakable(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|-]/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
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

export default function VoicePage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  // Voix muette d'office : aucune lecture auto. L'utilisateur clique "Écouter" sur une réponse au
  // besoin (le vrai temps réel viendra en V2). playingIdx = index du message en cours de lecture.
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  // Board : le brouillon de livrable que le bras droit projette et construit en live.
  const [board, setBoard] = useState<Board | null>(null);

  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [launching, setLaunching] = useState(false);
  // Réponses sélectionnées au formulaire de questions (par id de question). On envoie la sélection,
  // on ne l'injecte PAS dans le champ de saisie.
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const baseTextRef = useRef("");
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
    async (raw: string, idx: number | null = null) => {
      const txt = speakable(raw);
      if (!txt) return;
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
          setError("Voix indisponible (clé ElevenLabs manquante ou quota atteint).");
          setPlayingIdx(null);
          return;
        }
        const url = URL.createObjectURL(await res.blob());
        if (ctrl.signal.aborted) return void URL.revokeObjectURL(url);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setSpeaking(true);
        audio.onended = () => {
          setSpeaking(false);
          setPlayingIdx(null);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setSpeaking(false);
          setPlayingIdx(null);
        };
        await audio.play();
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          setSpeaking(false);
          setPlayingIdx(null);
        }
      }
    },
    [stopAudio],
  );

  // Auto-scroll en bas du fil + auto-grow du champ.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, planning, plan, loading]);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }, [text]);

  // ?demo=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      setDemo(true);
      setText((t) => t || DEMO_PREFILL);
    }
  }, []);

  // ── STT navigateur : la transcription s'écrit dans le champ, ÉDITABLE ─────────
  function startRec() {
    setError("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("La reconnaissance vocale n'est pas dispo sur ce navigateur (essaie Chrome ou Edge). Tu peux écrire ta réponse.");
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
      setText((baseTextRef.current + finalChunk + interim).replace(/\s+/g, " ").trimStart());
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      setRecognizing(false);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed")
        setError("Micro refusé — autorise l'accès au micro, ou écris ta réponse.");
    };
    rec.onend = () => setRecognizing(false);
    rec.start();
    recRef.current = rec;
    setRecognizing(true);
  }
  function stopRec() {
    recRef.current?.stop();
    setRecognizing(false);
    fieldRef.current?.focus();
  }
  function toggleRec() {
    recognizing ? stopRec() : startRec();
  }

  // ── Brief complet pour la planification ──────────────────────────────────────
  const buildBrief = useCallback((msgs: Msg[], noteIdx: number): string => {
    const transcript = msgs
      .slice(0, noteIdx)
      .map((m) => `**${m.role === "user" ? "Client" : "Chef de projet"}** : ${m.text}`)
      .join("\n\n");
    return [
      "# Échange de cadrage",
      transcript || "(brief déposé directement)",
      "",
      "# Note de cadrage validée par le client",
      msgs[noteIdx].text,
    ].join("\n");
  }, []);

  // ── Plan "qui fait quoi" (sans exécuter) ─────────────────────────────────────
  const requestPlan = useCallback(
    async (msgs: Msg[], noteIdx: number) => {
      setPlanning(true);
      setError("");
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: buildBrief(msgs, noteIdx), demo }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erreur de planification");
        const p = data.plan as Plan;
        setPlan(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setPlanning(false);
      }
    },
    [buildBrief, demo, speak],
  );

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
      setError("Sélectionne au moins une réponse (ou écris).");
      return;
    }
    setAnswers({});
    void send({ override: payload });
  }

  // ── Un tour de conversation (texte uniquement : la voix a déjà été transcrite) ─
  async function send(opts: { force?: boolean; override?: string } = {}) {
    const { force = false, override } = opts;
    if (recognizing) stopRec();
    setError("");
    const payload = (override ?? text).trim();
    const attached = files;
    if (!force && !payload && !demo && attached.length === 0) {
      setError("Parle (🎤), écris, ou joins un fichier.");
      return;
    }
    setLoading(true);
    const userLine = payload || (attached.length ? `📎 ${attached.length} pièce(s) jointe(s)` : "");
    const optimistic: Msg[] = userLine ? [...messages, { role: "user", text: userLine }] : messages;
    if (userLine) setMessages(optimistic);
    setText("");
    setFiles([]);
    try {
      const fd = new FormData();
      fd.append("history", JSON.stringify(messages.map((m) => ({ role: m.role, content: m.text }))));
      fd.append("text", payload);
      for (const f of attached) fd.append("files", f);
      if (force) fd.append("force", "1");
      if (demo) fd.append("demo", "1");

      const res = await fetch("/api/brief", { method: "POST", body: fd });

      // Finalisation commune (flux terminé OU réponse démo/JSON).
      const finalize = (data: BriefDone) => {
        if (data.board) setBoard(data.board);
        const chatText = data.board ? (data.spoken ?? "J'ai mis un premier jet dans le board →") : data.reply;
        const next: Msg[] = [
          ...optimistic,
          { role: "assistant", text: chatText, mode: data.mode, isNote: data.isNote, questions: data.questions ?? undefined, spoken: data.spoken ?? undefined },
        ];
        setMessages(next);
        if (data.isNote) void requestPlan(next, next.length - 1);
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

      const showLive = (body: string) =>
        setMessages([...optimistic, { role: "assistant", text: body || "…", mode: liveMode ?? undefined, streaming: true }]);
      showLive("");

      for (;;) {
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
            if (!headerParsed) {
              const nl = raw.indexOf("\n");
              if (nl >= 0) {
                const mm = /^MODE:\s*(direct|questions|cadrage)/i.exec(raw.slice(0, nl));
                liveMode = (mm?.[1]?.toLowerCase() as Mode) ?? "questions";
                headerParsed = true;
              }
            }
            // Affichage live hors mode "questions" (qui contient un bloc JSON à ne pas montrer brut).
            if (headerParsed && liveMode !== "questions") {
              const ps = parseStream(raw);
              if (ps.board) {
                // Le livrable se construit dans le board ; le chat ne montre que la voix.
                setBoard({ title: ps.boardTitle || "Brouillon", content: ps.body });
                showLive(ps.spoken || "Je rédige le brouillon dans le board…");
              } else {
                showLive(ps.body);
              }
            }
          } else if (evt.t === "done") {
            finalData = evt;
          } else if (evt.t === "error") {
            throw new Error(evt.error ?? "Erreur serveur");
          }
        }
      }
      if (finalData) finalize(finalData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      if (payload) setText(payload); // on rend la saisie en cas d'échec
    } finally {
      setLoading(false);
    }
  }

  // ── GO : coordonne l'équipe sur le plan validé ───────────────────────────────
  async function confirmGo() {
    if (!plan) return;
    const noteIdx = messages.map((m) => !!m.isNote).lastIndexOf(true);
    if (noteIdx < 0) return;
    setLaunching(true);
    setError("");
    stopAudio();
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: buildBrief(messages, noteIdx), plan, demo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur au lancement");
      router.push(`/run/${data.runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setLaunching(false);
    }
  }

  function downloadBoard() {
    if (!board) return;
    const blob = new Blob([board.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(board.title || "brouillon").replace(/[^\w-]+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFieldKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) void send();
    }
  }

  const statusText = recognizing
    ? "Je vous écoute…"
    : speaking
      ? "Je vous réponds…"
      : loading || planning
        ? "Je réfléchis…"
        : "En ligne · prêt à lancer un projet";
  const busy = recognizing || speaking || loading || planning;
  const avatarState = speaking ? "speaking" : recognizing ? "listening" : "";

  return (
    <div className="voice">
      {/* En-tête : accueil (avant) / barre compacte (pendant) */}
      {!started ? (
        <div className="vhero">
          <div className={`avatar ${avatarState}`}>CdP</div>
          <p className="eyebrow">Ton bras droit à la demande</p>
          <h1>Demande-lui n'importe quoi. Il s'en occupe.</h1>
          <p className="lead">
            Parle ou écris. Les <strong>tâches du quotidien</strong>, il les fait lui-même, tout de suite.
            Les <strong>vrais projets</strong>, il mobilise une équipe de spécialistes et te livre.
          </p>
          <p className="muted" style={{ fontSize: "0.86rem", margin: "1.1rem 0 0" }}>
            L'équipe qu'il peut mobiliser pour un projet — <strong>21 spécialistes</strong> en 6 pôles{" "}
            <span className="muted">(survole un pôle pour voir qui s'y trouve)</span> :
          </p>
          <div className="poles">
            {POLES.map((p) => (
              <span key={p.label} className="pole" title={p.members.join(", ")}>
                {p.label} <span className="n">{p.members.length}</span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="vbar">
          <div className={`avatar ${avatarState}`}>CdP</div>
          <div className="id">
            <span className="name">Chef de projet</span>
            <span className="status-line">
              <span className={`live-dot ${busy ? "busy" : ""}`} /> {statusText}
            </span>
          </div>
          <span className="header-spacer" />
        </div>
      )}

      {demo && !started && (
        <div className="banner info">
          ▶️ <strong>Démo</strong> — scénario pré-écrit, sans IA. Envoie le brief, réponds, donne le GO.
        </div>
      )}

      <div className={`workspace ${board ? "split" : ""}`}>
        {board && (
          <aside className="board-pane">
            <div className="board-head">
              <div className="board-titlewrap">
                <div className="eyebrow">Board · brouillon en live</div>
                <div className="board-title">{board.title}</div>
              </div>
              <div className="board-actions">
                <button type="button" className="cbtn" onClick={downloadBoard} title="Télécharger (.md)" aria-label="Télécharger">
                  <IcoDownload />
                </button>
                <button type="button" className="cbtn" onClick={() => setBoard(null)} title="Fermer le board" aria-label="Fermer">
                  <IcoClose />
                </button>
              </div>
            </div>
            <div className="board-body">
              <Markdown markdown={board.content || "…"} />
            </div>
          </aside>
        )}
        <div className="chat-pane">
      {/* Fil de conversation */}
      <div className="thread">
        {!started && (
          <div className="chips" style={{ alignSelf: "center", justifyContent: "center" }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => setText(ex)}>
                {ex}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "assistant" && m.isNote ? (
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
            <div key={i} className={`msg ${m.role === "user" ? "me" : "bot"}`}>
              {m.role === "assistant" && <div className="who">Chef de projet</div>}
              {m.role === "assistant" && !m.streaming ? <Markdown markdown={m.text} /> : <div>{m.text}</div>}
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

        {loading && (
          <div className="typing">
            <b>Chef de projet</b> réfléchit…
          </div>
        )}
        {planning && (
          <div className="typing">
            <b>Chef de projet</b> prépare le plan d'action de l'équipe…
          </div>
        )}

        {/* Plan "qui fait quoi" + GO */}
        {plan && (
          <div className="card plan-card block">
            <p className="eyebrow">Plan d'action de l'équipe</p>
            <p style={{ margin: "0.2rem 0 0.6rem", fontWeight: 600 }}>{plan.summary}</p>
            {plan.steps.map((s, idx) => (
              <div key={s.id} className="plan-step">
                <span className="pidx">{idx + 1}</span>
                <div className="pbody">
                  <div className="pagent">
                    {s.agentLabel}
                    {s.agentRole ? <span className="muted" style={{ textTransform: "none", fontWeight: 400 }}> — {s.agentRole}</span> : null}
                  </div>
                  <div className="ptitle">{s.title}</div>
                  {s.task ? <div className="ptask">{s.task}</div> : null}
                </div>
              </div>
            ))}
            <div className="toolbar" style={{ marginTop: "0.9rem" }}>
              <button type="button" className="btn btn-primary btn-lg" onClick={confirmGo} disabled={launching}>
                {launching ? "Lancement…" : "✓ GO — lancer l'équipe"}
              </button>
              <button type="button" className="playbtn" onClick={() => speak(`${plan.summary}. Donne-moi le GO pour lancer.`)}>
                <IcoPlay /> Relire
              </button>
            </div>
          </div>
        )}

        {error && <div className="banner err block">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Composer — caché une fois le plan affiché (place au GO) */}
      {!plan && (
        <div>
          {started && !planning && (
            <div className="composer-aside">
              <button type="button" className="linkbtn subtle" onClick={() => send({ force: true })} disabled={loading}>
                J'ai tout dit → passer au cadrage
              </button>
            </div>
          )}
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
                disabled={loading}
                aria-label="Joindre un fichier"
                title="Joindre un fichier"
              >
                <IcoClip />
              </button>
              <button
                type="button"
                className={`cbtn mic ${recognizing ? "rec" : ""}`}
                onClick={toggleRec}
                disabled={loading}
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
                placeholder={recognizing ? "J'écoute… (tu pourras corriger)" : started ? "Ta réponse…" : "Décris ton projet…"}
              />
              <button
                type="button"
                className="cbtn send"
                onClick={() => send()}
                disabled={loading || (!text.trim() && !demo && files.length === 0)}
                aria-label="Envoyer"
                title="Envoyer"
              >
                <IcoSend />
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>

      <p style={{ marginTop: "0.4rem" }}>
        <Link href="/" className="muted">← Accueil</Link>
      </p>
    </div>
  );
}
