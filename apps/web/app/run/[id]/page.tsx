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

  return (
    <main>
      <p>
        <Link href="/brief">← Nouveau brief</Link>
      </p>
      <h1>L'équipe au travail</h1>
      <p>
        <span
          style={{
            display: "inline-block",
            width: 9,
            height: 9,
            borderRadius: "50%",
            marginRight: 6,
            background: status === "done" ? "#16a34a" : status === "error" ? "#dc2626" : "#d97706",
          }}
        />
        <strong>{RUN_LABEL[status]}</strong>
        {working && <span> {/* petit indicateur d'activité */}⟳</span>}
      </p>
      {runError && <p style={{ color: "crimson" }}>{runError}</p>}
      {summary && (
        <p style={{ color: "#444", fontStyle: "italic" }}>« {summary} »</p>
      )}

      {/* Cartes d'étapes */}
      {order.map((sid) => {
        const s = steps[sid];
        if (!s) return null;
        const dot = STATUS_DOT[s.status];
        const isOpen = open[sid] ?? false;
        return (
          <section
            key={sid}
            style={{
              border: "1px solid #e2e2e2",
              borderLeft: `3px solid ${dot.color}`,
              borderRadius: 6,
              padding: "0.6rem 0.8rem",
              margin: "0.6rem 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot.color, display: "inline-block" }} />
              <strong>{s.agentLabel}</strong>
              <span style={{ color: "#333" }}>{s.title}</span>
              <small style={{ color: dot.color, marginLeft: "auto" }}>{dot.label}</small>
            </div>
            {s.error && <small style={{ color: "crimson" }}>{s.error}</small>}
            {s.output && (
              <div style={{ marginTop: "0.4rem" }}>
                <button type="button" onClick={() => setOpen((p) => ({ ...p, [sid]: !isOpen }))}>
                  {isOpen
                    ? s.status === "running"
                      ? "▾ En train d'écrire…"
                      : "▾ Masquer le livrable"
                    : "▸ Voir le livrable"}
                </button>
                {isOpen && (
                  <div style={{ marginTop: "0.5rem", borderTop: "1px dashed #ddd", paddingTop: "0.5rem" }}>
                    <Markdown markdown={s.output} />
                    {s.status === "running" && <span style={{ color: "#d97706" }}>▌</span>}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* Synthèse finale */}
      {synthesis && (
        <section
          ref={synthRef}
          style={{ border: "2px solid #2563eb", borderRadius: 6, padding: "1rem", marginTop: "1.2rem" }}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>✅ Synthèse du chef de projet</strong>{" "}
            <button type="button" onClick={downloadSynthesis}>
              Télécharger (.md)
            </button>
          </div>
          <Markdown markdown={synthesis} />
        </section>
      )}
    </main>
  );
}
