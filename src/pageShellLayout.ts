// The synth's page shell: the 1920x1080 stage it is drawn for, its closed-page cards, its flip layers,
// and its frame-arrange gutters, stops and usability floor. LayoutDimensions.pageShell re-exports this.

import { PHI_INVERSE } from './goldenRatio.ts';

const OUTER_STOP = (1 - PHI_INVERSE) * PHI_INVERSE;

// Stage stack, bottom to top: travelling cards, arriving page, fading pressed card, leaving page, then tile frames.
const flipCardLayer = 0;
const flipArrivingLayer = flipCardLayer + 1;
const flipPressedCardLayer = flipArrivingLayer + 1;
const flipLeavingLayer = flipPressedCardLayer + 1;
const frameLayer = flipLeavingLayer + 1;
// Arranging: grips, gutters and drop preview sit over frames; a held tile rides over them, and its chip rides above it.
const arrangeLayer = frameLayer + 1;
const heldLayer = arrangeLayer + 1;
const arrangeChipLayer = heldLayer + 1;

export const PageShellDimensions = {
  stageWidth: 1920,
  stageHeight: 1080,
  tileGutter: 3,
  moduleWidth: 320,
  moduleHeight: 194,
  envelopeMinWidth: 453,
  envelopeMinHeight: 255,
  previewMinWidth: 280,
  previewMinHeight: 157,
  scrollCueHeight: 18,
  scrollCueIcon: 12,
  barLineHeight: 1.4,
  guideText: 12,
  guideTagLayer: 1,
  // A closed page's card: laid out on φ in its own box, with text and icons at module size.
  cardPadding: 8,
  cardStroke: 1.5,
  cardWire: 1,
  cardGateRadius: 9,
  cardNodeRadius: 3,
  // Dash length for a line with no length of its own, such as an Envelope sustain held until the state is left.
  cardDash: 3,
  // What a drawing weighs against a list when a card shares its room out, in text rows, and minimum list column width.
  cardDrawingRows: 4,
  // Fewest text rows of height a condition's drawing gets; below that, a pad or sensor reads as a dash, so show title.
  cardDrawingLeastRows: 2,
  cardLineWidth: 120,
  // A card's title and live mark beside its drawing, when there they leave it more room than above it.
  cardHeaderWidth: 104,
  guideRemeasureMs: 1000,
  guideClipSlack: 1,
  overlayLayer: 2000,
  // A flip: twice the suite's .17s, long enough to watch a page and its card trade places around the still Preview.
  flipMs: 340,
  flipEase: 'cubic-bezier(.22,1,.36,1)',
  // First half: the pressed card fades as its page grows out of it, and the incoming card waits.
  // Second half: the incoming card slides in; the leaving page stays whole until it lands on its card.
  flipCardFadeDelayMs: 170,
  flipCardLayer,
  flipArrivingLayer,
  flipPressedCardLayer,
  flipLeavingLayer,
  frameLayer,
  arrangeLayer,
  heldLayer,
  arrangeChipLayer,
  // Arranging: how near a tile's edge a drop cuts in, how far a press moves to lift, what a gutter draws, and where a
  // cut can rest, so a layout stays on the ratio.
  dropEdgeZone: 36,
  pickUpDistance: 4,
  gutterLine: 2,
  arrangeText: 13,
  cutStops: [OUTER_STOP, 1 - PHI_INVERSE, PHI_INVERSE, 1 - OUTER_STOP],
  // The smallest window an arrangement has to stay usable in, whichever window it is made in.
  smallestWindowWidth: 1366,
  smallestWindowHeight: 650,
} as const;
