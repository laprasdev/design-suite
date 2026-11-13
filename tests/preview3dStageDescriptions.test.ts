import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelStageDescriptions} from '../src/react/preview3d/stageDescriptions.ts';
import {createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {createModelStageSharedValues} from '../src/react/preview3d/sharedValues.ts';
import {modelStagePolicy} from '../src/react/preview3d/model.ts';
import {modelDrawnMeshCount} from '../src/react/preview3d/asset.ts';
import {declaration, describing, makeActor} from './preview3dActorFixture.ts';
import {kindFile, MASK, PULSE, PULSE_PROGRAM, record, RENDERERS} from './preview3dKindFixture.ts';

// A stage's descriptions with everything but WebGL real: its registries, actors and parts. The scene side is a plain
// scene whose lighting load the test holds; files are read from memory, and every read and model load records its
// signal, so what is let go of is seen.
function stageWith(lightingLoad: () => readonly Promise<void>[] = () => []) {
  const scene = new THREE.Scene(), signals: AbortSignal[] = [], closed: string[] = [];
  const files: Record<string, Uint8Array> = {[PULSE.webProgram.path]: new TextEncoder().encode(PULSE_PROGRAM),
    [MASK.path]: new Uint8Array([1, 2, 3])};
  const descriptions = createModelStageDescriptions({
    policy: modelStagePolicy({reviewKey: 'review', clock: 'local', floor: false, grid: false, kinds: [PULSE as never]}),
    theme: {colors: {stage: '#000000', text: '#ffffff', surface: '#111111', surfaceHi: '#222222', accent: '#ff0000',
      accentDeep: '#880000', teal: '#00ffff'}},
    stage: {scene, fog: createModelFog(scene), shared: createModelStageSharedValues(), compile: () => undefined,
      lighting: {load: lightingLoad, prepare: () => () => undefined, attach: () => () => undefined},
      frame: () => undefined, requestFit: () => undefined},
    modes: createModelSurfaceModes(),
    load: async (path, sha256, signal) => {signals.push(signal); return kindFile().asset;},
    read: async (path, sha256, signal) => {signals.push(signal); return files[path].slice().buffer;},
    decode: async () => ({image: {} as TexImageSource, close: () => {closed.push(MASK.path);}}),
  });
  return {descriptions, signals, closed};
}
const tinted = () => describing({surfaceSets: {tinted: {[RENDERERS.body]: record(), [RENDERERS.eyes]: {kind: 'file'},
  [RENDERERS.line]: {kind: 'file'}}}, actors: {focus: 'a', actors: [declaration('a', 'otter',
  {surfaces: {from: 'set', set: 'tinted'}})]}});

describe('the stage\'s descriptions, composed', () => {
  it('waits for what the description\'s parts load, as for its models, before it applies it', async () => {
    let arrive = () => undefined as void;
    const look = new Promise<void>(done => {arrive = done;});
    const {descriptions} = stageWith(() => [look]);
    const applied = descriptions.set(describing());
    await new Promise(done => setTimeout(done, 0));
    assert.deepEqual([descriptions.applied, descriptions.actors.pending], [undefined, true]);
    arrive();
    await applied;
    assert.deepEqual([descriptions.applied?.actors.focus, descriptions.actors.pending], ['a', false]);
  });

  it('frees, when disposed, every registry: what a drawn kind holds, and every read still in flight', async () => {
    const {descriptions, signals, closed} = stageWith();
    await descriptions.set(tinted());
    const body = descriptions.actors.actors[0].asset.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh;
    const material = body.material as THREE.ShaderMaterial;
    let freed = 0;
    material.addEventListener('dispose', () => freed++);
    const later = descriptions.set(describing({actors: {focus: 'b', actors: [declaration('b', 'heron')]}}));
    descriptions.dispose();
    assert.equal(material.name, `surface kind ${PULSE.id}`);
    assert.deepEqual([freed, closed], [1, [MASK.path]], 'the kind\'s material and its texture\'s image');
    assert.equal(signals.at(-1)?.aborted, true, 'the later model\'s load is let go of');
    await later;
  });
});

describe('what the snapshot reads, and only when asked', () => {
  it('counts the meshes the camera\'s last frame drew: shown, and inside its view', () => {
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld();
    const root = new THREE.Group(), shape = new THREE.BoxGeometry();
    const seen = new THREE.Mesh(shape), behind = new THREE.Mesh(shape), hidden = new THREE.Mesh(shape);
    const unculled = new THREE.Mesh(shape);
    behind.position.z = 20;
    unculled.position.z = 20;
    unculled.frustumCulled = false;
    hidden.visible = false;
    root.add(seen, behind, hidden, unculled);
    root.updateMatrixWorld(true);
    assert.equal(modelDrawnMeshCount([root], camera), 2);
    assert.equal(modelDrawnMeshCount([], camera), 0, 'an actor no longer on the stage is no longer counted');
  });

  it('moves no rig the display hides, and moves it the first frame a display shows it', () => {
    const {actor, bone} = makeActor('a', []);
    const joints = actor.rig.root.children.find(node => node instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const at = () => {joints.getMatrixAt(0, matrix); return new THREE.Vector3().setFromMatrixPosition(matrix).x;};
    const before = at();
    bone.position.x += 5;
    actor.placement.updateMatrixWorld(true);
    actor.rig.update();
    assert.equal(at(), before, 'hidden in the Model display: nothing moved');
    actor.setDisplay('both');
    actor.rig.update();
    assert.equal(at(), bone.getWorldPosition(new THREE.Vector3()).x);
    assert.notEqual(at(), before);
  });
});
