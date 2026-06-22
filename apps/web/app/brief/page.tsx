"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NoteView from "./NoteView";

type Question = {
  id: string;
  text: string;
  type: "single" | "multi" | "open";
  options?: string[];
  allowFreeText?: boolean;
};
type Msg = { role: "user" | "assistant"; text: string; isNote?: boolean; questions?: Question[] };
type Answer = { selected: string[]; free: string };

const DEMO_PREFILL =
  "Je veux transformer une ancienne grange en tiers-lieu : un café associatif ouvert à tous " +
  "+ des espaces de coworking, dans un village rural. Je ne sais pas par où commencer " +
  "(statut juridique, budget, travaux, comment attirer du monde).";

const EXAMPLES = [
  "Un site vitrine pour mon activité d'artisan menuisier.",
  "Une appli mobile pour organiser des covoiturages entre voisins.",
  "Monter une association culturelle et trouver des financements.",
];

export default function BriefPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [launching, setLaunching] = useState(false);
  const [demo, setDemo] = useState(false);

  const router = useRouter();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Détecte ?demo=1 (sans useSearchParams pour garder la page simple à prerendre).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      setDemo(true);
      setText((t) => t || DEMO_PREFILL);
    }
  }, []);

  const started = messages.length > 0;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const activeQuestions =
    started && lastAssistant === messages[messages.length - 1] ? lastAssistant?.questions : null;

  function ans(id: string): Answer {
    return answers[id] ?? { selected: [], free: "" };
  }
  function toggleOption(q: Question, opt: string) {
    setAnswers((prev) => {
      const cur = prev[q.id] ?? { selected: [], free: "" };
      let selected: string[];
      if (q.type === "single") selected = cur.selected.includes(opt) ? [] : [opt];
      else
        selected = cur.selected.includes(opt)
          ? cur.selected.filter((o) => o !== opt)
          : [...cur.selected, opt];
      return { ...prev, [q.id]: { ...cur, selected } };
    });
  }
  function setFree(id: string, free: string) {
    setAnswers((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { selected: [], free: "" }), free } }));
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Micro inaccessible (autorise l'accès, ou écris ta réponse).");
    }
  }
  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function compilePayload(): string {
    if (!activeQuestions) return text.trim();
    const parts = activeQuestions.map((q) => {
      const a = ans(q.id);
      const val = [...a.selected, a.free.trim()].filter(Boolean).join(" ; ") || "(sans réponse)";
      return `${q.text}\n→ ${val}`;
    });
    if (text.trim()) parts.push(`Précision libre : ${text.trim()}`);
    return parts.join("\n\n");
  }

  async function send(force = false) {
    setError("");
    const payload = compilePayload();
    const hasStructured =
      !!activeQuestions &&
      activeQuestions.some((q) => ans(q.id).selected.length > 0 || ans(q.id).free.trim());
    if (!force && !payload && !audioBlob && files.length === 0 && !hasStructured && !demo) {
      setError("Réponds à au moins une question, écris, ou enregistre un message.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("history", JSON.stringify(messages.map((m) => ({ role: m.role, content: m.text }))));
      fd.append("text", payload);
      if (force) fd.append("force", "1");
      if (demo) fd.append("demo", "1");
      if (audioBlob) fd.append("audio", audioBlob, "message.webm");
      for (const f of files) fd.append("files", f);

      const res = await fetch("/api/brief", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");

      const userText = data.userEcho || (force ? "Produis la note de cadrage maintenant." : "(envoi)");
      setMessages((prev) => [
        ...prev,
        { role: "user", text: userText },
        { role: "assistant", text: data.reply, isNote: data.isNote, questions: data.questions ?? undefined },
      ]);
      setText("");
      setAnswers({});
      setFiles([]);
      setAudioBlob(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  function launchContext(noteIdx: number): string {
    const transcript = messages
      .slice(0, noteIdx)
      .map((m) => `**${m.role === "user" ? "Client" : "Chef de projet"}** : ${m.text}`)
      .join("\n\n");
    const note = messages[noteIdx].text;
    return [
      "# Échange de cadrage",
      transcript || "(brief déposé directement)",
      "",
      "# Note de cadrage validée par le client",
      note,
    ].join("\n");
  }

  async function launch(noteIdx: number) {
    setError("");
    setLaunching(true);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: launchContext(noteIdx), demo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur au lancement");
      router.push(`/run/${data.runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setLaunching(false);
    }
  }

  return (
    <>
      <p className="eyebrow">{demo ? "Démo" : "Nouveau projet"}</p>
      <h1>Déposer un brief</h1>
      {demo && (
        <div className="banner info">
          ▶️ <strong>Mode démo</strong> — scénario pré-écrit, aucun appel à l'IA (donc gratuit).
          Envoie le brief, réponds aux questions, puis lance l'équipe pour voir le tableau de bord.
        </div>
      )}
      {!started && (
        <p className="lead">
          Le chef de projet te <strong>challenge avec des questions</strong>, puis produit une{" "}
          <strong>note de cadrage</strong>. Tu valides, et l'équipe se met au travail.
        </p>
      )}

      {/* Fil de conversation */}
      {messages.map((m, i) =>
        m.role === "assistant" && m.isNote ? (
          <div key={i}>
            <NoteView markdown={m.text} />
            <div className="toolbar" style={{ margin: "0.8rem 0 1.6rem" }}>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => launch(i)} disabled={launching}>
                {launching ? "Lancement…" : "✓ Valider et lancer l'équipe"}
              </button>
              <small className="muted">
                L'équipe produit les livrables en arrière-plan ; tu suis l'avancement sur un tableau de bord.
              </small>
            </div>
          </div>
        ) : (
          <div key={i} className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-assistant"}`}>
            <div className="who">{m.role === "user" ? "Toi" : "Chef de projet"}</div>
            <div>{m.text}</div>
          </div>
        ),
      )}

      {/* Exemples (avant de démarrer) */}
      {!started && (
        <div style={{ margin: "0.6rem 0 0.2rem" }}>
          <small className="muted">Quelques idées pour démarrer :</small>
          <div className="chips">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => setText(ex)}>
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zone d'entrée */}
      <div className="card" style={{ marginTop: "1rem" }}>
        {activeQuestions?.map((q) => (
          <div key={q.id} className="qblock">
            <div className="qtext">
              {q.text}
              {q.type === "multi" && <small className="muted"> (plusieurs choix possibles)</small>}
            </div>
            {q.type !== "open" && (
              <div className="chips">
                {q.options?.map((opt) => {
                  const sel = ans(q.id).selected.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`chip ${sel ? "selected" : ""}`}
                      onClick={() => toggleOption(q, opt)}
                    >
                      {sel ? "✓ " : ""}
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
            {(q.type === "open" || q.allowFreeText) && (
              <input
                className="input"
                type="text"
                value={ans(q.id).free}
                onChange={(e) => setFree(q.id, e.target.value)}
                placeholder={q.type === "open" ? "Ta réponse…" : "Autre / compléter…"}
                style={{ marginTop: "0.4rem" }}
              />
            )}
          </div>
        ))}

        <textarea
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={started ? 2 : 5}
          style={{ marginTop: activeQuestions ? "0.5rem" : 0 }}
          placeholder={
            !started ? "Décris ce que tu veux faire…" : activeQuestions ? "Précision libre (optionnel)…" : "Ta réponse…"
          }
        />

        <div className="toolbar" style={{ marginTop: "0.6rem" }}>
          {!recording ? (
            <button onClick={startRecording} type="button" className="btn">
              ● Vocal
            </button>
          ) : (
            <button onClick={stopRecording} type="button" className="btn">
              ■ Arrêter
            </button>
          )}
          {audioBlob && !recording && <span className="muted">vocal prêt ✓</span>}
          {!started && (
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          )}
        </div>

        <div className="toolbar" style={{ marginTop: "0.8rem" }}>
          <button onClick={() => send(false)} type="button" className="btn btn-primary" disabled={loading}>
            {loading ? "…" : started ? "Répondre" : "Envoyer au chef de projet"}
          </button>
          {started && (
            <button onClick={() => send(true)} type="button" className="btn" disabled={loading}>
              J'ai tout dit → produire la note
            </button>
          )}
        </div>
      </div>

      {error && <div className="banner err" style={{ marginTop: "0.8rem" }}>{error}</div>}

      <p style={{ marginTop: "1.4rem" }}>
        <Link href="/" className="muted">
          ← Retour à l'accueil
        </Link>
      </p>
    </>
  );
}
