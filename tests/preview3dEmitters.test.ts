import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_CURVE_MODE, MODEL_EMITTER_BUDGET, MODEL_EMITTER_FORM, MODEL_EMITTER_ORIGIN, MODEL_EMITTER_REFUSAL,
  MODEL_RENDER_MODE, MODEL_SHAPE_TYPE, MODEL_UNITY_BUILTIN_MESH} from '../src/react/preview3d/emitterModel.ts';
import {modelEmitterProfile, modelEmitterProfiles, modelEmitterRecords}
  from '../src/react/preview3d/emitterProfileModel.ts';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {modelActorIdentity} from '../src/react/preview3d/actorModel.ts';
import {MODEL_EMITTER_CHANGE, modelEmitterChanges} from '../src/react/preview3d/emitterFrameModel.ts';
import {actorContext, applyFrame, declaration, describing, entity, frame, makeActor, refused}
  from './preview3dActorFixture.ts';
import {curve, EMITTER_ID, emitterChange, emitterProfile} from './preview3dEmitterCases.ts';
import {EMITTER_REFUSAL_CASES, EMITTER_WHERE, emitterProfileWith} from './preview3dEmitterRefusals.ts';

const WHERE = EMITTER_WHERE;
// An actor with these profiles, and the points its emitters add to its scene, in the profiles' order.
function withEmitters(id: string, profiles: Record<string, unknown>) {
  const {context, scene} = actorContext();
  const actor = makeActor(id, [], {emitters: modelEmitterRecords(profiles, `Actor ${id}.emitters`)}, context).actor;
  const points = scene.children.filter(child => child instanceof THREE.Points);
  return {actor, points, visible: () => points.filter(item => item.visible).length};
}
const changed = (change: string) => (...profiles: string[]) => profiles.map(profile => emitterChange(change, profile));
const starting = changed(MODEL_EMITTER_CHANGE.started), stopping = changed(MODEL_EMITTER_CHANGE.stopped);
const changing = (...changes: unknown[]) => ({...entity('a'), emitters: changes});
const {emitters: EMITTERS, coverage: COVERAGE} = MODEL_EMITTER_BUDGET.load;

describe('an emitter profile', () => {
  it('reads the constant and two-constant modes, Unity\'s constant from m_ConstantMax, beside unread curves', () => {
    const profile = modelEmitterProfile(emitterProfile(), WHERE);
    assert.deepEqual(profile.lifetime, {min: 0.8, max: 1.6});
    assert.equal(profile.rate, 160);
    assert.deepEqual(profile.sizeScale, {min: 0.5, max: 1});
    assert.deepEqual(profile.tint.min, [1, 0.55, 0.2, 1]);
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
  it('draws each mesh profile as one mesh of an instance per particle, each billboard as one points object', () => {
    const [sphere] = MODEL_UNITY_BUILTIN_MESH.meshes;
    const profiles = {[EMITTER_ID]: emitterProfile(), spheres: {...emitterProfile(), renderMode: MODEL_RENDER_MODE.mesh,
      mesh: {guid: MODEL_UNITY_BUILTIN_MESH.guid, fileID: sphere.fileID}}};
    const {context, scene} = actorContext();
    makeActor('a', [], {emitters: modelEmitterRecords(profiles, 'Actor a.emitters')}, context);
    const {maxParticles} = modelEmitterProfile(profiles.spheres, WHERE);
    const meshes = scene.children.filter(child => child instanceof THREE.Mesh);
    assert.equal(scene.children.filter(child => child instanceof THREE.Points).length, 1);
    assert.equal(meshes.length, 1);
    const [{geometry}] = meshes;
    assert.ok(geometry instanceof THREE.InstancedBufferGeometry);
    assert.equal(geometry.instanceCount, maxParticles);
    const slots = geometry.getAttribute('emitterSlot');
    assert.ok(slots instanceof THREE.InstancedBufferAttribute);
    assert.equal(slots.count, maxParticles);
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
  it('refuses a profile the actor does not declare or does not name, a burst and a routed value, each by name', () => {
    const {actor, visible} = withEmitters('a', {[EMITTER_ID]: emitterProfile()});
    refused(() => applyFrame([actor], frame(0, changing(...starting('other')))),
      MODEL_EMITTER_REFUSAL.undeclared('a', 'other'));
    refused(() => applyFrame([actor], frame(0, changing({change: MODEL_EMITTER_CHANGE.started, profile: 3}))),
      'Frame entity a emitters[0].profile must be a non-empty string.');
    refused(() => applyFrame([actor], frame(0, changing(emitterChange(MODEL_EMITTER_CHANGE.burst)))),
      MODEL_EMITTER_REFUSAL.burst('a', EMITTER_ID));
    refused(() => applyFrame([actor], frame(0, changing({...emitterChange(MODEL_EMITTER_CHANGE.started), rate: 3}))),
      MODEL_EMITTER_REFUSAL.routed('a', 'rate'));
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
    const changes = [...starting(EMITTER_ID), ...stopping(EMITTER_ID)];
    assert.equal(modelEmitterChanges(changes, 'a'), changes);
  });
  it('shows points once started, and keeps drawing them as they live out after a stop', () => {
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
    const {actor, points: [follows, stays]} = withEmitters('a', {follows: emitterProfile(), stays: environment});
    applyFrame([actor], frame(0, changing(...starting('follows', 'stays'))));
    const started = stays.matrixWorld.clone();
    actor.placement.position.set(3, 1, -2);
    actor.placement.updateMatrixWorld(true);
    actor.emitters.follow();
    assert.ok(follows.matrixWorld.equals(actor.placement.matrixWorld));
    assert.ok(!follows.matrixWorld.equals(started));
    assert.ok(stays.matrixWorld.equals(started));
  });
  it('starts an environment emitter where the same frame puts its actor', () => {
    const environment = {...emitterProfile(), emitterOrigin: MODEL_EMITTER_ORIGIN.environment};
    const {actor, points: [stays]} = withEmitters('a', {[EMITTER_ID]: environment});
    applyFrame([actor], frame(0, {...entity('a', [], [5, 0, 0]), emitters: starting(EMITTER_ID)}));
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
    const side = 1, atBudget = COVERAGE.most / side ** 2;
    const {actor: fits, visible} = withEmitters('a', {[EMITTER_ID]: emitterProfile(atBudget, side)});
    applyFrame([fits], frame(0, changing(...starting(EMITTER_ID))));
    assert.equal(visible(), 1);
    const {actor: big} = withEmitters('a', {[EMITTER_ID]: emitterProfile(atBudget + 1, side)});
    refused(() => applyFrame([big], frame(0, changing(...starting(EMITTER_ID)))),
      MODEL_EMITTER_REFUSAL.budget('coverage', atBudget + 1, COVERAGE.most));
  });
});
