/* The single choice's pending form, while its consumer saves the choice: SegmentedControl shows `pending.value`
   chosen at once, its text the loading Poké Ball beside `pending.label` in a status, marks the control busy, ignores
   every press and fades the other options. The consumer owns the save and the confirmed value it passes afterwards.
   Without `pending` nothing changes. */
import type {ReactNode} from 'react';
import {PokeballSpinner} from './Pokeball.tsx';

// A choice its consumer is still saving: the option shown chosen, and what it says meanwhile.
export interface SegmentPending<V> {value: V,label: ReactNode}
// An option's text: its own label, or the loading Poké Ball beside the pending label while its choice saves.
export function pendingText<V>(option: {value: V,label: ReactNode},pending: SegmentPending<V>|undefined): ReactNode {
  return pending?.value===option.value?<><PokeballSpinner/>{pending.label}</>:option.label;
}
