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
type Msg = { role: "user" | "assistant"; text: string; mode?: Mode; isNote?: boolean; questions?: Question[] };
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

// Nettoyage du Markdown pour la lecture vocale (TTS).
function speakable(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|-]/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export default function VoicePage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [launching, setLaunching] = useState(false);

  const router = useRouter();
  const mutedRef = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const baseTextRef = useRef("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);

  const started = messages.length > 0;

  // ── TTS : voix du navigateur (V1, gratuit). V2 = TTS serveur (Cartesia). ──────
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const pick = () => {
      const v = window.speechSynthesis.getVoices();
      voiceRef.current = v.find((x) => /fr-FR/i.test(x.lang)) ?? v.find((x) => /^fr/i.test(x.lang)) ?? null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((raw: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis || mutedRef.current) return;
    const txt = speakable(raw);
    if (!txt) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt.slice(0, 600));
    u.lang = "fr-FR";
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = 1.05;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

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
    if (window.speechSynthesis) window.speechSynthesis.cancel(); // ne pas se réécouter
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

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      if (next && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
      }
      return next;
    });
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
        const acteurs = p.steps.map((s) => `${s.agentLabel}, pour ${s.title.toLowerCase()}`).join(" ; ");
        speak(`Voici l'équipe que je mobilise. ${p.summary} Concrètement : ${acteurs}. Donne-moi le feu vert pour lancer.`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setPlanning(false);
      }
    },
    [buildBrief, demo, speak],
  );

  // ── Un tour de conversation (texte uniquement : la voix a déjà été transcrite) ─
  async function send(opts: { force?: boolean } = {}) {
    const { force = false } = opts;
    if (recognizing) stopRec();
    setError("");
    const payload = text.trim();
    if (!force && !payload && !demo) {
      setError("Parle (🎤) ou écris ta réponse.");
      return;
    }
    setLoading(true);
    const optimistic: Msg[] = payload ? [...messages, { role: "user", text: payload }] : messages;
    if (payload) setMessages(optimistic);
    setText("");
    try {
      const fd = new FormData();
      fd.append("history", JSON.stringify(messages.map((m) => ({ role: m.role, content: m.text }))));
      fd.append("text", payload);
      if (force) fd.append("force", "1");
      if (demo) fd.append("demo", "1");

      const res = await fetch("/api/brief", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");

      const next: Msg[] = [
        ...optimistic,
        { role: "assistant", text: data.reply, mode: data.mode, isNote: data.isNote, questions: data.questions ?? undefined },
      ];
      setMessages(next);

      if (data.isNote) {
        speak("J'ai de quoi cadrer. La note est à l'écran, je prépare le plan d'action de l'équipe.");
        void requestPlan(next, next.length - 1);
      } else {
        const qs = (data.questions as Question[] | undefined)?.map((q) => q.text).join(". ") ?? "";
        speak([data.reply, qs].filter(Boolean).join(". "));
      }
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
    if (window.speechSynthesis) window.speechSynthesis.cancel();
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
          <button type="button" className="btn btn-ghost" onClick={toggleMute} title="Couper / activer la voix">
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      )}

      {demo && !started && (
        <div className="banner info">
          ▶️ <strong>Démo</strong> — scénario pré-écrit, sans IA. Envoie le brief, réponds, donne le GO.
        </div>
      )}

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
            </div>
          ) : (
            <div key={i} className={`msg ${m.role === "user" ? "me" : "bot"}`}>
              {m.role === "assistant" && <div className="who">Chef de projet</div>}
              {m.role === "assistant" && m.mode === "direct" ? <Markdown markdown={m.text} /> : <div>{m.text}</div>}
              {m.questions && m.questions.length > 0 && i === messages.length - 1 && (
                <div className="chips" style={{ marginTop: "0.5rem" }}>
                  {m.questions.flatMap((q) =>
                    (q.options ?? []).map((opt) => (
                      <button
                        key={q.id + opt}
                        type="button"
                        className="chip"
                        onClick={() => setText((t) => (t ? `${t} ; ${opt}` : opt))}
                      >
                        {opt}
                      </button>
                    )),
                  )}
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
              <button type="button" className="btn" onClick={() => speak(`${plan.summary}. Donne-moi le GO pour lancer.`)}>
                🔊 Relire
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
          <div className="composer">
            <button
              type="button"
              className={`iconbtn mic ${recognizing ? "rec" : ""}`}
              onClick={toggleRec}
              disabled={loading}
              aria-label={recognizing ? "Arrêter la dictée" : "Dicter"}
              title={recognizing ? "Arrêter la dictée" : "Dicter à voix haute"}
            >
              {recognizing ? "■" : "🎤"}
            </button>
            <textarea
              ref={fieldRef}
              className="field"
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onFieldKey}
              placeholder={recognizing ? "J'écoute… (tu pourras corriger)" : started ? "Ta réponse…" : "Décris ton projet…"}
            />
            <button
              type="button"
              className="iconbtn send"
              onClick={() => send()}
              disabled={loading || (!text.trim() && !demo)}
              aria-label="Envoyer"
              title="Envoyer"
            >
              {loading ? "…" : "↑"}
            </button>
          </div>
        </div>
      )}

      <p style={{ marginTop: "0.4rem" }}>
        <Link href="/" className="muted">← Accueil</Link>
      </p>
    </div>
  );
}
