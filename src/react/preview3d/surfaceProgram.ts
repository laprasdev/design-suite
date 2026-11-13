import * as THREE from 'three';
import {MODEL_SURFACE_COVERAGE, MODEL_SURFACE_LIGHT, MODEL_SURFACE_PARAMETER, MODEL_SURFACE_SIDE,
  type ModelSurfaceKind, type ModelSurfaceParameter} from './surfaceKindModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {modelShaderChunk, modelShaderReplace, modelShaderUniforms} from './shading.ts';

// A kind's web program placed into three's own program, the one way the stage makes a kind's material. The kind's GLSL
// defines `kindSurface`; the stage declares what it may read before it and calls it once, just before three's
// <emissivemap_fragment>, where three's diffuse and emissive terms are whole and nothing has lit them yet. Every
// parameter that is not a texture is one vec4 of the kind's values (a colour whole, a vector in its first components, a
// float or keyword in x); a texture is a sampler and one vec4 of its sampling (scale in xy, offset in zw). The kind
// reads each through its accessor, `surfaceParameter` and the parameter's name, so it never names a uniform.
export const MODEL_SURFACE_GLSL = Object.freeze({accessor: 'surfaceParameter', values: 'surfaceValues',
  texture: 'surfaceTexture', surface: 'kindSurface'});
const CHUNK = Object.freeze({declarations: 'clipping_planes_pars_fragment', surface: 'emissivemap_fragment'});
/** What each `light` builds on: three's own program and what it is drawn with. Only lit kinds are built yet. */
interface Base {
  readonly shader: THREE.ShaderLibShader;
  readonly defines: Record<string, string>;
  readonly lights: boolean;
}
const BASES: Readonly<Partial<Record<ModelSurfaceKind['light'], Base>>> = Object.freeze({
  [MODEL_SURFACE_LIGHT.standard]: {shader: THREE.ShaderLib.standard, defines: {STANDARD: ''}, lights: true}});
/** The vertex attributes a kind may read, each through three's own varying: 'uv' as vUv, 'color' as vColor (which
 * three has already multiplied into the diffuse term when the kind's surface runs). */
const ATTRIBUTES = Object.freeze({uv: {defines: {USE_UV: ''}, vertexColors: false},
  color: {defines: {}, vertexColors: true}});
const SIDES = Object.freeze({[MODEL_SURFACE_SIDE.front]: THREE.FrontSide, [MODEL_SURFACE_SIDE.back]: THREE.BackSide,
  [MODEL_SURFACE_SIDE.double]: THREE.DoubleSide});
// Coverage as three's render state: a cut-out writes its alpha as coverage across the samples, a blended surface is
// sorted and blended and writes no depth.
const COVERAGE = Object.freeze({[MODEL_SURFACE_COVERAGE.opaque]: {alphaToCoverage: false, transparent: false},
  [MODEL_SURFACE_COVERAGE.cutout]: {alphaToCoverage: true, transparent: false},
  [MODEL_SURFACE_COVERAGE.blended]: {alphaToCoverage: false, transparent: true}});
export const MODEL_SURFACE_PROGRAM_TEXT = Object.freeze({
  light: (kind: string, light: string) => `Surface kind ${kind}: light ${light} is not built in the web stage yet; ` +
    `it builds ${Object.keys(BASES).join(', ')}.`,
  displacement: (kind: string) => `Surface kind ${kind}: displacement is not built in the web stage yet.`,
  attribute: (kind: string, name: string) => `Surface kind ${kind}: attribute ${name} is not one the web stage hands ` +
    `a kind; it hands ${Object.keys(ATTRIBUTES).join(', ')}.`,
});

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

/** A kind this stage can draw, and the program it builds on; refused by name when the stage is given one it cannot. */
export function modelSurfaceDrawable(kind: ModelSurfaceKind): Base {
  const base = BASES[kind.light];
  if (!base) throw new ModelStageRefusal(MODEL_SURFACE_PROGRAM_TEXT.light(kind.id, kind.light));
  if (kind.displacement !== null) throw new ModelStageRefusal(MODEL_SURFACE_PROGRAM_TEXT.displacement(kind.id));
  const unhanded = kind.attributes.find(name => !(name in ATTRIBUTES));
  if (unhanded) throw new ModelStageRefusal(MODEL_SURFACE_PROGRAM_TEXT.attribute(kind.id, unhanded));
  return base;
}

const VECTOR = Object.freeze({2: ['vec2', 'xy'], 3: ['vec3', 'xyz'], 4: ['vec4', 'xyzw']});
function accessor({index, name, parameter}: ModelSurfaceSlot) {
  const {accessor: of, values, texture} = MODEL_SURFACE_GLSL, slot = `${values}[ ${index} ]`;
  if (parameter.type === MODEL_SURFACE_PARAMETER.texture) {
    return `vec4 ${of}${name}( vec2 uv ) { return texture2D( ${texture}${name}, uv * ${slot}.xy + ${slot}.zw ); }`;
  }
  if (parameter.type === MODEL_SURFACE_PARAMETER.color) return `vec4 ${of}${name}() { return ${slot}; }`;
  if (parameter.type === MODEL_SURFACE_PARAMETER.vector) {
    const [type, part] = VECTOR[parameter.size];
    return `${type} ${of}${name}() { return ${slot}.${part}; }`;
  }
  if (parameter.type === MODEL_SURFACE_PARAMETER.keyword) return `bool ${of}${name}() { return ${slot}.x > 0.5; }`;
  return `float ${of}${name}() { return ${slot}.x; }`;
}

/** A kind's material, before its values: three's program for its light with the kind's program placed in it. */
export function createModelSurfaceProgram(kind: ModelSurfaceKind, program: string, shared: string) {
  const base = modelSurfaceDrawable(kind), slots = [...modelSurfaceSlots(kind).values()];
  const textures = slots.filter(({parameter}) => parameter.type === MODEL_SURFACE_PARAMETER.texture);
  const read = kind.attributes.map(name => ATTRIBUTES[name as keyof typeof ATTRIBUTES]);
  const declarations = [shared, slots.length ? `uniform vec4 ${MODEL_SURFACE_GLSL.values}[ ${slots.length} ];` : '',
    modelShaderUniforms(Object.fromEntries(textures.map(({name}) => [`${MODEL_SURFACE_GLSL.texture}${name}`,
      'sampler2D']))), ...slots.map(accessor), program].join('\n');
  const replace = modelShaderReplace(`surface kind ${kind.id}`);
  const call = `${MODEL_SURFACE_GLSL.surface}( diffuseColor, totalEmissiveRadiance );`;
  const declared = replace(base.shader.fragmentShader, CHUNK.declarations,
    `${modelShaderChunk(CHUNK.declarations)}\n${declarations}`);
  const fragmentShader = replace(declared, CHUNK.surface, `${call}\n${modelShaderChunk(CHUNK.surface)}`);
  return {slots, textures, fragmentShader, make(uniforms: Record<string, THREE.IUniform>) {
    return new THREE.ShaderMaterial({vertexShader: base.shader.vertexShader, fragmentShader, uniforms,
      defines: Object.assign({}, base.defines, ...read.map(({defines}) => defines)), lights: base.lights,
      vertexColors: read.some(({vertexColors}) => vertexColors), fog: kind.fog, side: SIDES[kind.side],
      ...COVERAGE[kind.coverage], depthWrite: kind.coverage !== MODEL_SURFACE_COVERAGE.blended});
  }, baseUniforms: () => THREE.UniformsUtils.clone(base.shader.uniforms)};
}
export type ModelSurfaceProgram = ReturnType<typeof createModelSurfaceProgram>;
