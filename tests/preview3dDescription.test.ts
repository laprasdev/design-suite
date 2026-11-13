import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelFog} from '../src/react/preview3d/fog.ts';
const FOG = createModelFog(new THREE.Scene()).change;
const MODES = () => createModelSurfaceModes();
import {createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import {MODEL_STAGE_COMMIT_TEXT, prepareWhole} from '../src/react/preview3d/commit.ts';
import {modelStageDescription, modelStageDescriptionChanges, modelStageRefit}
  from '../src/react/preview3d/descriptionModel.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {applyModelFrame} from '../src/react/preview3d/actor.ts';
import {ModelStageRefusal} from '../src/react/preview3d/model.ts';
import type {ModelStageController, ModelStageFraming} from '../src/react/preview3d/model.ts';
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
    for (const part of ['actors', 'environment', 'framing', 'orbit', 'lighting', 'display', 'materialMode', 'size',
      'origin'] as const) {
      const value: Record<string, unknown> = describing();
      delete value[part];
      assert.throws(() => modelStageDescription(value), new RegExp(`The stage description omits ${part}\\.`));
    }
    // A part the description does not have, such as a misspelt one, is refused by name rather than dropped.
    assert.throws(() => modelStageDescription({...describing(), lightning: {}}),
      /The stage description does not state lightning; it states actors, environment/);
    assert.throws(() => modelStageDescription(describing({display: 'xray'})), /Unknown stage display/);
    assert.deepEqual(modelStageDescription(describing({size: {rule: 'normalized', height: 2}})).size,
      {rule: 'normalized', height: 2});
    const sizes: Array<[unknown, RegExp]> = [[{rule: 'normalized'}, /The stage size omits height/],
      [{rule: 'normalized', height: 0}, /The stage size.height must be greater than 0/],
      [{rule: 'normalized', height: Infinity}, /The stage size.height must be a finite number/],
      [{rule: 'real', height: 2}, /The stage size does not state height; it states rule\./],
      [{rule: 'normalized', height: 2, scale: 1}, /The stage size does not state scale/],
      [{rule: 'actual'}, /The stage size states its rule, one of real, normalized/],
      [null, /The stage size states its rule/], [2, /The stage size states its rule/]];
    for (const [size, refusal] of sizes) {
      assert.throws(() => modelStageDescription(describing({size})), refusal);
    }
    // An asset states what the stage reads and nothing else: a stray field, such as an old attachments map, is refused.
    assert.throws(() => modelStageDescription(describing({actors: {focus: 'a', actors: [
      {...declaration('a'), asset: {id: 'otter', path: 'otter.glb', attachments: {}}}]}})),
    /Actor a.asset does not state attachments; it states id, path\./);
    const pose = (target: number[]) => ({framing: {kind: 'pose', position: [0, 0, 0], target}});
    assert.throws(() => modelStageDescription(describing(pose([0, 0, 0]))), /distinct/);
    assert.deepEqual(modelStageDescription(describing(pose([0, 0, 1]))).framing,
      {kind: 'pose', position: [0, 0, 0], target: [0, 0, 1]});
    const framings: Array<[unknown, RegExp]> = [[null, /The framing states its kind, one of focus, all, pose/],
      [{kind: 'fit'}, /The framing states its kind/],
      [{kind: 'focus', position: [0, 0, 0]}, /The framing does not state position; it states kind\./],
      [{kind: 'pose', position: [0, 0, 0]}, /The framing omits target/]];
    for (const [framing, refusal] of framings) {
      assert.throws(() => modelStageDescription(describing({framing})), refusal);
    }
    for (const orbit of [undefined, 1, 'yes']) {
      assert.throws(() => modelStageDescription(describing({orbit})), /orbit is stated as true or false/);
    }
    for (const origin of [undefined, 'floor', true]) {
      assert.throws(() => modelStageDescription(describing({origin})), /^ModelStageRefusal: A stage origin is one of/);
    }
  });

  it('names only the parts that change, and none for an equal description', () => {
    const applied = modelStageDescription(describing());
    assert.deepEqual([...modelStageDescriptionChanges(undefined, applied)].length, 10);
    assert.deepEqual([...modelStageDescriptionChanges(applied, modelStageDescription(describing()))], []);
    const relit = modelStageDescription(describing({lighting: {time: 'dark', times: []}}));
    assert.deepEqual([...modelStageDescriptionChanges(applied, relit)], ['lighting']);
  });

  it('refits for what the fit measures, and not for lighting, playing, orbit or an unframed actor', () => {
    const applied = modelStageDescription(describing());
    const refit = (changes: Parameters<typeof describing>[0]) => modelStageRefit(applied,
      modelStageDescription(describing(changes)));
    assert.equal(modelStageRefit(undefined, applied), true);
    assert.equal(refit({display: 'rig'}), true);
    assert.equal(refit({size: {rule: 'normalized', height: 2}}), true);
    assert.equal(refit({actors: {focus: 'a', actors: [declaration('a', 'otter', {animation: held('run', 0)})]}}), true);
    assert.equal(refit({actors: {focus: 'a', actors: [declaration('a', 'heron')]}}), true);
    assert.equal(refit({lighting: {time: 'dark', times: []}}), false);
    assert.equal(refit({orbit: false}), false);
    assert.equal(refit({origin: 'centred'}), true);
    assert.equal(refit({framing: {kind: 'all'}}), true);
    // A placement of a fitted actor refits; an actor the framing does not fit changes nothing.
    assert.equal(refit({actors: {focus: 'a', actors: [declaration('a', 'otter',
      {placement: {...STANDING, position: [1, 0, 0]}})]}}), true);
    const pair = {actors: {focus: 'a', actors: [declaration('a'), declaration('b')]}};
    const both = modelStageDescription(describing(pair));
    const elsewhere = {actors: {focus: 'a', actors: [declaration('a'),
      declaration('b', 'otter', {placement: {...STANDING, position: [5, 0, 0]}})]}};
    assert.equal(modelStageRefit(both, modelStageDescription(describing(elsewhere))), false);
    assert.equal(modelStageRefit(modelStageDescription(describing({...pair, framing: {kind: 'all'}})),
      modelStageDescription(describing({...elsewhere, framing: {kind: 'all'}}))), true);
    const running = (animation: unknown) => ({actors: {focus: 'a', actors: [declaration('a', 'otter',
      {animation} as object)]}});
    assert.equal(modelStageRefit(modelStageDescription(describing(running(playing('run')))),
      modelStageDescription(describing(running(held('run', 0.5))))), false);
  });
});

describe('the stage-wide parts', () => {
  const surface = () => {
    const calls: string[] = [];
    const parts = createModelStageParts({textures: {load: () => [], keep: () => undefined},
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
    const parts = createModelStageParts({textures: {load: () => [], keep: () => undefined},
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
    assert.deepEqual([a.sizing.size, b.sizing.size], [sized(4).size, sized(4).size]);
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
    assert.equal(context.surfaceModes.mode, 'lit');
  });
});
