// Each part's own validation throws the stage's one refusal type, before it changes anything.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {createModelEnvironment} from '../src/react/preview3d/environment.ts';
import {createModelRuntimeMaterials} from '../src/react/preview3d/runtimeMaterials.ts';
import {createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {prepareWhole} from '../src/react/preview3d/commit.ts';
import type {ModelActor} from '../src/react/preview3d/actor.ts';
import {createModelLighting} from '../src/react/preview3d/lighting.ts';
import {modelStageBuiltInTimes} from '../src/react/preview3d/lightingModel.ts';
import {createModelStage} from '../src/react/preview3d/stage.ts';
import {describing} from './preview3dActorFixture.ts';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';

const refused = (run: () => unknown, pattern: RegExp) =>
  assert.throws(run, (error: unknown) => error instanceof ModelStageRefusal && pattern.test(error.message));
const theme = {colors: {stage: '#000000', text: '#ffffff', surface: '#111111', surfaceHi: '#222222',
  accent: '#ff0000', accentDeep: '#880000', teal: '#00ffff'}};

test('environment.ts: an invalid update is a refusal and moves no box', () => {
  const value = {reflectZ: false, plane: null, boxes: [{id: 'box', position: [1, 2, 3], size: [1, 1, 1],
    color: [.5, .5, .5]}]};
  const environment = createModelEnvironment(value, createModelFog(new THREE.Scene()).change);
  const box = environment.group.getObjectByName('box')!;
  refused(() => environment.update({...value, boxes: [{...value.boxes[0], position: [9, 9, 9], color: [2, 0, 0]}]}),
    /The environment box box.color must be three finite numbers, sRGB in \[0, 1\]/);
  assert.deepEqual(box.position.toArray(), [1, 2, 3]);
  environment.dispose();
});

test('runtimeMaterials.ts: an unknown renderer is a refusal and installs no material', () => {
  const original = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
  const materials = createModelRuntimeMaterials([{rendererId: 'body', slot: 0, mesh}]);
  refused(() => materials.prepare([{rendererId: 'ghost', slot: 0, visible: true, colors: {}, floats: {}}]),
    /Unknown or repeated runtime renderer\/slot/);
  assert.equal(mesh.material, original);
  materials.dispose();
});

test('stageParts.ts: a Surface mode an actor cannot show is a refusal and leaves the mode', () => {
  const modes = createModelSurfaceModes();
  const parts = createModelStageParts({scene: new THREE.Scene(), fog: createModelFog(new THREE.Scene()),
    kinds: new Map(), modes, lighting: {load: () => [], prepare: () => () => undefined}, frame: () => undefined});
  const clay = modelStageDescription(describing({materialMode: 'clay'}));
  const actor = {id: 'plain', driver: 'host', rig: {display: clay.display}, sizing: {size: clay.size,
    origin: clay.origin}, materials: {available: false, emissiveMaterialCount: 0,
    refresh: () => assert.fail('nothing recompiles')}} as unknown as ModelActor;
  refused(() => prepareWhole(parts.prepares(clay, new Set(['materialMode']), [actor])),
    /Actor plain does not support material inspection/);
  assert.equal(modes.mode, 'lit');
  refused(() => modelStageDescription(describing({materialMode: 'xray'})), /Unknown material inspection mode/);
});

test('lightingModel.ts: an unknown time is a refusal and leaves the light', () => {
  const lighting = createModelLighting({setClearColor: () => undefined}, modelStageBuiltInTimes(theme.colors),
    {fog: createModelFog(new THREE.Scene()), output: {load: () => [], prepare: () => () => undefined}});
  const before = lighting.lights[0].intensity;
  refused(() => lighting.prepare({time: 'dusk', times: []})(), /The lighting.time names dusk/);
  assert.deepEqual([lighting.time, lighting.lights[0].intensity], ['light', before]);
});

test('stage.ts: a theme the stage refuses is refused before any renderer, canvas or control exists', () => {
  // In node there is no WebGL: anything that reached the renderer would fail with another error than this refusal.
  const host = {append: () => assert.fail('nothing is added to the host')} as unknown as HTMLElement;
  const options = {reviewKey: 'review', clock: 'local', floor: true, grid: true, kinds: []} as const;
  const short = {colors: {...theme.colors, surface: '#fff'}};
  refused(() => createModelStage(host, modelStageDescription(describing()), short, () => undefined, () => undefined,
    options), /The stage theme's surface must be a #rrggbb colour; it is #fff/);
});
