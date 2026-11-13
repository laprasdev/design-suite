import * as THREE from 'three';
import {MODEL_SURFACE_COVERAGE, MODEL_SURFACE_LIGHT, MODEL_SURFACE_PARAMETER, MODEL_SURFACE_SIDE, modelAttributeName,
  type ModelSurfaceAttribute, type ModelSurfaceKind, type ModelSurfaceParameter} from './surfaceKindModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {modelShaderChunk, modelShaderReplace, modelShaderUniforms, type ModelShaderReplace} from './shading.ts';

// A kind's web program placed into three's own program, the one way the stage makes a kind's material. The kind's GLSL
// defines `kindSurface`; the stage declares what it may read before it and calls it once where three's diffuse and
// emissive terms are whole and nothing has lit them yet. Every parameter that is not a texture is one vec4 of the
// kind's values (a colour whole, a vector in its first components, a float or keyword in x); a texture is a sampler and
// one vec4 of its sampling (scale in xy, offset in zw). The kind reads each through its accessor, `surfaceParameter`
// and the parameter's name, so it never names a uniform. A kind that moves vertices defines `kindDisplacement` too; its
// text is then compiled into the vertex stage as well, where KIND_VERTEX_STAGE is defined: what only a fragment stage
// has must sit inside `#ifndef KIND_VERTEX_STAGE`, and everything else compiles in both stages.
export const MODEL_SURFACE_GLSL = Object.freeze({accessor: 'surfaceParameter', values: 'surfaceValues',
  texture: 'surfaceTexture', surface: 'kindSurface', attribute: 'surfaceAttribute', emissive: 'kindEmissive',
  vertexStage: 'KIND_VERTEX_STAGE'});
const CHUNK = Object.freeze({declarations: 'clipping_planes_pars_fragment', emission: 'emissivemap_fragment',
  basic: 'specularmap_fragment', output: 'envmap_fragment', vertexDeclarations: 'clipping_planes_pars_vertex',
  begin: 'begin_vertex', project: 'project_vertex'});
/**
 * The one place a kind moves vertices: after three's morphs and skinning, before its projection. The kind is given
 * the vertex's world position and returns how far it moves, in world space (metres); the stage takes that offset to
 * the object's space with the inverse of the object's world transform (its model, instance and batch matrices), as a
 * shader graph's world-to-object transform does, so everything three computes from the position follows: the
 * projection, the fog's depth and height, a world position. Normals are not moved.
 */
const DISPLACE = `{
  mat4 kindObjectToWorld = modelMatrix;
  #ifdef USE_INSTANCING
    kindObjectToWorld = kindObjectToWorld * instanceMatrix;
  #endif
  #ifdef USE_BATCHING
    kindObjectToWorld = kindObjectToWorld * batchingMatrix;
  #endif
  vec3 kindWorld = ( kindObjectToWorld * vec4( transformed, 1.0 ) ).xyz;
  transformed += inverse( mat3( kindObjectToWorld ) ) * kindDisplacement( kindWorld );
}`;
const call = (diffuse: string, emissive: string) => `${MODEL_SURFACE_GLSL.surface}( ${diffuse}, ${emissive} );`;
/** What each `light` builds on: three's own program, what it is drawn with, and where the kind's surface is called. */
interface Base {
  readonly shader: THREE.ShaderLibShader;
  readonly defines: Record<string, string>;
  readonly lights: boolean;
  readonly surface: (source: string, replace: ModelShaderReplace) => string;
}
const BASES: Readonly<Record<ModelSurfaceKind['light'], Base>> = Object.freeze({
  // Lit by three's standard model: the surface is written just before the emission chunk.
  [MODEL_SURFACE_LIGHT.standard]: {shader: THREE.ShaderLib.standard, defines: {STANDARD: ''}, lights: true,
    surface: (source, replace) => replace(source, CHUNK.emission,
      `${call('diffuseColor', 'totalEmissiveRadiance')}\n${modelShaderChunk(CHUNK.emission)}`)},
  // Unlit, three's basic program: what the kind writes is drawn as it is, its diffuse colour plus its emission, which
  // the basic program has no term for, so the stage adds it to the output.
  [MODEL_SURFACE_LIGHT.unlit]: {shader: THREE.ShaderLib.basic, defines: {}, lights: false,
    surface: (source, replace) => replace(replace(source, CHUNK.basic, `${modelShaderChunk(CHUNK.basic)}\n` +
      `vec3 ${MODEL_SURFACE_GLSL.emissive} = vec3( 0.0 );\n${call('diffuseColor', MODEL_SURFACE_GLSL.emissive)}`),
    CHUNK.output, `outgoingLight += ${MODEL_SURFACE_GLSL.emissive};\n${modelShaderChunk(CHUNK.output)}`)},
});
/** Three's own vertex attributes a kind may read, each through three's own varying: 'uv' as vUv, 'color' as vColor
 * (which three has already multiplied into the diffuse term when the kind's surface runs). A file's own attribute is
 * read as `surfaceAttribute` and its name. */
const OWN = Object.freeze({uv: {defines: {USE_UV: ''}, vertexColors: false},
  color: {defines: {}, vertexColors: true}});
const SIDES = Object.freeze({[MODEL_SURFACE_SIDE.front]: THREE.FrontSide, [MODEL_SURFACE_SIDE.back]: THREE.BackSide,
  [MODEL_SURFACE_SIDE.double]: THREE.DoubleSide});
// Coverage as three's render state: a cut-out writes its alpha as coverage across the samples, a blended surface is
// sorted and blended and writes no depth.
const COVERAGE = Object.freeze({[MODEL_SURFACE_COVERAGE.opaque]: {alphaToCoverage: false, transparent: false},
  [MODEL_SURFACE_COVERAGE.cutout]: {alphaToCoverage: true, transparent: false},
  [MODEL_SURFACE_COVERAGE.blended]: {alphaToCoverage: false, transparent: true}});
export const MODEL_SURFACE_PROGRAM_TEXT = Object.freeze({
  attribute: (kind: string, name: string) => `Surface kind ${kind}: attribute ${name} is not one the web stage hands ` +
    `a kind by name (${Object.keys(OWN).join(', ')}); a file's own attribute states its name and size.`,
});
const GLSL_TYPE = Object.freeze({1: 'float', 2: 'vec2', 3: 'vec3', 4: 'vec4'});

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
  const unhanded = kind.attributes.find(attribute => typeof attribute === 'string' && !(attribute in OWN));
  if (unhanded) {
    throw new ModelStageRefusal(MODEL_SURFACE_PROGRAM_TEXT.attribute(kind.id, modelAttributeName(unhanded)));
  }
  return BASES[kind.light];
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
// The file's own attributes: declared and copied into a varying in the vertex stage, read by that name in both.
const fileAttributes = (kind: ModelSurfaceKind) => kind.attributes.flatMap((attribute: ModelSurfaceAttribute) =>
  typeof attribute === 'string' ? [] : [{...attribute, type: GLSL_TYPE[attribute.size],
    varying: `${MODEL_SURFACE_GLSL.attribute}${attribute.name}`}]);

/** A kind's material, before its values: three's program for its light with the kind's program placed in it. */
export function createModelSurfaceProgram(kind: ModelSurfaceKind, program: string, shared: string) {
  const base = modelSurfaceDrawable(kind), slots = [...modelSurfaceSlots(kind).values()];
  const textures = slots.filter(({parameter}) => parameter.type === MODEL_SURFACE_PARAMETER.texture);
  const read = kind.attributes.flatMap(attribute => typeof attribute === 'string' ?
    [OWN[attribute as keyof typeof OWN]] : []);
  const own = fileAttributes(kind), varyings = own.map(({type, varying}) => `varying ${type} ${varying};`);
  const declarations = [shared, slots.length ? `uniform vec4 ${MODEL_SURFACE_GLSL.values}[ ${slots.length} ];` : '',
    modelShaderUniforms(Object.fromEntries(textures.map(({name}) => [`${MODEL_SURFACE_GLSL.texture}${name}`,
      'sampler2D']))), ...varyings, ...slots.map(accessor), program].join('\n');
  const replace = modelShaderReplace(`surface kind ${kind.id}`);
  const fragmentShader = base.surface(replace(base.shader.fragmentShader, CHUNK.declarations,
    `${modelShaderChunk(CHUNK.declarations)}\n${declarations}`), replace);
  // The vertex stage is three's own unless the kind reads a file's own attribute (declared, and copied into its
  // varying) or moves vertices (its program declared there too, and its displacement applied before the projection).
  const moves = kind.displacement !== null, vertex = (source: string) => {
    // A moving kind's declarations hold the varyings already, and say which stage this is (fwidth, dFdx,
    // gl_FrontFacing and discard are a fragment stage's alone).
    const handed = [...own.map(({type, name}) => `attribute ${type} ${name};`),
      ...(moves ? [`#define ${MODEL_SURFACE_GLSL.vertexStage}`, declarations] : varyings)].join('\n');
    const copies = own.map(({name, varying}) => `${varying} = ${name};`).join('\n');
    const declared = replace(source, CHUNK.vertexDeclarations,
      `${modelShaderChunk(CHUNK.vertexDeclarations)}\n${handed}`);
    const begun = replace(declared, CHUNK.begin, `${modelShaderChunk(CHUNK.begin)}\n${copies}`);
    return moves ? replace(begun, CHUNK.project, `${DISPLACE}\n${modelShaderChunk(CHUNK.project)}`) : begun;
  };
  const vertexShader = own.length || moves ? vertex(base.shader.vertexShader) : base.shader.vertexShader;
  return {slots, textures, fragmentShader, vertexShader, make(uniforms: Record<string, THREE.IUniform>) {
    return new THREE.ShaderMaterial({vertexShader, fragmentShader, uniforms,
      defines: Object.assign({}, base.defines, ...read.map(({defines}) => defines)), lights: base.lights,
      vertexColors: read.some(({vertexColors}) => vertexColors), fog: kind.fog, side: SIDES[kind.side],
      ...COVERAGE[kind.coverage], depthWrite: kind.coverage !== MODEL_SURFACE_COVERAGE.blended});
  }, baseUniforms: () => THREE.UniformsUtils.clone(base.shader.uniforms)};
}
export type ModelSurfaceProgram = ReturnType<typeof createModelSurfaceProgram>;
