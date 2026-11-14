import {element,type ElementContract} from './elementContract.ts';

// PlayerIcon's parts and the states its props switch on, shared by the view, its stylesheet (portraits-modal.css)
// and consumers' browser checks. A RING holds one ARC for each arc it shows: a progress ring one, a segmented ring
// one for each segment that is not empty. Each ARC holds its STROKE and a CAP on every end that no arc continues.
export const PlayerIconElement=Object.freeze({
 ROOT:element('sd-pi'),PHOTO:element('sd-pi-photo'),
 BUTTON:element('sd-pi-btn'),SELECTED:element('sd-pi-sel'),FADED:element('sd-pi-faded'),BARE:element('sd-pi-bare'),
 RING:element('sd-pi-ring'),STATUS_RING:element('sd-pi-status-ring'),
 ARC:element('sd-pi-ring-arc'),STROKE:element('sd-pi-ring-fg'),CAP:element('sd-pi-ring-cap'),
 DOT:element('sd-pi-dot'),HAND_BONUS:element('sd-pi-hand-bonus'),ACCENT:element('sd-pi-acc'),
});
// The side of the photo a hand dot or a top-corner accent sits on.
export type PlayerIconSide='L'|'R';
export const PlayerIconSideElement=Object.freeze({
 DOT:Object.freeze({L:element('sd-pi-dot-l'),R:element('sd-pi-dot-r')}),
 ACCENT:Object.freeze({L:element('sd-pi-acc-l'),R:element('sd-pi-acc-r')}),
} satisfies Record<string,Readonly<Record<PlayerIconSide,ElementContract>>>);
