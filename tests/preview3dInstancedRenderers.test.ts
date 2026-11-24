import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MODEL_FILE_ENTRY} from '../src/react/preview3d/surfaceModel.ts';
import {modelFileRenderers, modelRendererMaterials, modelRendererPrimitive, modelSurfaceSetCovers}
  from '../src/react/preview3d/renderers.ts';
import {modelStageDescription, modelStageDescriptionChanges} from '../src/react/preview3d/descriptionModel.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {modelSurfaceKinds} from '../src/react/preview3d/surfaceKindModel.ts';
import {INSTANCED_FILE, instancedGlb} from './preview3dInstancedFixture.ts';
import {NO_FILES, actorContext, declaration, describing, refused} from './preview3dActorFixture.ts';
import {createModelActor} from '../src/react/preview3d/actor.ts';
import {modelFileDrawn} from '../src/react/preview3d/drawn.ts';
import {MODEL_RUNTIME_MATERIAL as channel} from '../src/react/preview3d/runtimeMaterialModel.ts';
import {bindModelRuntimeMaterials} from '../src/react/preview3d/runtimeMaterialBinding.ts';

const load = () => new GLTFLoader().parseAsync(instancedGlb(), '');
const whole = (ids: Iterable<string>) => Object.fromEntries([...ids].map(id => [id, MODEL_FILE_ENTRY]));

describe('a file whose meshes are instanced (EXT_mesh_gpu_instancing)', () => {
  it('lists each instanced primitive as the renderer of its node, with its own primitive\'s material', async () => {
    const asset = await load(), renderers = modelFileRenderers(asset, 'a', 'a.gltf');
    assert.deepEqual([...renderers.keys()], INSTANCED_FILE.renderers.map(({id}) => id));
    for (const {id, instanced, material, mesh} of INSTANCED_FILE.renderers) {
      const renderer = renderers.get(id);
      assert.ok(renderer, id);
      assert.equal(renderer instanceof THREE.InstancedMesh, instanced, `${id} is instanced as its node states`);
      const [slot] = modelRendererMaterials(renderer);
      assert.equal(asset.parser.associations.get(slot)?.materials, material, `${id} draws its primitive's material`);
      assert.equal(modelRendererPrimitive(asset, renderer)?.mesh, mesh, `${id} draws its node's mesh`);
    }
    assert.doesNotThrow(() => modelSurfaceSetCovers('a', 'own', whole(renderers.keys()), renderers));
  });

  it('refuses by name an instanced mesh whose node states no mesh, or which stands outside its mesh\'s group',
    async () => {
      const unstated = await load();
      delete unstated.parser.json.nodes[1].mesh;
      refused(() => modelFileRenderers(unstated, 'a', 'a.gltf'),
        /glTF node 1 loaded an instanced mesh, but the file states no mesh for that node\./);
      const moved = await load(), [, , , , first] = INSTANCED_FILE.renderers;
      const renderer = modelFileRenderers(moved, 'a', 'a.gltf').get(first.id);
      assert.ok(renderer?.parent?.parent, first.id);
      renderer.parent.parent.add(renderer);
      refused(() => modelFileRenderers(moved, 'a', 'a.gltf'),
        /glTF node 3 loaded an instanced mesh of several primitives outside the group of its mesh 0\./);
    });

  it('binds an actor drawn from a set naming exactly its instanced renderers', async () => {
    const actor = createModelActor(modelFileDrawn(await load(), {actor: 'a', path: 'a.gltf'}, undefined),
      declaration('a', 'otter', {surfaces: {from: 'set', set: 'own'}}), actorContext().context);
    const parts = createModelStageParts({...NO_FILES, scene: new THREE.Scene(), kinds: modelSurfaceKinds([]),
      modes: createModelSurfaceModes(), frame: () => undefined, fog: createModelFog(new THREE.Scene()),
      lighting: {load: () => [], prepare: () => () => undefined}});
    const prepare = (set: object) => {
      const next = modelStageDescription(describing({surfaceSets: {own: set},
        actors: {focus: 'a', actors: [actor.declaration]}}));
      return parts.prepares(next, modelStageDescriptionChanges(undefined, next), [actor]).map(each => each());
    };
    const ids = INSTANCED_FILE.renderers.map(({id}) => id);
    assert.doesNotThrow(() => prepare(whole(ids)));
    refused(() => prepare(whole(ids.slice(1))),
      new RegExp(`Actor a: surface set own leaves out the file's renderers ${ids[0].replace('/', '\\/')}`));
    actor.dispose();
  });

  it('binds a runtime material profile to each instanced renderer by its node, mesh and primitive', async () => {
    const asset = await load(), renderers = modelFileRenderers(asset, 'a', 'a.gltf');
    const runtime = bindModelRuntimeMaterials(asset, {asset: {id: 'a', revision: 'tested', sha256: '1'.repeat(64)},
      profile: channel.profile, colorSpace: channel.colorSpace, emissionMask: channel.emissionMask,
      noiseBlend: channel.noiseBlend, nightBoost: channel.nightBoost,
      renderers: INSTANCED_FILE.renderers.map(({id, node, mesh, primitive}) =>
        ({rendererId: id, nodeIndex: node, meshIndex: mesh, primitiveIndex: primitive, slot: 0}))});
    const originals = new Map([...renderers].map(([id, renderer]) => [id, renderer.material]));
    runtime.prepare(INSTANCED_FILE.renderers.map(({id}) => ({rendererId: id, slot: 0, visible: true, colors: {},
      floats: {[channel.emissionStrength]: 1}})))();
    for (const [id, renderer] of renderers) assert.notEqual(renderer.material, originals.get(id), id);
    runtime.dispose();
  });
});
