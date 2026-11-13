import {MODEL_SURFACE_PARAMETER, type ModelSurfaceKind, type ModelSurfaceParameter} from './surfaceKindModel.ts';

// The names a kind's web program and the stage share (kind-contract.md lists every one as reserved), and the accessors
// a kind reads its parameters through. Every parameter that is not a texture is one vec4 of the kind's values (a
// colour whole, a vector in its first components, a float or keyword in x); a texture is a sampler and one vec4 of its
// sampling (scale in xy, offset in zw). The kind reads each through its accessor, `surfaceParameter` and the
// parameter's name, so it never names a uniform. A texture has two more: its sampling as Unity's `_ST` holds a
// texture's tiling and offset (`surfaceTiling`: scale in xy, offset in zw), and a lookup at a uv as given
// (`surfaceSample`), so a port that samples every map at one map's tiling (URP Lit, at _BaseMap's) reads exactly that.
export const MODEL_SURFACE_GLSL = Object.freeze({accessor: 'surfaceParameter', values: 'surfaceValues',
  texture: 'surfaceTexture', surface: 'kindSurface', attribute: 'surfaceAttribute', emissive: 'kindEmissive',
  vertexStage: 'KIND_VERTEX_STAGE', normal: 'kindNormal', view: 'kindViewDirection', object: 'kindObjectPosition',
  tiling: 'surfaceTiling', sample: 'surfaceSample', viewNormal: 'kindViewNormal',
  fromMap: 'kindNormalFromTangentSpace', occlusion: 'kindOcclusion', roughness: 'kindRoughness',
  metalness: 'kindMetalness', coverage: 'kindCoverage'});

/** Where each parameter sits in a kind's values: one vec4 apiece, in the declaration's order. */
export interface ModelSurfaceSlot {
  readonly index: number;
  readonly name: string;
  readonly parameter: ModelSurfaceParameter;
}
export function modelSurfaceSlots(kind: ModelSurfaceKind): ReadonlyMap<string, ModelSurfaceSlot> {
  return new Map(Object.entries(kind.parameters).map(([name, parameter], index) => [name,
    Object.freeze({index, name, parameter})]));
}

const VECTOR = Object.freeze({2: ['vec2', 'xy'], 3: ['vec3', 'xyz'], 4: ['vec4', 'xyzw']});
/** The GLSL a kind reads one parameter by. */
export function modelSurfaceAccessor({index, name, parameter}: ModelSurfaceSlot) {
  const {accessor: of, values, texture, tiling, sample} = MODEL_SURFACE_GLSL, slot = `${values}[ ${index} ]`;
  if (parameter.type === MODEL_SURFACE_PARAMETER.texture) {
    return [`vec4 ${of}${name}( vec2 uv ) { return texture2D( ${texture}${name}, uv * ${slot}.xy + ${slot}.zw ); }`,
      `vec4 ${tiling}${name}() { return ${slot}; }`,
      `vec4 ${sample}${name}( vec2 uv ) { return texture2D( ${texture}${name}, uv ); }`].join('\n');
  }
  if (parameter.type === MODEL_SURFACE_PARAMETER.color) return `vec4 ${of}${name}() { return ${slot}; }`;
  if (parameter.type === MODEL_SURFACE_PARAMETER.vector) {
    const [type, part] = VECTOR[parameter.size];
    return `${type} ${of}${name}() { return ${slot}.${part}; }`;
  }
  if (parameter.type === MODEL_SURFACE_PARAMETER.keyword) return `bool ${of}${name}() { return ${slot}.x > 0.5; }`;
  return `float ${of}${name}() { return ${slot}.x; }`;
}
