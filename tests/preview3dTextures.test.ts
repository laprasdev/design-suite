import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_FILE_TEXT, readModelFile} from '../src/react/preview3d/files.ts';
import {createModelTextures, MODEL_TEXTURE_TEXT} from '../src/react/preview3d/textures.ts';
import {modelSurfaceFiles, modelSurfaceSets} from '../src/react/preview3d/surfaceModel.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {declaration, describing} from './preview3dActorFixture.ts';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const file = (name: string) => ({path: `/${name}.png`, sha256: digest(name)});
const sampled = (name: string, wrap: readonly ['repeat' | 'clamp', 'repeat' | 'clamp'] = ['repeat', 'repeat']) =>
  ({...file(name), wrap, scale: [1, 1] as const, offset: [0, 0] as const});
// A reader that answers every file at once from its name, counting reads; a decoder that tags what it decoded.
function registry() {
  const reads: string[] = [];
  const textures = createModelTextures(async (path, sha256) => {
    reads.push(path);
    return new TextEncoder().encode(`${path} ${sha256}`).buffer;
  }, async bytes => ({decoded: new TextDecoder().decode(bytes)}) as unknown as TexImageSource);
  return {textures, reads};
}

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
    const pending = textures.load([file('mask'), file('mask'), file('ramp')]);
    assert.equal(pending.length, 2);
    assert.equal(textures.load([file('mask')])[0], pending[0], 'one read while it is in flight');
    assert.throws(() => textures.acquire(sampled('mask'), 'linear'),
      new RegExp(MODEL_TEXTURE_TEXT.unloaded('/mask.png')));
    await Promise.all(pending);
    assert.deepEqual([reads, textures.load([file('mask')])], [['/mask.png', '/ramp.png'], []]);
    const first = textures.acquire(sampled('mask'), 'linear'), again = textures.acquire(sampled('mask'), 'linear');
    const clamped = textures.acquire(sampled('mask', ['clamp', 'repeat']), 'srgb');
    assert.equal(first, again);
    assert.equal(clamped.source, first.source, 'one decoded image under two samplings');
    assert.deepEqual([first.flipY, first.colorSpace, clamped.colorSpace, clamped.wrapS, first.wrapS],
      [false, THREE.NoColorSpace, THREE.SRGBColorSpace, THREE.ClampToEdgeWrapping, THREE.RepeatWrapping]);
    let disposed = 0;
    first.addEventListener('dispose', () => disposed++);
    textures.release(first);
    assert.equal(disposed, 0);
    textures.release(first);
    assert.equal(disposed, 1, 'the last user frees it');
    const white = textures.acquire({constant: 'white'}, 'srgb');
    assert.ok(white instanceof THREE.DataTexture);
    assert.deepEqual([...white.image.data], [255, 255, 255, 255]);
  });

  it('keeps the files the description in force names, and drops others nothing uses', async () => {
    const {textures, reads} = registry();
    await Promise.all(textures.load([file('mask'), file('ramp')]));
    const ramp = textures.acquire(sampled('ramp'), 'srgb');
    textures.keep([]);
    assert.deepEqual(textures.load([file('mask'), file('ramp')]).length, 1, 'mask was dropped; ramp is in use');
    textures.release(ramp);
    textures.keep([file('mask')]);
    await Promise.all(textures.load([file('mask'), file('ramp')]));
    assert.deepEqual(reads, ['/mask.png', '/ramp.png', '/mask.png', '/ramp.png']);
  });

  it('loads, in the staged load, the textures of the sets the actors are drawn from, and keeps them on commit', () => {
    const MASK = {texture: {...sampled('mask'), wrap: ['repeat', 'clamp']}};
    const sets = modelSurfaceSets({used: {'gltf-node:0/primitive:0': {kind: 'test-pulse', values: {_Mask: MASK}}},
      unused: {'gltf-node:0/primitive:0': {kind: 'test-pulse', values: {_Mask: {texture: sampled('ramp')}}}}});
    const actors = [declaration('a', 'otter', {surfaces: {kind: 'set', set: 'used'}})];
    assert.deepEqual(modelSurfaceFiles(sets, actors), [file('mask')]);
    assert.deepEqual(modelSurfaceFiles(sets, [declaration('a')]), []);
    const asked: unknown[] = [];
    const parts = createModelStageParts({scene: new THREE.Scene(), kinds: new Map(), modes: createModelSurfaceModes(),
      fog: createModelFog(new THREE.Scene()), lighting: {load: () => [], prepare: () => () => undefined},
      frame: () => undefined, textures: {load: files => {asked.push([...files]); return [];}, keep: () => undefined}});
    parts.loads(modelStageDescription(describing({surfaceSets: {used: sets.used}, actors: {focus: 'a', actors}})));
    assert.deepEqual(asked, [[file('mask')]]);
  });
});
