import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {isModelImageSource, MODEL_ACTOR_REFUSAL, MODEL_IMAGE_SOURCES, MODEL_RUNTIME_MATERIAL, MODEL_SURFACE_REFUSAL,
  modelRendererId, modelStageDescription, modelSurfaceFiles, modelSurfaceKinds, modelSurfaceSets}
  from '../src/react/preview3d/model.ts';
import {modelFileDrawn} from '../src/react/preview3d/drawn.ts';
import {modelStageDescriptionChanges} from '../src/react/preview3d/descriptionModel.ts';
import {modelActorSurfaceSource} from '../src/react/preview3d/actorSurfaceModel.ts';
import {createModelTextures, MODEL_TEXTURE_TEXT} from '../src/react/preview3d/textures.ts';
import {createModelSurfaceMaterials} from '../src/react/preview3d/surfaceMaterials.ts';
import {createModelActorSurfaces} from '../src/react/preview3d/actorSurfaces.ts';
import {createModelStageSharedValues} from '../src/react/preview3d/sharedValues.ts';
import {declaration, describing, refused} from './preview3dActorFixture.ts';
import {kindFile, RENDERERS} from './preview3dKindFixture.ts';

const PROGRAM_HASH = 'd'.repeat(64);
const IMAGE_KIND = {
  id: 'test-image',
  parameters: {MainTex: {type: 'texture', space: 'srgb'}},
  inert: {},
  attributes: ['uv'],
  light: 'standard',
  coverage: 'opaque',
  side: 'front',
  fog: true,
  displacement: null,
  webProgram: {path: '/image.glsl', sha256: PROGRAM_HASH},
};
const GLSL = 'void kindSurface( inout vec4 diffuse, inout vec3 emissive ) { ' +
  'diffuse = surfaceParameterMainTex( vUv ); }';

function withBrowserImageSources<Result>(run: (make: (tag: string) => TexImageSource) => Result): Result {
  const held = new Map<string, unknown>();
  for (const name of MODEL_IMAGE_SOURCES) held.set(name, Reflect.get(globalThis, name));
  class TestCanvas {
    readonly tag: string;
    constructor(tag: string) {this.tag = tag;}
  }
  for (const name of MODEL_IMAGE_SOURCES) {
    if (typeof Reflect.get(globalThis, name) !== 'function') {
      Reflect.set(globalThis, name, name === 'HTMLCanvasElement' ? TestCanvas : class {});
    }
  }
  try {
    return run(tag => {
      const candidate: unknown = new TestCanvas(tag);
      if (!isModelImageSource(candidate)) throw new Error('Expected TestCanvas to match HTMLCanvasElement.');
      return candidate;
    });
  } finally {
    for (const [name, previous] of held) {
      if (previous === undefined) Reflect.deleteProperty(globalThis, name);
      else Reflect.set(globalThis, name, previous);
    }
  }
}

const imageTexture = (image: TexImageSource,
  wrap: readonly ['repeat' | 'clamp' | 'mirror', 'repeat' | 'clamp' | 'mirror'] = ['clamp', 'clamp']) =>
  ({image, wrap, scale: [1, 1] as const, offset: [0, 0] as const});

describe('in-memory image surface textures', () => {
  it('accepts only real TexImageSource instances and refuses plain objects, primitives and mixed fields', () => {
    withBrowserImageSources(makeImage => {
      const valid = makeImage('crest');
      assert.equal(isModelImageSource(valid), true);
      for (const name of MODEL_IMAGE_SOURCES) {
        const Ctor = Reflect.get(globalThis, name);
        assert.equal(typeof Ctor === 'function' && isModelImageSource(Reflect.construct(Ctor, [])), true, name);
      }
      for (const bad of [{}, Object.create(null), [], new Uint8Array(4), new Map(), 'canvas', 42, true, null,
        undefined]) {
        assert.equal(isModelImageSource(bad), false);
        refused(() => modelSurfaceSets({s: {[RENDERERS.body]: {kind: 'test-image',
          values: {MainTex: {texture: {image: bad, wrap: ['clamp', 'clamp'], scale: [1, 1], offset: [0, 0]}}}}}}),
        new RegExp(MODEL_SURFACE_REFUSAL.image(`Surface set s, renderer ${RENDERERS.body}.MainTex.texture.image`)
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      refused(() => modelSurfaceSets({s: {[RENDERERS.body]: {kind: 'test-image',
        values: {MainTex: {texture: {...imageTexture(valid), path: '/extra.png'}}}}}}), /does not state path/);
      refused(() => modelSurfaceSets({s: {[RENDERERS.body]: {kind: 'test-image',
        values: {MainTex: {texture: {...imageTexture(valid), wrap: ['clamp']}}}}}}), /is a pair/);
    });
  });

  it('refuses an actor that states both a runtime material profile and an image surface set', () => {
    withBrowserImageSources(makeImage => {
      const digest = 'a'.repeat(64);
      const profile = {
        asset: {id: 'otter', revision: 'v1', sha256: digest},
        profile: MODEL_RUNTIME_MATERIAL.profile,
        colorSpace: MODEL_RUNTIME_MATERIAL.colorSpace,
        emissionMask: MODEL_RUNTIME_MATERIAL.emissionMask,
        noiseBlend: MODEL_RUNTIME_MATERIAL.noiseBlend,
        nightBoost: MODEL_RUNTIME_MATERIAL.nightBoost,
        renderers: [{rendererId: 'body', nodeIndex: 0, meshIndex: 0, primitiveIndex: 0, slot: 0}],
      };
      const sets = {s: {[modelRendererId(0, 0)]: {kind: 'test-image',
        values: {MainTex: {texture: imageTexture(makeImage('kit'))}}}}};
      refused(() => modelStageDescription(describing({
        surfaceSets: sets,
        actors: {focus: 'a', actors: [declaration('a', 'otter', {
          asset: {id: 'otter', revision: 'v1', path: '/models/otter.glb', sha256: digest, runtimeMaterials: profile},
          surfaces: {from: 'set', set: 's'},
        })]},
      })), new RegExp(MODEL_ACTOR_REFUSAL.routes('a').slice(0, 40)));
    });
  });

  it('shares textures by image identity, sampling and space, starts zero file reads, and frees on last release', () => {
    withBrowserImageSources(makeImage => {
      const firstImage = makeImage('home'), secondImage = makeImage('away');
      let fileReads = 0;
      const textures = createModelTextures(async () => {fileReads++; return new ArrayBuffer(0);},
        async () => ({image: firstImage, close: () => undefined}));
      const a = textures.acquire(imageTexture(firstImage), 'srgb');
      const reordered = textures.acquire(
        {offset: [0, 0], scale: [1, 1], wrap: ['clamp', 'clamp'], image: firstImage}, 'srgb');
      assert.equal(a, reordered, 'same image, sampling and space in any field order share one texture');
      const linear = textures.acquire(imageTexture(firstImage, ['mirror', 'repeat']), 'linear');
      assert.notEqual(a, linear);
      assert.equal(a.source, linear.source, 'one THREE.Source per image across samplings and spaces');
      const b = textures.acquire({image: secondImage, wrap: ['repeat', 'clamp'], scale: [2, 3], offset: [0.25, 0.5]},
        'srgb');
      assert.notEqual(a, b);
      assert.notEqual(a.source, b.source, 'distinct image instances produce distinct sources');
      assert.deepEqual([a.flipY, a.colorSpace, linear.colorSpace, b.wrapS, b.wrapT, b.repeat.toArray(),
        b.offset.toArray(), fileReads], [false, THREE.SRGBColorSpace, THREE.NoColorSpace, THREE.RepeatWrapping,
        THREE.ClampToEdgeWrapping, [2, 3], [0.25, 0.5], 0]);
      let disposed = 0;
      a.addEventListener('dispose', () => {disposed++;});
      textures.release(a);
      assert.equal(disposed, 0, 'still held by second user');
      textures.release(reordered);
      assert.equal(disposed, 1, 'freed when last user releases');
      assert.throws(() => textures.release(a), new RegExp(MODEL_TEXTURE_TEXT.unheld('image')));
      textures.release(linear);
      textures.release(b);
    });
  });

  it('detects image swaps across descriptions, frees replaced textures on sweep, and restores originals', async () => {
    await withBrowserImageSources(async makeImage => {
      const home = makeImage('home'), away = makeImage('away');
      const setFor = (image: TexImageSource) => ({
        [RENDERERS.body]: {kind: 'test-image', values: {MainTex: {texture: imageTexture(image)}}},
        [RENDERERS.eyes]: {kind: 'file'},
        [RENDERERS.line]: {kind: 'file'},
      });
      const descA = modelStageDescription(describing({
        surfaceSets: {kit: setFor(home)},
        actors: {focus: 'a', actors: [declaration('a', 'otter', {surfaces: {from: 'set', set: 'kit'}})]},
      }));
      const descSame = modelStageDescription(describing({
        surfaceSets: {kit: setFor(home)},
        actors: {focus: 'a', actors: [declaration('a', 'otter', {surfaces: {from: 'set', set: 'kit'}})]},
      }));
      const descB = modelStageDescription(describing({
        surfaceSets: {kit: setFor(away)},
        actors: {focus: 'a', actors: [declaration('a', 'otter', {surfaces: {from: 'set', set: 'kit'}})]},
      }));
      assert.deepEqual([...modelStageDescriptionChanges(descA, descSame)], []);
      assert.deepEqual([...modelStageDescriptionChanges(descA, descB)], ['surfaceSets']);
      assert.deepEqual(modelSurfaceFiles([modelActorSurfaceSource(descA.actors.actors[0], descA.surfaceSets)]), []);

      const kinds = modelSurfaceKinds([IMAGE_KIND]);
      const textures = createModelTextures(async () => new ArrayBuffer(0),
        async () => ({image: home, close: () => undefined}));
      const materials = createModelSurfaceMaterials({kinds,
        read: async () => new TextEncoder().encode(GLSL).buffer,
        textures, shared: createModelStageSharedValues(), changes: () => []});
      const recordA = descA.surfaceSets.kit[RENDERERS.body];
      if (!('values' in recordA)) throw new Error('Expected surface record.');
      await Promise.all(materials.load([recordA]).pending);
      const file = kindFile(), drawn = modelFileDrawn(file.asset, {actor: 'a', path: '/otter.glb'}, undefined);
      const originalBody = file.body.material;
      const actorSurfaces = createModelActorSurfaces(drawn, 'a', {materials, kinds, compile: () => undefined});
      actorSurfaces.prepare({surfaces: {from: 'set', set: 'kit'}, sets: descA.surfaceSets})();
      const firstMat = file.body.material;
      assert.notEqual(firstMat, originalBody);
      let firstTexDisposed = 0;
      if (firstMat instanceof THREE.ShaderMaterial) {
        const tex: unknown = firstMat.uniforms.surfaceTextureMainTex?.value;
        if (tex instanceof THREE.Texture) tex.addEventListener('dispose', () => {firstTexDisposed++;});
      }
      actorSurfaces.prepare({surfaces: {from: 'set', set: 'kit'}, sets: descB.surfaceSets})();
      materials.sweep();
      assert.equal(firstTexDisposed, 1, 'sweep frees the replaced image material and releases its texture');
      actorSurfaces.prepare({surfaces: {from: 'file'}, sets: {}})();
      materials.sweep();
      assert.equal(file.body.material, originalBody, 'file surfaces restore original mesh material');
      materials.dispose();
      textures.dispose();
    });
  });
});
