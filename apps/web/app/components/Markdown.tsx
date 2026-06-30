"use client";

// Rendu Markdown + blocs Mermaid, partagé entre la note de cadrage (/brief)
// et les livrables des agents (/run). Extrait de NoteView pour réutilisation.

import { useEffect, useId, useState } from "react";
import { marked } from "marked";
import mermaid from "mermaid";
import { enhanceLinks } from "../../lib/format";

mermaid.initialize({ startOnLoad: false, theme: "neutral" });

// Rend un bloc Mermaid en SVG ; si la syntaxe est invalide, retombe sur le code brut.
function MermaidBlock({ code }: { code: string }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    mermaid
      .render(`m${rawId}`, code)
      .then(({ svg }) => active && setSvg(svg))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [code, rawId]);

  if (failed) {
    return <pre style={{ background: "#f4f4f4", padding: "0.5rem", overflowX: "auto" }}>{code}</pre>;
  }
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}

type Part = { type: "md" | "mermaid"; content: string };

function split(markdown: string): Part[] {
  const parts: Part[] = [];
  const re = /```mermaid\s*\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    if (m.index > last) parts.push({ type: "md", content: markdown.slice(last, m.index) });
    parts.push({ type: "mermaid", content: m[1].trim() });
    last = re.lastIndex;
  }
  if (last < markdown.length) parts.push({ type: "md", content: markdown.slice(last) });
  return parts;
}

export default function Markdown({ markdown }: { markdown: string }) {
  return (
    <div className="md">
      {split(markdown).map((part, i) =>
        part.type === "mermaid" ? (
          <MermaidBlock key={i} code={part.content} />
        ) : (
          <div key={i} dangerouslySetInnerHTML={{ __html: enhanceLinks(marked.parse(part.content) as string) }} />
        ),
      )}
    </div>
  );
}
