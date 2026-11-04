import type { ReactNode } from "react";

/* What a Modal given a `title` lays out, on one grid: the title, which names the
   dialog, the rows (ModalRow), and the actions row, which stays in view while the
   rows scroll. */
export interface ModalLayoutProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}
export function ModalLayout({ title, actions, children }: ModalLayoutProps) {
  return (
    <>
      <h2 className="sd-modal-title">{title}</h2>
      <div className="sd-modal-rows">{children}</div>
      {actions && <div className="sd-modal-actions">{actions}</div>}
    </>
  );
}

/* A row of a titled Modal: a label and its control on the modal's two shared
   columns. A row without a label gives its content the full width (a message,
   a player, a segmented control). A field or segmented control fills its
   column; buttons sit at its end. */
export interface ModalRowProps {
  label?: ReactNode;
  children: ReactNode;
}
export function ModalRow({ label, children }: ModalRowProps) {
  return (
    <div className="sd-modal-row" data-labelled={label !== undefined}>
      {label !== undefined && <span className="sd-modal-label">{label}</span>}
      <div className="sd-modal-control">{children}</div>
    </div>
  );
}
