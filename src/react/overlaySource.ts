import {MenuViewKind,type MenuSource,type MenuView,type SidebarSource} from './menuSource.ts';
import type {ModelVector} from './preview3d/placementModel.ts';

// What an overlay over a surface asks the suite to draw. Every member is optional: a member not asked for is drawn as
// nothing and keeps no room. Values arrive resolved; whoever binds them to their state is not the suite's concern.

/** C#'s AtomicMenuBehaviour.OverlaySlot: the 3x3 anchor grid without its centre, one name per cell. */
export const OverlaySlot=Object.freeze({
 TOP_START:'top-start',TOP:'top',TOP_END:'top-end',START:'start',END:'end',
 BOTTOM_START:'bottom-start',BOTTOM:'bottom',BOTTOM_END:'bottom-end',
} as const);
export type OverlaySlot=typeof OverlaySlot[keyof typeof OverlaySlot];
/** The two side cells also hold a sidebar, after C#'s IntentDirection containers. */
export const SidebarEdge=Object.freeze({START:OverlaySlot.START,END:OverlaySlot.END} as const);
export type SidebarEdge=typeof SidebarEdge[keyof typeof SidebarEdge];

/** Every pattern an overlay can ask for, by C#'s name where C# has one: slot elements, world markers, the sidebar and
 * each kind of menu content view. PickupHint is no element of its own: it is the collectible preview drawn while its
 * count is recent. */
export const OverlayPattern=Object.freeze({
 HEALTH_SPIRAL:'HealthSpiral',BREATH_METER:'BreathMeter',COLLECTIBLE_PREVIEW:'CollectiblePreview',
 PICKUP_HINT:'PickupHint',STATE_PEEK:'StatePeek',PIP_CAMERA:'PIPCameraDisplay',MINIMAP:'Minimap',
 DIALOGUE:'DialogueDisplay',TOOLTIP:'Tooltip',GAMEPAD_PREVIEW:'GamePadPreview',PROJECTILE_TARGET:'ProjectileTarget',
 SIDEBAR:'SidebarFullNestedCollection',MENU_COLLECTION:MenuViewKind.COLLECTION,MENU_SYNTH:MenuViewKind.SYNTH,
} as const);
export type OverlayPattern=typeof OverlayPattern[keyof typeof OverlayPattern];

/** A bounded amount: how much there is of how much there can be, in PipRow's words. */
export interface OverlayMeasure {readonly value: number; readonly max: number}
/** A count of one kind of thing, beside the still image that names the kind. */
export interface OverlayCount {readonly image: string; readonly count: number}
/** A measure drawn as a row of pips: PipRow's value, max and segments. */
export interface OverlayPips extends OverlayMeasure {readonly segments: number}
/** A live render of one named camera view. */
export interface OverlayFeed {readonly view: string}
interface OverlayElementValues {
 [OverlayPattern.HEALTH_SPIRAL]: OverlayPips;
 [OverlayPattern.BREATH_METER]: OverlayPips;
 [OverlayPattern.COLLECTIBLE_PREVIEW]: {readonly counted: OverlayCount; readonly recent: boolean};
 [OverlayPattern.STATE_PEEK]: {readonly names: readonly string[]};
 [OverlayPattern.PIP_CAMERA]: OverlayFeed;
 [OverlayPattern.MINIMAP]: OverlayFeed;
 [OverlayPattern.DIALOGUE]: {readonly title: string; readonly lines: readonly string[]};
 [OverlayPattern.TOOLTIP]: {readonly text: string};
 [OverlayPattern.GAMEPAD_PREVIEW]: {readonly pressed: readonly string[]};
}
export type OverlayElementPattern=keyof OverlayElementValues;
export type OverlayElement={
 [P in OverlayElementPattern]: {readonly kind: P}&OverlayElementValues[P];
}[OverlayElementPattern];

/** A glyph placed at a point in the world, which the host projects onto the surface
 * (C#'s IntraEnvironmentHudBehaviour). */
export interface WorldMarker {
 readonly kind: typeof OverlayPattern.PROJECTILE_TARGET;
 readonly image: string;
 readonly position: ModelVector;
}

export interface OverlaySource {
 readonly slots?: Partial<Record<OverlaySlot,readonly OverlayElement[]>>;
 readonly sidebars?: Partial<Record<SidebarEdge,SidebarSource>>;
 readonly world?: readonly WorldMarker[];
 readonly menu?: MenuSource;
}

/** What each pattern draws from: its element, marker, sidebar or content view. */
export type OverlayPatternValue={[P in OverlayElementPattern]: Extract<OverlayElement,{kind: P}>}&{
 [OverlayPattern.PICKUP_HINT]: Extract<OverlayElement,{kind: typeof OverlayPattern.COLLECTIBLE_PREVIEW}>;
 [OverlayPattern.PROJECTILE_TARGET]: WorldMarker;
 [OverlayPattern.SIDEBAR]: SidebarSource;
}&{[K in MenuView['kind']]: Extract<MenuView,{kind: K}>};
