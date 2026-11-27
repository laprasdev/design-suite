// A kind reads the opaque scene's depth only by declaring it: the declaration is checked, its program gains the read
// in the fragment stage alone, and a material of it holds the frame's depth target from its build until it is freed,
// which is what the frame's depth pass draws into (draw.ts); the frame is held to its budget with the target only then.
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_SURFACE_SCENE_READ, modelSurfaceKind, modelSurfaceKinds}
  from '../src/react/preview3d/surfaceKindModel.ts';
import {createModelSurfaceProgram} from '../src/react/preview3d/surfaceProgram.ts';
import {createModelSurfaceMaterials} from '../src/react/preview3d/surfaceMaterials.ts';
import {modelSurfaceRecord} from '../src/react/preview3d/surfaceModel.ts';
import {MODEL_SCENE_DEPTH} from '../src/react/preview3d/sceneDepth.ts';
import {createModelLinearFrame} from '../src/react/preview3d/linearFrame.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {kindStage, PULSE, PULSE_PROGRAM, record} from './preview3dKindFixture.ts';
import {budgetRefusal, DEPTH_HELD, DEPTH_OVER} from './preview3dFrameBudgetCases.ts';

const READING = Object.freeze({...PULSE, sceneReads: [MODEL_SURFACE_SCENE_READ.depth]});
const checked = (color?: number[]) => modelSurfaceRecord(record(color), 'R');
const built = (kind: object) => {
  const {shared} = kindStage(new THREE.Scene());
  return createModelSurfaceProgram(modelSurfaceKind(kind, 'K'), PULSE_PROGRAM, shared.declarations);
};

describe('the scene depth a kind reads', () => {
  it('is declared in the fragment stage of a kind that reads it, and in no program of a kind that does not', () => {
    const reading = built(READING), not = built(PULSE);
    assert.equal(reading.fragmentShader.split(`uniform sampler2D ${MODEL_SCENE_DEPTH.texture};`).length, 2);
    assert.ok(!reading.vertexShader.includes(MODEL_SCENE_DEPTH.texture), 'the fragment stage alone');
    for (const source of [not.fragmentShader, not.vertexShader]) {
      assert.ok(!source.includes(MODEL_SCENE_DEPTH.texture) && !source.includes(MODEL_SCENE_DEPTH.view));
    }
  });
  it('refuses a read the stage does not offer, or one listed twice, by its path', () => {
    assert.throws(() => modelSurfaceKind({...PULSE, sceneReads: ['colour']}, 'K'),
      (error: unknown) => error instanceof ModelStageRefusal &&
        /^K\.sceneReads\[0\] is one of depth/.test(error.message));
    assert.throws(() => modelSurfaceKind({...PULSE, sceneReads: ['depth', 'depth']}, 'K'),
      /K\.sceneReads lists depth twice/);
  });
  // The frame's own readers, at a size: the depth target exists only while a material that reads it is built.
  const stageAt = (size: THREE.Vector2, kinds: readonly object[]) => {
    const frame = createModelLinearFrame(size), acquired: unknown[] = [];
    const materials = createModelSurfaceMaterials({kinds: modelSurfaceKinds(kinds), shared: kindStage(new THREE.Scene())
      .shared, sceneReaders: frame.sceneReaders, changes: () => [],
    read: async () => new TextEncoder().encode(PULSE_PROGRAM).buffer,
    textures: {acquire: value => {acquired.push(value); return new THREE.Texture();}, release: () => undefined}});
    return {frame, materials, acquired, loaded: Promise.all(materials.load([checked()]).pending)};
  };
  it('is held by the materials that read it, from their build until they are freed, at the frame\'s size', async () => {
    const {frame, materials, loaded} = stageAt(DEPTH_HELD, [READING]);
    await loaded;
    const held = () => frame.depth;
    assert.equal(held(), null, 'no target before a reader is built');
    const surface = materials.material(checked());
    const depth = held();
    assert.deepEqual([depth?.width, depth?.height, depth?.samples], [DEPTH_HELD.x, DEPTH_HELD.y, 0]);
    materials.material(checked([0, 1, 0, 1]));
    assert.equal(held(), depth, 'one target for every reader');
    frame.resize(DEPTH_HELD.y, DEPTH_HELD.x);
    assert.deepEqual([depth?.width, depth?.height], [DEPTH_HELD.y, DEPTH_HELD.x], 'it follows the frame\'s size');
    materials.use(surface);
    materials.sweep();
    assert.equal(held(), depth, 'the one in use is kept');
    materials.dispose();
    assert.equal(held(), null);
    frame.dispose();
  });
  it('refuses, by name and holding nothing, a reader the frame\'s budget cannot hold at its size', async () => {
    const {frame, materials, acquired, loaded} = stageAt(DEPTH_OVER, [READING]);
    await loaded;
    const refused = (error: unknown) => error instanceof ModelStageRefusal &&
      error.message === budgetRefusal(DEPTH_OVER, 'withSceneDepth');
    assert.throws(() => materials.material(checked()), refused);
    assert.throws(() => materials.material(checked()), refused, 'nothing was kept of the first');
    assert.deepEqual([frame.depth, acquired.length], [null, 0]);
    frame.resize(DEPTH_OVER.x, DEPTH_OVER.y);
    frame.dispose();
  });
  it('holds a resize to the budget with the depth target only while it is held', async () => {
    const {frame, materials, loaded} = stageAt(DEPTH_HELD, [READING]);
    await loaded;
    materials.material(checked());
    assert.throws(() => frame.resize(DEPTH_OVER.x, DEPTH_OVER.y), (error: unknown) =>
      error instanceof ModelStageRefusal && error.message === budgetRefusal(DEPTH_OVER, 'withSceneDepth'));
    materials.dispose();
    frame.resize(DEPTH_OVER.x, DEPTH_OVER.y);
    frame.dispose();
  });
});
