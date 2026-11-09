import groups from './elements.json' with {type: 'json'};

export interface ElementOption { id: string; label: string; states?: string[]; assignable?: boolean }
export interface ElementGroup {
  id: string; label: string; sample: string; options: ElementOption[];
  preview?: {minWidth: number; maxWidth?: number; height: number};
}
/** The width a group's samples keep where it declares no minimum. */
export const DEFAULT_ELEMENT_WIDTH = 240;
export type ElementSelections = Record<string, string[]>;
export const ELEMENT_GROUPS: readonly ElementGroup[] = groups;
export const elementOption = (group: string, option: string) =>
  ELEMENT_GROUPS.find(item => item.id === group)?.options.find(item => item.id === option);

/** How the footer words a sample setting: its value, capitalised. */
export const sampleLabel = (value: string) => value[0].toUpperCase() + value.slice(1);
export const SampleState = {SET: 'set', UNSET: 'unset', INHERITED: 'inherited', DISABLED: 'disabled'} as const;
export type SampleStateValue = typeof SampleState[keyof typeof SampleState];
export interface ElementSampleProps {
  group: string; option: string; state: SampleStateValue; modulation?: SampleModulationValue;
}

export const supportsSampleState = (option: ElementOption, state: SampleStateValue) =>
  (option.states ?? [SampleState.SET, SampleState.DISABLED]).includes(state);

/** The form ids of the modulation group, as elements.json lists them. */
export const ModulationForm = {SINGLE: 'single', STACKED: 'stacked', BIPOLAR: 'bipolar'} as const;
/** The footer's setting: no modulation, one of the group's forms, or the stacked sources drawn blended. */
export const SampleModulation = {OFF: 'off', ...ModulationForm, BLENDED: 'blended'} as const;
/** The gallery's groups that are not a skin's kinds. Each group's forms have an owner: the graph's is Graph's. */
export const GalleryGroup = {MODULATION: 'modulation', GRAPH: 'graph'} as const;
export type SampleModulationValue = typeof SampleModulation[keyof typeof SampleModulation];
/** The palette a gallery previews in: the host's own, or a skin's by name. */
export const PalettePick = {HOST: 'host'} as const;
/** Which options a gallery lists: all of them, or the skin's assigned ones. */
export const ElementFilter = {ALL: 'all', ASSIGNED: 'assigned'} as const;
export type ElementFilterValue = typeof ElementFilter[keyof typeof ElementFilter];
export const candidateKey = (group: string, option: string) => `${group}/${option}`;
