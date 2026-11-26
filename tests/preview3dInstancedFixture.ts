import {modelRendererId} from '../src/react/preview3d/surfaceModel.ts';

// A glTF file whose nodes 0, 1 and 3 draw their meshes instanced (EXT_mesh_gpu_instancing): node 0 a mesh of two
// primitives, which three's loader makes a group of instanced meshes, node 1 a mesh of one, which it makes the node
// itself; node 2 draws node 1's mesh plain; node 3 draws node 0's mesh beside a camera, so the loader makes the node a
// group holding the camera and the mesh's group of instanced meshes. Each primitive has its own triangle and material,
// so a renderer read as the wrong primitive draws the wrong material. It is a binary glTF, its buffer in its own chunk,
// so it loads with no file.
const EXTENSION = 'EXT_mesh_gpu_instancing';
const FLOAT = 5126, VEC3 = 3, FLOATS_PER_VEC3 = 3, BYTES_PER_FLOAT = 4;
const TRIANGLES = Object.freeze([[0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 0, 0, 0, 1, 0, 0, 0, 1]]);
const TRANSLATIONS = Object.freeze([0, 0, 0, 2, 0, 0]);
// Each node: its mesh and whether it is instanced; each mesh: the triangle and material of each primitive.
const MESHES = Object.freeze([[{triangle: 0, material: 0}, {triangle: 1, material: 1}], [{triangle: 1, material: 2}]]);
const NODES = Object.freeze([{mesh: 0, instanced: true, camera: false}, {mesh: 1, instanced: true, camera: false},
  {mesh: 1, instanced: false, camera: false}, {mesh: 0, instanced: true, camera: true}]);
const CAMERA = Object.freeze({type: 'perspective', perspective: {yfov: 1, znear: 0.1}});

/** Every renderer the file draws, in the order the loader makes them, with the primitive and material each draws. */
export const INSTANCED_FILE = Object.freeze({renderers: Object.freeze(NODES.flatMap(({mesh, instanced}, node) =>
  MESHES[mesh].map(({material}, primitive) =>
    Object.freeze({id: modelRendererId(node, primitive), node, mesh, primitive, material, instanced}))))});

// One buffer view and accessor per run of vectors: the triangles, then the instances' translations.
function accessors(runs: readonly (readonly number[])[]) {
  let byteOffset = 0;
  return runs.map((values, index) => {
    const byteLength = values.length * BYTES_PER_FLOAT, view = {buffer: 0, byteOffset, byteLength};
    byteOffset += byteLength;
    const axes = [0, 1, 2].map(axis => values.filter((_, at) => at % FLOATS_PER_VEC3 === axis));
    return {view, accessor: {bufferView: index, componentType: FLOAT, type: 'VEC3',
      count: values.length / VEC3, min: axes.map(axis => Math.min(...axis)), max: axes.map(axis => Math.max(...axis))}};
  });
}

// A binary glTF's header and chunk types (glTF 2.0, "GLB File Format Specification"); a chunk pads to 4 bytes.
const GLB = Object.freeze({magic: 0x46546c67, version: 2, json: 0x4e4f534a, bin: 0x004e4942, align: 4, header: 12,
  chunkHeader: 8, jsonPad: 0x20});
const padded = (bytes: Uint8Array, pad: number) => {
  const out = new Uint8Array(Math.ceil(bytes.length / GLB.align) * GLB.align).fill(pad);
  out.set(bytes);
  return out;
};
/** The file as a binary glTF's bytes. */
export function instancedGlb(): ArrayBuffer {
  const {json, bin} = instancedGltf();
  const chunks = [{type: GLB.json, bytes: padded(new TextEncoder().encode(JSON.stringify(json)), GLB.jsonPad)},
    {type: GLB.bin, bytes: padded(bin, 0)}];
  const length = GLB.header + chunks.reduce((sum, {bytes}) => sum + GLB.chunkHeader + bytes.length, 0);
  const out = new ArrayBuffer(length), view = new DataView(out);
  [GLB.magic, GLB.version, length].forEach((word, index) => view.setUint32(index * 4, word, true));
  let offset = GLB.header;
  for (const {type, bytes} of chunks) {
    view.setUint32(offset, bytes.length, true);
    view.setUint32(offset + 4, type, true);
    new Uint8Array(out, offset + GLB.chunkHeader).set(bytes);
    offset += GLB.chunkHeader + bytes.length;
  }
  return out;
}
// The file's glTF JSON and its buffer's bytes.
function instancedGltf() {
  const runs = [...TRIANGLES, TRANSLATIONS], bytes = new Float32Array(runs.flat()), translation = TRIANGLES.length;
  const laid = accessors(runs);
  const json = {asset: {version: '2.0'}, extensionsUsed: [EXTENSION], scene: 0,
    scenes: [{nodes: NODES.map((_, at) => at)}],
    nodes: NODES.map(({mesh, instanced, camera}) => ({mesh, ...(camera && {camera: 0}),
      ...(instanced && {extensions: {[EXTENSION]: {attributes: {TRANSLATION: translation}}}})})),
    cameras: [CAMERA],
    meshes: MESHES.map(primitives => ({primitives: primitives.map(({triangle, material}) =>
      ({attributes: {POSITION: triangle}, material}))})),
    materials: MESHES.flat().map(() => ({pbrMetallicRoughness: {}})),
    buffers: [{byteLength: bytes.byteLength}],
    bufferViews: laid.map(({view}) => view), accessors: laid.map(({accessor}) => accessor)};
  return {json, bin: new Uint8Array(bytes.buffer)};
}
