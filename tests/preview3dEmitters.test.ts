import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {RenderMode} from 'three.quarks';
import {MODEL_CURVE_MODE, MODEL_EMITTER_BUDGET, MODEL_EMITTER_FORM, MODEL_EMITTER_ORIGIN, MODEL_EMITTER_REFUSAL,
  MODEL_RENDER_MODE, MODEL_SHAPE_TYPE, MODEL_UNITY_BUILTIN_MESH} from '../src/react/preview3d/emitterModel.ts';
import {modelEmitterProfile, modelEmitterProfiles, modelEmitterRecords}
  from '../src/react/preview3d/emitterProfileModel.ts';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {modelActorIdentity} from '../src/react/preview3d/actorModel.ts';
import {MODEL_EMITTER_CHANGE, modelEmitterChanges} from '../src/react/preview3d/emitterFrameModel.ts';
import {actorContext, applyFrame, declaration, describing, entity, frame, makeActor, refused}
  from './preview3dActorFixture.ts';
import {changing, starting, stopping, withEmitters} from './preview3dEmitterActors.ts';
import {curve, EMITTER_ID, EMITTER_ROUTED, emitterChange, emitterProfile} from './preview3dEmitterCases.ts';
import {EMITTER_REFUSAL_CASES, EMITTER_WHERE, emitterProfileWith} from './preview3dEmitterRefusals.ts';

const WHERE = EMITTER_WHERE;
const {emitters: EMITTERS, coverage: COVERAGE} = MODEL_EMITTER_BUDGET.load;

describe('an emitter profile', () => {
  it('reads the constant and two-constant modes, Unity\'s constant from m_ConstantMax, beside unread curves', () => {
    const profile = modelEmitterProfile(emitterProfile(), WHERE);
    assert.deepEqual(profile.lifetime, {min: 0.8, max: 1.6});
    assert.equal(profile.rate, 160);
    assert.equal(profile.sizeScale, 0.75);
    assert.deepEqual(profile.tint, [1, 0.85, 0.4, 1]);
    const constant = emitterProfile();
    constant.mainSettings.startSize = curve(0.01, 0.2, MODEL_CURVE_MODE.constant);
    assert.deepEqual(modelEmitterProfile(constant, WHERE).size, {min: 0.2, max: 0.2});
  });
  for (const item of EMITTER_REFUSAL_CASES) {
    it(`refuses ${item.path.join('.')} set to ${JSON.stringify(item.value)} by name`, () => {
      refused(() => modelEmitterProfile(emitterProfileWith(item), EMITTER_WHERE), item.refusal);
    });
  }
  it('reads a description\'s records back as themselves, and draws the profile they check', () => {
    const read = modelEmitterRecords({[EMITTER_ID]: emitterProfile()}, WHERE);
    assert.deepEqual(modelEmitterRecords(read, WHERE), read);
    assert.deepEqual(read[EMITTER_ID], emitterProfile());
    assert.ok(Object.isFrozen(read[EMITTER_ID].mainSettings));
    assert.ok(Object.isFrozen(read[EMITTER_ID].submodules));
    assert.deepEqual(modelEmitterProfiles(read, WHERE)[EMITTER_ID], modelEmitterProfile(emitterProfile(), WHERE));
    const once = modelStageDescription(describing({actors: {focus: 'a',
      actors: [{...declaration('a'), emitters: {[EMITTER_ID]: emitterProfile()}}]}}));
    assert.deepEqual(modelStageDescription(once), once);
  });
  it('reloads an actor whose only change is an emitter record, and keeps one whose records read the same', () => {
    const resized = emitterProfile();
    resized.mainSettings.startSize = curve(0.01, 0.2, MODEL_CURVE_MODE.constant);
    const [kept, same, other] = [emitterProfile(), emitterProfile(), resized].map(record => modelStageDescription(
      describing({actors: {focus: 'a', actors: [{...declaration('a'), emitters: {[EMITTER_ID]: record}}]}})));
    const [keptKey, sameKey, otherKey] = [kept, same, other].map(value => modelActorIdentity(value.actors.actors[0]));
    assert.equal(keptKey, sameKey);
    assert.notEqual(keptKey, otherKey);
  });
  it('draws a mesh profile as instances of the built-in mesh it names, and refuses any other mesh by name', () => {
    const [sphere] = MODEL_UNITY_BUILTIN_MESH.meshes;
    const meshed = (mesh: unknown) => ({...emitterProfile(), renderMode: MODEL_RENDER_MODE.mesh, mesh});
    assert.deepEqual(modelEmitterProfile(meshed({guid: MODEL_UNITY_BUILTIN_MESH.guid, fileID: sphere.fileID}), WHERE)
      .particle, {form: MODEL_EMITTER_FORM.mesh, mesh: sphere});
    assert.deepEqual(modelEmitterProfile(emitterProfile(), WHERE).particle, {form: MODEL_EMITTER_FORM.points});
    const project = {guid: '07b42f3ac947778439b43247de193bd0', fileID: '6149864076678568875'};
    refused(() => modelEmitterProfile(meshed(project), WHERE), MODEL_EMITTER_REFUSAL.undrawnMesh(`${WHERE}.mesh`,
      project.guid, project.fileID, [sphere.mesh]));
    refused(() => modelEmitterProfile(meshed({...project, guid: MODEL_UNITY_BUILTIN_MESH.guid}), WHERE),
      MODEL_EMITTER_REFUSAL.undrawnMesh(`${WHERE}.mesh`, MODEL_UNITY_BUILTIN_MESH.guid, project.fileID, [sphere.mesh]));
    // Unity's own YAML reference, beside ISM's exported `ComponentReference`: not the pack's form.
    refused(() => modelEmitterProfile(meshed({guid: MODEL_UNITY_BUILTIN_MESH.guid, fileID: sphere.fileID, type: 0}),
      WHERE), /^Profile\.mesh does not state type/);
  });
  it('draws each mesh profile as instances of the built-in mesh, each billboard as billboards', () => {
    const [sphere] = MODEL_UNITY_BUILTIN_MESH.meshes, {radius, widthSegments, heightSegments} = sphere.segments;
    const {systems: [billboards, spheres]} = withEmitters('a', {[EMITTER_ID]: emitterProfile(), spheres:
      {...emitterProfile(), renderMode: MODEL_RENDER_MODE.mesh, mesh: {guid: MODEL_UNITY_BUILTIN_MESH.guid,
        fileID: sphere.fileID}}});
    assert.equal(billboards.rendererSettings.renderMode, RenderMode.BillBoard);
    assert.equal(spheres.rendererSettings.renderMode, RenderMode.Mesh);
    const {instancingGeometry: geometry} = spheres.rendererSettings;
    assert.ok(geometry instanceof THREE.SphereGeometry);
    const {parameters} = geometry;
    assert.deepEqual([parameters.radius, parameters.widthSegments, parameters.heightSegments],
      [radius, widthSegments, heightSegments]);
  });
  it('refuses a field the record does not have and a profile with no content; reads no shape when off', () => {
    refused(() => modelEmitterProfile({...emitterProfile(), extra: {}}, WHERE), /^Profile does not state extra/);
    refused(() => modelEmitterProfile({...emitterProfile(), enabled: false}, WHERE),
      MODEL_EMITTER_REFUSAL.noContent(WHERE));
    refused(() => modelEmitterProfile({...emitterProfile(), material: null}, WHERE),
      MODEL_EMITTER_REFUSAL.noContent(WHERE));
    const offShape = {...emitterProfile(), shapeSettings: {...emitterProfile().shapeSettings, enabled: false,
      shapeType: MODEL_SHAPE_TYPE.cone}};
    assert.equal(modelEmitterProfile(offShape, WHERE).radius, 0);
  });
});

describe('an engine frame\'s emitters', () => {
  it('refuses a profile the actor does not declare or does not name, a burst and an unsent field, by name', () => {
    const {actor, visible} = withEmitters('a', {[EMITTER_ID]: emitterProfile()});
    refused(() => applyFrame([actor], frame(0, changing(...starting('other')))),
      MODEL_EMITTER_REFUSAL.undeclared('a', 'other'));
    refused(() => applyFrame([actor], frame(0, changing({change: MODEL_EMITTER_CHANGE.started, profile: 3}))),
      'Frame entity a emitters[0].profile must be a non-empty string.');
    refused(() => applyFrame([actor], frame(0, changing(emitterChange(MODEL_EMITTER_CHANGE.burst)))),
      MODEL_EMITTER_REFUSAL.burst('a', EMITTER_ID));
    for (const field of ['burst', 'origin', 'position']) {
      refused(() => applyFrame([actor], frame(0, changing({...emitterChange(MODEL_EMITTER_CHANGE.started),
        [field]: 1}))), MODEL_EMITTER_REFUSAL.stubbed('a', field));
    }
    refused(() => applyFrame([actor], frame(0, changing(...starting(EMITTER_ID), {profile: EMITTER_ID}))),
      /^Frame entity a emitters\[1\] omits change; it states profile, change\.$/);
    refused(() => applyFrame([actor], frame(0, changing({...emitterChange(MODEL_EMITTER_CHANGE.started), at: 1}))),
      /^Frame entity a emitters\[0\] does not state at;/);
    refused(() => applyFrame([actor], frame(0, changing(emitterChange('paused')))),
      /^Frame entity a emitters\[0\]\.change is one of started, stopped, burst\.$/);
    refused(() => applyFrame([actor], frame(0, {...entity('a'), emitters: {}})),
      'Frame entity a emitters must be an array.');
    assert.equal(visible(), 0);
  });
  it('reads a frame\'s changes in place: the list it returns is the frame\'s own, with no record copied', () => {
    const changes = [...starting(EMITTER_ID), ...stopping(EMITTER_ID), {...emitterChange(MODEL_EMITTER_CHANGE.started),
      ...EMITTER_ROUTED}, {...emitterChange(MODEL_EMITTER_CHANGE.started), radius: 0}];
    assert.equal(modelEmitterChanges(changes, 'a'), changes);
  });
  it('shows billboards once started, and keeps drawing them as they live out after a stop', () => {
    const {actor, visible} = withEmitters('a', {[EMITTER_ID]: emitterProfile()});
    applyFrame([actor], frame(1, entity('a')));
    assert.equal(visible(), 0);
    applyFrame([actor], frame(2, changing(...starting(EMITTER_ID))));
    assert.equal(visible(), 1);
    applyFrame([actor], frame(3, changing(...stopping(EMITTER_ID))));
    assert.equal(visible(), 1);
  });
  it('moves a character emitter with its actor each frame, and leaves an environment emitter where it started', () => {
    const environment = {...emitterProfile(), emitterOrigin: MODEL_EMITTER_ORIGIN.environment};
    const {actor, scene, systems: [{emitter: follows}, {emitter: stays}]} =
      withEmitters('a', {follows: emitterProfile(), stays: environment});
    applyFrame([actor], frame(0, changing(...starting('follows', 'stays'))));
    scene.updateMatrixWorld(true);
    const started = stays.matrixWorld.clone();
    actor.placement.position.set(3, 1, -2);
    scene.updateMatrixWorld(true);
    assert.equal(follows.parent, actor.placement);
    assert.ok(follows.matrixWorld.equals(actor.placement.matrixWorld));
    assert.ok(!follows.matrixWorld.equals(started));
    assert.ok(stays.matrixWorld.equals(started));
  });
  it('starts an environment emitter where the same frame puts its actor', () => {
    const environment = {...emitterProfile(), emitterOrigin: MODEL_EMITTER_ORIGIN.environment};
    const {actor, scene, systems: [{emitter: stays}]} = withEmitters('a', {[EMITTER_ID]: environment});
    applyFrame([actor], frame(0, {...entity('a', [], [5, 0, 0]), emitters: starting(EMITTER_ID)}));
    scene.updateMatrixWorld(true);
    assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(stays.matrixWorld).toArray(), [5, 0, 0]);
  });
  it('runs as many emitters as the budget holds, and refuses by name one more, changing nothing', () => {
    const ids = Array.from({length: EMITTERS.most + 1}, (_, index) => `p${index}`);
    const {actor, visible} = withEmitters('a', Object.fromEntries(ids.map(id => [id, emitterProfile(8, 0.01)])));
    const [first, ...rest] = ids, last = rest.pop() ?? first;
    refused(() => applyFrame([actor], frame(0, changing(...starting(...ids)))),
      MODEL_EMITTER_REFUSAL.budget('emitters', ids.length, EMITTERS.most));
    assert.equal(visible(), 0);
    applyFrame([actor], frame(1, changing(...starting(first, ...rest))));
    assert.equal(visible(), EMITTERS.most);
    refused(() => applyFrame([actor], frame(2, changing(...starting(last)))),
      MODEL_EMITTER_REFUSAL.budget('emitters', ids.length, EMITTERS.most));
    applyFrame([actor], frame(3, changing(...stopping(first), ...starting(last))));
    assert.equal(visible(), ids.length);
    // A stop in one frame frees its place for a start in the next.
    applyFrame([actor], frame(4, changing(...stopping(last))));
    applyFrame([actor], frame(5, changing(...starting(first))));
    assert.equal(visible(), ids.length);
  });
  it('runs a profile whose coverage is the budget, and refuses by name one past it', () => {
    // A largest particle one metre across once its size over lifetime scales it.
    const side = 1 / modelEmitterProfile(emitterProfile(), WHERE).sizeScale, atBudget = COVERAGE.most;
    const {actor: fits, visible} = withEmitters('a', {[EMITTER_ID]: emitterProfile(atBudget, side)});
    applyFrame([fits], frame(0, changing(...starting(EMITTER_ID))));
    assert.equal(visible(), 1);
    const {actor: big} = withEmitters('a', {[EMITTER_ID]: emitterProfile(atBudget + 1, side)});
    refused(() => applyFrame([big], frame(0, changing(...starting(EMITTER_ID)))),
      MODEL_EMITTER_REFUSAL.budget('coverage', atBudget + 1, COVERAGE.most));
  });
});
