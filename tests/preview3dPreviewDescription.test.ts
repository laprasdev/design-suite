import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {MODEL_PREVIEW_TEXT, MODEL_REST_POSE, MODEL_STAGE_SIZE, MODEL_STAGE_THEME_LIGHTING,
  MODEL_STAGE_FAILURE,
  ModelStageRefusal, modelStageFailure}
  from '../src/react/preview3d/model.ts';
import type {ModelStageController} from '../src/react/preview3d/model.ts';
import {createModelDescriptionRequests, modelPreviewChoices, modelPreviewDescription, modelPreviewFailure,
  modelPreviewSelectionOf,
  modelPreviewClip, modelPreviewNotice, modelPreviewPick, modelPreviewReady, modelPreviewToggle}
  from '../src/react/preview3d/previewDescription.ts';
import {declaration, describing, held, playing, REST, standingAt} from './preview3dActorFixture.ts';

describe('the view\'s description', () => {
  const host = modelStageDescription(describing({actors: {focus: 'otter', actors: [
    declaration('otter', 'otter', {animation: playing('run'), placement: standingAt([2, 0, 1])}),
    declaration('ball', 'ball')]}, size: {rule: MODEL_STAGE_SIZE.normalized, height: 3}}));
  it('applies the person\'s choices to the host\'s description and its focused actor, and changes nothing else', () => {
    const selection = modelPreviewSelectionOf(host);
    assert.deepEqual(selection, {animation: playing('run'), display: 'model', materialMode: 'lit',
      lighting: MODEL_STAGE_THEME_LIGHTING});
    assert.deepEqual(modelPreviewDescription(host, selection), host);
    const chosen = modelPreviewDescription(host, {animation: held('run', 0.5), display: 'rig', materialMode: 'clay',
      lighting: 'dark'});
    assert.deepEqual(chosen, {...host, display: 'rig', materialMode: 'clay', lighting: 'dark',
      actors: {focus: 'otter', actors: [{...host.actors.actors[0], animation: held('run', 0.5)},
        host.actors.actors[1]]}});
    // The host's placement and size reach the stage as stated: the view fixes neither.
    assert.deepEqual([chosen.actors.actors[0].placement.position, chosen.size], [[2, 0, 1], host.size]);
  });

  it('keeps the person\'s choices until the host changes a value they edit, whatever else the host changes', () => {
    const over = modelPreviewSelectionOf(host);
    const held = {over, selection: {...over, display: 'rig' as const}};
    // A host that moves its camera every tick keeps the person's display.
    const posed = modelStageDescription({...host, framing: {kind: 'pose', position: [0, 1, 4], target: [0, 1, 0]}});
    assert.equal(modelPreviewChoices(held, posed), held);
    const relit = modelStageDescription({...host, lighting: 'dark'});
    assert.deepEqual(modelPreviewChoices(held, relit).selection, modelPreviewSelectionOf(relit));
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
    const requests = createModelDescriptionRequests(value => pending.push(value), error => failures.push(error),
      () => undefined);
    const description = modelStageDescription(describing());
    let loading = false, settle: (fail: boolean) => void = () => undefined;
    const refusal = new ModelStageRefusal('no');
    const api = {snapshot: () => ({actorsPending: loading}) as ReturnType<ModelStageController['snapshot']>,
      setDescription: () => loading ? new Promise<void>((resolve, reject) =>
        {settle = fail => fail ? reject(refusal) : resolve();}) : Promise.resolve()};
    assert.equal(requests.request(api, description), true);
    await Promise.resolve();
    assert.deepEqual(pending, [false]);
    loading = true;
    requests.request(api, description);
    settle(true);
    await Promise.resolve();
    assert.deepEqual([pending.at(-2), pending.at(-1), failures], [true, false, [refusal]]);
    assert.equal(requests.request({...api, setDescription: () => {throw refusal;}}, description), false);
  });

  it('reports only the latest of two overlapping descriptions', async () => {
    const pending: boolean[] = [], settles: Array<() => void> = [];
    const requests = createModelDescriptionRequests(value => pending.push(value), () => undefined, () => undefined);
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

  it('clears a recorded refusal when the declared description returns to the one the stage holds', async () => {
    const events: string[] = [];
    const requests = createModelDescriptionRequests(() => undefined, () => events.push('refused'),
      () => events.push('settled'));
    const shown = modelStageDescription(describing());
    const other = modelStageDescription({...describing(), lighting: 'dark'});
    let loads = false, reject: () => void = () => undefined;
    const api = {snapshot: () => ({actorsPending: loads}) as ReturnType<ModelStageController['snapshot']>,
      setDescription: (value: unknown) => {
        if (value === other && !loads) throw new ModelStageRefusal('no');
        return loads ? new Promise<void>((_, fail) => {reject = () => fail(new ModelStageRefusal('late'));}) :
          Promise.resolve();
      }};
    requests.hold(shown);
    // Refused at once: the stage still holds the first; declaring it again clears the refusal and sends nothing.
    assert.equal(requests.declare(api, other), false);
    let sent = 0;
    const counted = {...api, setDescription: (value: unknown) => {sent++; return api.setDescription(value);}};
    assert.equal(requests.declare(counted, shown), true);
    assert.deepEqual([events, sent], [['refused', 'settled'], 0]);
    // Taken, then refused when its loads arrive: the stage still holds the first, so declaring it clears again.
    events.length = 0;
    loads = true;
    assert.equal(requests.declare(api, other), true);
    reject();
    await new Promise(resolve => setTimeout(resolve));
    loads = false;
    requests.declare(counted, shown);
    assert.deepEqual([events, sent], [['settled', 'refused', 'settled'], 0]);
    // While a load is in flight, the held description is sent again so that it supersedes the load.
    loads = true;
    requests.declare(api, other);
    requests.declare(counted, shown);
    assert.equal(sent, 1);
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
