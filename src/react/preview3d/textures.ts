import * as THREE from 'three';
import type {ModelFileReader} from './files.ts';
import {MODEL_TEXTURE_CONSTANT, MODEL_TEXTURE_WRAP, type ModelSurfaceFile, type ModelSurfaceTexture}
  from './surfaceModel.ts';
import {MODEL_COLOR_SPACE, type ModelColorSpace} from './surfaceKindModel.ts';

// The stage's textures for surface records. A file is read once by its SHA-256 (verified, files.ts) and decoded once,
// as three's glTF loader decodes a file's own images: no premultiplied alpha, no colour-space conversion, glTF's
// orientation (flipY false). A texture is one file under one sampling (space, wrap, scale, offset), counted by its
// users and freed with the last. Files load inside the stage's staged load, so readiness covers them; the files the
// description in force names are kept, every other is dropped once nothing uses it.
/** Turns a file's verified bytes into an image three can upload. */
export type ModelImageDecoder = (bytes: ArrayBuffer) => Promise<TexImageSource>;
/** The browser's decoder, as three's GLTFLoader uses it (ImageBitmapLoader's options, r180). */
export const decodeModelImage: ModelImageDecoder = bytes => createImageBitmap(new Blob([bytes]),
  {premultiplyAlpha: 'none', colorSpaceConversion: 'none'});
const WRAPS: Readonly<Record<string, THREE.Wrapping>> = Object.freeze({
  [MODEL_TEXTURE_WRAP.repeat]: THREE.RepeatWrapping,
  [MODEL_TEXTURE_WRAP.clamp]: THREE.ClampToEdgeWrapping, [MODEL_TEXTURE_WRAP.mirror]: THREE.MirroredRepeatWrapping});
// A texture's space is how three reads its texels: sRGB colour is decoded, linear data is read as stored.
const SPACES: Readonly<Record<ModelColorSpace, string>> = Object.freeze({[MODEL_COLOR_SPACE.srgb]: THREE.SRGBColorSpace,
  [MODEL_COLOR_SPACE.linear]: THREE.NoColorSpace});
const TEXELS = Object.freeze({[MODEL_TEXTURE_CONSTANT.white]: [255, 255, 255, 255],
  [MODEL_TEXTURE_CONSTANT.black]: [0, 0, 0, 255]});
export const MODEL_TEXTURE_TEXT = Object.freeze({
  unloaded: (path: string) => `The texture ${path} was asked for before the staged load read it.`,
});

export function createModelTextures(read: ModelFileReader, decode: ModelImageDecoder) {
  const sources = new Map<string, THREE.Source>(), loading = new Map<string, Promise<void>>();
  const textures = new Map<string, {readonly texture: THREE.Texture; users: number}>();
  const controller = new AbortController();
  const make = (value: ModelSurfaceTexture, space: ModelColorSpace) => {
    if ('constant' in value) {
      const texture = new THREE.DataTexture(new Uint8Array(TEXELS[value.constant]), 1, 1);
      texture.colorSpace = SPACES[space];
      texture.needsUpdate = true;
      return texture;
    }
    const source = sources.get(value.sha256);
    if (!source) throw new Error(MODEL_TEXTURE_TEXT.unloaded(value.path));
    const texture = new THREE.Texture();
    texture.source = source;
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
    /** What these files need loaded first: each one not yet read, read and decoded once while in flight. */
    load(files: Iterable<ModelSurfaceFile>): readonly Promise<void>[] {
      const wanted = new Map([...files].filter(file => !sources.has(file.sha256)).map(file => [file.sha256, file]));
      return [...wanted.values()].map(file => {
        const pending = loading.get(file.sha256) ?? read(file.path, file.sha256, controller.signal).then(decode)
          .then(image => {sources.set(file.sha256, new THREE.Source(image));})
          .finally(() => loading.delete(file.sha256));
        loading.set(file.sha256, pending);
        return pending;
      });
    },
    /** A texture of a record's value in its parameter's space, shared by every user of the same; counted. */
    acquire(value: ModelSurfaceTexture, space: ModelColorSpace): THREE.Texture {
      const key = JSON.stringify([value, space]), held = textures.get(key);
      if (held) {
        held.users++;
        return held.texture;
      }
      const texture = make(value, space);
      textures.set(key, {texture, users: 1});
      return texture;
    },
    /** One user is done with a texture; the last one frees it. */
    release(texture: THREE.Texture) {
      for (const [key, held] of textures) {
        if (held.texture !== texture || --held.users > 0) continue;
        textures.delete(key);
        texture.dispose();
      }
    },
    /** The files the description in force names stay read; every other file no texture uses is dropped. */
    keep(files: Iterable<ModelSurfaceFile>) {
      const named = new Set([...files].map(file => file.sha256));
      const used = new Set([...textures.values()].map(({texture}) => texture.source));
      for (const [sha256, source] of sources) if (!named.has(sha256) && !used.has(source)) sources.delete(sha256);
    },
    dispose() {
      controller.abort();
      for (const {texture} of textures.values()) texture.dispose();
      textures.clear();
      sources.clear();
    },
  };
}
export type ModelTextures = ReturnType<typeof createModelTextures>;
