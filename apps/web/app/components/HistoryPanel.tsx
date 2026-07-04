"use client";

// Panneau d'historique (docs/13) — rail latéral (Projet) ou tiroir overlay (Échange).
// Liste les conversations d'un mode, ouvre/crée/renomme/supprime. Pattern ChatGPT/Claude.
import { useEffect, useRef, useState } from "react";
import type { ConversationSummary } from "../../lib/history";
import { relativeDate } from "../../lib/history";

const IcoPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IcoClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);
const IcoDots = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
  </svg>
);

type Props = {
  items: ConversationSummary[];
  activeId: string | null;
  variant: "rail" | "drawer";
  open?: boolean;
  onClose?: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
};

export default function HistoryPanel({ items, activeId, variant, open, onClose, onNew, onSelect, onRename, onDelete }: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  // P1-5 : Escape démonte l'input (setEditId(null)) → ça déclenche un onBlur, qui sans garde
  // committerait quand même (Escape sauvegardait au lieu d'annuler). Entrée committe déjà
  // explicitement puis démonte aussi → même souci (double commit). Ce flag, posé par Escape ET
  // Entrée, dit à onBlur « le commit/l'annulation vient d'être géré, ne refais rien ».
  const suppressBlurRef = useRef(false);

  useEffect(() => {
    if (!menuId) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuId]);

  const startRename = (s: ConversationSummary) => {
    setEditId(s.id);
    setDraft(s.title);
    setMenuId(null);
    suppressBlurRef.current = false;
  };
  const commitRename = (id: string) => {
    const t = draft.trim();
    if (t) onRename(id, t);
    setEditId(null);
  };

  const body = (
    <div className="hist-inner" ref={rootRef}>
      <div className="hist-head">
        <button type="button" className="hist-new" onClick={onNew}>
          <IcoPlus /> Nouvelle conversation
        </button>
        {variant === "drawer" && (
          <button type="button" className="cbtn" onClick={onClose} aria-label="Fermer l'historique">
            <IcoClose />
          </button>
        )}
      </div>
      <div className="hist-list">
        {items.length === 0 ? (
          <p className="hist-empty">Aucune conversation pour l'instant — commence à parler.</p>
        ) : (
          items.map((s) => (
            <div key={s.id} className={`hist-item ${s.id === activeId ? "active" : ""}`}>
              {editId === s.id ? (
                <input
                  className="hist-edit"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      suppressBlurRef.current = true; // déjà committé ici — le blur du démontage ne doit pas rejouer
                      commitRename(s.id);
                    }
                    if (e.key === "Escape") {
                      suppressBlurRef.current = true; // annulation — le blur du démontage ne doit PAS sauvegarder
                      setEditId(null);
                    }
                  }}
                  onBlur={() => {
                    if (suppressBlurRef.current) {
                      suppressBlurRef.current = false;
                      return;
                    }
                    commitRename(s.id);
                  }}
                />
              ) : (
                <button type="button" className="hist-open" onClick={() => onSelect(s.id)} title={s.title}>
                  <span className="hist-title">{s.title}</span>
                  <span className="hist-date">{relativeDate(s.updatedAt)}</span>
                </button>
              )}
              <button
                type="button"
                className="hist-menu-btn"
                onClick={() => setMenuId(menuId === s.id ? null : s.id)}
                aria-label="Options de la conversation"
              >
                <IcoDots />
              </button>
              {menuId === s.id && (
                <div className="hist-menu">
                  <button type="button" onClick={() => startRename(s)}>
                    Renommer
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setMenuId(null);
                      if (window.confirm("Supprimer cette conversation ? C'est définitif.")) onDelete(s.id);
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (variant === "rail") return <aside className="hist hist-rail">{body}</aside>;
  return (
    <>
      {open && <div className="hist-backdrop" onClick={onClose} />}
      <aside className={`hist hist-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        {body}
      </aside>
    </>
  );
}
