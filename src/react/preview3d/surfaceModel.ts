import {isRecord} from '../../valueChecks.ts';
import {modelEntries, modelFlag, modelName, modelNumber, modelNumbers, modelOneOf,
  modelRecord, modelShape, modelStates} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_FILE_SURFACE, MODEL_SURFACE_PARAMETER, MODEL_VECTOR_SIZE, type ModelSurfaceKind}
  from './surfaceKindModel.ts';
import {MODEL_SURFACE_TEXTURE_REFUSAL, modelSurfaceTexture, type ModelSurfaceFile, type ModelSurfaceTexture}
  from './surfaceTextureModel.ts';
export {isModelImageSource, MODEL_IMAGE_SOURCES, MODEL_TEXTURE_CONSTANT, MODEL_TEXTURE_FORMATS, MODEL_TEXTURE_WRAP,
  modelSurfaceTexture} from './surfaceTextureModel.ts';
export type {ModelSurfaceFile, ModelSurfaceTexture, ModelTextureSampling} from './surfaceTextureModel.ts';

// What draws a model's renderers. An actor states where its surfaces come from, one of two whole forms: the file's own
// materials throughout, or a named set of the description's, whose keys are the file's renderers, every one exactly
// once. A set's entry is the file's own material for that renderer (the reserved kind `file`), or a record: a supplied
// kind and a value for each of its parameters. Sets, their entries and a record's values are keyed by the data's own
// names, so a lookup by such a name asks whether the record states it (recordModel.ts `modelStates`).
export const MODEL_ACTOR_SURFACES = Object.freeze({file: 'file', set: 'set'} as const);
export type ModelActorSurfaces = {readonly from: typeof MODEL_ACTOR_SURFACES.file}
  | {readonly from: typeof MODEL_ACTOR_SURFACES.set; readonly set: string};
const ACTOR_SURFACES = Object.freeze({[MODEL_ACTOR_SURFACES.file]: ['from'],
  [MODEL_ACTOR_SURFACES.set]: ['from', 'set']});
export type ModelSurfaceValue = {readonly color: readonly [number, number, number, number]}
  | {readonly vector: readonly number[]} | {readonly float: number} | {readonly keyword: boolean}
  | {readonly texture: ModelSurfaceTexture};
export interface ModelSurfaceRecord {
  readonly kind: string;
  readonly values: Readonly<Record<string, ModelSurfaceValue>>;
}
export const MODEL_FILE_ENTRY = Object.freeze({kind: MODEL_FILE_SURFACE});
export type ModelSurfaceEntry = ModelSurfaceRecord | typeof MODEL_FILE_ENTRY;
/** A set: each renderer of a file, by its id, and what draws it. */
export type ModelSurfaceSet = Readonly<Record<string, ModelSurfaceEntry>>;
const RENDERER_ID = /^gltf-node:(0|[1-9]\d*)\/primitive:(0|[1-9]\d*)$/;
/** A renderer's one address, as the engine, the model files and the hosts agree: a glTF node's primitive. */
export const modelRendererId = (node: number, primitive: number) => `gltf-node:${node}/primitive:${primitive}`;
const FORMS = Object.values(MODEL_SURFACE_PARAMETER);
export const MODEL_SURFACE_REFUSAL = Object.freeze({
  ...MODEL_SURFACE_TEXTURE_REFUSAL,
  renderer: (where: string, id: string) => `${where}: ${id} is not a renderer id, gltf-node:<n>/primitive:<m>.`,
  unknownSet: (where: string, set: string, sets: readonly string[]) =>
    `${where} names surface set ${set}; the description's sets are ${sets.join(', ') || 'none'}.`,
  kind: (where: string, kind: string, kinds: readonly string[]) =>
    `${where} names kind ${kind}; the stage was given ${kinds.join(', ') || 'no kinds'}.`,
  form: (where: string, expected: string, stated: string) => `${where} is a ${expected}; it states a ${stated}.`,
  size: (where: string, size: number) => `${where} is a vector of ${size}.`,
  sizes: (where: string) => `${where} is a vector of ${Object.values(MODEL_VECTOR_SIZE).join(', ')} finite numbers.`,
  negative: (where: string) => `${where} has a channel below 0.`,
  range: (where: string) => `${where} is not HDR: each channel is from 0 to 1.`,
  inert: (where: string, value: number) => `${where} is drawn only at ${value}.`,
  reach: (where: string) => `${where} is how far the kind moves a vertex, in metres: 0 or more.`,
});
const refusal = MODEL_SURFACE_REFUSAL;

/** A value's form, checked without its kind: exactly one of the forms, its content whole and finite. */
export function modelSurfaceValue(entry: unknown, where: string): ModelSurfaceValue {
  const {name, content} = modelOneOf(entry, FORMS, where), at = `${where}.${name}`;
  if (name === MODEL_SURFACE_PARAMETER.color) {
    const [r, g, b, a] = modelNumbers(content, 4, at);
    if (r < 0 || g < 0 || b < 0 || a < 0) throw new ModelStageRefusal(refusal.negative(at));
    return Object.freeze({color: Object.freeze([r, g, b, a] as const)});
  }
  if (name === MODEL_SURFACE_PARAMETER.vector) {
    const sizes: readonly number[] = Object.values(MODEL_VECTOR_SIZE);
    if (!Array.isArray(content) || !sizes.includes(content.length)) throw new ModelStageRefusal(refusal.sizes(at));
    return Object.freeze({vector: Object.freeze(modelNumbers(content, content.length, at))});
  }
  if (name === MODEL_SURFACE_PARAMETER.float) {
    return Object.freeze({float: modelNumber(content, at, -Infinity, Infinity)});
  }
  if (name === MODEL_SURFACE_PARAMETER.keyword) return Object.freeze({keyword: modelFlag(content, at)});
  return Object.freeze({texture: modelSurfaceTexture(content, at)});
}
function entry(input: unknown, where: string): ModelSurfaceEntry {
  if (isRecord(input) && modelStates(input, 'kind') && input.kind === MODEL_FILE_SURFACE) {
    modelRecord(input, ['kind'], where);
    return MODEL_FILE_ENTRY;
  }
  return modelSurfaceRecord(input, where);
}
/** A record: a supplied kind and a value for each of its parameters, each value's form checked. */
export function modelSurfaceRecord(input: unknown, where: string): ModelSurfaceRecord {
  const record = modelRecord(input, ['kind', 'values'], where);
  return Object.freeze({kind: modelName(record.kind, `${where}.kind`), values: Object.freeze(Object.fromEntries(
    modelEntries(record.values, `${where}.values`, 'values by parameter name').map(([name, item]) =>
      [name, modelSurfaceValue(item, `${where}.${name}`)])))});
}

/** The description's surface sets, every form checked; whether a record fits its kind is `modelSurfaceRecordsFit`'s. */
export function modelSurfaceSets(input: unknown): Readonly<Record<string, ModelSurfaceSet>> {
  return Object.freeze(Object.fromEntries(modelEntries(input, 'The surfaceSets', 'surface sets by name')
    .map(([name, set]) => {
      const where = `Surface set ${name}`;
      return [name, Object.freeze(Object.fromEntries(modelEntries(set, where, 'entries by renderer id')
        .map(([id, item]) => {
          if (!RENDERER_ID.test(id)) throw new ModelStageRefusal(refusal.renderer(where, id));
          return [id, entry(item, `${where}, renderer ${id}`)];
        })))];
    })));
}

/** An actor's surfaces: the file's own materials throughout, or a named set. */
export function modelActorSurfaces(input: unknown, where: string): ModelActorSurfaces {
  const {shape: from, record} = modelShape(input, 'from', ACTOR_SURFACES, where);
  return from === MODEL_ACTOR_SURFACES.file ? Object.freeze({from}) :
    Object.freeze({from, set: modelName(record.set, `${where}.set`)});
}

/** Where a set's record stands, in the terms its author wrote it in, for a refusal. */
export type ModelSurfaceWhere = (set: string, renderer: string) => string;
/** A record of the description's own sets: its set and renderer. */
export const modelSurfaceSetWhere: ModelSurfaceWhere = (set, renderer) => `Surface set ${set}, renderer ${renderer}`;
/** What draws one actor's renderers: where its surfaces come from, the sets they may name, and where a record of
 * those sets stands. */
export interface ModelSurfaceSource {
  readonly surfaces: ModelActorSurfaces;
  readonly sets: Readonly<Record<string, ModelSurfaceSet>>;
  readonly where: ModelSurfaceWhere;
}
/** The records of the sets these sources are drawn from, each set once. */
export function modelSurfaceRecords(sources: readonly ModelSurfaceSource[]): readonly ModelSurfaceRecord[] {
  const used = new Set(sources.flatMap(({surfaces, sets}) =>
    surfaces.from === MODEL_ACTOR_SURFACES.set ? [sets[surfaces.set]] : []));
  return [...used].flatMap(set => Object.values(set).flatMap(entry => 'values' in entry ? [entry] : []));
}
/** The texture files named by the sets these sources are drawn from, each file once. */
export function modelSurfaceFiles(sources: readonly ModelSurfaceSource[]): readonly ModelSurfaceFile[] {
  const files = new Map<string, ModelSurfaceFile>();
  for (const entry of modelSurfaceRecords(sources)) for (const item of Object.values(entry.values)) {
    if ('texture' in item && 'sha256' in item.texture) {
      files.set(item.texture.sha256, Object.freeze({path: item.texture.path, sha256: item.texture.sha256}));
    }
  }
  return Object.freeze([...files.values()]);
}

/**
 * A value against its kind's parameter, the one rule for a record's value and an engine's: of the parameter's type and
 * size, a colour that is not HDR within [0, 1], an inert parameter at its one value, and a reach not below 0.
 */
export function modelSurfaceValueFits(item: ModelSurfaceValue, kind: ModelSurfaceKind, name: string, at: string) {
  const parameter = kind.parameters[name], [stated] = Object.keys(item);
  if (!(parameter.type in item)) throw new ModelStageRefusal(refusal.form(at, parameter.type, stated));
  if ('vector' in item && parameter.type === MODEL_SURFACE_PARAMETER.vector && item.vector.length !== parameter.size) {
    throw new ModelStageRefusal(refusal.size(at, parameter.size));
  }
  if ('color' in item && parameter.type === MODEL_SURFACE_PARAMETER.color && !parameter.hdr &&
    item.color.some(channel => channel > 1)) throw new ModelStageRefusal(refusal.range(at));
  const inert = kind.inert[name];
  if (modelStates(kind.inert, name) && 'float' in item && item.float !== inert) {
    throw new ModelStageRefusal(refusal.inert(at, inert));
  }
  if (kind.displacement !== null && kind.displacement.reach === name && 'float' in item && !(item.float >= 0)) {
    throw new ModelStageRefusal(refusal.reach(at));
  }
}
/** Every record against its kind: the kind was given, its parameters are exactly the record's, each value fits. */
export function modelSurfaceRecordsFit(sets: Readonly<Record<string, ModelSurfaceSet>>,
  kinds: ReadonlyMap<string, ModelSurfaceKind>, at: ModelSurfaceWhere) {
  for (const [name, set] of Object.entries(sets)) for (const [id, entry] of Object.entries(set)) {
    if (!('values' in entry)) continue;
    const where = at(name, id), kind = kinds.get(entry.kind);
    if (!kind) throw new ModelStageRefusal(refusal.kind(where, entry.kind, [...kinds.keys()]));
    modelRecord(entry.values, Object.keys(kind.parameters), `${where}, kind ${kind.id}: values`);
    for (const parameter of Object.keys(kind.parameters)) {
      modelSurfaceValueFits(entry.values[parameter], kind, parameter, `${where}, kind ${kind.id}: ${parameter}`);
    }
  }
}
