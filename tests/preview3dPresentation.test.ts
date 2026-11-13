import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {modelPreviewPresentation, modelPoseForBinding, MODEL_PREVIEW_CAPABILITIES}
  from '../src/react/preview3d/model.ts';
import {createModelPresentationInbox} from '../src/react/preview3d/presentation.ts';
import type {ModelPresentationPose} from '../src/react/preview3d/model.ts';

const input = (x = 1, modelId = 'otter') => ({modelId,
  pose: {position: [x, 2, 3], rotationQuaternion: [0, 0, 0, 1], scale: [2, 3, 4]},
  animationLayers: [] as unknown[], partPoses: [] as unknown[], materials: [] as unknown[]});
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10);

describe('pose-only model presentation boundary', () => {
  it('requires every unsupported channel to be explicitly empty before accepting a pose', () => {
    assert.deepEqual(MODEL_PREVIEW_CAPABILITIES,
      {pose: true, animationLayers: true, partPoses: false, materials: false});
    for (const key of ['partPoses', 'materials']) {
      const missing: Record<string, unknown> = input();
      delete missing[key];
      assert.throws(() => modelPreviewPresentation(missing, 'otter'), /explicitly empty/);
      for (const value of [null, {}, [{weight: 0}], ['unsupported']]) {
        assert.throws(() => modelPreviewPresentation({...input(), [key]: value}, 'otter'), /explicitly empty/);
      }
    }
  });

  it('rejects mismatched models, partial/sparse/nonfinite poses and nonunit quaternions', () => {
    assert.throws(() => modelPreviewPresentation(input(1, 'other'), 'otter'), /match/);
    for (const position of [[], [1, 2], [1, 2, 3, 4], Array(3), [1, NaN, 3], [1, Infinity, 3], ['1', 2, 3]]) {
      assert.throws(() => modelPreviewPresentation({...input(), pose: {...input().pose, position}}, 'otter'), /finite/);
    }
    for (const rotationQuaternion of [[0, 0, 0, 0], [0, 0, 0, 2], [NaN, 0, 0, 1], Array(4)]) {
      assert.throws(() => modelPreviewPresentation({...input(), pose: {...input().pose, rotationQuaternion}}, 'otter'));
    }
    const partial = {...input(), pose: {position: [0, 0, 0], rotationQuaternion: [0, 0, 0, 1]}};
    assert.throws(() => modelPreviewPresentation(partial, 'otter'), /scale/);
    assert.throws(() => modelPreviewPresentation({...input(), pose: {...input().pose, scale: [1, NaN, 1]}}, 'otter'));
  });

  it('deep-copies and freezes accepted values without retaining caller arrays', () => {
    const source = input();
    const accepted = modelPreviewPresentation(source, 'otter');
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
    const pose = modelPreviewPresentation({...input(), pose: {...input().pose,
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

describe('pending pose delivery', () => {
  it('applies only the latest validated copy when the instance becomes ready', () => {
    const inbox = createModelPresentationInbox('otter'), applied: ModelPresentationPose[] = [];
    assert.equal(inbox.receive(input(1)), 'pending');
    const latest = input(7);
    assert.equal(inbox.receive(latest), 'pending');
    latest.pose.position[0] = 99;
    assert.equal(inbox.attach(value => applied.push(value.pose)), 'ready');
    assert.equal(applied.length, 1);
    assert.equal(applied[0].position[0], 7);
  });

  it('clears pending input on null or error and never revives an earlier pose at readiness', () => {
    for (const bad of [null, {...input(), materials: [{}]}, input(1, 'different')]) {
      const inbox = createModelPresentationInbox('otter'), applied: ModelPresentationPose[] = [];
      inbox.receive(input());
      const status = inbox.receive(bad);
      assert.equal(status, bad === null ? 'waiting' : 'error');
      assert.equal(inbox.attach(value => applied.push(value.pose)), status);
      assert.equal(applied.length, 0);
    }
  });

  it('retains the last applied pose on invalid/waiting input and recovers on the same instance', () => {
    const inbox = createModelPresentationInbox('otter'), applied: ModelPresentationPose[] = [];
    inbox.attach(value => applied.push(value.pose));
    assert.equal(inbox.receive(input(1)), 'ready');
    const previous = applied[0];
    assert.equal(inbox.receive({...input(99), animationLayers: [{}]}), 'error');
    assert.equal(applied.length, 1);
    assert.equal(inbox.receive(null), 'waiting');
    assert.equal(applied[0], previous);
    assert.equal(inbox.receive(input(2)), 'ready');
    assert.equal(applied.length, 2);
    assert.equal(applied[1].position[0], 2);
  });

  it('invalidates a cleared instance instead of handing its pending pose to a new consumer', () => {
    const inbox = createModelPresentationInbox('otter'), applied: ModelPresentationPose[] = [];
    inbox.receive(input(3));
    inbox.clear();
    assert.equal(inbox.attach(value => applied.push(value.pose)), 'waiting');
    assert.equal(applied.length, 0);
    assert.equal(inbox.receive(input(4)), 'ready');
    assert.equal(applied[0].position[0], 4);
  });
});
