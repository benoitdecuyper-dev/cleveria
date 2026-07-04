import { describe, it, expect } from "vitest";
import { createRun, cancelRun, getRun, emit } from "./runStore";

describe("cancelRun", () => {
  it("pose le flag cancelled et émet run.status = cancelled", () => {
    const run = createRun("un brief");
    const events: string[] = [];
    run.subscribers.add((e) => events.push(e.type));

    const ok = cancelRun(run.id);

    expect(ok).toBe(true);
    expect(run.cancelled).toBe(true);
    expect(run.status).toBe("cancelled");
    expect(events).toContain("run.status");
  });

  it("renvoie false si le run est introuvable", () => {
    expect(cancelRun("run_inconnu")).toBe(false);
  });

  it("un run annulé n'est pas repassé running/done par un event.status ultérieur mal placé (garde côté orchestrateur, pas ici)", () => {
    // runStore lui-même ne fait AUCUN arbitrage entre "cancelled" et d'autres statuts : c'est
    // l'orchestrateur qui doit vérifier `run.cancelled` avant d'émettre "done"/"error". Ce test
    // documente juste que cancelRun pose bien l'état attendu pour que cette garde soit possible.
    const run = createRun("un brief");
    cancelRun(run.id);
    expect(getRun(run.id)?.cancelled).toBe(true);
    // Un emit "run.status: done" non gardé écraserait bien le statut — d'où la garde dans orchestrator.ts.
    emit(run, { type: "run.status", status: "done" });
    expect(run.status).toBe("done");
  });
});
