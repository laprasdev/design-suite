import {isRecord} from '../../valueChecks.ts';
import {modelDigest, modelName, modelNumbers, modelOption, modelRecord, modelStates} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';

// A surface record's texture value: a file by path and SHA-256 with its sampling, a host-supplied browser image with
// its sampling, or a 1x1 constant for an empty slot. Orientation is glTF's (`flipY` false) across file and image alike.
export const MODEL_TEXTURE_WRAP = Object.freeze({repeat: 'repeat', clamp: 'clamp', mirror: 'mirror'} as const);
export const MODEL_TEXTURE_CONSTANT = Object.freeze({white: 'white', black: 'black'} as const);
/** The image formats the stage decodes (the browser's own decoder, as three's glTF loader uses it), by a path's end. */
export const MODEL_TEXTURE_FORMATS = Object.freeze(['png', 'jpg', 'jpeg', 'webp'] as const);
/** The browser image constructors three uploads as a `TexImageSource`. */
export const MODEL_IMAGE_SOURCES = Object.freeze(['ImageBitmap', 'HTMLImageElement', 'HTMLCanvasElement',
  'OffscreenCanvas', 'ImageData', 'VideoFrame', 'HTMLVideoElement'] as const);

type Wrap = typeof MODEL_TEXTURE_WRAP[keyof typeof MODEL_TEXTURE_WRAP];
type Pair = readonly [number, number];
export interface ModelTextureSampling {
  readonly wrap: readonly [Wrap, Wrap];
  readonly scale: Pair;
  readonly offset: Pair;
}
/** A file a record names, by path and SHA-256. */
export type ModelSurfaceFile = {readonly path: string; readonly sha256: string};
/** A texture a record names: a verified file or an in-memory image with its sampling, or a constant texel. */
export type ModelSurfaceTexture =
  | (ModelSurfaceFile & ModelTextureSampling)
  | ({readonly image: TexImageSource} & ModelTextureSampling)
  | {readonly constant: typeof MODEL_TEXTURE_CONSTANT[keyof typeof MODEL_TEXTURE_CONSTANT]};

const FILE_TEXTURE_FIELDS = Object.freeze(['path', 'sha256', 'wrap', 'scale', 'offset']);
const IMAGE_TEXTURE_FIELDS = Object.freeze(['image', 'wrap', 'scale', 'offset']);
const FORMAT = new RegExp(`\\.(${MODEL_TEXTURE_FORMATS.join('|')})(?:[?#].*)?$`, 'i');

export const MODEL_SURFACE_TEXTURE_REFUSAL = Object.freeze({
  format: (where: string, path: string) =>
    `${where} ${path} is not a format the stage decodes: ${MODEL_TEXTURE_FORMATS.join(', ')}.`,
  wrap: (where: string) => `${where} is a pair, [u, v], each one of ${Object.values(MODEL_TEXTURE_WRAP).join(', ')}.`,
  image: (where: string) => `${where} must be an image source: ${MODEL_IMAGE_SOURCES.join(', ')}.`,
});

/** Whether a value is an instance of one of the browser's `TexImageSource` types. */
export function isModelImageSource(value: unknown): value is TexImageSource {
  if (typeof value !== 'object' || value === null) return false;
  return MODEL_IMAGE_SOURCES.some(name => {
    const kind = Reflect.get(globalThis, name);
    return typeof kind === 'function' && value instanceof kind;
  });
}

function sampling(record: Record<string, unknown>, where: string): ModelTextureSampling {
  if (!Array.isArray(record.wrap) || record.wrap.length !== 2) {
    throw new ModelStageRefusal(MODEL_SURFACE_TEXTURE_REFUSAL.wrap(`${where}.wrap`));
  }
  const [u, v] = record.wrap;
  const pair = (name: string): Pair => {
    const [x, y] = modelNumbers(record[name], 2, `${where}.${name}`);
    return Object.freeze([x, y]);
  };
  const wrap: readonly [Wrap, Wrap] = Object.freeze([
    modelOption(u, MODEL_TEXTURE_WRAP, `${where}.wrap[0]`),
    modelOption(v, MODEL_TEXTURE_WRAP, `${where}.wrap[1]`),
  ]);
  return {wrap, scale: pair('scale'), offset: pair('offset')};
}

export function modelSurfaceTexture(value: unknown, where: string): ModelSurfaceTexture {
  if (isRecord(value) && modelStates(value, 'constant')) {
    return Object.freeze({constant: modelOption(modelRecord(value, ['constant'], where).constant,
      MODEL_TEXTURE_CONSTANT, `${where}.constant`)});
  }
  if (isRecord(value) && modelStates(value, 'image')) {
    const record = modelRecord(value, IMAGE_TEXTURE_FIELDS, where);
    if (!isModelImageSource(record.image)) {
      throw new ModelStageRefusal(MODEL_SURFACE_TEXTURE_REFUSAL.image(`${where}.image`));
    }
    return Object.freeze({image: record.image, ...sampling(record, where)});
  }
  const record = modelRecord(value, FILE_TEXTURE_FIELDS, where);
  const path = modelName(record.path, `${where}.path`);
  if (!FORMAT.test(path)) throw new ModelStageRefusal(MODEL_SURFACE_TEXTURE_REFUSAL.format(`${where}.path`, path));
  return Object.freeze({path, sha256: modelDigest(record.sha256, `${where}.sha256`), ...sampling(record, where)});
}
