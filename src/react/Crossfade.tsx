// =====================================================
// Crossfade — shows one pane at a time and crossfades when the view key
// changes: the outgoing pane fades out, the incoming one rises 5px while it
// fades in, both at the kit's 0.17s ease. The non-modal counterpart of
// ViewStack: the consumer renders the current pane's content as children and
// names it with `view`.
// =====================================================
import React, { useState, useEffect, type ReactNode } from "react";

export interface CrossfadeProps {
  view: string;
  children: ReactNode;
}

export function Crossfade({ view, children }: CrossfadeProps) {
  const [displayed, setDisplayed] = useState({ key: view, node: children });
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (displayed.key === view) return undefined;
    setLeaving(true);
    const t = setTimeout(() => {
      setDisplayed({ key: view, node: children });
      setLeaving(false);
    }, 170);
    return () => clearTimeout(t);
  }, [view, displayed]);
  // The shown pane stays current — its key's latest content — until another view replaces it.
  const shown = displayed.key === view ? { key: view, node: children } : displayed;
  return (
    <div className="bd-pane" key={shown.key} data-leaving={leaving ? "true" : undefined}>
      {shown.node}
    </div>
  );
}
