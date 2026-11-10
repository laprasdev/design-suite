// The field vocabulary: whether a field is set, how much it says, which control draws it, what a yes/no reads, and
// which lifecycle phases are active. No React here, so the web synth's models read it without importing a view, and
// the suite's views read it too.
import {ChoiceSkinForm} from './skinKinds.ts';

/** Whether a field holds its own value here: set, not set, or inheriting through its mode. */
export const FieldState = Object.freeze({ SET: 'set', UNSET: 'unset', INHERITED: 'inherited' } as const);
export type FieldStateValue = typeof FieldState[keyof typeof FieldState];

// How much a field says for itself: set, quiet because nothing is set or it inherits, or inert because it can't apply
// here. Inert is as dim as quiet: its module's header already says it's off, and a value inside it still reads at 3:1
// or better.
export const FieldEmphasis = Object.freeze({ SET: 'set', QUIET: 'quiet', INERT: 'inert' } as const);
export type FieldEmphasisValue = typeof FieldEmphasis[keyof typeof FieldEmphasis];

/** Which control draws a field. Values are the DOM's data-field-kind. Knob and slider are the suite's own kinds. */
export const ControlKind = Object.freeze({
  KNOB: 'knob', SLIDER: 'slider', RANGE: 'range', NUMBER: 'number', YES_NO: 'yes-no', CHOICE: 'choice',
  FLAGS: 'flags', VECTOR: 'vector', COLOR: 'color', TEXT: 'text', LAYERS: 'layers', REFERENCE: 'reference',
  CURVE: 'curve', PHASES: 'phases', OPENS: 'opens', READOUT: 'readout',
} as const);
export type ControlKindValue = typeof ControlKind[keyof typeof ControlKind];
/** The kinds a bounded number is drawn as: a number's kind is its form. */
export const NUMBER_KINDS = Object.freeze([
  ControlKind.KNOB, ControlKind.SLIDER, ControlKind.RANGE, ControlKind.NUMBER,
] as const);
export type NumberKind = typeof NUMBER_KINDS[number];

/** A choice's forms: the manifest's widget name for words in a row, and the skin's own value for every other. */
export const ChoiceForm = Object.freeze({
  MULTI_CHOICE: 'multiChoice', SELECT: ChoiceSkinForm.SELECT, ICONS: ChoiceSkinForm.ICONS, GRID: ChoiceSkinForm.GRID,
} as const);
export type ChoiceFormValue = typeof ChoiceForm[keyof typeof ChoiceForm];

/** A yes/no field's four real states: on, off, not set, and inherit. */
export const YesNo = Object.freeze({ ON: 'on', OFF: 'off', UNSET: 'unset', INHERIT: 'inherit' } as const);
export type YesNoValue = typeof YesNo[keyof typeof YesNo];

/** What a yes/no draws: a plain bool is on or off, and an overridable one is also not set or inherit. */
export function yesNoOf(state: FieldStateValue, on: boolean, overridable: boolean): YesNoValue {
  if (overridable && state === FieldState.UNSET) return YesNo.UNSET;
  if (overridable && state === FieldState.INHERITED) return YesNo.INHERIT;
  return on ? YesNo.ON : YesNo.OFF;
}

/** Where an overridable yes/no's press goes next: not set, on, off, inherit, and round again. */
export const YES_NO_NEXT: Readonly<Record<YesNoValue, YesNoValue>> = Object.freeze({
  [YesNo.UNSET]: YesNo.ON, [YesNo.ON]: YesNo.OFF, [YesNo.OFF]: YesNo.INHERIT, [YesNo.INHERIT]: YesNo.UNSET,
});

/** What a field holding nothing reads. */
export const NO_VALUE = '—';

/** C#'s PhaseConfiguration as a phase glyph draws it: whether its entrance and maintain phases are active. */
export interface PhaseGlyphValue { entrance: boolean; maintain: boolean }
