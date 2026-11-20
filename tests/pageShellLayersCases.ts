// The stage's stacking order, bottom to top: every layer PageShellDimensions declares from a flip's cards up to an
// arrange chip, which rides above the held tile it labels even when the held tile's page mounts after the arrange
// layer in the DOM.
import {element} from '../src/react/elementContract.ts';
import type {PageShellDimensions} from '../src/pageShellLayout.ts';

export const StageLayersHost = element('stage-layers-host');
export const STAGE_LAYER_BOX = Object.freeze({width: 160, height: 96});
export const STAGE_STACK_BOTTOM_TO_TOP = Object.freeze([
  'flipCardLayer', 'flipArrivingLayer', 'flipPressedCardLayer', 'flipLeavingLayer',
  'frameLayer', 'arrangeLayer', 'heldLayer', 'arrangeChipLayer',
] as const satisfies readonly (keyof typeof PageShellDimensions)[]);
export type StageLayerName = typeof STAGE_STACK_BOTTOM_TO_TOP[number];
export const ARRANGE_WRAPPED_LAYERS: readonly StageLayerName[] = Object.freeze(['arrangeLayer', 'arrangeChipLayer']);
