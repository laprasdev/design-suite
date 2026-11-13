import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_STAGE_COMMIT_TEXT, prepareWhole} from '../src/react/preview3d/commit.ts';
import {modelStageDescription, modelStageDescriptionChanges, modelStageRefit}
  from '../src/react/preview3d/descriptionModel.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {applyModelFrame} from '../src/react/preview3d/actor.ts';
import {ModelStageRefusal} from '../src/react/preview3d/model.ts';
import type {ModelStageCamera, ModelStageController} from '../src/react/preview3d/model.ts';
import {actorContext, close, declaration, describing, entity, frame, held, makeActor, playing, STANDING}
  from './preview3dActorFixture.ts';

// The controller is one description, one frame, one read and one action. Adding an actor, a scene or a kind of
// scenery is data in the description: this list cannot grow without failing the compile.
const CONTROLLER = ['setDescription', 'setFrame', 'resetCamera', 'snapshot'] as const;
type Exactly<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
const exact: Exactly<keyof ModelStageController, typeof CONTROLLER[number]> = true;

const box = (id: string) => ({id, position: [0, 0, 0], size: [1, 1, 1], color: [.5, .5, .5]});
describe('one whole-or-refused owner', () => {
  it('runs every prepare before any commit, and reports a commit that throws as a partial apply', () => {
    const order: string[] = [];
    const refused = new ModelStageRefusal('no');
    assert.throws(() => prepareWhole([() => {order.push('a'); return () => order.push('A');},
      () => {throw refused;}]), error => error === refused);
    assert.deepEqual(order, ['a']);
    const partial = prepareWhole([() => () => order.push('B'), () => () => {throw refused;}]);
    assert.throws(partial, (error: unknown) => !(error instanceof ModelStageRefusal) &&
      error instanceof Error && error.message === MODEL_STAGE_COMMIT_TEXT.partial && error.cause === refused);
  });
});

describe('the stage description', () => {
  it('holds a second character, a second scene and every scenery box as data, and refuses a missing part', () => {
    const two = modelStageDescription(describing({environment: {reflectZ: false, plane: null,
      boxes: [box('ramp'), box('goal')]}, actors: {focus: 'b', actors: [declaration('a'), declaration('b')]}}));
    assert.deepEqual([two.actors.actors.map(({id}) => id), two.environment?.boxes.length], [['a', 'b'], 2]);
    for (const part of ['actors', 'environment', 'camera', 'lighting', 'display', 'materialMode', 'size'] as const) {
      const value: Record<string, unknown> = describing();
      delete value[part];
      assert.throws(() => modelStageDescription(value), /requires actors, environment, camera/);
    }
    assert.throws(() => modelStageDescription(describing({display: 'xray'})), /Unknown stage display/);
    assert.deepEqual(modelStageDescription(describing({size: {rule: 'normalized', height: 2}})).size,
      {rule: 'normalized', height: 2});
    for (const size of [{rule: 'normalized'}, {rule: 'normalized', height: 0}, {rule: 'normalized', height: Infinity},
      {rule: 'real', height: 2}, {rule: 'normalized', height: 2, scale: 1}, {rule: 'actual'}, null, 2]) {
      assert.throws(() => modelStageDescription(describing({size})), /^ModelStageRefusal: A stage size is/);
    }
    assert.throws(() => modelStageDescription(describing({camera: {position: [0, 0, 0], target: [0, 0, 0]}})),
      /distinct/);
  });

  it('names only the parts that change, and none for an equal description', () => {
    const applied = modelStageDescription(describing());
    assert.deepEqual([...modelStageDescriptionChanges(undefined, applied)].length, 7);
    assert.deepEqual([...modelStageDescriptionChanges(applied, modelStageDescription(describing()))], []);
    assert.deepEqual([...modelStageDescriptionChanges(applied, modelStageDescription(describing({lighting: 'dark'})))],
      ['lighting']);
  });

  it('refits for a new focus, asset, clip or display, and not for lighting, playing or placement', () => {
    const applied = modelStageDescription(describing());
    const refit = (changes: Parameters<typeof describing>[0]) => modelStageRefit(applied,
      modelStageDescription(describing(changes)));
    assert.equal(modelStageRefit(undefined, applied), true);
    assert.equal(refit({display: 'rig'}), true);
    assert.equal(refit({size: {rule: 'normalized', height: 2}}), true);
    assert.equal(refit({actors: {focus: 'a', actors: [declaration('a', 'otter', {animation: held('run', 0)})]}}), true);
    assert.equal(refit({actors: {focus: 'a', actors: [declaration('a', 'heron')]}}), true);
    assert.equal(refit({lighting: 'dark'}), false);
    const running = (animation: unknown) => ({actors: {focus: 'a', actors: [declaration('a', 'otter',
      {animation} as object)]}});
    assert.equal(modelStageRefit(modelStageDescription(describing(running(playing('run')))),
      modelStageDescription(describing(running(held('run', 0.5))))), false);
    const moved = declaration('a', 'otter', {placement: {...STANDING, position: [1, 0, 0]}});
    assert.equal(refit({actors: {focus: 'a', actors: [moved]}}), false);
  });
});

describe('the stage-wide parts', () => {
  const surface = () => {
    const calls: string[] = [];
    const parts = createModelStageParts({scene: new THREE.Scene(), lighting: {set: value => calls.push(value)},
      setCamera: (value: ModelStageCamera) => calls.push(`hold ${value.position}`),
      resetCamera: () => calls.push('fit')});
    return {calls, parts};
  };
  const CLIPS = [{name: 'run', duration: 1}];
  it('prepares nothing for an equal description, and only what a change names', () => {
    const {calls, parts} = surface(), {actor} = makeActor('a', CLIPS);
    const applied = modelStageDescription(describing());
    assert.deepEqual(parts.prepares(applied, modelStageDescriptionChanges(applied, applied), [actor]), []);
    const darker = modelStageDescription(describing({lighting: 'dark'}));
    prepareWhole(parts.prepares(darker, modelStageDescriptionChanges(applied, darker), [actor]))();
    assert.deepEqual(calls, ['dark']);
  });

  it('returns an orbited view to the described camera: a held pose, or a fresh fit', () => {
    const {calls, parts} = surface();
    parts.resetCamera(modelStageDescription(describing({camera: {position: [0, 2, 4], target: [0, 0, 0]}})));
    parts.resetCamera(modelStageDescription(describing()));
    assert.deepEqual(calls, ['hold 0,2,4', 'fit']);
    assert.equal(exact, true);
  });

  it('sizes every actor whose size differs by the one rule, its joints with it, and leaves the rest', () => {
    const {parts} = surface(), {context} = actorContext();
    const {actor: a} = makeActor('a', CLIPS, {}, context), {actor: b} = makeActor('b', CLIPS, {}, context);
    const applied = modelStageDescription(describing());
    const sized = (height: number) => modelStageDescription(describing({size: {rule: 'normalized', height}}));
    const apply = (next: ReturnType<typeof sized>) =>
      prepareWhole(parts.prepares(next, modelStageDescriptionChanges(applied, next), [a, b]))();
    a.setDisplay('rig');
    const bounds = () => [...a.rig.bounds().min.toArray(), ...a.rig.bounds().max.toArray()];
    apply(sized(2));
    const two = bounds();
    apply(sized(4));
    bounds().forEach((value, index) => close(value, two[index] * 2));
    a.rig.update();
    const joints = a.rig.root.children.find(node => node instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    joints.getMatrixAt(0, matrix);
    close(new THREE.Vector3().setFromMatrixScale(matrix).x, 4);
    assert.deepEqual([a.size, b.size], [sized(4).size, sized(4).size]);
    assert.deepEqual(parts.prepares(sized(4), modelStageDescriptionChanges(applied, sized(4)), [a, b]).length, 0);
  });

  it('refuses an inspection surface while an actor is engine-driven, before any actor changes', () => {
    const {parts} = surface(), {context} = actorContext();
    const {actor: a} = makeActor('a', CLIPS, {}, context), {actor: b} = makeActor('b', CLIPS, {}, context);
    applyModelFrame([a, b], frame(0, entity('a')));
    const applied = modelStageDescription(describing());
    const clay = modelStageDescription(describing({materialMode: 'clay'}));
    assert.throws(() => prepareWhole(parts.prepares(clay, modelStageDescriptionChanges(applied, clay), [a, b])),
      /requires lit materials/);
    assert.deepEqual([a, b].map(actor => actor.materials.snapshot().materialMode), ['lit', 'lit']);
  });
});
