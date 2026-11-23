import type {ReactNode} from 'react';
import type {Density} from '../../../react/density.ts';
// One boolean, four forms: a lit cell for a module's grid, a labelled row for a settings list, a small switch for a
// module's header, or a header's icon toggle. A leaf, so Boolean and the forms it draws share it without importing
// each other.
export const BooleanForm = Object.freeze({CELL: 'cell', SETTING: 'setting', SWITCH: 'switch', ICON: 'icon'} as const);

export interface SwitchBooleanProps {
  form: typeof BooleanForm.SWITCH;
  value: boolean;
  onChange(value: boolean): void;
  ariaLabel: string;
  /** Its height. The width and thumb follow from it. */
  height?: number;
  disabled?: boolean;
}

/** The glyph each value draws. A toggle shows what a press does next, as play shows while paused. */
export interface BooleanGlyphs {on: ReactNode; off: ReactNode}
/** A header's icon toggle: HeaderIconButton pressed while the value is on. The consumer supplies its glyphs, so a
 *  skin never chooses this form. */
export interface IconBooleanProps {
  form: typeof BooleanForm.ICON;
  value: boolean;
  onChange(value: boolean): void;
  label: string;
  glyphs: BooleanGlyphs;
  bare?: boolean;
  density?: Density;
  disabled?: boolean;
}
