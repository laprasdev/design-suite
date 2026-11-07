import type { ReactNode } from "react";
import { MODAL_ROW_LABELLED_ATTRIBUTE, ModalElement } from "./modalElements.ts";

/* What a Modal given a `title` lays out, on one grid: the title, which names the
   dialog, the rows (ModalRow), and the actions row, which stays in view while the
   rows scroll. */
export interface ModalLayoutProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}
// A Modal is titled, with its rows and actions, or plain; actions need the title's layout.
export type ModalTitleProps = {title?: undefined; actions?: never} | Pick<ModalLayoutProps, "title" | "actions">;
export function ModalLayout({ title, actions, children }: ModalLayoutProps) {
  return (
    <>
      <h2 className={ModalElement.TITLE.className}>{title}</h2>
      <div className={ModalElement.ROWS.className}>{children}</div>
      {actions && <div className={ModalElement.ACTIONS.className}>{actions}</div>}
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
    <div className={ModalElement.ROW.className} {...{[MODAL_ROW_LABELLED_ATTRIBUTE]: label !== undefined}}>
      {label !== undefined && <span className={ModalElement.LABEL.className}>{label}</span>}
      <div className={ModalElement.CONTROL.className}>{children}</div>
    </div>
  );
}
