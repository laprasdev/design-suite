import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {MODEL_EMITTER_REFUSAL, MODEL_RENDER_MODE, MODEL_UNITY_BUILTIN_MESH}
  from '../src/react/preview3d/emitterModel.ts';
import {MODEL_EMITTER_UNDRAWN_MODULES} from '../src/react/preview3d/emitterProfileModel.ts';
import {modelEmitterDrawing, modelEmitterRecords} from '../src/react/preview3d/emitterRecordModel.ts';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {modelPreviewNotice} from '../src/react/preview3d/previewNotice.ts';
import {MODEL_PREVIEW_TEXT} from '../src/react/preview3d/model.ts';
import {MODEL_STAGE_FAILURE} from '../src/react/preview3d/refusal.ts';
import {NoticeTone} from '../src/react/actionBarElements.ts';
import {applyFrame, declaration, describing, frame, refused} from './preview3dActorFixture.ts';
import {changing, starting, stopping, withEmitters} from './preview3dEmitterActors.ts';
import {EMITTER_ID, emitterProfile} from './preview3dEmitterCases.ts';
import {EMITTER_REFUSAL_CASES, EMITTER_WHERE, emitterProfileWith, type EmitterRefusalCase}
  from './preview3dEmitterRefusals.ts';

// A profile holding a value the stage does not draw yet is skipped, never refusing the stage: the actor draws the
// rest, and its snapshot reports each skipped profile by the setting holding that value. A record that is invalid
// still refuses the description.
const ACTOR = 'a';
const caseAt = (...path: string[]): EmitterRefusalCase => {
  const found = EMITTER_REFUSAL_CASES.find(item => item.path.join('.') === path.join('.'));
  assert.ok(found, `The refusal cases set ${path.join('.')}.`);
  return found;
};
const [module] = Object.keys(MODEL_EMITTER_UNDRAWN_MODULES);
const PROJECT_MESH = {guid: '07b42f3ac947778439b43247de193bd0', fileID: '6149864076678568875'};
// Each kind of value the stage does not draw yet, by the setting that holds it.
const UNDRAWN = Object.freeze([
  {profile: 'module', setting: `${module}.enabled`, record: emitterProfileWith(caseAt(module, 'enabled'))},
  {profile: 'asset', setting: 'shapeSettings.texture', record: emitterProfileWith(caseAt('shapeSettings', 'texture'))},
  {profile: 'mesh', setting: 'mesh', record: {...emitterProfile(), renderMode: MODEL_RENDER_MODE.mesh,
    mesh: PROJECT_MESH}},
  {profile: 'curve', setting: 'mainSettings.startSpeed.m_Mode',
    record: emitterProfileWith(caseAt('mainSettings', 'startSpeed'))},
  {profile: 'gradient', setting: 'colorOverLifetime.color.m_Mode',
    record: emitterProfileWith(caseAt('colorOverLifetime', 'color'))},
]);
const profiles = {[EMITTER_ID]: emitterProfile(),
  ...Object.fromEntries(UNDRAWN.map(({profile, record}) => [profile, record]))};
const described = (emitters: unknown) => modelStageDescription(describing({actors: {focus: ACTOR,
  actors: [{...declaration(ACTOR), emitters}]}}));

describe('an emitter profile the stage does not draw yet', () => {
  it('is skipped by the setting holding the undrawn value', () => {
    const description = described(profiles);
    const [actor] = description.actors.actors;
    assert.ok('emitters' in actor);
    const {drawn, skipped} = modelEmitterDrawing(actor.emitters);
    assert.deepEqual(Object.keys(drawn), [EMITTER_ID]);
    assert.deepEqual(skipped.map(({profile, setting}) => ({profile, setting})),
      UNDRAWN.map(({profile, setting}) => ({profile, setting})));
    assert.equal(skipped[0].refusal, caseAt(module, 'enabled').refusal
      .replace(EMITTER_WHERE, `Actor ${ACTOR}.emitters.module`));
    assert.equal(skipped[2].refusal, MODEL_EMITTER_REFUSAL.undrawnMesh(`Actor ${ACTOR}.emitters.mesh.mesh`,
      PROJECT_MESH.guid, PROJECT_MESH.fileID, ['sphere']));
  });
  it('draws the drawable profile, reports the skips in its snapshot, and a frame starting one is inert', () => {
    const {actor, systems, visible} = withEmitters(ACTOR, profiles);
    assert.equal(systems.length, 1);
    assert.deepEqual(actor.snapshot().skipped.map(({profile}) => profile), UNDRAWN.map(({profile}) => profile));
    applyFrame([actor], frame(0, changing(...starting('module'))));
    assert.equal(visible(), 0);
    applyFrame([actor], frame(0.05, changing(...stopping('curve', 'gradient'))));
    assert.equal(visible(), 0);
    applyFrame([actor], frame(0.1, changing(...starting(EMITTER_ID, 'mesh'))));
    assert.equal(visible(), 1);
    refused(() => applyFrame([actor], frame(0.2, changing(...starting('other')))),
      MODEL_EMITTER_REFUSAL.undeclared(ACTOR, 'other'));
  });
});

describe('an emitter record that is invalid', () => {
  it('refuses the description by its own refusal', () => {
    refused(() => described({broken: {notAParticleRecord: 1}}), /^Actor a\.emitters\.broken /);
    const emitsNothing = EMITTER_REFUSAL_CASES.find(({refusal}) =>
      refusal === MODEL_EMITTER_REFUSAL.emitsNothing(`${EMITTER_WHERE}.emissionSettings`));
    assert.ok(emitsNothing, 'The refusal cases hold a profile that emits nothing.');
    refused(() => described({[EMITTER_ID]: emitterProfileWith(emitsNothing)}),
      emitsNothing.refusal.replace(EMITTER_WHERE, `Actor ${ACTOR}.emitters.${EMITTER_ID}`));
  });
  it('refuses Unity\'s own serialized asset reference, which adds type, whole: the pack states the one form', () => {
    const {guid, meshes: [{fileID}]} = MODEL_UNITY_BUILTIN_MESH, unity = {fileID, guid, type: 0};
    const profile = emitterProfile();
    for (const [record, where] of [
      [{...profile, renderMode: MODEL_RENDER_MODE.mesh, mesh: unity}, 'mesh'],
      [{...profile, shapeSettings: {...profile.shapeSettings, texture: unity}}, 'shapeSettings.texture']] as const) {
      refused(() => described({[EMITTER_ID]: record}), new RegExp(`^Actor ${ACTOR}\\.emitters\\.${EMITTER_ID}\\.${
        where.replace('.', '\\.')} .*\\btype\\b`));
    }
    assert.equal(Object.keys(modelEmitterDrawing(modelEmitterRecords(ACTOR, {[EMITTER_ID]: {...profile,
      renderMode: MODEL_RENDER_MODE.mesh, mesh: {fileID, guid}}})).drawn).length, 1, 'the one form draws');
  });
  it('lets any failure other than a refusal escape', () => {
    const failing = Object.defineProperty(emitterProfile(), 'mainSettings', {enumerable: true,
      get() {throw new TypeError('unreadable');}});
    assert.throws(() => modelEmitterRecords(ACTOR, {[EMITTER_ID]: failing}), TypeError);
  });
});

describe('the stage notice', () => {
  const skip = (profile: string, setting: string) => ({actor: ACTOR, profile, setting, refusal: profile});
  const retry = () => undefined;
  it('names the skipped effects by setting, counting the effects each holds, after any failure', () => {
    const skipped = [skip('dust', 'noiseSettings.enabled'), skip('sparks', 'noiseSettings.enabled'),
      skip('trail', 'mesh')];
    assert.deepEqual(modelPreviewNotice(null, skipped, retry), {message: MODEL_PREVIEW_TEXT.skipped,
      tone: NoticeTone.INFO, detail: `noiseSettings.enabled ${MODEL_PREVIEW_TEXT.effects(2)} · mesh ${
        MODEL_PREVIEW_TEXT.effects(1)}`});
    assert.equal(modelPreviewNotice({kind: MODEL_STAGE_FAILURE.refused, message: 'Broken'}, skipped, retry)?.detail,
      'Broken');
  });
});
