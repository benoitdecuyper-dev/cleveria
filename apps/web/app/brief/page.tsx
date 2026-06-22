"use client";

import { useRef, useState } from "react";
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

export default function BriefPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState(""); // brief initial, ou précision libre / réponse ouverte
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [launching, setLaunching] = useState(false);

  const router = useRouter();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Compile l'échange + la note de cadrage validée en un brief unique pour l'orchestrateur.
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
        body: JSON.stringify({ brief: launchContext(noteIdx) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur au lancement");
      router.push(`/run/${data.runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setLaunching(false);
    }
  }

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
    if (!force && !payload && !audioBlob && files.length === 0 && !hasStructured) {
      setError("Réponds à au moins une question, écris, ou enregistre un message.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("history", JSON.stringify(messages.map((m) => ({ role: m.role, content: m.text }))));
      fd.append("text", payload);
      if (force) fd.append("force", "1");
      if (audioBlob) fd.append("audio", audioBlob, "message.webm");
      for (const f of files) fd.append("files", f);

      const res = await fetch("/api/brief", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");

      const userText =
        data.userEcho || (force ? "Produis la note de cadrage maintenant." : "(envoi)");
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

  return (
    <main>
      <p>
        <Link href="/">← Cleveria</Link>
      </p>
      <h1>Déposer un brief</h1>
      {!started && (
        <p>
          <small>
            Le chef de projet va d'abord te <strong>challenger avec des questions</strong> (cliquables),
            puis produira une <strong>note de cadrage</strong>.
          </small>
        </p>
      )}

      {/* Fil de conversation */}
      {messages.map((m, i) =>
        m.role === "assistant" && m.isNote ? (
          <div key={i}>
            <NoteView markdown={m.text} />
            <div style={{ margin: "0.75rem 0 1.5rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => launch(i)}
                disabled={launching}
                style={{
                  padding: "0.5rem 0.9rem",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: launching ? "default" : "pointer",
                  fontWeight: 600,
                }}
              >
                {launching ? "Lancement…" : "✓ Valider et lancer l'équipe"}
              </button>
              <small style={{ color: "#666" }}>
                L'équipe produit les livrables en arrière-plan ; tu suivras l'avancement sur un tableau de bord.
              </small>
            </div>
          </div>
        ) : (
          <div
            key={i}
            style={{
              margin: "0.75rem 0",
              padding: "0.5rem 0.75rem",
              borderLeft: `3px solid ${m.role === "user" ? "#999" : "#2563eb"}`,
              whiteSpace: "pre-wrap",
            }}
          >
            <small style={{ color: "#666" }}>{m.role === "user" ? "Toi" : "Chef de projet"}</small>
            <div>{m.text}</div>
          </div>
        ),
      )}

      {/* Zone d'entrée */}
      <div style={{ marginTop: "1.5rem" }}>
        {/* Questions cliquables (si le CDP en a posé) */}
        {activeQuestions?.map((q) => (
          <div key={q.id} style={{ margin: "0.75rem 0" }}>
            <div>
              <strong>{q.text}</strong>
              {q.type === "multi" && <small style={{ color: "#666" }}> (plusieurs choix possibles)</small>}
            </div>
            {q.type !== "open" &&
              q.options?.map((opt) => {
                const sel = ans(q.id).selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleOption(q, opt)}
                    style={{
                      margin: "0.25rem 0.25rem 0 0",
                      padding: "0.3rem 0.6rem",
                      borderRadius: 6,
                      border: "1px solid #ccc",
                      background: sel ? "#2563eb" : "#f1f1f1",
                      color: sel ? "#fff" : "#000",
                      cursor: "pointer",
                    }}
                  >
                    {sel ? "✓ " : ""}
                    {opt}
                  </button>
                );
              })}
            {(q.type === "open" || q.allowFreeText) && (
              <input
                type="text"
                value={ans(q.id).free}
                onChange={(e) => setFree(q.id, e.target.value)}
                placeholder={q.type === "open" ? "Ta réponse…" : "Autre / compléter…"}
                style={{ width: "100%", marginTop: "0.35rem" }}
              />
            )}
          </div>
        ))}

        {/* Texte libre : brief initial, précision, ou réponse ouverte */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={started ? 2 : 6}
          style={{ width: "100%", marginTop: activeQuestions ? "0.5rem" : 0 }}
          placeholder={
            !started
              ? "Décris ce que tu veux faire…"
              : activeQuestions
                ? "Précision libre (optionnel)…"
                : "Ta réponse…"
          }
        />

        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {!recording ? (
            <button onClick={startRecording} type="button">
              ● Vocal
            </button>
          ) : (
            <button onClick={stopRecording} type="button">
              ■ Arrêter
            </button>
          )}
          {audioBlob && !recording && <span>vocal prêt ✓</span>}
          {!started && (
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          )}
        </div>

        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={() => send(false)} type="button" disabled={loading}>
            {loading ? "…" : started ? "Répondre" : "Envoyer au chef de projet"}
          </button>
          {started && (
            <button onClick={() => send(true)} type="button" disabled={loading}>
              J'ai tout dit → produire la note de cadrage
            </button>
          )}
        </div>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}
