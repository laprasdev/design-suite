import {PHI, PHI_INVERSE, LayoutDimensions} from '../../../layout.ts';
import {Opacity} from '../../../tokens.ts';
import type {StyleTheme} from '../../StyleContext.tsx';

// What a control needs to draw a modulation: where its source sits in the registry, how far it reaches, and where it is now.
export const ModulationRoot = Object.freeze({SELF: 'self', GLOBAL: 'global', COMPUTATION: 'computation', RELATIONSHIP: 'relationship'} as const);
export type ModulationRootValue = typeof ModulationRoot[keyof typeof ModulationRoot];

export const RangeEnd = Object.freeze({ORIGIN: 'origin', END: 'end'} as const);
export type RangeEndValue = typeof RangeEnd[keyof typeof RangeEnd];

export interface ControlModulator {
  source: string;
  root: ModulationRootValue;
  /** Signed reach in the control's own units. */
  depth: number;
  /** Reaches both ways from the value, split by a hair gap. */
  bipolar?: boolean;
  /** The end of a range this moves. */
  end?: RangeEndValue;
  /** Where the source is right now: 0 to 1, or -1 to 1 when bipolar. */
  sample?: number;
}

export interface ModulationProps {
  modulators?: ControlModulator[];
  selectedSource?: string | null;
  onSelectSource?: (source: string) => void;
}

// The one table from registry root to skin role. Rerouting the colours is a change here and nowhere else.
const ROOT_COLOR: Record<ModulationRootValue, (style: StyleTheme) => string> = {
  [ModulationRoot.SELF]: style => style.primaryColor,
  [ModulationRoot.GLOBAL]: style => style.primaryColor,
  [ModulationRoot.COMPUTATION]: style => style.secondaryColor,
  [ModulationRoot.RELATIONSHIP]: style => style.tertiaryColor,
};
export const modulatorColor = (root: ModulationRootValue, style: StyleTheme) => ROOT_COLOR[root](style);

export const MODULATOR_LIVE_COLOR = '#ffffff';
export const modulatorOpacity = (source: string, selected?: string | null) => (selected && selected !== source ? Opacity.dim : Opacity.full);

// The golden ladder: a modulator line is φ⁻¹ of the value's thickness, and φ of it clears the value and each line.
export const VALUE_THICKNESS = LayoutDimensions.knob.strokeHeavy;
export const modulationLadder = (thickness: number) => ({line: thickness * PHI_INVERSE, gap: thickness * PHI});
