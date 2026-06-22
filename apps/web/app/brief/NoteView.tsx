"use client";

import Markdown from "../components/Markdown";

export default function NoteView({ markdown }: { markdown: string }) {
  function download() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "note-de-cadrage.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", marginTop: "0.5rem" }}>
      <div style={{ marginBottom: "0.5rem" }}>
        <strong>📄 Note de cadrage</strong>{" "}
        <button onClick={download} type="button">
          Télécharger (.md)
        </button>
      </div>
      <Markdown markdown={markdown} />
    </section>
  );
}
