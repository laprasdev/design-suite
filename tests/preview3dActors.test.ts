import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {applyModelFrame} from '../src/react/preview3d/actor.ts';
import {MODEL_REST_POSE, MODEL_STAGE_DRIVER, modelStageActors} from '../src/react/preview3d/model.ts';
import {actorContext, BIND, clipValue, entity, frame, layer, makeActor, sample, declaration}
  from './preview3dActorFixture.ts';

const CLIPS = [{name: 'run', duration: 2}, {name: 'walk', duration: 4}];
const pair = () => {
  const {context} = actorContext();
  return {a: makeActor('a', CLIPS, {}, context), b: makeActor('b', CLIPS, {placement: {position: [5, 0, 0]}}, context)};
};

describe('declared actors under one frame', () => {
  it('gives each named actor its own samples and pose in one call, and returns the frame time', () => {
    const {a, b} = pair();
    const time = applyModelFrame([a.actor, b.actor], frame(1.5,
      entity('a', [layer(sample('run', 1))], [1, 0, 0]), entity('b', [layer(sample('walk', 3))], [9, 0, 0])));
    assert.equal(time, 1.5);
    assert.equal(a.bone.position.x, clipValue(0, 1));
    assert.equal(b.bone.position.x, clipValue(1, 3));
    assert.deepEqual(a.actor.snapshot().samples, [sample('run', 1)]);
    assert.deepEqual(b.actor.snapshot().samples, [sample('walk', 3)]);
    assert.deepEqual([a.actor.snapshot().pose.position, b.actor.snapshot().pose.position], [[1, 0, 0], [9, 0, 0]]);
  });

  it('keeps an actor at its host placement until a record names it, then draws the record and refuses the host', () => {
    const {a, b} = pair();
    assert.deepEqual(b.actor.snapshot(), {id: 'b', modelId: 'otter', driver: MODEL_STAGE_DRIVER.host,
      held: MODEL_REST_POSE, samples: [],
      pose: {position: [5, 0, 0], rotationQuaternion: [0, 0, 0, 1], scale: [1, 1, 1]}});
    applyModelFrame([a.actor, b.actor], frame(0, entity('a')));
    assert.equal(b.actor.snapshot().driver, MODEL_STAGE_DRIVER.host);
    b.actor.setPlacement({position: [6, 0, 0]});
    applyModelFrame([a.actor, b.actor], frame(0.1, entity('b', [], [7, 0, 0])));
    assert.equal(b.actor.snapshot().driver, MODEL_STAGE_DRIVER.engine);
    assert.throws(() => b.actor.setPlacement({position: [8, 0, 0]}), /^ModelStageRefusal: Actor b is engine-driven/);
    assert.deepEqual(b.actor.snapshot().pose.position, [7, 0, 0]);
  });

  it('refuses a whole frame when one actor\'s clip is unknown, naming that actor and clip, and applies nothing', () => {
    const {a, b} = pair();
    assert.throws(() => applyModelFrame([a.actor, b.actor], frame(1,
      entity('a', [layer(sample('run', 1))], [1, 0, 0]), entity('b', [layer(sample('swim', 0))]))),
    /^ModelStageRefusal: Actor b: clip swim is not an animation in the model file/);
    const {driver, pose} = a.actor.snapshot();
    assert.deepEqual([driver, pose.position], [MODEL_STAGE_DRIVER.host, [0, 0, 0]]);
    assert.deepEqual(a.bone.position.toArray(), [...BIND]);
  });

  it('refuses a frame naming an undeclared actor, an actor twice, a removal or another model, applying nothing', () => {
    const {a, b} = pair();
    const named = entity('a', [layer(sample('run', 1))], [1, 0, 0]);
    const refusals: Array<[unknown, RegExp]> = [
      [frame(0, named, entity('ghost')), /Frame entity ghost names no declared actor/],
      [frame(0, named, named), /Frame entity a appears twice/],
      [{...frame(0, named), removedEntities: [{entityId: 'b'}]}, /removedEntities must be empty/],
      [frame(0, named, entity('b', [], [0, 0, 0], 'heron')), /modelId must match/],
      [frame(-1, named), /simulationTimeSeconds/],
      [frame(0, {...named, partPoses: [{}]}), /partPoses/],
    ];
    for (const [value, pattern] of refusals) {
      assert.throws(() => applyModelFrame([a.actor, b.actor], value), pattern);
      assert.equal(a.actor.snapshot().driver, MODEL_STAGE_DRIVER.host);
    }
  });

  it('shows a declared held clip at its first frame until samples play, and again on []', () => {
    const {a, b} = pair(), held = makeActor('h', CLIPS, {heldAnimation: 'walk'});
    assert.equal(held.bone.position.x, clipValue(1, 0));
    assert.equal(held.actor.snapshot().held, 'walk');
    applyModelFrame([held.actor], frame(0, entity('h', [layer(sample('run', 1))])));
    assert.equal(held.bone.position.x, clipValue(0, 1));
    applyModelFrame([held.actor], frame(0.1, entity('h')));
    assert.equal(held.bone.position.x, clipValue(1, 0));
    applyModelFrame([a.actor, b.actor], frame(0, entity('a', [layer(sample('run', 1))])));
    applyModelFrame([a.actor, b.actor], frame(0.1, entity('a')));
    assert.deepEqual(a.bone.position.toArray(), [...BIND]);
  });

  it('refuses a held clip the file lacks as soon as the asset loads, naming the actor', () => {
    const {context, scene} = actorContext();
    assert.throws(() => makeActor('h', CLIPS, {heldAnimation: 'swim'}, context),
      /^ModelStageRefusal: Actor h: clip swim/);
    assert.equal(scene.children.length, 0);
  });

  it('accepts an asset with no skeleton and no clips, drawn at rest', () => {
    const {actor} = makeActor('still', []);
    assert.deepEqual(actor.snapshot().samples, []);
    applyModelFrame([actor], frame(0, entity('still', [], [1, 2, 3])));
    assert.deepEqual(actor.snapshot().pose.position, [1, 2, 3]);
  });
});

describe('declared actor sets', () => {
  const asset = declaration('x').asset;
  it('validates the whole set: unique ids apart from the character and whole placements', () => {
    const valid = modelStageActors([{id: 'a', asset, placement: {scale: [1, 2, 3]}}], 'otter');
    assert.deepEqual(valid[0].placement, {scale: [1, 2, 3]});
    const refusals: Array<[unknown, RegExp]> = [
      [[{id: 'a', asset, placement: {}}, {id: 'a', asset, placement: {}}], /Actor a is declared twice/],
      [[{id: 'otter', asset, placement: {}}], /repeats the stage's own character/],
      [[{id: 'a', asset, placement: {scale: [2, 2]}}], /scale must contain 3/],
      [[{id: 'a', asset, placement: {rotationQuaternion: [0, 0, 0, 2]}}], /unit length/],
      [[{id: 'a', asset, placement: {}, heldAnimation: ''}], /heldAnimation must name a clip/],
      [[{id: 'a', asset: {id: 'x'}, placement: {}}], /Actor 0 requires/], [{}, /must be an array/],
    ];
    for (const [value, pattern] of refusals) assert.throws(() => modelStageActors(value, 'otter'), pattern);
  });
});
