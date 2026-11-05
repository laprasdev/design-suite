import type {SampleModulationValue} from './GalleryControls.tsx';
import groups from './elements.json' with {type: 'json'};

export interface ElementOption { id: string; label: string; states?: string[]; assignable?: boolean }
export interface ElementGroup {
  id: string; label: string; sample: string; options: ElementOption[];
  preview?: {minWidth: number; maxWidth?: number; height: number};
}
export type ElementSelections = Record<string, string[]>;
export const ELEMENT_GROUPS: readonly ElementGroup[] = groups;
export const elementOption = (group: string, option: string) =>
  ELEMENT_GROUPS.find(item => item.id === group)?.options.find(item => item.id === option);

export const SampleState = {SET: 'set', UNSET: 'unset', INHERITED: 'inherited', DISABLED: 'disabled'} as const;
export type SampleStateValue = typeof SampleState[keyof typeof SampleState];
export interface ElementSampleProps {
  group: string; option: string; state: SampleStateValue; modulation?: SampleModulationValue;
}

export const supportsSampleState = (option: ElementOption, state: SampleStateValue) =>
  (option.states ?? [SampleState.SET, SampleState.DISABLED]).includes(state);
