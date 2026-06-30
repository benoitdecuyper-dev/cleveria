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

async function viaAnthropic({ system, messages, model, maxTokens, onText }: LlmRequest): Promise<string> {
  const stream = anthropic().messages.stream({ model, max_tokens: maxTokens, system, messages });
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

  try {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn("claude", args, {
        cwd: tmpdir(), // pas de CLAUDE.md projet chargé
        shell: process.platform === "win32", // résout le shim claude.cmd
      });
      let buf = "";
      let acc = "";
      let finalText = "";
      let rawOut = "";
      let stderr = "";

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
            } else if (obj.type === "result" && typeof obj.result === "string") {
              finalText = obj.result;
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
          const out = (finalText || acc).trim();
          if (out) return resolve(out);
          return reject(new Error(`claude-code (code ${code}) : sortie vide. ${stderr.slice(0, 300)}`));
        }
        try {
          const obj = JSON.parse(rawOut);
          if (typeof obj.result === "string") return resolve(obj.result.trim());
          throw new Error("champ result absent");
        } catch {
          reject(new Error(`claude-code (code ${code}) : sortie illisible. ${(stderr || rawOut).slice(0, 300)}`));
        }
      });
    });
  } finally {
    void unlink(sysFile).catch(() => {});
  }
}
