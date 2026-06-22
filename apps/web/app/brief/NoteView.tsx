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
    <section className="note">
      <div className="note-head">
        <span className="tag">📄 Note de cadrage</span>
        <button onClick={download} type="button" className="btn btn-ghost">
          Télécharger .md
        </button>
      </div>
      <Markdown markdown={markdown} />
    </section>
  );
}
