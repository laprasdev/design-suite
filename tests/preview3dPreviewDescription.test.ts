import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {MODEL_PREVIEW_TEXT, MODEL_REST_POSE, MODEL_STAGE, MODEL_STAGE_SIZE, MODEL_STAGE_THEME_LIGHTING,
  MODEL_STAGE_FAILURE,
  ModelStageRefusal, modelStageFailure}
  from '../src/react/preview3d/model.ts';
import type {ModelPreviewAsset, ModelStageController} from '../src/react/preview3d/model.ts';
import {createModelDescriptionRequests, modelPreviewDescription, modelPreviewFailure, modelPreviewInitialSelection,
  modelPreviewClip, modelPreviewNotice, modelPreviewPick, modelPreviewReady, modelPreviewToggle}
  from '../src/react/preview3d/previewDescription.ts';
import {declaration, describing, held, playing, REST, STANDING} from './preview3dActorFixture.ts';

describe('the view\'s description', () => {
  const asset: ModelPreviewAsset = {id: 'otter', name: 'Otter', path: '/otter.glb', attachments: {},
    idleAnimation: 'run', animations: [{name: 'run', label: 'Run'}]};
  const inputs = {asset, actors: [declaration('ball', 'ball')], external: false};
  it('focuses the selected model beside the consumer\'s actors, and the engine overrides the host choices', () => {
    const selection = modelPreviewInitialSelection(asset, false);
    const local = modelPreviewDescription(inputs, {...selection, lighting: 'dark', materialMode: 'clay'});
    assert.deepEqual([local.actors.focus, local.actors.actors.map(({id}) => id)], ['otter', ['otter', 'ball']]);
    assert.deepEqual([local.actors.actors[0].animation, local.lighting, local.camera], [playing('run'), 'dark', null]);
    assert.deepEqual(local.actors.actors[0].placement, STANDING);
    const engine = modelPreviewDescription({...inputs, external: true}, {...selection, materialMode: 'clay'});
    assert.deepEqual([engine.actors.actors[0].animation, engine.materialMode, engine.lighting],
      [REST, 'lit', MODEL_STAGE_THEME_LIGHTING]);
    assert.deepEqual([local.size, engine.size],
      [{rule: MODEL_STAGE_SIZE.normalized, height: MODEL_STAGE.normalizedHeight}, {rule: MODEL_STAGE_SIZE.real}]);
    assert.equal(modelPreviewInitialSelection(asset, false).lighting, MODEL_STAGE_THEME_LIGHTING);
  });

  it('picks a clip that plays on if the last one played and is held at its start if not, and the rest pose', () => {
    assert.deepEqual(modelPreviewPick(playing('run'), 'walk'), playing('walk'));
    assert.deepEqual(modelPreviewPick(held('run', 0.4), 'walk'), held('walk', 0));
    assert.deepEqual(modelPreviewPick(playing('run'), MODEL_REST_POSE), REST);
    assert.deepEqual([REST, playing('run'), held('walk', 1)].map(modelPreviewClip), [MODEL_REST_POSE, 'run', 'walk']);
  });

  it('pauses at the time the stage shows, plays on from a hold, and refuses to pause the rest pose or samples', () => {
    assert.deepEqual(modelPreviewToggle(playing('run'), 0.7), held('run', 0.7));
    assert.deepEqual(modelPreviewToggle(held('run', 0.7), 0.7), playing('run'));
    assert.throws(() => modelPreviewToggle(REST, 0), /^ModelStageRefusal: The rest pose neither plays nor pauses/);
    assert.throws(() => modelPreviewToggle(playing('run'), null), /^ModelStageRefusal: Engine samples drive/);
  });

  it('keeps readiness for a description that loads nothing, and hands on the latest refusal only', async () => {
    const pending: boolean[] = [], failures: unknown[] = [];
    const requests = createModelDescriptionRequests(value => pending.push(value), error => failures.push(error));
    const description = modelStageDescription(describing());
    let loading = false, settle: (fail: boolean) => void = () => undefined;
    const refusal = new ModelStageRefusal('no');
    const api = {snapshot: () => ({actorsPending: loading}) as ReturnType<ModelStageController['snapshot']>,
      setDescription: () => loading ? new Promise<void>((resolve, reject) =>
        {settle = fail => fail ? reject(refusal) : resolve();}) : Promise.resolve()};
    assert.equal(requests.request(api, description), true);
    await Promise.resolve();
    assert.deepEqual(pending, [false, false]);
    loading = true;
    requests.request(api, description);
    settle(true);
    await Promise.resolve();
    assert.deepEqual([pending.at(-2), pending.at(-1), failures], [true, false, [refusal]]);
    assert.equal(requests.request({...api, setDescription: () => {throw refusal;}}, description), false);
  });

  it('reports only the latest of two overlapping descriptions', async () => {
    const pending: boolean[] = [], settles: Array<() => void> = [];
    const requests = createModelDescriptionRequests(value => pending.push(value), () => undefined);
    const api = {snapshot: () => ({actorsPending: true}) as ReturnType<ModelStageController['snapshot']>,
      setDescription: () => new Promise<void>(resolve => {settles.push(resolve);})};
    const description = modelStageDescription(describing());
    requests.request(api, description);
    requests.request(api, description);
    settles[0]();
    await Promise.resolve();
    assert.deepEqual(pending, [true, true]);
    settles[1]();
    await Promise.resolve();
    assert.deepEqual(pending, [true, true, false]);
  });

  it('is ready when loaded, the runtime pose is shown when external, and nothing loads', () => {
    assert.equal(modelPreviewReady(true, false, 'waiting', false), true);
    assert.equal(modelPreviewReady(true, false, 'waiting', true), false);
    assert.equal(modelPreviewReady(true, true, 'error', false), false);
    assert.equal(modelPreviewReady(false, false, 'ready', false), false);
  });

  it('keeps a stage on a refusal and fails it otherwise; a frame\'s failure survives an accepted request', () => {
    const refused = modelStageFailure(new ModelStageRefusal('no frame'), true);
    assert.deepEqual(refused, {kind: MODEL_STAGE_FAILURE.refused, message: 'no frame'});
    assert.deepEqual(modelStageFailure(new Error('broken'), true), {kind: MODEL_STAGE_FAILURE.unusable,
      message: 'broken'});
    assert.equal(modelStageFailure(new ModelStageRefusal('no frame'), false).kind, MODEL_STAGE_FAILURE.unusable);
    assert.deepEqual(modelStageFailure('thrown text', true), {kind: MODEL_STAGE_FAILURE.unusable,
      message: 'thrown text'});
    const stopped = modelStageFailure(new Error('broken'), true);
    const request = modelStageFailure(new ModelStageRefusal('x'), true);
    assert.equal(modelPreviewFailure(null, refused), refused);
    assert.equal(modelPreviewFailure(request, refused), refused);
    assert.equal(modelPreviewFailure(stopped, refused), stopped);
    assert.equal(modelPreviewFailure(request, null), request);
  });

  it('shows a failure as the suite notice: what failed, its own message, and Retry for a stopped stage', () => {
    const retry = () => undefined;
    assert.equal(modelPreviewNotice(null, retry), null);
    assert.deepEqual(modelPreviewNotice({kind: MODEL_STAGE_FAILURE.refused, message: 'Actor a: clip swim'}, retry),
      {message: MODEL_PREVIEW_TEXT.refused, tone: 'error', detail: 'Actor a: clip swim'});
    assert.deepEqual(modelPreviewNotice({kind: MODEL_STAGE_FAILURE.unusable, message: 'Missing bone'}, retry),
      {message: MODEL_PREVIEW_TEXT.stopped, tone: 'error', detail: 'Missing bone',
        action: {label: MODEL_PREVIEW_TEXT.retry, onClick: retry}});
  });
});
