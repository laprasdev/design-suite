// The kind the seam is proven with: tests only, never shipped (Bloom's kinds live in bloom-3d-design). A flat colour
// whose emission pulses on the stage's decorative time, with one of every other value form beside it.
import * as THREE from 'three';
import {modelSurfaceKinds} from '../src/react/preview3d/surfaceKindModel.ts';
import {modelSurfaceSets} from '../src/react/preview3d/surfaceModel.ts';
import {createModelSurfaceMaterials} from '../src/react/preview3d/surfaceMaterials.ts';
import {createModelStageSharedValues} from '../src/react/preview3d/sharedValues.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {createModelSurfaceModes, modelStageChanges} from '../src/react/preview3d/materials.ts';

export const PULSE = Object.freeze({id: 'test-pulse', parameters: {_Color: {type: 'color', space: 'srgb', hdr: false},
  _Glow: {type: 'color', space: 'linear', hdr: true}, _Pulse: {type: 'float'}, _Rim: {type: 'float'},
  _Offset: {type: 'vector', size: 2}, _On: {type: 'keyword'}, _Mask: {type: 'texture', space: 'linear'}},
inert: {_Rim: 0}, attributes: ['uv'], light: 'standard', coverage: 'opaque', side: 'front', fog: true,
displacement: null, webProgram: {path: '/pulse.glsl', sha256: 'a'.repeat(64)}});
export const PULSE_PROGRAM = `void kindSurface( inout vec4 diffuse, inout vec3 emissive ) {
  diffuse.rgb = surfaceParameter_Color().rgb;
  emissive = diffuse.rgb * surfaceParameter_Pulse() * ( 0.5 + 0.5 * sin( stageDecorativeSeconds ) );
}`;
export const MASK = Object.freeze({path: '/mask.png', sha256: 'b'.repeat(64), wrap: ['repeat', 'clamp'],
  scale: [2, 3], offset: [0.25, 0.5]});
export const record = (color = [1, 0.5, 0, 1], pulse = 2) => ({kind: 'test-pulse', values: {_Color: {color},
  _Glow: {color: [4, 2, 0, 1]}, _Pulse: {float: pulse}, _Rim: {float: 0}, _Offset: {vector: [0.5, -1]},
  _On: {keyword: true}, _Mask: {texture: MASK}}});
export const RENDERERS = Object.freeze({body: 'gltf-node:2/primitive:0', eyes: 'gltf-node:2/primitive:1',
  line: 'gltf-node:3/primitive:0'});
export const kinds = () => modelSurfaceKinds([PULSE]);
/** A set over the file below: the body by `body`, the eyes by the file's own material, the line likewise. */
export const sets = (body: unknown = record()) => modelSurfaceSets({tinted: {[RENDERERS.body]: body,
  [RENDERERS.eyes]: {kind: 'file'}, [RENDERERS.line]: {kind: 'file'}}});

/** A loaded file as the loader associates it: node 2 holds a mesh of two primitives, node 3 a line. */
export function kindFile() {
  const scene = new THREE.Group(), node = new THREE.Group(), associations = new Map<object, object>();
  const [body, eyes] = [0, 1].map(() => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
  node.add(body, eyes);
  scene.add(node, line);
  associations.set(node, {nodes: 2});
  associations.set(body, {meshes: 0, primitives: 0});
  associations.set(eyes, {meshes: 0, primitives: 1});
  associations.set(line, {nodes: 3, meshes: 1, primitives: 0});
  return {asset: {scene, animations: [], parser: {associations}} as never, body, eyes, line};
}

/** The stage's kind materials over a texture registry that records what it was asked, with the program loaded. */
export async function kindMaterials() {
  const acquired: unknown[] = [], released: THREE.Texture[] = [];
  const shared = createModelStageSharedValues(), fog = createModelFog(new THREE.Scene());
  const modes = createModelSurfaceModes();
  const materials = createModelSurfaceMaterials({kinds: kinds(), shared, changes: modelStageChanges(fog.change, modes),
    read: async () => new TextEncoder().encode(PULSE_PROGRAM).buffer,
    textures: {acquire: value => {acquired.push(value); return new THREE.Texture();},
      release: texture => {released.push(texture);}}});
  const load = materials.load([record() as never]);
  await Promise.all(load.pending);
  return {materials, shared, fog, modes, acquired, released, load};
}
