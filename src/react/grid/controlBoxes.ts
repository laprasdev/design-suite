// Canonical control-kind boxes and metadata shared by the suite's input views/CSS and consumer grid sizing.
import { ChoiceForm, ControlKind, type ChoiceFormValue, type ControlKindValue } from '../../fields.ts';
import { ModuleGridDimensions as G, TEXT_FLOOR } from '../../moduleGridLayout.ts';
import { Borders } from '../../tokens.ts';
import { ONE_LINE_HEIGHT } from './lineTrack.ts';

export const FRAME = Borders.standard.width * 2;
export const HEADER_CHROME = G.headerLineHeight + Borders.standard.width;
export const LINE_TEXT_HEIGHT = Math.ceil(TEXT_FLOOR * G.tightLine);
export const CUTOUT_HEIGHT = LINE_TEXT_HEIGHT + G.inputPadding * 2 + FRAME;
export const COLOR_HEIGHT = G.swatchHeight + G.groupGap + CUTOUT_HEIGHT;
export const VECTOR_HEIGHT = LINE_TEXT_HEIGHT + CUTOUT_HEIGHT;
export const OPTION_BUTTON_HEIGHT = LINE_TEXT_HEIGHT + G.optionPaddingBlock * 2;
export const PHASE_GLYPH_VIEW = Object.freeze({ width: 21, height: 10 } as const);
export const PHASE_GLYPH_WIDTH = Math.ceil(G.phaseGlyphHeight * PHASE_GLYPH_VIEW.width / PHASE_GLYPH_VIEW.height);

export interface ControlBoxQuery {
  readonly kind: ControlKindValue;
  readonly knobSize: number;
  readonly columns: number;
  readonly choiceForm?: ChoiceFormValue;
  readonly optionCount?: number;
}

export interface ControlBox {
  readonly width: number;
  readonly height: number;
}

/** How a kind's placed box follows from its spec and the field it draws. */
export type ControlBoxRule = (spec: ControlKindSpec, query: ControlBoxQuery) => ControlBox;

const square = (size: number): ControlBox => ({ width: size, height: size });

/** The spec's own box. */
const SPEC_BOX: ControlBoxRule = spec => ({ width: spec.width, height: spec.height });
/** A box in the caption's line, taking no inline width of its own. */
const LINE_BOX: ControlBoxRule = spec => ({ width: 0, height: spec.height });
/** A square at the grid's fitted knob size. */
const KNOB_BOX: ControlBoxRule = (_spec, query) => square(query.knobSize);
/** A knob alone in its column, a one-line row beside others. */
const RANGE_BOX: ControlBoxRule = (spec, query) =>
  query.columns >= 2 ? { width: 0, height: ONE_LINE_HEIGHT } : KNOB_BOX(spec, query);
/** The select form's cutout, otherwise the spec's option row. */
const CHOICE_BOX: ControlBoxRule = (spec, query) =>
  query.choiceForm === ChoiceForm.SELECT ? { width: spec.width, height: CUTOUT_HEIGHT } : SPEC_BOX(spec, query);
/** One option row per `G.optionColumns` options. */
const FLAGS_BOX: ControlBoxRule = (spec, query) => {
  const rows = Math.max(1, Math.ceil((query.optionCount ?? 1) / G.optionColumns));
  return { width: spec.width, height: rows * spec.height + (rows - 1) * G.optionGap };
};

export interface ControlKindSpec {
  /** Intrinsic inline control width in px (0 when the control has no fixed inline box beside its caption). */
  readonly width: number;
  /** Intrinsic single-row control height in px before multi-option or dynamic knob scaling. */
  readonly height: number;
  /** True when the control draws its own value or holds none, so no separate reading is shown when set. */
  readonly wordless: boolean;
  /** True when in a single-column grid the caption sits beside the control (`width + fieldGap + caption`). */
  readonly besideInOneColumn: boolean;
  /** The kind's placed box, as `controlBoxOf` reads it. */
  readonly box: ControlBoxRule;
}

export const CONTROL_KINDS: { readonly [K in ControlKindValue]: ControlKindSpec } = Object.freeze({
  [ControlKind.YES_NO]: {
    width: G.yesNoDot, height: ONE_LINE_HEIGHT, wordless: true, besideInOneColumn: true,
    box: LINE_BOX,
  },
  [ControlKind.KNOB]: {
    width: G.controlMin, height: G.controlMin, wordless: false, besideInOneColumn: true,
    box: KNOB_BOX,
  },
  [ControlKind.RANGE]: {
    width: G.controlMin, height: G.controlMin, wordless: false, besideInOneColumn: true,
    box: RANGE_BOX,
  },
  [ControlKind.SLIDER]: {
    width: 0, height: ONE_LINE_HEIGHT, wordless: false, besideInOneColumn: false,
    box: SPEC_BOX,
  },
  [ControlKind.NUMBER]: {
    width: G.numberInputWidth, height: CUTOUT_HEIGHT, wordless: true, besideInOneColumn: false,
    box: SPEC_BOX,
  },
  [ControlKind.VECTOR]: {
    width: G.numberInputWidth, height: VECTOR_HEIGHT, wordless: true, besideInOneColumn: false,
    box: SPEC_BOX,
  },
  [ControlKind.COLOR]: {
    width: G.swatchWidth, height: COLOR_HEIGHT, wordless: true, besideInOneColumn: false,
    box: SPEC_BOX,
  },
  [ControlKind.TEXT]: {
    width: G.numberInputWidth, height: CUTOUT_HEIGHT, wordless: true, besideInOneColumn: false,
    box: SPEC_BOX,
  },
  [ControlKind.CHOICE]: {
    width: G.openButtonWidth, height: OPTION_BUTTON_HEIGHT, wordless: true, besideInOneColumn: false,
    box: CHOICE_BOX,
  },
  [ControlKind.FLAGS]: {
    width: G.openButtonWidth, height: OPTION_BUTTON_HEIGHT, wordless: true, besideInOneColumn: false,
    box: FLAGS_BOX,
  },
  [ControlKind.REFERENCE]: {
    width: 0, height: LINE_TEXT_HEIGHT, wordless: true, besideInOneColumn: false,
    box: SPEC_BOX,
  },
  [ControlKind.CURVE]: {
    width: G.curveWidth, height: G.curveHeight, wordless: true, besideInOneColumn: false,
    box: SPEC_BOX,
  },
  [ControlKind.PHASES]: {
    width: PHASE_GLYPH_WIDTH, height: G.phaseGlyphHeight, wordless: true, besideInOneColumn: true,
    box: SPEC_BOX,
  },
  [ControlKind.OPENS]: {
    width: G.openButtonWidth, height: G.openButtonHeight, wordless: false, besideInOneColumn: true,
    box: SPEC_BOX,
  },
  [ControlKind.LAYERS]: {
    width: G.openButtonWidth, height: G.openButtonHeight, wordless: false, besideInOneColumn: true,
    box: SPEC_BOX,
  },
  [ControlKind.READOUT]: {
    width: 0, height: LINE_TEXT_HEIGHT, wordless: true, besideInOneColumn: false,
    box: SPEC_BOX,
  },
});

/** Placed control box `{ width, height }` for `query`, by its kind's rule in `CONTROL_KINDS`. */
export function controlBoxOf(query: ControlBoxQuery): ControlBox {
  const spec = CONTROL_KINDS[query.kind];
  return spec.box(spec, query);
}
