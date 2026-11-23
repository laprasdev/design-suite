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

export interface ControlKindSpec {
  /** Intrinsic inline control width in px (0 when the control has no fixed inline box beside its caption). */
  readonly width: number;
  /** Intrinsic single-row control height in px before multi-option or dynamic knob scaling. */
  readonly height: number;
  /** True when the control draws its own value or holds none, so no separate reading is shown when set. */
  readonly wordless: boolean;
  /** True when in a single-column grid the caption sits beside the control (`width + fieldGap + caption`). */
  readonly besideInOneColumn: boolean;
}

export const CONTROL_KINDS: { readonly [K in ControlKindValue]: ControlKindSpec } = Object.freeze({
  [ControlKind.YES_NO]: {
    width: G.yesNoDot, height: ONE_LINE_HEIGHT, wordless: true, besideInOneColumn: true,
  },
  [ControlKind.KNOB]: {
    width: G.controlMin, height: G.controlMin, wordless: false, besideInOneColumn: true,
  },
  [ControlKind.RANGE]: {
    width: G.controlMin, height: G.controlMin, wordless: false, besideInOneColumn: true,
  },
  [ControlKind.SLIDER]: {
    width: 0, height: ONE_LINE_HEIGHT, wordless: false, besideInOneColumn: false,
  },
  [ControlKind.NUMBER]: {
    width: G.numberInputWidth, height: CUTOUT_HEIGHT, wordless: true, besideInOneColumn: false,
  },
  [ControlKind.VECTOR]: {
    width: G.numberInputWidth, height: VECTOR_HEIGHT, wordless: true, besideInOneColumn: false,
  },
  [ControlKind.COLOR]: {
    width: G.swatchWidth, height: COLOR_HEIGHT, wordless: true, besideInOneColumn: false,
  },
  [ControlKind.TEXT]: {
    width: G.numberInputWidth, height: CUTOUT_HEIGHT, wordless: true, besideInOneColumn: false,
  },
  [ControlKind.CHOICE]: {
    width: G.openButtonWidth, height: OPTION_BUTTON_HEIGHT, wordless: true, besideInOneColumn: false,
  },
  [ControlKind.FLAGS]: {
    width: G.openButtonWidth, height: OPTION_BUTTON_HEIGHT, wordless: true, besideInOneColumn: false,
  },
  [ControlKind.REFERENCE]: {
    width: 0, height: LINE_TEXT_HEIGHT, wordless: true, besideInOneColumn: false,
  },
  [ControlKind.CURVE]: {
    width: G.curveWidth, height: G.curveHeight, wordless: true, besideInOneColumn: false,
  },
  [ControlKind.PHASES]: {
    width: PHASE_GLYPH_WIDTH, height: G.phaseGlyphHeight, wordless: true, besideInOneColumn: true,
  },
  [ControlKind.OPENS]: {
    width: G.openButtonWidth, height: G.openButtonHeight, wordless: false, besideInOneColumn: true,
  },
  [ControlKind.LAYERS]: {
    width: G.openButtonWidth, height: G.openButtonHeight, wordless: false, besideInOneColumn: true,
  },
  [ControlKind.READOUT]: {
    width: 0, height: LINE_TEXT_HEIGHT, wordless: true, besideInOneColumn: false,
  },
});

export interface ControlBoxQuery {
  readonly kind: ControlKindValue;
  readonly knobSize: number;
  readonly columns: number;
  readonly choiceForm?: ChoiceFormValue;
  readonly optionCount?: number;
}

/** Resolved control box `{ width, height }` for `query`, read from `CONTROL_KINDS`. */
export function controlBoxOf(query: ControlBoxQuery): { readonly width: number; readonly height: number } {
  const spec = CONTROL_KINDS[query.kind];
  if (query.kind === ControlKind.YES_NO) return { width: 0, height: spec.height };
  if (query.kind === ControlKind.KNOB) return { width: query.knobSize, height: query.knobSize };
  if (query.kind === ControlKind.RANGE) {
    return query.columns >= 2
      ? { width: 0, height: ONE_LINE_HEIGHT }
      : { width: query.knobSize, height: query.knobSize };
  }
  if (query.kind === ControlKind.CHOICE && query.choiceForm === ChoiceForm.SELECT) {
    return { width: spec.width, height: CUTOUT_HEIGHT };
  }
  if (query.kind === ControlKind.FLAGS) {
    const flagRows = Math.max(1, Math.ceil((query.optionCount ?? 1) / G.optionColumns));
    return { width: spec.width, height: flagRows * OPTION_BUTTON_HEIGHT + (flagRows - 1) * G.optionGap };
  }
  return { width: spec.width, height: spec.height };
}
