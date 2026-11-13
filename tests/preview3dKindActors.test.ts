import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelActorSurfaces, MODEL_ACTOR_SURFACES_TEXT as TEXT} from '../src/react/preview3d/actorSurfaces.ts';
import {modelSurfaceOutputs, modelSurfaceTakes} from '../src/react/preview3d/surfaceOutputModel.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {kindFile, kindMaterials, kinds, record, RENDERERS, sets} from './preview3dKindFixture.ts';

const SET = Object.freeze({kind: 'set', set: 'tinted'} as const), FILE = Object.freeze({kind: 'file'} as const);
const refused = (run: () => unknown, message: string) => assert.throws(run, (error: unknown) =>
  error instanceof ModelStageRefusal && error.message === message, message);
// As a kind's values hold it: a 32-bit float.
const linear = (value: number) => Math.fround(new THREE.Color().setRGB(value, 0, 0, THREE.SRGBColorSpace).r);
// One actor's surfaces over the kind fixture's file, with a compile that records what it compiled and can fail.
async function actorWith(registry?: Awaited<ReturnType<typeof kindMaterials>>) {
  const held = registry ?? await kindMaterials(), file = kindFile(), compiled: THREE.Material[] = [];
  let failing: string | undefined;
  const surfaces = createModelActorSurfaces(file.asset, 'a', {materials: held.materials, kinds: kinds(),
    compile: object => {
      compiled.push((object as THREE.Mesh).material as THREE.Material);
      if (failing) throw new Error(failing);
    }});
  return {...held, ...file, surfaces, compiled, fail: (why: string) => {failing = why;}};
}
// three's renderer calls this just before it draws the mesh; nothing the stage's hook reads is the renderer's.
const draws = (mesh: THREE.Mesh) => mesh.onBeforeRender(null as never, null as never, null as never, null as never,
  mesh.material as THREE.Material, null as never);

describe('an actor drawn by surface kinds', () => {
  it('draws a set\'s records with shared kind materials, compiled on each renderer before the commit', async () => {
    const a = await actorWith(), b = await actorWith(a);
    const own = a.body.material;
    const commit = a.surfaces.prepare(SET, sets());
    const surface = a.materials.material(sets().tinted[RENDERERS.body] as never);
    assert.deepEqual(a.compiled, [surface.material], 'compiled as the renderer draws it, before any frame');
    assert.equal(a.body.material, own, 'the renderer shows its own material until the commit');
    commit();
    b.surfaces.prepare(SET, sets())();
    assert.deepEqual([a.body.material, b.body.material], [surface.material, surface.material]);
    assert.deepEqual([a.eyes.material instanceof THREE.MeshStandardMaterial, a.line.material instanceof
      THREE.LineBasicMaterial], [true, true], 'the file\'s own material where the set says file');
    assert.deepEqual([a.surfaces.inspection.available, a.surfaces.inspection.emissiveMaterialCount], [true, 1]);
  });

  it('refuses what a renderer cannot draw, naming the actor, the renderer and the kind', async () => {
    const a = await actorWith(), own = a.body.material;
    const at = (id: string) => `Actor a, renderer ${id}, kind test-pulse`;
    refused(() => a.surfaces.prepare(SET, {tinted: {...sets().tinted,
      [RENDERERS.line]: record()}} as never), TEXT.mesh(at(RENDERERS.line)));
    a.fail('ERROR: 0:1434: \'kindSurface\' : no matching overloaded function found');
    refused(() => a.surfaces.prepare(SET, sets()), TEXT.program(at(RENDERERS.body),
      'ERROR: 0:1434: \'kindSurface\' : no matching overloaded function found'));
    assert.equal(a.body.material, own, 'a refused program leaves the renderer as it was');
    a.body.geometry.deleteAttribute('uv');
    refused(() => a.surfaces.prepare(SET, sets()), TEXT.attribute(at(RENDERERS.body), 'uv'));
  });

  it('applies a kept actor\'s change of surfaces: a new record is a new material, and no model reloads', async () => {
    const a = await actorWith(), own = a.body.material;
    a.surfaces.prepare(SET, sets())();
    const first = a.body.material as unknown as THREE.ShaderMaterial;
    let freed = 0;
    first.addEventListener('dispose', () => freed++);
    a.surfaces.prepare(SET, sets(record([0, 0, 1, 1])))();
    a.materials.sweep();
    assert.notEqual(a.body.material, first);
    assert.equal(freed, 1, 'the old record\'s material, used by nobody, is freed');
    const tweaked = a.body.material;
    a.surfaces.prepare(SET, sets(record([0, 0, 1, 1])))();
    assert.equal(a.body.material, tweaked, 'an unchanged record keeps its material, compiled once');
    assert.equal(a.compiled.length, 2);
    a.surfaces.prepare(FILE, sets())();
    assert.deepEqual([a.body.material, a.body.onBeforeRender], [own, THREE.Object3D.prototype.onBeforeRender]);
    a.surfaces.prepare(SET, sets())();
    a.surfaces.dispose();
    assert.equal(a.body.material, own, 'its own material is back before the model is freed');
  });

  it('hands each renderer\'s values to the shared material as it is drawn; an omitted name shows the record\'s',
    async () => {
      const a = await actorWith(), b = await actorWith(a);
      for (const actor of [a, b]) actor.surfaces.prepare(SET, sets())();
      const shared = a.body.material as unknown as THREE.ShaderMaterial, values = shared.uniforms.surfaceValues;
      const frame = modelSurfaceOutputs([{rendererId: RENDERERS.body, slot: 0, visible: false, floats: {},
        colors: {_Color: [0, 0.5, 0, 1]}}], modelSurfaceTakes(SET, sets(), kinds()), 'Entity a');
      const hidden = a.surfaces.prepareValues(frame)();
      assert.deepEqual([...hidden], [a.body]);
      draws(a.body);
      const own = values.value as Float32Array;
      assert.deepEqual([...own.slice(0, 4)], [0, linear(0.5), 0, 1], 'the engine\'s colour, by the one rule');
      assert.equal(own[8], 2, '_Pulse, which the frame leaves out, shows the record\'s value');
      assert.equal(shared.uniformsNeedUpdate, true);
      shared.uniformsNeedUpdate = false;
      draws(a.body);
      assert.equal(shared.uniformsNeedUpdate, false, 'unchanged and already held: nothing to upload');
      draws(b.body);
      assert.notEqual(values.value, own);
      assert.deepEqual([...(values.value as Float32Array).slice(0, 4)], [linear(1), linear(0.5), 0, 1]);
      assert.equal(shared.uniformsNeedUpdate, true, 'the other renderer\'s own values');
      a.surfaces.prepareValues([])();
      draws(a.body);
      assert.deepEqual([...own.slice(0, 4)], [linear(1), linear(0.5), 0, 1], 'a frame without it: the record\'s');
    });
});
