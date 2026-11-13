import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {createModelFog} from '../src/react/preview3d/fog.ts';
const FOG = createModelFog(new THREE.Scene()).change;
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MODEL_RUNTIME_MATERIAL as channel, modelRuntimeMaterialProfile}
  from '../src/react/preview3d/runtimeMaterialModel.ts';
import {bindModelRuntimeMaterials} from '../src/react/preview3d/runtimeMaterialBinding.ts';
import {modelPreviewCamera} from '../src/react/preview3d/presentation.ts';
import {modelRuntimeAssetProfile} from '../src/react/preview3d/actorModel.ts';
import {createModelFrameInbox} from '../src/react/preview3d/frameInbox.ts';
import {actorContext, describing, REST, STANDING} from './preview3dActorFixture.ts';
import {applyModelFrame, createModelActor} from '../src/react/preview3d/actor.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {prepareWhole} from '../src/react/preview3d/commit.ts';

const rendererId = 'body';
const profile = () => ({asset: {id: 'otter', revision: 'tested', sha256: '1'.repeat(64)},
  profile: channel.profile, colorSpace: channel.colorSpace,
  emissionMask: channel.emissionMask, noiseBlend: channel.noiseBlend, nightBoost: channel.nightBoost,
  renderers: [{rendererId, nodeIndex: 65, meshIndex: 0, primitiveIndex: 0, slot: 0}]});
const material = () => ({rendererId, slot: 0, visible: true, colors: {},
  floats: {[channel.emissionStrength]: 2.8}});
// The one declared actor otter, whose asset carries the profile, and an inbox of one-entity frames for it.
const actor = (runtimeMaterials: unknown = profile()) => ({id: 'otter', placement: STANDING,
  animation: REST, asset: {id: 'otter', revision: 'tested', path: '/otter.glb',
    attachments: {}, sha256: '1'.repeat(64), runtimeMaterials: runtimeMaterials as ReturnType<typeof profile>}});
const createInbox = (runtimeMaterials?: unknown) => {
  const inbox = createModelFrameInbox(), actors = [actor(runtimeMaterials)];
  return {attach: inbox.attach, receive: (value: ReturnType<typeof frame>) =>
    inbox.receive({simulationTimeSeconds: 0, entities: [value]}, actors)};
};
const frame = () => ({entityId: 'otter', modelId: 'otter', pose: {position: [1, 2, 3], rotationQuaternion: [0, 0, 0, 1],
  scale: [1, 1, 1]}, materials: [material()], animationLayers: [], partPoses: []});

test('requires explicit shader simplifications and rejects incomplete, ambiguous or unsupported bindings', () => {
  assert.equal(modelRuntimeMaterialProfile(profile()).renderers[0].nodeIndex, 65);
  for (const key of ['emissionMask', 'colorSpace', 'profile', 'noiseBlend', 'nightBoost']) {
    const value: Record<string, unknown> = profile(); delete value[key];
    assert.throws(() => modelRuntimeMaterialProfile(value), /Unsupported/);
  }
  assert.throws(() => modelRuntimeMaterialProfile({...profile(), noiseBlend: .5}), /Unsupported/);
  const duplicate = profile(); duplicate.renderers.push({...duplicate.renderers[0], rendererId: 'second-name'});
  assert.throws(() => modelRuntimeMaterialProfile(duplicate), /Duplicate/);
});
test('the full-frame inbox refuses a material fault before delivering any new pose', () => {
  const inbox = createInbox();
  const delivered: unknown[] = [];
  inbox.attach(value => delivered.push(value));
  assert.equal(inbox.receive(frame()), 'ready');
  const invalid = frame(); invalid.pose.position[0] = 99; invalid.materials[0].floats[channel.emissionStrength] = NaN;
  assert.equal(inbox.receive(invalid), 'error'); assert.equal(delivered.length, 1);
  const unknown = frame(); unknown.materials[0].rendererId = 'missing';
  assert.equal(inbox.receive(unknown), 'error'); assert.equal(delivered.length, 1);
  assert.equal(inbox.receive(frame()), 'ready'); assert.equal(delivered.length, 2);
});
test('glTF node/primitive associations identify bindings independently of names and order', () => {
  const scene = new THREE.Group(), node = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial());
  scene.add(new THREE.Group(), node); node.add(mesh); mesh.name = 'an unrelated display label';
  const associations = new Map<THREE.Object3D, {nodes?: number; meshes?: number; primitives?: number}>([
    [node, {nodes: 65, meshes: 0}], [mesh, {meshes: 0, primitives: 0}],
  ]);
  const asset = {scene, parser: {associations}} as unknown as GLTF;
  const original = mesh.material;
  const runtime = bindModelRuntimeMaterials(asset, profile());
  runtime.prepare([material()])(); assert.notEqual(mesh.material, original);
  runtime.dispose(); assert.equal(mesh.material, original);
  const missing = profile(); missing.renderers[0].nodeIndex = 66;
  assert.throws(() => bindModelRuntimeMaterials(asset, missing), /uniquely/);
  original.emissiveMap = new THREE.Texture();
  assert.throws(() => bindModelRuntimeMaterials(asset, profile()), /white emission-mask/);
  original.emissiveMap.dispose(); original.dispose(); mesh.geometry.dispose();
});
test('camera data is finite, nondegenerate and independent of caller arrays', () => {
  const value = {position: [0, 4, 8], target: [0, 0, 0]}, camera = modelPreviewCamera(value);
  value.position[0] = 99; assert.deepEqual(camera.position, [0, 4, 8]);
  assert.throws(() => modelPreviewCamera({...value, target: [NaN, 0, 0]}), /finite/);
  assert.throws(() => modelPreviewCamera({position: [0, 0, 0], target: [0, 0, 0]}), /distinct/);
  assert.throws(() => modelPreviewCamera({position: [1e308, 0, 0], target: [-1e308, 0, 0]}), /distinct/);
});
test('runtime profiles bind exact source identity and freeze caller-owned data', () => {
  const value = profile(), asset = {id: 'otter', revision: 'tested', path: '/otter.glb', attachments: {},
    sha256: value.asset.sha256, runtimeMaterials: value};
  const accepted = modelRuntimeAssetProfile({id: 'otter', placement: STANDING, animation: actor().animation, asset})!;
  value.asset.id = 'different'; value.renderers[0].slot = 1;
  assert.equal(accepted.asset.id, 'otter'); assert.equal(accepted.renderers[0].slot, 0);
  for (const change of [{id: 'different'}, {revision: 'different'}, {sha256: '0'.repeat(64)}]) {
    const changed = {...actor(), asset: {...asset, runtimeMaterials: profile(), ...change}};
    assert.throws(() => modelRuntimeAssetProfile(changed),
      /^ModelStageRefusal: Actor otter: the runtime material profile (belongs to another|does not match)/);
  }
  const inbox = createInbox();
  assert.equal(inbox.receive(frame()), 'pending');
  const malformed = profile(); malformed.asset.sha256 = 'unverified';
  assert.throws(() => modelRuntimeMaterialProfile(malformed), /SHA/);
});
test('sparse renderer lists and material outputs are rejected before a frame is delivered', () => {
  const sparse = profile(); sparse.renderers = new Array(1);
  assert.throws(() => modelRuntimeMaterialProfile(sparse), /bindings/);
  const inbox = createInbox();
  let delivered = 0; inbox.attach(() => delivered++);
  assert.equal(inbox.receive({...frame(), materials: new Array(1)}), 'error');
  assert.equal(delivered, 0);
});
test('a display change after a frame leaves the engine\'s hidden renderer hidden, without applying the frame again',
  t => {
    const scene = new THREE.Group(), node = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial());
    scene.add(node); node.add(mesh);
    const associations = new Map<THREE.Object3D, {nodes?: number; meshes?: number; primitives?: number}>([
      [node, {nodes: 65, meshes: 0}], [mesh, {meshes: 0, primitives: 0}]]);
    const asset = {scene, animations: [], parser: {associations}} as unknown as GLTF;
    const model = createModelActor(asset, actor(), actorContext().context);
    const parts = createModelStageParts({scene: new THREE.Scene(), fog: {change: FOG},
      lighting: {load: () => [], prepare: () => () => undefined}, frame: () => undefined});
    const show = (display: string) => prepareWhole(parts.prepares(modelStageDescription(describing({display})),
      new Set(['display']), [model]))();
    const outputs = (visible: boolean) => ({simulationTimeSeconds: 0, entities: [{...frame(), materials: [
      {...material(), visible}]}]});
    applyModelFrame([model], outputs(false));
    const prepare = t.mock.method(model, 'prepare');
    for (const display of ['rig', 'both', 'model']) {
      show(display);
      assert.equal(mesh.visible, false, display);
    }
    assert.equal(prepare.mock.callCount(), 0);
    prepare.mock.restore();
    applyModelFrame([model], outputs(true));
    assert.equal(mesh.visible, true);
    show('rig');
    assert.equal(mesh.visible, false);
    show('model');
    assert.equal(mesh.visible, true);
    model.dispose();
  });
