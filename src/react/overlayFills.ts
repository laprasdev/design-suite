import type {ReactNode} from 'react';
import type {ActionBarNotice} from './ActionBar.tsx';
import {NoticeTone} from './actionBarElements.ts';
import {OverlayPattern,OverlaySlot,SidebarEdge,type OverlayElement,type OverlayPatternValue,type OverlaySource}
 from './overlaySource.ts';

// One table names how the suite draws each overlay pattern. A pattern declared but not yet drawable holds UNFILLED;
// a source asking for one is refused whole, by name, and nothing of it is drawn.

/** The mark of a declared pattern the suite does not draw yet. */
export const UNFILLED: unique symbol=Symbol('unfilled');
export type OverlayDraw<P extends OverlayPattern>=(value: OverlayPatternValue[P])=>ReactNode;
export type OverlayFills={readonly [P in OverlayPattern]: OverlayDraw<P>|typeof UNFILLED};

// Each entry is filled by the change that adds its drawing; the patterns' order is OverlayPattern's.
export const OVERLAY_FILLS: OverlayFills=Object.freeze({
 [OverlayPattern.HEALTH_SPIRAL]:UNFILLED,[OverlayPattern.BREATH_METER]:UNFILLED,
 [OverlayPattern.COLLECTIBLE_PREVIEW]:UNFILLED,[OverlayPattern.PICKUP_HINT]:UNFILLED,
 [OverlayPattern.STATE_PEEK]:UNFILLED,[OverlayPattern.PIP_CAMERA]:UNFILLED,[OverlayPattern.MINIMAP]:UNFILLED,
 [OverlayPattern.DIALOGUE]:UNFILLED,[OverlayPattern.TOOLTIP]:UNFILLED,[OverlayPattern.GAMEPAD_PREVIEW]:UNFILLED,
 [OverlayPattern.PROJECTILE_TARGET]:UNFILLED,[OverlayPattern.SIDEBAR]:UNFILLED,
 [OverlayPattern.MENU_COLLECTION]:UNFILLED,[OverlayPattern.MENU_SYNTH]:UNFILLED,
});

export const OVERLAY_TEXT=Object.freeze({
 unfilled:'Not filled',
 unfilledDetail:(patterns: readonly OverlayPattern[])=>`Overlay patterns not filled: ${patterns.join(', ')}.`,
});

/** The patterns a source asks for, each once: slot elements in OverlaySlot's order, markers, sidebars, then the menu
 * stack from its root. */
export function overlayPatterns(source: OverlaySource): OverlayPattern[] {
 const asked: OverlayPattern[]=[
  ...Object.values(OverlaySlot).flatMap(slot=>(source.slots?.[slot]??[]).flatMap(elementPatterns)),
  ...(source.world??[]).map(marker=>marker.kind),
  ...Object.values(SidebarEdge).filter(edge=>source.sidebars?.[edge]).map(()=>OverlayPattern.SIDEBAR),
  ...(source.menu?.stack??[]).map(view=>view.kind),
 ];
 return [...new Set(asked)];
}

/** The patterns one element asks for: its own kind and, for a collectible preview whose count is recent, the pickup
 * hint it is drawn with. */
function elementPatterns(element: OverlayElement): OverlayPattern[] {
 return element.kind===OverlayPattern.COLLECTIBLE_PREVIEW&&element.recent
  ?[element.kind,OverlayPattern.PICKUP_HINT]:[element.kind];
}

/** The refusal of a source that asks for any pattern its fills leave unfilled, naming every such pattern. */
export function overlayRefusal(source: OverlaySource,fills: OverlayFills): ActionBarNotice|null {
 const unfilled=overlayPatterns(source).filter(pattern=>fills[pattern]===UNFILLED);
 return unfilled.length
  ?{message:OVERLAY_TEXT.unfilled,tone:NoticeTone.ERROR,detail:OVERLAY_TEXT.unfilledDetail(unfilled)}:null;
}
