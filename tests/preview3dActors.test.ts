import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {applyModelFrame, modelRenderableVisible} from '../src/react/preview3d/actor.ts';
import {MODEL_REST_POSE, MODEL_STAGE_DRIVER, MODEL_STAGE_ORIGIN, MODEL_STAGE_SIZE, modelStageActorSet}
  from '../src/react/preview3d/model.ts';
import {actorContext, BIND, clipValue, declaration, entity, frame, held, layer, makeActor, playing, REST, sample,
  STANDING, standingAt} from './preview3dActorFixture.ts';

const CLIPS = [{name: 'run', duration: 2}, {name: 'walk', duration: 4}];
const pair = () => {
  const {context} = actorContext();
  return {a: makeActor('a', CLIPS, {}, context), b: makeActor('b', CLIPS, {placement: standingAt([5, 0, 0])}, context)};
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

  it('keeps an actor at its declared placement until a record names it, then draws the record', () => {
    const {a, b} = pair();
    assert.deepEqual(b.actor.snapshot(), {id: 'b', modelId: 'otter', driver: MODEL_STAGE_DRIVER.host,
      animation: MODEL_REST_POSE, samples: [],
      pose: {position: [5, 0, 0], rotationQuaternion: [0, 0, 0, 1], scale: [1, 1, 1]}});
    applyModelFrame([a.actor, b.actor], frame(0, entity('a')));
    assert.equal(b.actor.snapshot().driver, MODEL_STAGE_DRIVER.host);
    b.actor.prepareHost(declaration('b', 'otter', {placement: standingAt([6, 0, 0])}))();
    assert.deepEqual(b.actor.snapshot().pose.position, [6, 0, 0]);
    applyModelFrame([a.actor, b.actor], frame(0.1, entity('b', [], [7, 0, 0])));
    assert.equal(b.actor.snapshot().driver, MODEL_STAGE_DRIVER.engine);
    assert.deepEqual(b.actor.snapshot().pose.position, [7, 0, 0]);
  });

  it('writes each renderable\'s one visible value from the authored value, the display and the engine', () => {
    for (const authored of [true, false]) for (const display of ['model', 'rig', 'both'] as const) {
      for (const engineHidden of [true, false]) {
        assert.equal(modelRenderableVisible(authored, display, engineHidden),
          authored && display !== 'rig' && !engineHidden);
      }
    }
    const {a} = pair(), {context} = actorContext();
    // Built at its file's own size and origin; a description's origin centres it over its placement.
    const centred = makeActor('c', CLIPS, {}, context);
    assert.equal(centred.actor.asset.scene.position.y, 0);
    centred.actor.setSizing({size: {rule: MODEL_STAGE_SIZE.real}, origin: MODEL_STAGE_ORIGIN.centred});
    assert.equal(centred.actor.asset.scene.position.y, 0.5);
    a.actor.setDisplay('rig');
    assert.equal(a.body.visible, false);
    a.actor.setDisplay('both');
    assert.equal(a.body.visible, true);
  });

  it('takes a declared placement whole, and refuses one that omits a component, naming the actor and component', () => {
    const {b} = pair();
    b.actor.prepareHost(declaration('b', 'otter', {placement: {...STANDING, scale: [2, 2, 2]}}))();
    assert.deepEqual([b.actor.snapshot().pose.position, b.actor.snapshot().pose.scale], [[0, 0, 0], [2, 2, 2]]);
    for (const component of ['position', 'rotationQuaternion', 'scale'] as const) {
      const {[component]: omitted, ...partial} = STANDING;
      assert.ok(omitted);
      assert.throws(() => modelStageActorSet({focus: 'b', actors: [{...declaration('b'), placement: partial}]}),
        new RegExp(`^ModelStageRefusal: Actor b placement: the pose omits ${component}`));
    }
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
      [frame(0, named, entity('b', [], [0, 0, 0], 'heron')), /Entity b: modelId must match the declared model otter/],
      [frame(-1, named), /simulationTimeSeconds/],
      [frame(0, {...named, partPoses: [{}]}), /partPoses/],
      [frame(0, {...named, entityId: ''}), /requires an entityId/],
    ];
    for (const [value, pattern] of refusals) {
      assert.throws(() => applyModelFrame([a.actor, b.actor], value), pattern);
      assert.equal(a.actor.snapshot().driver, MODEL_STAGE_DRIVER.host);
    }
  });

  it('shows a declared held clip until samples play, and again on []', () => {
    const {a, b} = pair(), still = makeActor('h', CLIPS, {animation: held('walk', 0)});
    assert.equal(still.bone.position.x, clipValue(1, 0));
    assert.equal(still.actor.snapshot().animation, 'walk');
    applyModelFrame([still.actor], frame(0, entity('h', [layer(sample('run', 1))])));
    assert.equal(still.bone.position.x, clipValue(0, 1));
    applyModelFrame([still.actor], frame(0.1, entity('h')));
    assert.equal(still.bone.position.x, clipValue(1, 0));
    applyModelFrame([a.actor, b.actor], frame(0, entity('a', [layer(sample('run', 1))])));
    applyModelFrame([a.actor, b.actor], frame(0.1, entity('a')));
    assert.deepEqual(a.bone.position.toArray(), [...BIND]);
  });

  it('refuses a clip the file lacks as soon as the asset is built, naming the actor', () => {
    const {context, scene} = actorContext();
    assert.throws(() => makeActor('h', CLIPS, {animation: held('swim', 0)}, context),
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
  const asset = declaration('x').asset, animation = REST;
  const set = (...actors: unknown[]) => ({focus: 'a', actors});
  it('validates the whole set: unique ids, a declared focus, whole placements and animations', () => {
    const placement = {...STANDING, scale: [1, 2, 3]};
    const valid = modelStageActorSet(set({id: 'a', asset, placement, animation}));
    assert.deepEqual(valid.actors[0].placement, placement);
    const a = {id: 'a', asset, placement: STANDING, animation};
    for (const shape of [REST, playing('run'), held('run', 0.5)]) {
      assert.deepEqual(modelStageActorSet(set({...a, animation: shape})).actors[0].animation, shape);
    }
    const refusals: Array<[unknown, RegExp]> = [
      [set(a, a), /Actor a is declared twice/],
      [{focus: 'z', actors: [a]}, /The focus z names no declared actor/],
      [set(), /non-empty actors/],
      [set({...a, placement: {...STANDING, scale: [2, 2]}}), /scale must contain 3/],
      [set({...a, placement: {...STANDING, rotationQuaternion: [0, 0, 0, 2]}}), /unit length/],
      // The three shapes are the only animations: no shape, a stray field of another shape, a missing clip or time.
      [set({...a, animation: {name: 'run', playing: false}}), /Actor a.animation states its kind, one of rest/],
      [set({...a, animation: {kind: 'paused', name: 'run'}}), /Actor a.animation states its kind, one of rest/],
      [set({...a, animation: {...playing('run'), timeSeconds: 1}}),
        /Actor a.animation does not state timeSeconds; it states kind, name\./],
      [set({...a, animation: {...REST, name: 'run'}}), /Actor a.animation does not state name; it states kind\./],
      [set({...a, animation: {...held('run', 0), playing: false}}), /Actor a.animation does not state playing/],
      [set({...a, animation: playing('')}), /Actor a.animation.name must be a non-empty string/],
      [set({...a, animation: {kind: 'held', name: 'run'}}), /Actor a.animation omits timeSeconds/],
      [set({...a, animation: held('run', -1)}), /Actor a.animation.timeSeconds must be a finite number of at least 0/],
      [set({...a, animation: held('run', Infinity)}), /Actor a.animation.timeSeconds must be a finite number/],
      [set({id: 'a', asset: {id: 'x'}, placement: STANDING, animation}), /Actor a.asset omits path/],
      [set({asset, placement: STANDING, animation}), /Actor 0 omits id/],
      [set({...a, id: ''}), /Actor 0.id must be a non-empty string/],
      [{...set(a), extra: 1}, /The actors does not state extra/], [{}, /The actors omits focus/],
    ];
    for (const [value, pattern] of refusals) assert.throws(() => modelStageActorSet(value), pattern);
  });
});
