import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {modelPreviewEntity, modelPoseForBinding, MODEL_PREVIEW_CAPABILITIES}
  from '../src/react/preview3d/model.ts';
import {createModelFrameInbox} from '../src/react/preview3d/frameInbox.ts';
import type {ModelPresentationPose, ModelPreviewFrame} from '../src/react/preview3d/model.ts';
import {declaration, fileScene} from './preview3dActorFixture.ts';

const input = (x = 1, modelId = 'otter') => ({entityId: 'e', modelId,
  pose: {position: [x, 2, 3], rotationQuaternion: [0, 0, 0, 1], scale: [2, 3, 4]},
  animationLayers: [] as unknown[], partPoses: [] as unknown[], materials: [] as unknown[]});
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10);
// The frame inbox holds one-entity frames for the declared actor e.
const ACTORS = [declaration('e')];
const inboxOf = () => {
  const inbox = createModelFrameInbox();
  inbox.describe(fileScene(ACTORS), []);
  return {inbox, receive: (value: unknown) => inbox.receive(value === null ? null :
    {simulationTimeSeconds: 0, entities: [value]})};
};
const poseOf = (value: ModelPreviewFrame) => value.entities[0].pose;

describe('one entity of a frame', () => {
  it('requires every unsupported channel to be explicitly empty before accepting a pose', () => {
    assert.deepEqual(MODEL_PREVIEW_CAPABILITIES,
      {pose: true, animationLayers: true, partPoses: false, materials: false});
    for (const key of ['partPoses', 'materials']) {
      const missing: Record<string, unknown> = input();
      delete missing[key];
      assert.throws(() => modelPreviewEntity(missing, 'otter'), /explicitly empty/);
      for (const value of [null, {}, [{weight: 0}], ['unsupported']]) {
        assert.throws(() => modelPreviewEntity({...input(), [key]: value}, 'otter'), /explicitly empty/);
      }
    }
  });

  it('rejects mismatched models, partial/sparse/nonfinite poses and nonunit quaternions', () => {
    assert.throws(() => modelPreviewEntity(input(1, 'other'), 'otter'), /match/);
    for (const position of [[], [1, 2], [1, 2, 3, 4], Array(3), [1, NaN, 3], [1, Infinity, 3], ['1', 2, 3]]) {
      assert.throws(() => modelPreviewEntity({...input(), pose: {...input().pose, position}}, 'otter'), /finite/);
    }
    for (const rotationQuaternion of [[0, 0, 0, 0], [0, 0, 0, 2], [NaN, 0, 0, 1], Array(4)]) {
      assert.throws(() => modelPreviewEntity({...input(), pose: {...input().pose, rotationQuaternion}}, 'otter'));
    }
    const partial = {...input(), pose: {position: [0, 0, 0], rotationQuaternion: [0, 0, 0, 1]}};
    assert.throws(() => modelPreviewEntity(partial, 'otter'), /scale/);
    assert.throws(() => modelPreviewEntity({...input(), pose: {...input().pose, scale: [1, NaN, 1]}}, 'otter'));
  });

  it('deep-copies and freezes accepted values without retaining caller arrays', () => {
    const source = input();
    const accepted = modelPreviewEntity(source, 'otter');
    source.pose.position[0] = 100;
    source.pose.rotationQuaternion[0] = 1;
    source.pose.scale[0] = 100;
    source.materials.push('later mutation');
    assert.deepEqual(accepted.pose.position, [1, 2, 3]);
    assert.deepEqual(accepted.pose.rotationQuaternion, [0, 0, 0, 1]);
    assert.deepEqual(accepted.pose.scale, [2, 3, 4]);
    assert.deepEqual(accepted.materials, []);
    assert.ok(Object.isFrozen(accepted.pose.position) && Object.isFrozen(accepted.pose) && Object.isFrozen(accepted));
  });

  it('reflects the basis and postmultiplies model alignment, keeping metres and scale unchanged', () => {
    const s = Math.SQRT1_2;
    const pose = modelPreviewEntity({...input(), pose: {...input().pose,
      rotationQuaternion: [s, 0, 0, s]}}, 'otter').pose;
    const converted = modelPoseForBinding(pose, {reflectZ: true, rotationQuaternion: [0, 1, 0, 0]});
    assert.deepEqual(converted.position, [1, 2, -3]);
    assert.deepEqual(converted.scale, [2, 3, 4]);
    [0, s, -s, 0].forEach((expected, index) => close(converted.rotationQuaternion[index], expected));
    const unchanged = modelPoseForBinding(pose, {reflectZ: false, rotationQuaternion: [0, 0, 0, 1]});
    assert.deepEqual(unchanged.position, pose.position);
    pose.rotationQuaternion.forEach((expected, index) => close(unchanged.rotationQuaternion[index], expected));
    assert.throws(() => modelPoseForBinding(pose, {reflectZ: false, rotationQuaternion: [0, 0, 0, 2]}), /unit/);
  });
});

describe('pending frame delivery', () => {
  it('applies only the latest validated copy when the instance becomes ready', () => {
    const {inbox, receive} = inboxOf(), applied: ModelPresentationPose[] = [];
    assert.equal(receive(input(1)), 'pending');
    const latest = input(7);
    assert.equal(receive(latest), 'pending');
    latest.pose.position[0] = 99;
    assert.equal(inbox.attach(value => applied.push(poseOf(value))), 'ready');
    assert.equal(applied.length, 1);
    assert.equal(applied[0].position[0], 7);
  });

  it('clears pending input on null or error and never revives an earlier pose at readiness', () => {
    for (const bad of [null, {...input(), materials: [{}]}, input(1, 'different')]) {
      const {inbox, receive} = inboxOf(), applied: ModelPresentationPose[] = [];
      receive(input());
      const status = receive(bad);
      assert.equal(status, bad === null ? 'waiting' : 'error');
      assert.equal(inbox.attach(value => applied.push(poseOf(value))), status);
      assert.equal(applied.length, 0);
    }
  });

  it('retains the last applied pose on invalid/waiting input and recovers on the same instance', () => {
    const {inbox, receive} = inboxOf(), applied: ModelPresentationPose[] = [];
    inbox.attach(value => applied.push(poseOf(value)));
    assert.equal(receive(input(1)), 'ready');
    const previous = applied[0];
    assert.equal(receive({...input(99), animationLayers: [{}]}), 'error');
    assert.equal(applied.length, 1);
    assert.equal(receive(null), 'waiting');
    assert.equal(applied[0], previous);
    assert.equal(receive(input(2)), 'ready');
    assert.equal(applied.length, 2);
    assert.equal(applied[1].position[0], 2);
  });

  it('invalidates a cleared instance instead of handing its pending pose to a new consumer', () => {
    const {inbox, receive} = inboxOf(), applied: ModelPresentationPose[] = [];
    receive(input(3));
    inbox.clear();
    assert.equal(inbox.attach(value => applied.push(poseOf(value))), 'waiting');
    assert.equal(applied.length, 0);
    assert.equal(receive(input(4)), 'ready');
    assert.equal(applied[0].position[0], 4);
  });
});
