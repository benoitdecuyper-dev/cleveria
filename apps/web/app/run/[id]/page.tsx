"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Markdown from "../../components/Markdown";

type StepStatus = "pending" | "running" | "done" | "error";
type RunStatus = "planning" | "running" | "done" | "error";

type Step = {
  id: string;
  agent: string;
  agentLabel: string;
  title: string;
  dependsOn: string[];
  status: StepStatus;
  output: string | null;
  error?: string | null;
};

const STATUS_DOT: Record<StepStatus, { color: string; label: string }> = {
  pending: { color: "#bbb", label: "en attente" },
  running: { color: "#d97706", label: "en cours…" },
  done: { color: "#16a34a", label: "terminé" },
  error: { color: "#dc2626", label: "échec" },
};

const RUN_LABEL: Record<RunStatus, string> = {
  planning: "L'orchestrateur établit le plan…",
  running: "L'équipe travaille…",
  done: "Travail terminé",
  error: "Le run a rencontré une erreur",
};

export default function RunDashboard() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<RunStatus>("planning");
  const [summary, setSummary] = useState<string>("");
  const [steps, setSteps] = useState<Record<string, Step>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [synthesis, setSynthesis] = useState<string>("");
  const [runError, setRunError] = useState<string>("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const synthRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;
    let es: EventSource | null = null;

    function applyStep(partial: Partial<Step> & { id: string }) {
      setSteps((prev) => {
        const cur = prev[partial.id] ?? {
          id: partial.id,
          agent: "",
          agentLabel: "",
          title: "",
          dependsOn: [],
          status: "pending" as StepStatus,
          output: null,
        };
        return { ...prev, [partial.id]: { ...cur, ...partial } };
      });
    }

    // 1) Snapshot initial (couvre le cas où des événements sont passés avant l'abonnement).
    fetch(`/api/run/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return setRunError(data.error);
        setStatus(data.status);
        if (data.error) setRunError(data.error);
        if (data.plan?.summary) setSummary(data.plan.summary);
        if (Array.isArray(data.steps)) {
          const map: Record<string, Step> = {};
          for (const s of data.steps) map[s.id] = s;
          setSteps(map);
          setOrder(data.steps.map((s: Step) => s.id));
        }
        if (data.synthesis) setSynthesis(data.synthesis);
      })
      .catch(() => {});

    // 2) Flux live.
    es = new EventSource(`/api/run/${id}/stream`);
    es.onmessage = (ev) => {
      let e: Record<string, unknown>;
      try {
        e = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (e.type) {
        case "run.status":
          setStatus(e.status as RunStatus);
          if (e.error) setRunError(e.error as string);
          if (e.status === "done" || e.status === "error") es?.close();
          break;
        case "planned": {
          const plan = e.plan as { summary: string };
          setSummary(plan.summary);
          type Planned = {
            step: { id: string; agent: string; title: string; dependsOn?: string[] };
            agentLabel: string;
            status: StepStatus;
            output?: string | null;
          };
          const map: Record<string, Step> = {};
          const ids: string[] = [];
          for (const s of (e.steps as Planned[]) ?? []) {
            map[s.step.id] = {
              id: s.step.id,
              agent: s.step.agent,
              agentLabel: s.agentLabel,
              title: s.step.title,
              dependsOn: s.step.dependsOn ?? [],
              status: s.status,
              output: s.output ?? null,
            };
            ids.push(s.step.id);
          }
          setSteps(map);
          setOrder(ids);
          break;
        }
        case "step.status":
          applyStep({ id: e.id as string, status: e.status as StepStatus, error: (e.error as string) ?? null });
          // Auto-déplie l'étape qui démarre : on regarde l'agent travailler en direct.
          if (e.status === "running") setOpen((p) => ({ ...p, [e.id as string]: true }));
          break;
        case "step.delta":
          setSteps((prev) => {
            const cur = prev[e.id as string];
            if (!cur) return prev;
            return { ...prev, [e.id as string]: { ...cur, output: (cur.output ?? "") + (e.text as string) } };
          });
          break;
        case "step.output":
          applyStep({ id: e.id as string, output: e.output as string });
          break;
        case "synthesis.delta":
          setSynthesis((prev) => prev + (e.text as string));
          break;
        case "synthesis":
          setSynthesis(e.output as string);
          break;
      }
    };
    es.onerror = () => {
      // Le navigateur retente seul ; si le run est fini, on a déjà fermé.
    };

    return () => es?.close();
  }, [id]);

  const working = status === "planning" || status === "running";

  function downloadSynthesis() {
    const blob = new Blob([synthesis], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "synthese-cleveria.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  const doneCount = order.filter((id) => steps[id]?.status === "done").length;

  return (
    <>
      <p className="eyebrow">Tableau de bord</p>
      <h1>L'équipe au travail</h1>
      <p className="run-status">
        <span className={`dot ${status === "done" ? "done" : status === "error" ? "error" : "running"}`} />
        {RUN_LABEL[status]}
        {order.length > 0 && (
          <span className="muted" style={{ fontWeight: 500 }}>
            &nbsp;· {doneCount}/{order.length} étapes
          </span>
        )}
      </p>
      {runError && <div className="banner err">{runError}</div>}
      {summary && <p className="muted" style={{ fontStyle: "italic" }}>« {summary} »</p>}

      {working && order.length === 0 && (
        <div className="card muted">L'orchestrateur compose l'équipe…</div>
      )}

      {/* Cartes d'étapes */}
      {order.map((sid) => {
        const s = steps[sid];
        if (!s) return null;
        const dot = STATUS_DOT[s.status];
        const isOpen = open[sid] ?? false;
        return (
          <section key={sid} className={`step ${s.status}`}>
            <div className="step-head">
              <span className={`dot ${s.status}`} />
              <span className="agent">{s.agentLabel}</span>
              <span className="step-title">{s.title}</span>
              <span className={`badge ${s.status}`}>{dot.label}</span>
            </div>
            {s.error && <div className="banner err" style={{ marginTop: "0.4rem" }}>{s.error}</div>}
            {s.output && (
              <div style={{ marginTop: "0.4rem" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setOpen((p) => ({ ...p, [sid]: !isOpen }))}
                >
                  {isOpen
                    ? s.status === "running"
                      ? "▾ En train d'écrire…"
                      : "▾ Masquer le livrable"
                    : "▸ Voir le livrable"}
                </button>
                {isOpen && (
                  <div style={{ marginTop: "0.5rem", borderTop: "1px dashed var(--border)", paddingTop: "0.6rem" }}>
                    <Markdown markdown={s.output} />
                    {s.status === "running" && <span className="caret">▌</span>}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* Synthèse finale */}
      {synthesis && (
        <section ref={synthRef} className="synthesis">
          <div className="note-head">
            <span className="tag">✅ Synthèse du chef de projet</span>
            <button type="button" className="btn btn-ghost" onClick={downloadSynthesis}>
              Télécharger .md
            </button>
          </div>
          <Markdown markdown={synthesis} />
        </section>
      )}

      <p style={{ marginTop: "1.4rem" }}>
        <Link href="/brief" className="muted">
          ← Nouveau brief
        </Link>
      </p>
    </>
  );
}
