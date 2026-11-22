/* A control's pending form while its consumer saves the press: the loading Poké Ball with what the control shows, in a
   status (its forms: pendingElements.ts), and its press, which marks it busy (`aria-busy`, which its styles read) and
   refuses itself whole. The control stays focusable; pending replaces `disabled` for that time. The consumer owns the
   save and the confirmed value it passes afterwards. The content keeps its own inline layout. */
import type {ButtonHTMLAttributes,ReactNode} from 'react';
import {PokeballSpinner} from './Pokeball.tsx';
import {PENDING_FORM_ATTRIBUTE,PendingElement,type PendingForm} from './pendingElements.ts';

// What a control shows, and whether it shows it pending.
export interface PendingContent {pending: boolean,form: PendingForm,content: ReactNode}

export function pendingContent({pending,form,content}: PendingContent): ReactNode {
  return pending?<span className={PendingElement.className} {...{[PENDING_FORM_ATTRIBUTE]:form}} role="status">
    <PokeballSpinner/><span>{content}</span>
  </span>:content;
}

// A pending control's press: busy, and refusing the click and the submit or reset a button's type would start. Its
// event is whatever starts the press: a pointer's click, or a key that moves to the control.
interface Refusable {preventDefault(): void}
type Press<E extends Refusable>=(event: E)=>void;
export interface PendingPress<E extends Refusable=Refusable> {'aria-busy': true|undefined,onClick: Press<E>|undefined}

// A pending control's button attributes: its busy state is pendingPress's alone. Declared as never, because the type
// check passes any undeclared hyphenated attribute, so a consumer's own value would compile and be dropped.
export type PendingButtonAttributes=Omit<ButtonHTMLAttributes<HTMLButtonElement>,'aria-busy'>&{'aria-busy'?: never};

const refuse=(event: Refusable)=>event.preventDefault();

export function pendingPress<E extends Refusable>(pending: boolean,onClick: Press<E>|undefined): PendingPress<E> {
  return {'aria-busy':pending||undefined,onClick:pending?refuse:onClick};
}
