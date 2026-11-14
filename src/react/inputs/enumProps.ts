// The Enum's props: its options, colors and variants. A leaf, so the synth Enum and the inputs that draw its forms
// (OptionsEnum, SkinChoice) share them without importing each other.
import type React from 'react';
import type {AnyColor} from '../../color.ts';
import type {HciComposableStyle} from '../../synth/design/designTokensLoader.ts';

export type EnumColor = AnyColor;
export type EnumVariant = 'full' | 'cycling' | 'multi' | 'options';
export type EnumDisplayMode = 'shared' | 'distinct';

export interface EnumOption<T = string> {
  value: T;
  label?: string;
  icon?: React.ReactNode;
  image?: string;
  tooltip?: string;
}

interface BaseEnumProps<T = string> {
  options: EnumOption<T>[];
  className?: string;
  color?: EnumColor;
  layout?: HciComposableStyle;
  optionComposition?: HciComposableStyle;
  disabled?: boolean;
}

/** One value chosen: every option in view (full), one cycling in place (cycling), or a module's grid (options). */
export interface SingleSelectEnumProps<T = string> extends BaseEnumProps<T> {
  value: T;
  onChange?: (value: T) => void;
  variant?: 'full' | 'cycling' | 'options';
  /** Size in px for cycling variant button (default: uses SIZES.enumMinWidth) */
  size?: number;
  /** How many columns the options form lays its choices in. */
  columns?: number;
  /** The options form with several lit at once, for a flags value. Takes the place of `value`. */
  litValues?: T[];
}

/** Several values chosen, one of them primary. */
export interface MultiSelectEnumProps<T = string> extends BaseEnumProps<T> {
  values: T[];
  onChange?: (values: T[]) => void;
  primaryValue?: T;
  variant: 'multi';
  displayStyle?: 'default' | 'full';
}

export type EnumProps<T = string> = SingleSelectEnumProps<T> | MultiSelectEnumProps<T>;
