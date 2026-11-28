// A kind reads what presses the ground only by declaring it: its program gains the read in both stages, a material of
// it draws no target for it, and the stage carries each frame entity's stated presser, at the entity's pose position,
// into the uniforms every kind material holds, refusing by name a presser it cannot read or a frame over its budget.
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {checkModelGroundPresserBudget, createModelGroundPressers, MODEL_GROUND_PRESSER_BUDGET,
  MODEL_GROUND_PRESSER_REFUSAL, MODEL_GROUND_PRESSERS, modelGroundPresser, type ModelPressingEntity}
  from '../src/react/preview3d/groundPressers.ts';
import {MODEL_SURFACE_SCENE_READ, modelSurfaceKind, modelSurfaceKinds}
  from '../src/react/preview3d/surfaceKindModel.ts';
import {createModelSurfaceProgram} from '../src/react/preview3d/surfaceProgram.ts';
import {createModelSurfaceMaterials} from '../src/react/preview3d/surfaceMaterials.ts';
import {modelSurfaceRecord} from '../src/react/preview3d/surfaceModel.ts';
import {createModelLinearFrame} from '../src/react/preview3d/linearFrame.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {kindStage, PULSE, PULSE_PROGRAM, record} from './preview3dKindFixture.ts';
import {actorContext, applyFrame, entity as frameEntity, frame, FRAME_PRESSERS, makeActor}
  from './preview3dActorFixture.ts';
import {DEPTH_HELD} from './preview3dFrameBudgetCases.ts';

const READING = Object.freeze({...PULSE, sceneReads: [MODEL_SURFACE_SCENE_READ.pressers]});
const ARRAY = `uniform vec4 ${MODEL_GROUND_PRESSERS.pressers}[ ${MODEL_GROUND_PRESSER_BUDGET.pressers} ];`;
const built = (kind: object) => {
  const {shared} = kindStage(new THREE.Scene());
  return createModelSurfaceProgram(modelSurfaceKind(kind, 'K'), PULSE_PROGRAM, shared.declarations);
};
const entity = (position: readonly [number, number, number], radius: number | null): ModelPressingEntity =>
  Object.freeze({pose: {position}, presser: radius === null ? null : modelGroundPresser({radius}, 'E')});
const refusing = (message: string) => (error: unknown) => error instanceof ModelStageRefusal &&
  error.message === message;

describe('the ground pressers a kind reads', () => {
  it('are declared once in each stage of a kind that reads them, and in no program of a kind that does not', () => {
    const reading = built(READING), not = built(PULSE);
    for (const source of [reading.vertexShader, reading.fragmentShader]) assert.equal(source.split(ARRAY).length, 2);
    for (const source of [not.vertexShader, not.fragmentShader]) {
      assert.ok(!source.includes(MODEL_GROUND_PRESSERS.pressers) && !source.includes(MODEL_GROUND_PRESSERS.count));
    }
  });
  it('draw no frame target for a material that reads them', async () => {
    const frame = createModelLinearFrame(DEPTH_HELD), shared = kindStage(new THREE.Scene()).shared;
    const materials = createModelSurfaceMaterials({kinds: modelSurfaceKinds([READING]), shared,
      sceneReaders: frame.sceneReaders, changes: () => [],
      read: async () => new TextEncoder().encode(PULSE_PROGRAM).buffer,
      textures: {acquire: () => new THREE.Texture(), release: () => undefined}});
    const checked = modelSurfaceRecord(record(), 'R');
    await Promise.all(materials.load([checked]).pending);
    const surface = materials.material(checked);
    assert.equal(frame.depth, null);
    const {pressers} = MODEL_GROUND_PRESSERS;
    assert.equal(surface.material.uniforms[pressers], shared.uniforms[pressers], 'one uniform for all');
    materials.dispose();
    frame.dispose();
  });
  it('carry each stated presser at its entity\'s pose position, in the frame\'s order, and their count', () => {
    const pressers = createModelGroundPressers();
    pressers.write([entity([1, 2, 3], 0.25), entity([9, 9, 9], null), entity([-4, 0.5, 6], 0.5)]);
    const values = pressers.uniforms[MODEL_GROUND_PRESSERS.pressers].value;
    assert.deepEqual([...values.subarray(0, 8)], [1, 2, 3, 0.25, -4, 0.5, 6, 0.5]);
    assert.equal(pressers.uniforms[MODEL_GROUND_PRESSERS.count].value, 2);
    pressers.write([entity([0, 0, 0], null)]);
    assert.equal(pressers.uniforms[MODEL_GROUND_PRESSERS.count].value, 0, 'a frame that states none presses nothing');
  });
  it('refuse a presser whose radius is not a positive finite number, or that states another field', () => {
    for (const radius of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
      assert.throws(() => modelGroundPresser({radius}, 'Entity E presser'),
        refusing(MODEL_GROUND_PRESSER_REFUSAL.radius('Entity E presser')));
    }
    assert.throws(() => modelGroundPresser({radius: 1, height: 2}, 'Entity E presser'), ModelStageRefusal);
  });
  it('refuse, by the budget\'s name, a frame that states more than the budget carries', () => {
    const most = MODEL_GROUND_PRESSER_BUDGET.pressers;
    const pressing = (count: number) => Array.from({length: count}, () => entity([0, 0, 0], 1));
    checkModelGroundPresserBudget(pressing(most));
    assert.throws(() => checkModelGroundPresserBudget(pressing(most + 1)),
      refusing(MODEL_GROUND_PRESSER_REFUSAL.budget(most + 1)));
  });
  it('are written by applying a frame, from each entity\'s presser at its pose, into the uniforms kinds hold', () => {
    const {context} = actorContext(), actors = ['a', 'b'].map(id => makeActor(id, [], {}, context).actor);
    applyFrame(actors, frame(0, {...frameEntity('a', [], [1, 2, 3]), presser: {radius: 0.25}},
      frameEntity('b', [], [4, 5, 6])));
    const {pressers, count} = MODEL_GROUND_PRESSERS;
    assert.deepEqual([...FRAME_PRESSERS.uniforms[pressers].value.subarray(0, 4)], [1, 2, 3, 0.25]);
    assert.equal(FRAME_PRESSERS.uniforms[count].value, 1);
  });
  it('are left as they were, with every pose, by a frame refused over the budget', () => {
    const {context} = actorContext(), most = MODEL_GROUND_PRESSER_BUDGET.pressers;
    const ids = Array.from({length: most + 1}, (_, index) => `e${index}`);
    const actors = ids.map(id => makeActor(id, [], {}, context).actor);
    applyFrame(actors, frame(0, {...frameEntity(ids[0], [], [1, 0, 0]), presser: {radius: 0.5}}));
    const {pressers, count} = MODEL_GROUND_PRESSERS, before = [...FRAME_PRESSERS.uniforms[pressers].value];
    const over = frame(1, ...ids.map(id => ({...frameEntity(id, [], [9, 9, 9]), presser: {radius: 1}})));
    assert.throws(() => applyFrame(actors, over), refusing(MODEL_GROUND_PRESSER_REFUSAL.budget(most + 1)));
    assert.deepEqual([...FRAME_PRESSERS.uniforms[pressers].value], before);
    assert.equal(FRAME_PRESSERS.uniforms[count].value, 1);
    assert.deepEqual(actors.map(actor => actor.snapshot().pose.position[0]), ids.map((_, index) => index ? 0 : 1));
  });
});
