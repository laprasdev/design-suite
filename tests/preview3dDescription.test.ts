import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {MODEL_STAGE_COMMIT_TEXT, prepareWhole} from '../src/react/preview3d/commit.ts';
import {modelStageDescription, modelStageDescriptionChanges, modelStageRefit}
  from '../src/react/preview3d/descriptionModel.ts';
import {ModelStageRefusal} from '../src/react/preview3d/model.ts';
import {declaration, describing, held, playing, STANDING} from './preview3dActorFixture.ts';

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
    for (const part of ['actors', 'environment', 'framing', 'orbit', 'lighting', 'display', 'surfaceMode', 'size',
      'origin'] as const) {
      const value: Record<string, unknown> = describing();
      delete value[part];
      assert.throws(() => modelStageDescription(value),
        new RegExp(`The stage description omits ${part}; it states actors, `));
    }
    // A part the description does not have, such as a misspelt one, is refused by name rather than dropped.
    assert.throws(() => modelStageDescription({...describing(), lightning: {}}),
      /The stage description does not state lightning; it states actors, environment/);
    assert.throws(() => modelStageDescription(describing({display: 'xray'})),
      /The stage description.display is one of model, rig, both/);
    assert.deepEqual(modelStageDescription(describing({size: {rule: 'normalized', height: 2}})).size,
      {rule: 'normalized', height: 2});
    const sizes: Array<[unknown, RegExp]> = [[{rule: 'normalized'}, /The stage size omits height/],
      [{rule: 'normalized', height: 0}, /The stage size.height must be greater than 0/],
      [{rule: 'normalized', height: Infinity}, /The stage size.height must be a finite number/],
      [{rule: 'real', height: 2}, /The stage size does not state height; it states rule\./],
      [{rule: 'normalized', height: 2, scale: 1}, /The stage size does not state scale/],
      [{rule: 'actual'}, /The stage size.rule is one of real, normalized/],
      [null, /The stage size.rule is one of/], [2, /The stage size.rule is one of/]];
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
    const framings: Array<[unknown, RegExp]> = [[null, /The framing.kind is one of focus, all, pose/],
      [{kind: 'fit'}, /The framing.kind is one of/],
      [{kind: 'focus', position: [0, 0, 0]}, /The framing does not state position; it states kind\./],
      [{kind: 'pose', position: [0, 0, 0]}, /The framing omits target/]];
    for (const [framing, refusal] of framings) {
      assert.throws(() => modelStageDescription(describing({framing})), refusal);
    }
    for (const orbit of [undefined, 1, 'yes']) {
      assert.throws(() => modelStageDescription(describing({orbit})), /orbit is stated as true or false/);
    }
    for (const origin of [undefined, 'floor', true]) {
      assert.throws(() => modelStageDescription(describing({origin})),
        /^ModelStageRefusal: The stage description.origin is one of file, centred/);
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
