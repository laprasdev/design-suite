import {modelDigest, modelEntries, modelFlag, modelIsNamed, modelIsRecord, modelName, modelNumber, modelOption,
  modelRecord, modelRecordStating, modelShape, modelStates} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';

// A surface kind's declaration: what any host needs to know to check a record against the kind, with no renderer. It
// is an exported constant of the kind's own repository. Only `webProgram` is one host's: the web stage's GLSL for this
// kind, named by path and SHA-256; another host brings its own program for the same kind id.
export const MODEL_SURFACE_PARAMETER = Object.freeze(
  {color: 'color', vector: 'vector', float: 'float', keyword: 'keyword', texture: 'texture'} as const);
export const MODEL_COLOR_SPACE = Object.freeze({srgb: 'srgb', linear: 'linear'} as const);
export const MODEL_SURFACE_LIGHT = Object.freeze({standard: 'standard', unlit: 'unlit'} as const);
export const MODEL_SURFACE_COVERAGE = Object.freeze({opaque: 'opaque', cutout: 'cutout', blended: 'blended'} as const);
export const MODEL_SURFACE_SIDE = Object.freeze({front: 'front', back: 'back', double: 'double'} as const);
export const MODEL_VECTOR_SIZE = Object.freeze({two: 2, three: 3, four: 4} as const);
/** How many numbers a vertex attribute of the file's own holds per vertex. */
export const MODEL_ATTRIBUTE_SIZE = Object.freeze({one: 1, two: 2, three: 3, four: 4} as const);
/** The reserved kind id of a file's own material, which the stage draws as the file states it. */
export const MODEL_FILE_SURFACE = 'file';
type Of<T> = T[keyof T];
export type ModelColorSpace = Of<typeof MODEL_COLOR_SPACE>;
/**
 * A vertex attribute a kind reads: one of three's own by its name ('uv', 'color'), or one of the file's own (a glTF
 * custom attribute, `_DEPTH`, which three names `_depth`) by its name and the numbers it holds per vertex.
 */
export type ModelSurfaceAttribute = string | {readonly name: string; readonly size: Of<typeof MODEL_ATTRIBUTE_SIZE>};
/** A cut-out at a threshold: a declared float's name, or a number from 0 to 1. Below it the surface is cut away; the
 * stage sharpens the kind's alpha across it, once, for alpha to coverage (surfaceProgram.ts). */
export interface ModelSurfaceCutout {readonly cutout: string | number}
/** A file a web program is made of, by path and SHA-256. */
export interface ModelSurfaceProgramFile {readonly path: string; readonly sha256: string}
export type ModelSurfaceParameter =
  | {readonly type: typeof MODEL_SURFACE_PARAMETER.color; readonly space: ModelColorSpace; readonly hdr: boolean}
  | {readonly type: typeof MODEL_SURFACE_PARAMETER.vector; readonly size: Of<typeof MODEL_VECTOR_SIZE>}
  | {readonly type: typeof MODEL_SURFACE_PARAMETER.float}
  | {readonly type: typeof MODEL_SURFACE_PARAMETER.keyword}
  | {readonly type: typeof MODEL_SURFACE_PARAMETER.texture; readonly space: ModelColorSpace};
export interface ModelSurfaceKind {
  readonly id: string;
  /** Keyed by the source shader's reference names: the one vocabulary for records and for engine values. */
  readonly parameters: Readonly<Record<string, ModelSurfaceParameter>>;
  /** Float parameters the port draws only at this value: a record stating another is refused by name. */
  readonly inert: Readonly<Record<string, number>>;
  /** The vertex attributes the kind reads, as three names a glTF's: three's own by name, the file's own with a size. */
  readonly attributes: readonly ModelSurfaceAttribute[];
  readonly light: Of<typeof MODEL_SURFACE_LIGHT>;
  /** Opaque, blended, or cut out: `cutout` writes the kind's alpha as coverage as it is; a threshold sharpens it. */
  readonly coverage: Of<typeof MODEL_SURFACE_COVERAGE> | ModelSurfaceCutout;
  readonly side: Of<typeof MODEL_SURFACE_SIDE>;
  /** Whether the stage's fog reaches the kind. */
  readonly fog: boolean;
  /** The kind moves vertices, at most `reach` metres (a declared float); or null, it moves none. */
  readonly displacement: {readonly reach: string} | null;
  /** The web host's program for this kind: its GLSL file, by path and SHA-256, and the shared GLSL files its
   * repository owns that it includes, each by path and SHA-256, placed ahead of it in order (stated or left out in a
   * declaration: left out, it includes none, [] here). */
  readonly webProgram: ModelSurfaceProgramFile & {readonly includes: readonly ModelSurfaceProgramFile[]};
}
export const MODEL_SURFACE_KIND_FIELDS = Object.freeze({kind: ['id', 'parameters', 'inert', 'attributes', 'light',
  'coverage', 'side', 'fog', 'displacement', 'webProgram'], webProgram: ['path', 'sha256'], include: ['path', 'sha256'],
displacement: ['reach'], cutout: ['cutout'],
attribute: ['name', 'size'],
parameter: Object.freeze({color: ['type', 'space', 'hdr'], vector: ['type', 'size'], float: ['type'],
  keyword: ['type'], texture: ['type', 'space']})});
const fields = MODEL_SURFACE_KIND_FIELDS;
export const MODEL_SURFACE_KIND_REFUSAL = Object.freeze({
  reserved: (where: string) => `${where} ${MODEL_FILE_SURFACE} is the file's own material's; a kind has its own id.`,
  repeated: (where: string, id: string, earlier: string) => `${where} ${id} is already ${earlier}'s.`,
  float: (where: string, name: string) => `${where} names ${name}, which is not a declared float parameter.`,
  twice: (where: string, name: string) => `${where} lists ${name} twice.`,
  list: (where: string) => `${where} is a list.`,
  kinds: 'The stage\'s surface kinds is a list of kinds; state [] for none.',
  coverage: (where: string) => `${where} is one of ${Object.values(MODEL_SURFACE_COVERAGE).join(', ')}, or ` +
    '{cutout: a declared float or a number from 0 to 1}.',
  glsl: (where: string, name: string) => `${where} names ${name}, which is not a GLSL name: a letter or underscore, ` +
    'then letters, digits and underscores, never two underscores in a row.',
});
// A parameter's name becomes part of the names a kind's program reads it by (`surfaceParameter` and the name, for one
// web host), so it must be a GLSL identifier, and GLSL reserves any name with two underscores in a row (measured:
// three r180 in Chromium refuses a program declaring `surfaceParameter__Color`).
const GLSL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const glslName = (name: string) => GLSL_NAME.test(name) && !name.includes('__');
const refusal = MODEL_SURFACE_KIND_REFUSAL;

function parameter(value: unknown, where: string): ModelSurfaceParameter {
  const {shape: type, record} = modelShape(value, 'type', fields.parameter, where);
  if (type === MODEL_SURFACE_PARAMETER.vector) {
    return Object.freeze({type, size: modelOption(record.size, MODEL_VECTOR_SIZE, `${where}.size`)});
  }
  if (type === MODEL_SURFACE_PARAMETER.color) {
    return Object.freeze({type, space: modelOption(record.space, MODEL_COLOR_SPACE, `${where}.space`),
      hdr: modelFlag(record.hdr, `${where}.hdr`)});
  }
  if (type === MODEL_SURFACE_PARAMETER.texture) {
    return Object.freeze({type, space: modelOption(record.space, MODEL_COLOR_SPACE, `${where}.space`)});
  }
  return Object.freeze({type});
}
/** An attribute's name, whichever form it is stated in. */
export const modelAttributeName = (attribute: ModelSurfaceAttribute) =>
  typeof attribute === 'string' ? attribute : attribute.name;
function attribute(value: unknown, where: string): ModelSurfaceAttribute {
  if (typeof value === 'string') return modelName(value, where);
  const record = modelRecord(value, fields.attribute, where), name = modelName(record.name, `${where}.name`);
  if (!glslName(name)) throw new ModelStageRefusal(refusal.glsl(where, name));
  return Object.freeze({name, size: modelOption(record.size, MODEL_ATTRIBUTE_SIZE, `${where}.size`)});
}
function attributes(value: unknown, where: string): readonly ModelSurfaceAttribute[] {
  if (!Array.isArray(value)) throw new ModelStageRefusal(refusal.list(where));
  const listed = new Set<string>();
  return Object.freeze(Array.from(value, (entry: unknown, index) => {
    const read = attribute(entry, `${where}[${index}]`), name = modelAttributeName(read);
    if (listed.has(name)) throw new ModelStageRefusal(refusal.twice(where, name));
    listed.add(name);
    return read;
  }));
}

const programFile = (record: Record<string, unknown>, where: string): ModelSurfaceProgramFile => Object.freeze({
  path: modelName(record.path, `${where}.path`), sha256: modelDigest(record.sha256, `${where}.sha256`)});
const NO_INCLUDES: readonly ModelSurfaceProgramFile[] = Object.freeze([]);
function includes(value: unknown, where: string): readonly ModelSurfaceProgramFile[] {
  if (!Array.isArray(value)) throw new ModelStageRefusal(refusal.list(where));
  const listed = new Set<string>();
  return Object.freeze(Array.from(value, (entry: unknown, index) => {
    const file = programFile(modelRecord(entry, fields.include, `${where}[${index}]`), `${where}[${index}]`);
    if (listed.has(file.path)) throw new ModelStageRefusal(refusal.twice(where, file.path));
    listed.add(file.path);
    return file;
  }));
}

/** The coverage a kind's render state is drawn with: a cut-out at a threshold is a cut-out. */
export const modelSurfaceCoverage = (kind: Pick<ModelSurfaceKind, 'coverage'>) =>
  typeof kind.coverage === 'string' ? kind.coverage : MODEL_SURFACE_COVERAGE.cutout;

/** One kind's declaration, checked whole; `where` names it in every refusal. */
export function modelSurfaceKind(value: unknown, where: string): ModelSurfaceKind {
  const kind = modelRecord(value, fields.kind, where);
  const id = modelName(kind.id, `${where}.id`);
  if (id === MODEL_FILE_SURFACE) throw new ModelStageRefusal(refusal.reserved(`${where}.id`));
  const parameters = Object.freeze(Object.fromEntries(modelEntries(kind.parameters, `${where}.parameters`,
    'parameters by name').map(([name, entry]) => {
    if (!glslName(name)) throw new ModelStageRefusal(refusal.glsl(`${where}.parameters`, name));
    return [name, parameter(entry, `${where}.parameters.${name}`)];
  })));
  const float = (name: unknown, at: string) => {
    if (!modelIsNamed(name) || !modelStates(parameters, name) ||
      parameters[name].type !== MODEL_SURFACE_PARAMETER.float) {
      throw new ModelStageRefusal(refusal.float(at, String(name)));
    }
    return name;
  };
  const inert = Object.freeze(Object.fromEntries(modelEntries(kind.inert, `${where}.inert`,
    'inert values by float parameter name').map(([name, number]) =>
    [float(name, `${where}.inert`), modelNumber(number, `${where}.inert.${name}`, -Infinity, Infinity)])));
  const displacement = kind.displacement === null ? null : Object.freeze({reach: float(modelRecord(kind.displacement,
    fields.displacement, `${where}.displacement`).reach, `${where}.displacement.reach`)});
  const coverage = (value: unknown, at: string): ModelSurfaceKind['coverage'] => {
    if (!modelIsRecord(value)) {
      if (Object.values<unknown>(MODEL_SURFACE_COVERAGE).includes(value)) {
        return modelOption(value, MODEL_SURFACE_COVERAGE, at);
      }
      throw new ModelStageRefusal(refusal.coverage(at));
    }
    const {cutout} = modelRecord(value, fields.cutout, at);
    return Object.freeze({cutout: typeof cutout === 'number' ? modelNumber(cutout, `${at}.cutout`, 0, 1) :
      float(cutout, `${at}.cutout`)});
  };
  const program = modelRecordStating(kind.webProgram, {stated: fields.webProgram, whenStated: ['includes']},
    `${where}.webProgram`);
  return Object.freeze({id, parameters, inert, attributes: attributes(kind.attributes, `${where}.attributes`),
    light: modelOption(kind.light, MODEL_SURFACE_LIGHT, `${where}.light`),
    coverage: coverage(kind.coverage, `${where}.coverage`),
    side: modelOption(kind.side, MODEL_SURFACE_SIDE, `${where}.side`), fog: modelFlag(kind.fog, `${where}.fog`),
    displacement, webProgram: Object.freeze({...programFile(program, `${where}.webProgram`), includes:
      modelStates(program, 'includes') ? includes(program.includes, `${where}.webProgram.includes`) : NO_INCLUDES})});
}

/** The kinds a stage is given, by id: each checked whole, ids distinct, none the file's. */
export function modelSurfaceKinds(values: unknown): ReadonlyMap<string, ModelSurfaceKind> {
  if (!Array.isArray(values)) throw new ModelStageRefusal(refusal.kinds);
  const kinds = new Map<string, ModelSurfaceKind>(), at = new Map<string, number>();
  values.forEach((value: unknown, index) => {
    const kind = modelSurfaceKind(value, `Surface kind ${index}`), earlier = at.get(kind.id);
    if (earlier !== undefined) {
      throw new ModelStageRefusal(refusal.repeated(`Surface kind ${index}.id`, kind.id, `surface kind ${earlier}`));
    }
    kinds.set(kind.id, kind);
    at.set(kind.id, index);
  });
  return kinds;
}
