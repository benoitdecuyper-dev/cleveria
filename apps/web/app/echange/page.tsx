"use client";

// Mode Échange (docs/12) — conversation VOCALE mains-libres avec le bras droit.
// Boucle demi-duplex : listening → (silence) → thinking (LLM streame) → speaking (TTS)
// → listening. Pas de board, pas de questionnaire : on parle, il répond, ça ré-écoute.
// Marche avec le provider local gratuit (le serveur route selon CLEVERIA_LLM_PROVIDER).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { speakable } from "../../lib/format";
import HistoryPanel from "../components/HistoryPanel";
import {
  autoTitle,
  deleteConversation,
  getConversation,
  listConversations,
  migrateLegacyVoice,
  newId,
  nowIso,
  renameConversation,
  saveConversation,
  type ConversationSummary,
  type StoredConversation,
} from "../../lib/history";

type Msg = { role: "user" | "assistant"; text: string; streaming?: boolean };
type Phase = "idle" | "listening" | "thinking" | "speaking";

// Délai de silence après la dernière parole avant d'envoyer le tour.
const SILENCE_MS = 1500;

const IcoMic = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);
const IcoStop = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
  </svg>
);
const IcoSend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
    <path d="m21.854 2.147-10.94 10.939" />
  </svg>
);
const IcoSpeaker = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 4.7 6.5 8H3v8h3.5L11 19.3z" />
    <path d="M16 8.5a4 4 0 0 1 0 7" />
    <path d="M19.5 6a8 8 0 0 1 0 12" />
  </svg>
);
const IcoSpeakerOff = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 4.7 6.5 8H3v8h3.5L11 19.3z" />
    <line x1="22" y1="9" x2="16" y2="15" />
    <line x1="16" y1="9" x2="22" y2="15" />
  </svg>
);
const IcoHistory = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export default function EchangePage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState(""); // transcription live du tour en cours
  const [voiceOn, setVoiceOn] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState(""); // repli clavier
  const [sttSupported, setSttSupported] = useState(true);
  // Historique (docs/13)
  const [convList, setConvList] = useState<ConversationSummary[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [histOpen, setHistOpen] = useState(false);

  const router = useRouter();

  // Refs (état lu dans des callbacks async, hors cycle React) ───────────────────
  const sessionRef = useRef(false); // la boucle vocale est-elle active ?
  const phaseRef = useRef<Phase>("idle");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const finalRef = useRef(""); // final accumulé du tour courant
  const interimRef = useRef(""); // dernier interim (repli si le final n'est pas venu)
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Jeton de parole : invalide un enchaînement « après la voix, ré-écoute » périmé
  // (interruption / nouveau tour) pour ne jamais relancer l'écoute en double.
  const speakTokenRef = useRef(0);
  // Flux SSE de /api/brief en cours (P0-1) : annulé à chaque nouveau tour ET dans endSession
  // (dont newConversation/openConversation héritent), pour qu'un flux périmé ne touche plus
  // jamais l'état d'une conversation qu'on a quittée entre-temps.
  const sendAbortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Historique : id de la conversation courante + méta pour la persistance.
  const convIdRef = useRef<string | null>(null);
  const convCreatedAtRef = useRef<string>("");
  const titleCustomRef = useRef(false);
  const titleRef = useRef("");
  const skipPersistRef = useRef(false); // saute la sauvegarde juste après un chargement/reset

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Historique : migration legacy (une fois) + liste des conversations Échange ──
  const refreshList = useCallback(async () => {
    setConvList(await listConversations("echange"));
  }, []);
  useEffect(() => {
    void (async () => {
      await migrateLegacyVoice();
      await refreshList();
    })();
  }, [refreshList]);

  // Persistance : à chaque état stabilisé (aucun message en streaming), on enregistre la
  // conversation courante (création à la volée au 1er message).
  const persist = useCallback(async () => {
    const msgs = messagesRef.current.filter((m) => !m.streaming && m.text.trim());
    if (msgs.length === 0) return;
    let id = convIdRef.current;
    if (!id) {
      id = newId();
      convIdRef.current = id;
      convCreatedAtRef.current = nowIso();
      setConvId(id);
    }
    const firstUser = msgs.find((m) => m.role === "user")?.text ?? "";
    const title = titleCustomRef.current ? titleRef.current : autoTitle(firstUser);
    titleRef.current = title;
    const conv: StoredConversation = {
      id,
      mode: "echange",
      title,
      titleIsCustom: titleCustomRef.current,
      messages: msgs,
      board: null,
      createdAt: convCreatedAtRef.current || nowIso(),
      updatedAt: nowIso(),
      userId: null,
      schemaVersion: 1,
    };
    // P0-2 : saveConversation REMONTE l'échec (stockage bloqué/quota) — on ne l'avale pas, on
    // prévient via la bannière d'erreur existante. On continue à échanger (pas de blocage).
    try {
      await saveConversation(conv);
      await refreshList();
    } catch {
      setError("Impossible de sauvegarder cette conversation — le stockage du navigateur est peut-être bloqué.");
    }
  }, [refreshList]);
  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    if (messages.length === 0 || messages.some((m) => m.streaming)) return;
    void persist();
  }, [messages, persist]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSttSupported(!!SR);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, caption, phase]);

  // ── TTS : ElevenLabs (/api/tts) avec repli speechSynthesis navigateur. Résout à la
  // fin de la lecture pour enchaîner la ré-écoute. Toujours résout (même échec) → pas de blocage.
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const browserSpeak = useCallback((clean: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return resolve();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "fr-FR";
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }, []);

  const speak = useCallback(
    (raw: string): Promise<void> => {
      const clean = speakable(raw).slice(0, 1500);
      if (!clean) return Promise.resolve();
      return new Promise<void>((resolve) => {
        (async () => {
          try {
            const res = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: clean }),
            });
            if (res.ok) {
              const url = URL.createObjectURL(await res.blob());
              const audio = new Audio(url);
              audioRef.current = audio;
              audio.onended = () => {
                URL.revokeObjectURL(url);
                if (audioRef.current === audio) audioRef.current = null;
                resolve();
              };
              audio.onerror = () => {
                URL.revokeObjectURL(url);
                if (audioRef.current === audio) audioRef.current = null;
                void browserSpeak(clean).then(resolve);
              };
              await audio.play();
              return;
            }
          } catch {
            /* réseau/clé KO → repli navigateur */
          }
          void browserSpeak(clean).then(resolve);
        })();
      });
    },
    [browserSpeak],
  );

  // ── Reconnaissance vocale ─────────────────────────────────────────────────────
  const clearSilence = () => {
    if (silenceRef.current) {
      clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
  };

  const stopRecognition = useCallback(() => {
    clearSilence();
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
  }, []);

  // startListening / commitTurn / sendTurn se référencent mutuellement → refs de fonctions.
  const commitTurnRef = useRef<() => void>(() => {});
  const startListeningRef = useRef<() => void>(() => {});

  const startListening = useCallback(() => {
    if (!sessionRef.current) return;
    stopRecognition();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Reconnaissance vocale indisponible (essaie Chrome ou Edge). Tu peux écrire en bas.");
      return;
    }
    finalRef.current = "";
    interimRef.current = "";
    setCaption("");
    setPhaseBoth("listening");
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current = (finalRef.current + " " + r[0].transcript).replace(/\s+/g, " ").trim();
        else interim += r[0].transcript;
      }
      interimRef.current = interim;
      setCaption((finalRef.current + " " + interim).trim());
      clearSilence();
      silenceRef.current = setTimeout(() => commitTurnRef.current(), SILENCE_MS);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setError("Micro refusé — autorise l'accès au micro, ou écris en bas.");
        sessionRef.current = false;
        setPhaseBoth("idle");
      }
      // "no-speech"/"aborted" : onend enchaînera le redémarrage.
    };
    rec.onend = () => {
      // Chrome coupe tout seul après un silence : si on est encore en écoute, on relance.
      if (sessionRef.current && phaseRef.current === "listening") {
        try {
          rec.start();
        } catch {
          /* course de redémarrage → ignore */
        }
      }
    };
    try {
      rec.start();
    } catch {
      /* déjà démarrée */
    }
    recRef.current = rec;
  }, [setPhaseBoth, stopRecognition]);
  startListeningRef.current = startListening;

  const sendTurn = useCallback(
    async (userText: string) => {
      const clean = userText.trim();
      if (!clean) {
        // rien de dit → on continue d'écouter si la session tourne
        if (sessionRef.current) startListeningRef.current();
        return;
      }

      // P0-1 : un nouveau tour annule le flux SSE encore en cours (sinon un ancien flux
      // continuerait à écrire dans l'état — voire dans la MAUVAISE conversation si on en a
      // changé entre-temps). `isCurrent()` sert de jeton pour toute écriture d'état issue de
      // CE flux précis.
      sendAbortRef.current?.abort();
      const ctrl = new AbortController();
      sendAbortRef.current = ctrl;
      const isCurrent = () => sendAbortRef.current === ctrl;

      setError("");
      setPhaseBoth("thinking");
      const history = messagesRef.current.map((m) => ({ role: m.role, content: m.text }));
      const optimistic: Msg[] = [...messagesRef.current, { role: "user", text: clean }];
      setMessages(optimistic);
      setCaption("");

      const speakThenLoop = async (reply: string) => {
        if (!isCurrent()) return; // flux périmé : pas d'enchaînement voix/écoute
        const token = ++speakTokenRef.current;
        if (voiceOn) {
          setPhaseBoth("speaking");
          await speak(reply);
        }
        // Enchaîne la ré-écoute seulement si ce tour est toujours le courant.
        if (token !== speakTokenRef.current || !isCurrent()) return;
        if (sessionRef.current) startListeningRef.current();
        else setPhaseBoth("idle");
      };

      try {
        const fd = new FormData();
        fd.append("mode", "echange");
        fd.append("history", JSON.stringify(history));
        fd.append("text", clean);
        const res = await fetch("/api/brief", { method: "POST", body: fd, signal: ctrl.signal });
        const ct = res.headers.get("content-type") ?? "";

        if (!ct.includes("event-stream")) {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
          if (!isCurrent()) return;
          const reply = (data.reply ?? "").trim();
          setMessages([...optimistic, { role: "assistant", text: reply }]);
          await speakThenLoop(reply);
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let raw = "";
        let final = "";
        const showLive = (t: string) => {
          if (!isCurrent()) return;
          setMessages([...optimistic, { role: "assistant", text: t || "…", streaming: true }]);
        };
        showLive("");

        for (;;) {
          if (!isCurrent()) {
            try {
              await reader.cancel();
            } catch {
              /* déjà fermé */
            }
            return; // flux périmé : on abandonne sans plus toucher l'état
          }
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            const line = chunk.startsWith("data:") ? chunk.slice(5).trim() : chunk.trim();
            if (!line) continue;
            let evt: { t?: string; text?: string; reply?: string; error?: string };
            try {
              evt = JSON.parse(line);
            } catch {
              continue;
            }
            if (evt.t === "delta") {
              raw += evt.text ?? "";
              showLive(raw);
            } else if (evt.t === "done") {
              final = (evt.reply ?? raw).trim();
            } else if (evt.t === "error") {
              throw new Error(evt.error ?? "Erreur serveur");
            }
          }
        }
        if (!isCurrent()) return;
        const reply = final || raw.trim();
        setMessages([...optimistic, { role: "assistant", text: reply }]);
        await speakThenLoop(reply);
      } catch (e) {
        if (!isCurrent() || (e instanceof Error && e.name === "AbortError")) return; // flux périmé/annulé : rien à afficher
        setError(e instanceof Error ? e.message : "Erreur inconnue");
        setMessages(messagesRef.current.filter((m) => !m.streaming));
        if (sessionRef.current) startListeningRef.current();
        else setPhaseBoth("idle");
      }
    },
    [setPhaseBoth, speak, voiceOn],
  );

  const commitTurn = useCallback(() => {
    clearSilence();
    const said = (finalRef.current || interimRef.current).trim();
    if (!said) return; // silence pur → on reste en écoute
    stopRecognition();
    void sendTurn(said);
  }, [sendTurn, stopRecognition]);
  commitTurnRef.current = commitTurn;

  // ── Contrôles ─────────────────────────────────────────────────────────────────
  const beginSession = useCallback(() => {
    setError("");
    sessionRef.current = true;
    speakTokenRef.current++;
    startListeningRef.current();
  }, []);

  const endSession = useCallback(() => {
    sessionRef.current = false;
    speakTokenRef.current++;
    // P0-1 : abandonne tout flux SSE en cours. newConversation/openConversation appellent
    // endSession() en 1er, donc ce garde couvre aussi les deux (un tour qui se termine APRÈS
    // qu'on a quitté la conversation ne doit plus jamais toucher l'état).
    sendAbortRef.current?.abort();
    sendAbortRef.current = null;
    stopRecognition();
    stopAudio();
    setCaption("");
    setPhaseBoth("idle");
  }, [setPhaseBoth, stopAudio, stopRecognition]);

  // Tap sur le bouton central : démarrer / interrompre-pour-parler / rien pendant qu'il réfléchit.
  const onOrbTap = useCallback(() => {
    if (!sessionRef.current) return beginSession();
    if (phaseRef.current === "speaking") {
      // barge-in : on coupe la voix et on ré-écoute tout de suite
      speakTokenRef.current++;
      stopAudio();
      startListeningRef.current();
    } else if (phaseRef.current === "listening") {
      // « j'ai fini » : envoie ce qui est déjà dit, sinon ne fait rien
      commitTurnRef.current();
    }
  }, [beginSession, stopAudio]);

  useEffect(() => {
    return () => {
      sessionRef.current = false;
      stopRecognition();
      stopAudio();
    };
  }, [stopAudio, stopRecognition]);

  // Repli clavier : envoie un tour sans passer par le micro.
  const sendTyped = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    setText("");
    // Un envoi tapé n'ouvre pas la boucle micro ; il répond (et parle si la voix est active).
    void sendTurn(t);
  }, [text, sendTurn]);

  // ── Historique : ouvrir / nouvelle / renommer / supprimer ─────────────────────
  const openConversation = useCallback(
    async (id: string) => {
      const conv = await getConversation(id);
      if (!conv) return;
      endSession();
      skipPersistRef.current = true; // ne pas re-sauver ce qu'on vient de charger
      convIdRef.current = conv.id;
      convCreatedAtRef.current = conv.createdAt;
      titleCustomRef.current = conv.titleIsCustom;
      titleRef.current = conv.title;
      setConvId(conv.id);
      setMessages(conv.messages as Msg[]);
      setHistOpen(false);
    },
    [endSession],
  );

  const newConversation = useCallback(() => {
    endSession();
    skipPersistRef.current = true;
    convIdRef.current = null;
    convCreatedAtRef.current = "";
    titleCustomRef.current = false;
    titleRef.current = "";
    setConvId(null);
    setMessages([]);
    setHistOpen(false);
  }, [endSession]);

  const onRename = useCallback(
    async (id: string, title: string) => {
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
    },
    [refreshList],
  );

  const onDelete = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
        if (id === convIdRef.current) newConversation();
        await refreshList();
      } catch {
        setError("Impossible de supprimer — le stockage du navigateur est peut-être bloqué.");
      }
    },
    [newConversation, refreshList],
  );

  // Passerelle → mode Projet : crée une NOUVELLE conversation projet (jamais d'écrasement),
  // pré-remplie avec l'échange + trace de l'échange source, puis ouvre /voice dessus.
  const toProject = useCallback(async () => {
    endSession();
    const slim = messagesRef.current
      .filter((m) => !m.streaming && m.text.trim())
      .map((m) => ({ role: m.role, text: m.text }));
    const id = newId();
    const now = nowIso();
    try {
      await saveConversation({
        id,
        mode: "voice",
        title: autoTitle(slim.find((m) => m.role === "user")?.text ?? ""),
        titleIsCustom: false,
        messages: slim,
        board: null,
        sourceConversationId: convIdRef.current ?? undefined,
        createdAt: now,
        updatedAt: now,
        userId: null,
        schemaVersion: 1,
      });
    } catch {
      // P0-2 : stockage indisponible → on NE navigue PAS vers /voice (qui repartirait vide,
      // silencieusement, avec l'échange perdu) ; on prévient et on laisse l'utilisateur sur
      // l'échange, qu'il peut toujours continuer/réessayer.
      setError("Impossible de transformer cet échange en projet — le stockage du navigateur est peut-être bloqué.");
      return;
    }
    // ?cadrer=1 → /voice produit tout de suite la carte récap ; ?conv=<id> = la conv à ouvrir.
    router.push(`/voice?cadrer=1&conv=${id}`);
  }, [endSession, router]);

  const started = messages.length > 0 || phase !== "idle";
  const statusText =
    phase === "listening"
      ? "Je vous écoute…"
      : phase === "thinking"
        ? "Je réfléchis…"
        : phase === "speaking"
          ? "Je vous réponds…"
          : started
            ? "En pause"
            : "Prêt à parler";

  return (
    <div className="voice" data-mode="assistant">
      <HistoryPanel
        variant="drawer"
        open={histOpen}
        onClose={() => setHistOpen(false)}
        items={convList}
        activeId={convId}
        onNew={newConversation}
        onSelect={openConversation}
        onRename={onRename}
        onDelete={onDelete}
      />
      <div className="vbar">
        <button type="button" className="cbtn hist-btn" onClick={() => setHistOpen(true)} aria-label="Historique des conversations" title="Historique">
          <IcoHistory />
        </button>
        <div className={`avatar ${phase === "speaking" ? "speaking" : phase === "listening" ? "listening" : ""}`}>BD</div>
        <div className="id">
          <span className="name">Bras droit — Échange</span>
          <span className="status-line">
            <span className={`live-dot ${phase !== "idle" ? "busy" : ""}`} /> {statusText}
          </span>
        </div>
        <span className="header-spacer" />
        {started && (
          <button type="button" className="btn" onClick={toProject} title="Reprendre cet échange en mode projet (board + équipe)">
            Transformer en projet →
          </button>
        )}
        <button
          type="button"
          className={`cbtn ${voiceOn ? "voice-on" : ""}`}
          onClick={() => {
            setVoiceOn((v) => {
              if (v) stopAudio();
              return !v;
            });
          }}
          aria-pressed={voiceOn}
          title={voiceOn ? "Voix activée — couper" : "Voix coupée — activer"}
        >
          {voiceOn ? <IcoSpeaker /> : <IcoSpeakerOff />}
        </button>
      </div>

      {!sttSupported && (
        <div className="banner warn">
          La reconnaissance vocale n'est pas dispo sur ce navigateur (essaie Chrome ou Edge). Tu peux écrire en bas.
        </div>
      )}
      {error && <div className="banner err">{error}</div>}

      {/* Scène centrale : l'orbe + la transcription live */}
      <div className="echange-stage">
        {/* Hero d'accueil (avant le 1er message) — même esprit que le hero plein écran de
            /voice (sh-title/sh-sub), pour une entrée cohérente entre les deux modes. */}
        {!started && (
          <>
            <h1 className="sh-title">De quoi veux-tu qu'on parle ?</h1>
            <p className="sh-sub">Appuie et parle. Je te réponds à voix haute, puis je réécoute.</p>
          </>
        )}
        <button
          type="button"
          className={`sh-mic ${phase === "listening" ? "rec" : ""}`}
          data-phase={phase}
          onClick={onOrbTap}
          aria-label={phase === "idle" ? "Démarrer l'échange" : phase === "speaking" ? "M'interrompre pour parler" : "Parler"}
          title={
            phase === "idle"
              ? "Démarrer l'échange vocal"
              : phase === "listening"
                ? "Cliquer = j'ai fini de parler"
                : phase === "speaking"
                  ? "Cliquer = t'interrompre et reprendre la parole"
                  : "…"
          }
        >
          <span className="sh-rings" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          {phase === "listening" ? <IcoStop /> : <IcoMic />}
        </button>

        <p className="echange-hint">
          {/* idle && !started : le sous-titre du hero ci-dessus fait déjà le job — pas de doublon ici. */}
          {phase === "idle" && started && "En pause — appuie pour reprendre."}
          {phase === "listening" && (caption ? "" : "J'écoute…")}
          {phase === "thinking" && "Reçu — je réfléchis…"}
          {phase === "speaking" && "Tu peux m'interrompre — appuie sur l'orbe."}
        </p>
        {caption && <p className="sh-transcript">« {caption} »</p>}
        {phase !== "idle" && (
          <button type="button" className="btn btn-ghost echange-stop" onClick={endSession}>
            <IcoStop /> Terminer
          </button>
        )}
      </div>

      {/* Fil : transcription simple et efficace de l'échange */}
      {messages.length > 0 && (
        <div className="thread echange-thread">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "me" : "bot"}`}>
              {m.role === "assistant" && <div className="who">Bras droit</div>}
              <div>{m.text}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Repli clavier — toujours dispo (silence, environnement bruyant, navigateur sans STT) */}
      <div className="composer">
        <div className="composer-bar">
          <button
            type="button"
            className={`cbtn mic ${phase === "listening" ? "rec" : ""}`}
            onClick={onOrbTap}
            aria-label="Micro"
            title="Micro"
          >
            {phase === "listening" ? <IcoStop /> : <IcoMic />}
          </button>
          <textarea
            className="cfield"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendTyped();
              }
            }}
            placeholder="…ou écris ici"
          />
          <button type="button" className="cbtn send" onClick={sendTyped} disabled={!text.trim()} aria-label="Envoyer" title="Envoyer">
            <IcoSend />
          </button>
        </div>
      </div>
    </div>
  );
}
