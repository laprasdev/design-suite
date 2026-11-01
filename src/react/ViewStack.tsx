// =====================================================
// ViewStack — a modal that hosts a stack of views and cross-fades between them
// (a lightweight "view controller" that pushes/pops). Domain-free and reusable
// for pickers, confirmations, error dialogs, drill-in table stacks, etc.
//
// Controlled: the consumer owns the stack array and pushes/pops by updating it.
//   views: [{ key, node }]   (the last entry is the visible top)
//   onClose: called on backdrop click / Escape
// When the top view changes, the current view fades out and the new one fades in.
// =====================================================
import React, { useState, useEffect, type ReactNode } from "react";

// A view on the stack: its key and its content.
export interface StackView {
  key: string;
  node: ReactNode;
}
export interface ViewStackProps {
  views: readonly StackView[];
  onClose(): void;
  className?: string;
}

export function ViewStack({ views, onClose, className = "" }: ViewStackProps) {
  const top = views[views.length - 1] || null;
  const [displayed, setDisplayed] = useState(top);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!top) return;
    if (displayed && top.key === displayed.key) return;
    setLeaving(true);
    const t = setTimeout(() => {
      setDisplayed(top);
      setLeaving(false);
    }, 170);
    return () => clearTimeout(t);
  }, [top, displayed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!displayed) return null;
  // The shown view stays current: its key's latest content, until another view replaces it.
  const shown = top && top.key === displayed.key ? top : displayed;

  return (
    <div className="bd-vs-backdrop" onClick={onClose}>
      <div
        className={`bd-vs-modal${className ? " " + className : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bd-vs-view" key={shown.key} data-leaving={leaving ? "true" : "false"}>
          {shown.node}
        </div>
      </div>
    </div>
  );
}
