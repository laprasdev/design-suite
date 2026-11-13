import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_FILE_TEXT, readModelFile} from '../src/react/preview3d/files.ts';
import {createModelTextures, MODEL_TEXTURE_TEXT} from '../src/react/preview3d/textures.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {MODEL_FILE_CACHE_TEXT} from '../src/react/preview3d/fileCache.ts';
import {modelSurfaceFiles, modelSurfaceSets} from '../src/react/preview3d/surfaceModel.ts';
import {modelSurfaceKinds} from '../src/react/preview3d/surfaceKindModel.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {NO_FILES, NO_LOAD, declaration, describing} from './preview3dActorFixture.ts';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const file = (name: string) => ({path: `/${name}.png`, sha256: digest(name)});
const sampled = (name: string, wrap: readonly ['repeat' | 'clamp', 'repeat' | 'clamp'] = ['repeat', 'repeat']) =>
  ({...file(name), wrap, scale: [1, 1] as const, offset: [0, 0] as const});
// A reader that answers every file at once from its name, counting reads; a decoder that tags what it decoded and
// counts the images it is asked to close.
function registry() {
  const reads: string[] = [], closed: string[] = [];
  const textures = createModelTextures(async (path, sha256) => {
    reads.push(path);
    return new TextEncoder().encode(`${path} ${sha256}`).buffer;
  }, async bytes => {
    const decoded = new TextDecoder().decode(bytes);
    return {image: {decoded} as unknown as TexImageSource, close: () => {closed.push(decoded.split(' ')[0]);}};
  });
  return {textures, reads, closed};
}
const settled = (load: {readonly pending: readonly Promise<void>[]}) => Promise.all(load.pending);

// A kind with one texture, for the staged load.
const MASK_KIND = {id: 'test-mask', parameters: {_Mask: {type: 'texture', space: 'linear'}}, inert: {}, attributes: [],
  light: 'standard', coverage: 'opaque', side: 'front', fog: true, displacement: null,
  webProgram: {path: '/mask.glsl', sha256: 'c'.repeat(64)}};

describe('the stage\'s textures', () => {
  it('reads a file the description names only when its bytes have the stated SHA-256', async () => {
    const real = globalThis.fetch;
    globalThis.fetch = (async () => new Response('texels')) as typeof fetch;
    try {
      const signal = new AbortController().signal;
      assert.equal(new TextDecoder().decode(await readModelFile('/a.png', digest('texels'), signal)), 'texels');
      await assert.rejects(readModelFile('/a.png', digest('other'), signal),
        new RegExp(MODEL_FILE_TEXT.digest('/a.png', digest('other'), digest('texels'))));
      globalThis.fetch = (async () => new Response('', {status: 404})) as typeof fetch;
      await assert.rejects(readModelFile('/a.png', digest('texels'), signal), /\/a.png could not be read \(HTTP 404\)/);
    } finally {
      globalThis.fetch = real;
    }
  });

  it('reads and decodes each file once, and shares one texture per file and sampling, counted', async () => {
    const {textures, reads} = registry();
    const load = textures.load([file('mask'), file('mask'), file('ramp')]);
    assert.equal(load.pending.length, 2);
    assert.equal(textures.load([file('mask')]).pending[0], load.pending[0], 'one read while it is in flight');
    assert.throws(() => textures.acquire(sampled('mask'), 'linear'),
      new RegExp(MODEL_FILE_CACHE_TEXT.unloaded('/mask.png')));
    await settled(load);
    assert.deepEqual([reads, textures.load([file('mask')]).pending], [['/mask.png', '/ramp.png'], []]);
    const first = textures.acquire(sampled('mask'), 'linear'), again = textures.acquire(sampled('mask'), 'linear');
    const clamped = textures.acquire(sampled('mask', ['clamp', 'repeat']), 'srgb');
    assert.equal(first, again);
    const {path, sha256, wrap, scale, offset} = sampled('mask');
    assert.equal(textures.acquire({offset, scale, wrap, sha256, path}, 'linear'), first, 'one sampling in any order');
    textures.release(first);
    assert.equal(clamped.source, first.source, 'one decoded image under two samplings');
    assert.deepEqual([first.flipY, first.colorSpace, clamped.colorSpace, clamped.wrapS, first.wrapS],
      [false, THREE.NoColorSpace, THREE.SRGBColorSpace, THREE.ClampToEdgeWrapping, THREE.RepeatWrapping]);
    // The record's sampling, each axis its own: wrap, scale and offset, none of them three's defaults.
    const stated = textures.acquire({...sampled('ramp', ['repeat', 'clamp']), wrap: ['mirror', 'repeat'],
      scale: [2, 3], offset: [0.25, 0.5]}, 'linear');
    assert.deepEqual([stated.wrapS, stated.wrapT, stated.repeat.toArray(), stated.offset.toArray()],
      [THREE.MirroredRepeatWrapping, THREE.RepeatWrapping, [2, 3], [0.25, 0.5]]);
    // An empty slot's constant: one texel, in the parameter's space.
    const black = textures.acquire({constant: 'black'}, 'srgb') as THREE.DataTexture;
    assert.deepEqual([[...black.image.data as Uint8Array], black.image.width, black.colorSpace],
      [[0, 0, 0, 255], 1, THREE.SRGBColorSpace]);
    let disposed = 0;
    first.addEventListener('dispose', () => disposed++);
    textures.release(first);
    assert.equal(disposed, 0);
    textures.release(first);
    assert.equal(disposed, 1, 'the last user frees it');
    // Released once more than acquired, or a texture from elsewhere: a defect of the caller, said by name.
    assert.throws(() => textures.release(first), new RegExp(MODEL_TEXTURE_TEXT.unheld('/mask.png')));
    assert.throws(() => textures.release(new THREE.Texture()), /was released, but the registry does not hold it/);
    const white = textures.acquire({constant: 'white'}, 'srgb');
    assert.ok(white instanceof THREE.DataTexture);
    assert.deepEqual([...white.image.data], [255, 255, 255, 255]);
  });

  it('keeps the files the description in force names or a texture uses, and frees and closes the others', async () => {
    const {textures, reads, closed} = registry();
    const load = textures.load([file('mask'), file('ramp')]);
    await settled(load);
    textures.keep([file('mask')]);
    const ramp = textures.acquire(sampled('ramp'), 'srgb');
    load.release();
    assert.deepEqual(closed, [], 'mask is named in force, ramp is in use');
    textures.keep([]);
    assert.deepEqual(closed, ['/mask.png']);
    textures.release(ramp);
    textures.keep([]);
    assert.deepEqual(closed, ['/mask.png', '/ramp.png']);
    await settled(textures.load([file('mask'), file('ramp')]));
    assert.deepEqual(reads, ['/mask.png', '/ramp.png', '/mask.png', '/ramp.png']);
  });

  it('aborts a read no staged load waits on any more, frees what lands for nobody, names a failed one', async () => {
    const signals = new Map<string, AbortSignal>(), answers = new Map<string, () => void>(), closed: string[] = [];
    const textures = createModelTextures((path, sha256, signal) => new Promise((resolve, reject) => {
      signals.set(path, signal);
      signal.addEventListener('abort', () => reject(signal.reason));
      answers.set(path, () => resolve(new TextEncoder().encode(path).buffer));
    }), async bytes => {
      const path = new TextDecoder().decode(bytes);
      if (path === '/broken.png') throw new Error('not an image');
      if (path === '/slow.png') await decoding;
      return {image: {} as TexImageSource, close: () => {closed.push(path);}};
    });
    let decoded = () => undefined as void;
    const decoding = new Promise<void>(resolve => {decoded = resolve;});
    const first = textures.load([file('mask'), file('ramp')]), second = textures.load([file('ramp')]);
    first.release();
    assert.deepEqual([signals.get('/mask.png')!.aborted, signals.get('/ramp.png')!.aborted], [true, false],
      'ramp is still waited on by the second load');
    second.release();
    answers.get('/ramp.png')!();
    await Promise.allSettled([...first.pending, ...second.pending]);
    assert.equal(signals.get('/ramp.png')!.aborted, true, 'nobody waits: aborted');
    const late = textures.load([file('late')]);
    answers.get('/late.png')!();
    await settled(late);
    late.release();
    assert.deepEqual(closed, ['/late.png'], 'landed for an attempt that let go, and no description names it');
    // Read whole, then let go of while it decodes: the read can no longer be aborted, and it lands for nobody.
    const slow = textures.load([file('slow')]);
    answers.get('/slow.png')!();
    await Promise.resolve();
    slow.release();
    decoded();
    await Promise.allSettled(slow.pending);
    assert.deepEqual(closed, ['/late.png', '/slow.png'], 'what lands for nobody is freed as it lands');
    // A file that landed for one load and is named by the next stays when the first lets go.
    const first2 = textures.load([file('kept')]);
    answers.get('/kept.png')!();
    await settled(first2);
    const next2 = textures.load([file('kept')]);
    first2.release();
    assert.deepEqual([closed.includes('/kept.png'), next2.pending.length], [false, 0]);
    assert.doesNotThrow(() => textures.acquire(sampled('kept'), 'srgb'));
    // A read let go of and named again before it settled starts afresh, and the new load gets its file.
    const dropped = textures.load([file('again')]);
    dropped.release();
    const again = textures.load([file('again')]);
    answers.get('/again.png')!();
    await settled(again);
    assert.equal((await Promise.allSettled(dropped.pending))[0].status, 'rejected', 'the first read was aborted');
    assert.doesNotThrow(() => textures.acquire(sampled('again'), 'srgb'));
    const broken = textures.load([file('broken')]);
    answers.get('/broken.png')!();
    await assert.rejects(broken.pending[0], (error: unknown) => error instanceof ModelStageRefusal &&
      error.message === MODEL_FILE_CACHE_TEXT.failed('texture', file('broken'), 'not an image'));
  });

  it('loads, in the staged load, the textures of the sets the actors use, never for a record it will refuse', () => {
    const MASK = {texture: {...sampled('mask'), wrap: ['repeat', 'clamp']}};
    const sets = modelSurfaceSets({used: {'gltf-node:0/primitive:0': {kind: 'test-mask', values: {_Mask: MASK}}},
      unused: {'gltf-node:0/primitive:0': {kind: 'test-mask', values: {_Mask: {texture: sampled('ramp')}}}}});
    const actors = [declaration('a', 'otter', {surfaces: {from: 'set', set: 'used'}})];
    assert.deepEqual(modelSurfaceFiles(sets, actors), [file('mask')]);
    assert.deepEqual(modelSurfaceFiles(sets, [declaration('a')]), []);
    const asked: unknown[] = [];
    const parts = (kinds: unknown[]) => createModelStageParts({scene: new THREE.Scene(),
      kinds: modelSurfaceKinds(kinds),
      modes: createModelSurfaceModes(), fog: createModelFog(new THREE.Scene()), frame: () => undefined,
      lighting: {load: () => [], prepare: () => () => undefined}, materials: NO_FILES.materials,
      textures: {load: files => {asked.push([...files]); return NO_LOAD;}, keep: () => undefined}});
    const described = modelStageDescription(describing({surfaceSets: {used: sets.used}, actors: {focus: 'a', actors}}));
    assert.throws(() => parts([]).loads(described), /names kind test-mask; the stage was given no kinds/);
    assert.deepEqual(asked, [], 'no read starts for a description refused without one');
    parts([MASK_KIND]).loads(described);
    assert.deepEqual(asked, [[file('mask')]]);
    // A format the stage does not decode is refused where the record is read, before any read.
    assert.throws(() => modelSurfaceSets({used: {'gltf-node:0/primitive:0': {kind: 'test-mask', values: {_Mask:
      {texture: {...sampled('mask'), path: '/mask.ktx2'}}}}}}), /_Mask.texture.path \/mask.ktx2 is not a format/);
  });
});
