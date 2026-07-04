// Abstraction du fournisseur d'inférence. Deux backends :
//  - "anthropic" (défaut, prod/Render) : API Anthropic facturée.
//  - "claude-code" (local, dev) : route les appels vers le CLI `claude` sur l'abonnement local
//    (gratuit, auth OAuth) pour éprouver la VRAIE app sans crédit API. Activé par
//    CLEVERIA_LLM_PROVIDER=claude-code.
//
// ⚠️ Le backend claude-code est LOCAL UNIQUEMENT (le CLI n'existe pas sur Render) et ne mesure pas
// le coût réel en tokens. Il consomme le quota d'abonnement (limite de débit du plan), pas des $.
import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type LlmRequest = {
  system: string;
  messages: Anthropic.MessageParam[];
  model: string; // id résolu (claude-opus-4-8, …)
  maxTokens: number;
  onText?: (t: string) => void; // si fourni → streaming (deltas au fil de l'eau)
  // Active l'outil web_search HÉBERGÉ de l'API (recherche réelle + citations). Backend `anthropic`
  // UNIQUEMENT : le CLI local headless ne déclenche pas la recherche (testé : 0 requête → il fabrique
  // des sources). Donc en local, les experts restent sans outil et marquent « à confirmer ».
  webSearch?: boolean;
};

/** true si on route vers le CLI Claude Code local au lieu de l'API facturée. */
export function localProvider(): boolean {
  return process.env.CLEVERIA_LLM_PROVIDER === "claude-code";
}

export async function llmGenerate(req: LlmRequest): Promise<string> {
  return localProvider() ? viaClaudeCode(req) : viaAnthropic(req);
}

// ── Backend API Anthropic (prod) ─────────────────────────────────────────────
let _client: Anthropic | null = null;
function anthropic(): Anthropic {
  return (_client ??= new Anthropic({ maxRetries: 4 }));
}

// Prompt caching : on pose un point de césure `cache_control` à la FIN du dernier message.
// Tout le préfixe stable AVANT ce point (le gros system + l'historique de la conversation) est
// mémorisé côté Anthropic ~5 min ; les tours suivants qui repartent du même préfixe le relisent
// au tarif cache (~10% du plein prix) au lieu de le re-facturer entièrement. Gain net sur les
// conversations multi-tours — typiquement les retouches de maquette qui repassent par le bras
// droit (Opus) à chaque fois. Aucun changement de comportement, uniquement le coût.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withCacheBreakpoint(messages: Anthropic.MessageParam[]): any[] {
  if (messages.length === 0) return messages as unknown[];
  const out = messages.map((m) => ({ ...m })) as { role: string; content: unknown }[];
  const last = out[out.length - 1];
  const mark = { type: "ephemeral" as const };
  if (typeof last.content === "string") {
    last.content = [{ type: "text", text: last.content, cache_control: mark }];
  } else if (Array.isArray(last.content) && last.content.length > 0) {
    const blocks = last.content.map((b) => ({ ...(b as object) }));
    (blocks[blocks.length - 1] as { cache_control?: unknown }).cache_control = mark;
    last.content = blocks;
  }
  return out;
}

async function viaAnthropic({ system, messages, model, maxTokens, onText, webSearch }: LlmRequest): Promise<string> {
  // system (stable et volumineux) mis en cache à part ; l'historique via le point de césure ci-dessus.
  const cachedSystem = [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
  const params: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system: cachedSystem,
    messages: withCacheBreakpoint(messages),
  };
  if (webSearch) {
    // Outil web_search hébergé Anthropic (server-side, facturé ~10$/1000 recherches). ⚠️ NON TESTÉ
    // (pas de crédit au moment du câblage) — spec `type`/nom à CONFIRMER en conditions réelles.
    params.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  }
  const stream = anthropic().messages.stream(params as unknown as Anthropic.MessageStreamParams);
  if (onText) stream.on("text", onText);
  const message = await stream.finalMessage();
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// ── Backend Claude Code local (dev, gratuit) ─────────────────────────────────
function mapModel(model: string): "opus" | "sonnet" | "haiku" {
  const m = model.toLowerCase();
  if (m.includes("opus")) return "opus";
  if (m.includes("haiku")) return "haiku";
  return "sonnet";
}

// Le CLI `claude -p` prend une entrée unique : on aplatit les messages en un seul prompt (texte
// seulement — les pièces jointes image/PDF ne sont pas supportées en mode local).
function flatten(messages: Anthropic.MessageParam[]): string {
  return messages
    .map((m) => {
      const text =
        typeof m.content === "string"
          ? m.content
          : m.content
              .map((b) => (b.type === "text" ? b.text : `[pièce jointe ${b.type} — non supportée en mode local]`))
              .join("\n");
      return messages.length > 1 ? `${m.role === "user" ? "Utilisateur" : "Assistant"} :\n${text}` : text;
    })
    .join("\n\n");
}

let _seq = 0;

async function viaClaudeCode({ system, messages, model, onText }: LlmRequest): Promise<string> {
  const prompt = flatten(messages);
  // System prompt (parfois volumineux) → fichier ; prompt user → stdin. Les arguments restent ainsi
  // des tokens simples (robuste sur Windows avec shell:true).
  const sysFile = join(tmpdir(), `cleveria-sys-${process.pid}-${_seq++}.txt`);
  await writeFile(sysFile, system, "utf8");
  const streaming = !!onText;
  const args = [
    "-p",
    "--system-prompt-file", sysFile,
    "--model", mapModel(model),
    "--allowedTools", "",
    "--exclude-dynamic-system-prompt-sections",
    "--output-format", streaming ? "stream-json" : "json",
  ];
  if (streaming) args.push("--include-partial-messages", "--verbose");

  // CRUCIAL : on retire ANTHROPIC_API_KEY (présente dans .env pour la prod) de l'env du CLI.
  // Sinon Claude Code l'utilise au lieu de l'abonnement OAuth → on tape la clé sans crédit.
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;

  const spawnOnce = () =>
    new Promise<string>((resolve, reject) => {
      const child = spawn("claude", args, {
        cwd: tmpdir(), // pas de CLAUDE.md projet chargé
        shell: process.platform === "win32", // résout le shim claude.cmd
        windowsHide: true,
        env,
      });
      let buf = "";
      let acc = "";
      let finalText = "";
      let resultIsError = false;
      let rawOut = "";
      let stderr = "";

      child.stdin.on("error", () => {}); // process mort avant de lire stdin → pas de crash EPIPE
      child.stdin.end(prompt, "utf8");
      child.stdout.on("data", (chunk: Buffer) => {
        const s = chunk.toString("utf8");
        if (!streaming) {
          rawOut += s;
          return;
        }
        buf += s;
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line);
            if (
              obj.type === "stream_event" &&
              obj.event?.type === "content_block_delta" &&
              obj.event.delta?.type === "text_delta"
            ) {
              const t: string = obj.event.delta.text ?? "";
              acc += t;
              onText!(t);
            } else if (obj.type === "result") {
              if (obj.is_error || obj.subtype !== "success") resultIsError = true;
              if (typeof obj.result === "string") finalText = obj.result;
            }
          } catch {
            /* ligne partielle / non-JSON → ignorée */
          }
        }
      });
      child.stderr.on("data", (c: Buffer) => {
        stderr += c.toString("utf8");
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (streaming) {
          if (resultIsError) return reject(new Error(`claude-code : ${finalText || "erreur CLI"}`));
          const out = (finalText || acc).trim();
          if (out) return resolve(out);
          return reject(new Error(`claude-code (code ${code}) : sortie vide. ${stderr.slice(0, 300)}`));
        }
        try {
          const obj = JSON.parse(rawOut);
          if (obj.is_error || obj.subtype !== "success") {
            return reject(new Error(`claude-code : ${obj.result ?? obj.subtype ?? "erreur CLI"}`));
          }
          if (typeof obj.result === "string") return resolve(obj.result.trim());
          throw new Error("champ result absent");
        } catch (err) {
          reject(
            err instanceof Error && /claude-code :/.test(err.message)
              ? err
              : new Error(`claude-code (code ${code}) : sortie illisible. ${(stderr || rawOut).slice(0, 300)}`),
          );
        }
      });
    });

  try {
    // Retry sur échec d'INITIALISATION du process (rien produit) — typiquement 0xC0000142 transitoire
    // sur Windows (AV/EDR). On ne retente PAS une vraie erreur CLI (qui, elle, a produit une sortie).
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await spawnOnce();
      } catch (e) {
        lastErr = e as Error;
        if (!/sortie vide|3221225794|spawn|ENOENT|EBUSY|ETXTBSY/i.test(lastErr.message)) throw lastErr;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
      }
    }
    throw lastErr ?? new Error("claude-code : échec inconnu");
  } finally {
    void unlink(sysFile).catch(() => {});
  }
}
