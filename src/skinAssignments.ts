import {ChoiceSkinForm, ColorSkinForm, ContainerForm, CurveSkinForm, FlagsSkinForm, KnobSkinForm, LayersSkinForm,
  NumberSkinForm, OpensSkinForm, PhasesSkinForm, RangeSkinForm, ReadoutSkinForm, ReferenceSkinForm, SkinId, SkinKind,
  SliderSkinForm, TextSkinForm, VectorSkinForm, YesNoSkinForm} from './skinKinds.ts';

/** Component shapes are skins. Palette identities are independent of these assignments. */
export interface SkinCatalogGroup { id: string; options: readonly { id: string; assignable?: boolean }[] }
export interface ComponentSkin {
  id: string;
  name: string;
  candidates: Record<string, string[]>;
  active: Record<string, string>;
}
export type ElementFeedback = Record<string, Record<string, string>>;
export const ELEMENT_FEEDBACK_LIMIT = 2000;
export interface SkinAssignments {
  version: 2; revision: number; skins: ComponentSkin[]; feedback: ElementFeedback;
}
export type SkinChange = { revision: number } & (
  | { action: 'create'; name: string; source: string }
  | { action: 'assign'; skin: string; group: string; option: string; selected: boolean }
  | { action: 'activate'; skin: string; group: string; option: string }
  | { action: 'feedback'; group: string; option: string; text: string });

const FLAT = {[SkinKind.KNOB]: KnobSkinForm.CUTOUT, [SkinKind.SLIDER]: SliderSkinForm.TRACK,
  [SkinKind.RANGE]: RangeSkinForm.TRACK, [SkinKind.NUMBER]: NumberSkinForm.INPUT, [SkinKind.YES_NO]: YesNoSkinForm.DOT,
  [SkinKind.CHOICE]: ChoiceSkinForm.TEXT, [SkinKind.FLAGS]: FlagsSkinForm.JOINED,
  [SkinKind.VECTOR]: VectorSkinForm.INPUTS, [SkinKind.COLOR]: ColorSkinForm.SWATCH,
  [SkinKind.TEXT]: TextSkinForm.INPUT, [SkinKind.LAYERS]: LayersSkinForm.BITS,
  [SkinKind.REFERENCE]: ReferenceSkinForm.SELECT, [SkinKind.CURVE]: CurveSkinForm.LINE,
  [SkinKind.PHASES]: PhasesSkinForm.GLYPH, [SkinKind.OPENS]: OpensSkinForm.CHEVRON,
  [SkinKind.READOUT]: ReadoutSkinForm.VALUE, [SkinKind.CONTAINER]: ContainerForm.FLAT};
const CLASSIC = {...FLAT, [SkinKind.KNOB]: KnobSkinForm.LINE, [SkinKind.SLIDER]: SliderSkinForm.TRACK,
  [SkinKind.CHOICE]: ChoiceSkinForm.JOINED, [SkinKind.CONTAINER]: ContainerForm.CUTOUT};
const definition = (id: string, name: string, active: Record<string, string>): ComponentSkin => ({
  id, name, active: { ...active },
  candidates: Object.fromEntries(Object.entries(active).map(([key, form]) => [key, [form]])),
});
export const emptySkinAssignments = (): SkinAssignments => ({ version: 2, revision: 0, feedback: {}, skins: [
  definition(SkinId.FREEFORM, 'Freeform', {}), definition(SkinId.FLAT, 'Flat', FLAT),
  definition(SkinId.CLASSIC, 'Classic', CLASSIC),
] });
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a skin record.');
  return value as Record<string, unknown>;
};
const revision = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid skin revision.');
  return value as number;
};
const nameOf = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 48)
    throw new Error('A skin name needs 1–48 characters.');
  return value.trim();
};
const idOf = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(value)) throw new Error('Invalid skin identity.');
  return value;
};
function optionOf(catalog: readonly SkinCatalogGroup[], group: unknown, option: unknown) {
  const found = catalog.find(item => item.id === group)?.options.find(item => item.id === option);
  if (!found) throw new Error('Unknown element choice.');
  return found;
}
const feedbackText = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > ELEMENT_FEEDBACK_LIMIT)
    throw new Error(`Feedback must be text of at most ${ELEMENT_FEEDBACK_LIMIT} characters.`);
  return value.trim();
};
function feedbackOf(value: unknown, catalog: readonly SkinCatalogGroup[]): ElementFeedback {
  if (value === undefined) return {};
  const result: ElementFeedback = {};
  for (const [group, options] of Object.entries(object(value))) {
    if (!catalog.some(item => item.id === group)) throw new Error('Unknown feedback group.');
    result[group] = {};
    for (const [option, text] of Object.entries(object(options))) {
      optionOf(catalog, group, option);
      result[group][option] = feedbackText(text);
    }
  }
  return result;
}
function candidatesOf(value: unknown, catalog: readonly SkinCatalogGroup[]) {
  const candidates = object(value);
  for (const [group, forms] of Object.entries(candidates)) {
    if (!catalog.some(item => item.id === group) || !Array.isArray(forms)) throw new Error('Invalid element group.');
    forms.forEach(form => optionOf(catalog, group, form));
    if (new Set(forms).size !== forms.length) throw new Error('Duplicate element choice.');
  }
  return candidates as Record<string, string[]>;
}
export function parseComponentSkin(value: unknown, catalog: readonly SkinCatalogGroup[]): ComponentSkin {
  const data = object(value), candidates = candidatesOf(data.candidates, catalog), active = object(data.active);
  for (const [group, form] of Object.entries(active)) {
    if (optionOf(catalog, group, form).assignable === false)
      throw new Error('A data example cannot change a skin.');
    if (!candidates[group]?.includes(form as string)) throw new Error('The active form must be an assigned candidate.');
  }
  return { id: idOf(data.id), name: nameOf(data.name), candidates, active: active as Record<string, string> };
}
/** Reads the old shortlist without writing it. Ambiguous old candidates do not acquire an invented winner. */
export function parseSkinAssignments(value: unknown, catalog: readonly SkinCatalogGroup[]): SkinAssignments {
  const data = object(value), currentRevision = revision(data.revision);
  if (data.version === 1) {
    const migrated = emptySkinAssignments(), candidates = candidatesOf(data.selections, catalog);
    const active = Object.fromEntries(Object.entries(candidates).filter(([group, forms]) =>
      forms.length === 1 && optionOf(catalog, group, forms[0]).assignable !== false)
      .map(([group, forms]) => [group, forms[0]]));
    migrated.revision = currentRevision;
    migrated.skins[0] = { ...migrated.skins[0], candidates, active };
    return migrated;
  }
  if (data.version !== 2 || !Array.isArray(data.skins)) throw new Error('Unsupported skin assignments.');
  const skins = data.skins.map(skin => parseComponentSkin(skin, catalog));
  if (!skins.some(skin => skin.id === SkinId.FREEFORM)) throw new Error('Freeform choices are missing.');
  if (new Set(skins.map(skin => skin.id)).size !== skins.length ||
    new Set(skins.map(skin => skin.name.toLocaleLowerCase())).size !== skins.length) throw new Error('Duplicate skin.');
  return { version: 2, revision: currentRevision, skins, feedback: feedbackOf(data.feedback, catalog) };
}
export function parseSkinChange(value: unknown, catalog: readonly SkinCatalogGroup[]): SkinChange {
  const data = object(value), currentRevision = revision(data.revision);
  const keys = data.action === 'feedback' ? ['revision', 'action', 'group', 'option', 'text']
    : data.action === 'create' ? ['revision', 'action', 'name', 'source']
    : ['revision', 'action', 'skin', 'group', 'option', ...(data.action === 'assign' ? ['selected'] : [])];
  if (Object.keys(data).some(key => !keys.includes(key))) throw new Error('Unknown skin change.');
  if (data.action === 'feedback') {
    optionOf(catalog, data.group, data.option);
    return {action: 'feedback', revision: currentRevision, group: data.group as string,
      option: data.option as string, text: feedbackText(data.text)};
  }
  if (data.action === 'create') return { action: 'create', revision: currentRevision,
    name: nameOf(data.name), source: idOf(data.source) };
  if (data.action !== 'assign' && data.action !== 'activate') throw new Error('Unknown skin action.');
  if (optionOf(catalog, data.group, data.option).assignable === false)
    throw new Error('This example describes data, not a component form.');
  const choice = { revision: currentRevision, skin: idOf(data.skin),
    group: data.group as string, option: data.option as string };
  if (data.action === 'activate') return { ...choice, action: 'activate' };
  if (typeof data.selected !== 'boolean') throw new Error('Selected must be a boolean.');
  return { ...choice, action: 'assign', selected: data.selected };
}
/** Only presentation assignments change here. No source value, evaluation, or palette is written. */
export function assignSkinChoice(current: SkinAssignments, change: SkinChange, newId?: string): SkinAssignments {
  if (change.revision !== current.revision)
    throw new Error('The skins changed in another tab. Reload before choosing.');
  const next = structuredClone(current);
  if (change.action === 'feedback') {
    const text = feedbackText(change.text);
    const notes = next.feedback[change.group] ?? {};
    if (text) notes[change.option] = text;
    else delete notes[change.option];
    if (Object.keys(notes).length) next.feedback[change.group] = notes;
    else delete next.feedback[change.group];
  } else if (change.action === 'create') {
    if (next.skins.some(skin => skin.name.toLocaleLowerCase() === change.name.toLocaleLowerCase()))
      throw new Error('A skin already has that name.');
    const source = next.skins.find(skin => skin.id === change.source);
    if (!source) throw new Error('The source skin is missing.');
    next.skins.push({ ...structuredClone(source), id: idOf(newId), name: change.name });
  } else {
    const skin = next.skins.find(item => item.id === change.skin);
    if (!skin) throw new Error('The selected skin is missing.');
    const candidates = new Set(skin.candidates[change.group] ?? []);
    if (change.action === 'activate') {
      if (!candidates.has(change.option)) throw new Error('Assign this form before using it.');
      skin.active[change.group] = change.option;
    } else if (change.selected) {
      candidates.add(change.option); skin.active[change.group] = change.option;
    } else {
      candidates.delete(change.option);
      if (skin.active[change.group] === change.option) delete skin.active[change.group];
    }
    if (candidates.size) skin.candidates[change.group] = [...candidates];
    else delete skin.candidates[change.group];
  }
  return { ...next, revision: current.revision + 1 };
}
