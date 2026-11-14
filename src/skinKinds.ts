import {BooleanForm} from './synth/components/synth/booleanForm.ts';
import {IncrementerForm} from './synth/components/synth/incrementerForm.ts';
import {SliderForm} from './react/inputs/sliderForm.ts';

/** The kinds a skin chooses a form for. A consumer's own kinds are named beside its own catalog. */
export const SkinKind = {
  KNOB: 'knob', SLIDER: 'slider', RANGE: 'range', NUMBER: 'number', YES_NO: 'yes-no', CHOICE: 'choice',
  FLAGS: 'flags', VECTOR: 'vector', COLOR: 'color', TEXT: 'text', LAYERS: 'layers', REFERENCE: 'reference',
  CURVE: 'curve', PHASES: 'phases', OPENS: 'opens', READOUT: 'readout', CONTAINER: 'container',
} as const;
export type SkinKindValue = typeof SkinKind[keyof typeof SkinKind];

export const SkinId = {FREEFORM: 'freeform', FLAT: 'flat', CLASSIC: 'classic'} as const;
export type SkinIdValue = typeof SkinId[keyof typeof SkinId];

/** The form ids of each kind, as elements.json's group of the same name lists them. */
export const ContainerForm = {CUTOUT: 'cutout', FLAT: 'flat'} as const;
export type ContainerFormValue = typeof ContainerForm[keyof typeof ContainerForm];
/** A catalog id read as a container form; an id the owner doesn't list is a broken catalog. */
export function containerFormOf(id: string): ContainerFormValue {
  const form = Object.values(ContainerForm).find(known => known === id);
  if (!form) throw new Error(`No container form "${id}".`);
  return form;
}
export const KnobSkinForm = {CUTOUT: 'cutout', MINIMAL: 'minimal', FINE: 'fine', LINE: 'line', TICKS: 'ticks'} as const;
export const SliderSkinForm = {MINIMAL: 'minimal', LINE: 'line', TRACK: 'track', SETTING: SliderForm.SETTING} as const;
export type SliderSkinFormValue = typeof SliderSkinForm[keyof typeof SliderSkinForm];
export const RangeSkinForm = {TRACK: 'track', DIAL: 'dial'} as const;
export const YesNoSkinForm = {DOT: 'dot', ...BooleanForm} as const;
export const NumberSkinForm = {INPUT: 'input', HORIZONTAL: IncrementerForm.HORIZONTAL,
  VERTICAL: IncrementerForm.VERTICAL, METER: IncrementerForm.METER} as const;
export const ChoiceSkinForm = {
  JOINED: 'joined', TEXT: 'text', ICONS: 'icons', GRID: 'grid', CYCLE: 'cycle', SELECT: 'select',
} as const;
export const FlagsSkinForm = {JOINED: 'joined', ICONS: 'icons'} as const;
export const VectorSkinForm = {INPUTS: 'inputs', KNOBS: 'knobs'} as const;
export const OpensSkinForm = {CHEVRON: 'chevron', TOOL: 'tool'} as const;
export const ColorSkinForm = {SWATCH: 'swatch'} as const;
export const TextSkinForm = {INPUT: 'input', UNDERLINE: 'underline'} as const;
export const LayersSkinForm = {BITS: 'bits'} as const;
export const ReferenceSkinForm = {SELECT: 'select'} as const;
export const CurveSkinForm = {LINE: 'line'} as const;
export const PhasesSkinForm = {GLYPH: 'glyph'} as const;
export const ReadoutSkinForm = {VALUE: 'value'} as const;

/** A kind whose callers all treat "the skin names no form" as one named form. Its catalog declares it. */
export interface DefaultedKind {readonly kind: string; readonly form: string}
export const SkinDefault = {
  SLIDER: {kind: SkinKind.SLIDER, form: SliderSkinForm.TRACK},
  YES_NO: {kind: SkinKind.YES_NO, form: YesNoSkinForm.DOT},
} as const satisfies Record<string, DefaultedKind>;
