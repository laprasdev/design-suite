/* A control's pending form while its consumer saves the press: the loading Poké Ball sized to its text beside its
   label in a status (`pendingStatus`), keeping the control focusable while marking it busy and ignoring presses. */
import type {ReactNode} from 'react';
import {PokeballSpinner} from './Pokeball.tsx';

// A choice its consumer is still saving: the option shown chosen, and what it says meanwhile.
export interface SegmentPending<V> {value: V,label: ReactNode}
export function pendingStatus(label?: ReactNode,fit=false,id?: string): ReactNode {
  return <span id={id} className="bd-pending" role="status"><PokeballSpinner fit={fit}/>{label}</span>;
}
// An option's text: its own label, or the loading Poké Ball beside the pending label while its choice saves.
export function pendingText<V>(option: {value: V,label: ReactNode},pending: SegmentPending<V>|undefined): ReactNode {
  return pending?.value===option.value?<><PokeballSpinner/>{pending.label}</>:option.label;
}
