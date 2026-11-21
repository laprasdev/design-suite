import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import {prepareWhole} from '../src/react/preview3d/commit.ts';
import {modelStageDescription, modelStageDescriptionChanges} from '../src/react/preview3d/descriptionModel.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {ModelStageRefusal} from '../src/react/preview3d/model.ts';
import type {ModelStageController, ModelStageFraming} from '../src/react/preview3d/model.ts';
import {NO_FILES, applyFrame, actorContext, close, describing, entity, frame, makeActor}
  from './preview3dActorFixture.ts';

// The stage-wide parts a description changes, each prepared beside the actors and applied whole or refused.
const FOG = createModelFog(new THREE.Scene()).change;
const MODES = () => createModelSurfaceModes();
// The controller is one description, one frame, one read and one action. Adding an actor, a scene or a kind of
// scenery is data in the description: this list cannot grow without failing the compile.
const CONTROLLER = ['setDescription', 'setFrame', 'resetCamera', 'snapshot'] as const;
type Exactly<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
const exact: Exactly<keyof ModelStageController, typeof CONTROLLER[number]> = true;

describe('the stage-wide parts', () => {
  const surface = () => {
    const calls: string[] = [];
    const parts = createModelStageParts({...NO_FILES,
      scene: new THREE.Scene(), fog: {change: FOG}, kinds: new Map(), modes: MODES(),
      lighting: {load: () => [], prepare: value => () => {calls.push(value.time);}},
      frame: (framing: ModelStageFraming, orbit: boolean) => calls.push(`${framing.kind} ${orbit}`)});
    return {calls, parts};
  };
  const CLIPS = [{name: 'run', duration: 1}];
  it('prepares nothing for an equal description, and only what a change names', () => {
    const {calls, parts} = surface(), {actor} = makeActor('a', CLIPS);
    const applied = modelStageDescription(describing());
    assert.deepEqual(parts.prepares(applied, modelStageDescriptionChanges(applied, applied), [actor]), []);
    const darker = modelStageDescription(describing({lighting: {time: 'dark', times: []}}));
    prepareWhole(parts.prepares(darker, modelStageDescriptionChanges(applied, darker), [actor]))();
    assert.deepEqual(calls, ['dark']);
  });

  it('refuses a lighting while preparing, so a refused time leaves every other part unapplied', () => {
    const calls: string[] = [];
    const parts = createModelStageParts({...NO_FILES,
      scene: new THREE.Scene(), fog: {change: FOG}, kinds: new Map(), modes: MODES(),
      lighting: {load: () => [],
        prepare: () => {throw new ModelStageRefusal('Time t: look.glow: glow needs half-float render targets.');}},
    frame: (framing: ModelStageFraming) => calls.push(framing.kind)});
    const applied = modelStageDescription(describing());
    const next = modelStageDescription(describing({lighting: {time: 'dark', times: []}, framing: {kind: 'all'}}));
    assert.throws(() => prepareWhole(parts.prepares(next, modelStageDescriptionChanges(applied, next), []))(),
      (error: unknown) => error instanceof ModelStageRefusal && /half-float/.test(error.message));
    assert.deepEqual(calls, []);
  });

  it('returns an orbited view to the described framing, with the described orbit', () => {
    const {calls, parts} = surface();
    parts.resetCamera(modelStageDescription(describing({framing: {kind: 'pose', position: [0, 2, 4],
      target: [0, 0, 0]}, orbit: true})));
    parts.resetCamera(modelStageDescription(describing({orbit: false})));
    assert.deepEqual(calls, ['pose true', 'focus false']);
    assert.equal(exact, true);
  });

  it('sizes every actor whose size differs by the one rule, its joints with it, and leaves the rest', () => {
    const {parts} = surface(), {context} = actorContext();
    const {actor: a} = makeActor('a', CLIPS, {}, context), {actor: b} = makeActor('b', CLIPS, {}, context);
    const applied = modelStageDescription(describing());
    // Shown in the Rig display: a hidden rig moves nothing (rig.ts), so its joints are read where they are drawn.
    const sized = (height: number) => modelStageDescription(describing({size: {rule: 'normalized', height},
      display: 'rig'}));
    const apply = (next: ReturnType<typeof sized>) =>
      prepareWhole(parts.prepares(next, modelStageDescriptionChanges(applied, next), [a, b]))();
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
    assert.deepEqual([a.sizing.size, b.sizing.size], [sized(4).size, sized(4).size]);
    assert.deepEqual(parts.prepares(sized(4), modelStageDescriptionChanges(applied, sized(4)), [a, b]).length, 0);
  });

  it('refuses an inspection surface while an actor is engine-driven, before any actor changes', () => {
    const {parts} = surface(), {context} = actorContext();
    const {actor: a} = makeActor('a', CLIPS, {}, context), {actor: b} = makeActor('b', CLIPS, {}, context);
    applyFrame([a, b], frame(0, entity('a')));
    const applied = modelStageDescription(describing());
    const clay = modelStageDescription(describing({surfaceMode: 'clay'}));
    assert.throws(() => prepareWhole(parts.prepares(clay, modelStageDescriptionChanges(applied, clay), [a, b])),
      /requires lit materials/);
    assert.equal(context.surfaceModes.inspecting, false);
  });
});
