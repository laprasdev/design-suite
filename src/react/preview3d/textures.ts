import * as THREE from 'three';
import type {ModelFileReader} from './files.ts';
import {createModelFileCache} from './fileCache.ts';
import {MODEL_TEXTURE_CONSTANT, MODEL_TEXTURE_WRAP, type ModelSurfaceTexture}
  from './surfaceModel.ts';
import {MODEL_COLOR_SPACE, type ModelColorSpace} from './surfaceKindModel.ts';
import {modelRecordIdentity} from './recordModel.ts';

// The stage's textures for surface records. A file is read once by its SHA-256 and decoded once (fileCache.ts),
// as three's glTF loader decodes a file's own images: no premultiplied alpha, no colour-space conversion, glTF's
// orientation (flipY false). A texture is one file under one sampling (space, wrap, scale, offset), counted by its
// users and freed with the last. Files load inside the stage's staged load, so readiness covers them; the files the
// description in force names are kept, every other is dropped once nothing uses it.
/** An image three can upload, and how to free it once the stage drops it. */
export interface ModelDecodedImage {readonly image: TexImageSource; close(): void}
/** Turns a file's verified bytes into an image three can upload. */
export type ModelImageDecoder = (bytes: ArrayBuffer) => Promise<ModelDecodedImage>;
/** The browser's decoder, as three's GLTFLoader uses it (ImageBitmapLoader's options, r180). */
export const decodeModelImage: ModelImageDecoder = async bytes => {
  const image = await createImageBitmap(new Blob([bytes]), {premultiplyAlpha: 'none', colorSpaceConversion: 'none'});
  return {image, close: () => image.close()};
};
const WRAPS: Readonly<Record<string, THREE.Wrapping>> = Object.freeze({
  [MODEL_TEXTURE_WRAP.repeat]: THREE.RepeatWrapping,
  [MODEL_TEXTURE_WRAP.clamp]: THREE.ClampToEdgeWrapping, [MODEL_TEXTURE_WRAP.mirror]: THREE.MirroredRepeatWrapping});
// A texture's space is how three reads its texels: sRGB colour is decoded, linear data is read as stored.
const SPACES: Readonly<Record<ModelColorSpace, string>> = Object.freeze({[MODEL_COLOR_SPACE.srgb]: THREE.SRGBColorSpace,
  [MODEL_COLOR_SPACE.linear]: THREE.NoColorSpace});
const TEXELS = Object.freeze({[MODEL_TEXTURE_CONSTANT.white]: [255, 255, 255, 255],
  [MODEL_TEXTURE_CONSTANT.black]: [0, 0, 0, 255]});

export const MODEL_TEXTURE_TEXT = Object.freeze({
  unheld: (name: string) => `The texture ${name} was released, but the registry does not hold it: released more ` +
    'often than acquired, or acquired elsewhere.',
});
type Decoded = {readonly source: THREE.Source; readonly close: () => void};

export function createModelTextures(read: ModelFileReader, decode: ModelImageDecoder) {
  const textures = new Map<string, {readonly texture: THREE.Texture; users: number}>();
  const keys = new Map<THREE.Texture, string>();
  const sources = createModelFileCache<Decoded>(read, {what: 'texture', free: decoded => decoded.close(),
    decode: async bytes => {
      const {image, close} = await decode(bytes);
      return {source: new THREE.Source(image), close};
    },
    used: decoded => [...textures.values()].some(({texture}) => texture.source === decoded.source)});
  const make = (value: ModelSurfaceTexture, space: ModelColorSpace) => {
    if ('constant' in value) {
      const texture = new THREE.DataTexture(new Uint8Array(TEXELS[value.constant]), 1, 1);
      texture.name = `constant ${value.constant}`;
      texture.colorSpace = SPACES[space];
      texture.needsUpdate = true;
      return texture;
    }
    const texture = new THREE.Texture();
    texture.name = value.path;
    texture.source = sources.get(value).source;
    texture.flipY = false;
    texture.colorSpace = SPACES[space];
    texture.wrapS = WRAPS[value.wrap[0]];
    texture.wrapT = WRAPS[value.wrap[1]];
    texture.repeat.fromArray(value.scale);
    texture.offset.fromArray(value.offset);
    texture.needsUpdate = true;
    return texture;
  };
  return {
    /** A staged load of these files: each one not yet held is read and decoded once while in flight. */
    load: sources.load,
    /** A texture of a record's value in its parameter's space, shared by every user of the same; counted. */
    acquire(value: ModelSurfaceTexture, space: ModelColorSpace): THREE.Texture {
      const key = modelRecordIdentity([value, space]), held = textures.get(key);
      if (held) {
        held.users++;
        return held.texture;
      }
      const texture = make(value, space);
      textures.set(key, {texture, users: 1});
      keys.set(texture, key);
      return texture;
    },
    /** One user is done with a texture; the last one frees it. A texture the registry does not hold is a defect of
     * the caller, never a refusal. */
    release(texture: THREE.Texture) {
      const key = keys.get(texture), held = key === undefined ? undefined : textures.get(key);
      if (key === undefined || !held) throw new Error(MODEL_TEXTURE_TEXT.unheld(texture.name));
      if (--held.users > 0) return;
      textures.delete(key);
      keys.delete(texture);
      texture.dispose();
    },
    /** The files the description in force names stay read; every other file no texture uses is freed. */
    keep: sources.keep,
    dispose() {
      sources.dispose();
      for (const {texture} of textures.values()) texture.dispose();
      textures.clear();
      keys.clear();
    },
  };
}
export type ModelTextures = ReturnType<typeof createModelTextures>;
