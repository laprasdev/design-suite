import * as THREE from 'three';
import {MODEL_SURFACE_COVERAGE, MODEL_SURFACE_LIGHT, MODEL_SURFACE_PARAMETER, MODEL_SURFACE_SIDE, modelAttributeName,
  type ModelSurfaceKind} from './surfaceKindModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {modelShaderChunk, modelShaderReplace, modelShaderUniforms, type ModelShaderReplace} from './shading.ts';
import {MODEL_SURFACE_GLSL, modelSurfaceAccessor, modelSurfaceSlots} from './surfaceGlsl.ts';
import {MODEL_SURFACE_OWN_ATTRIBUTES, modelSurfaceReads} from './surfaceReads.ts';

// A kind's web program placed into three's own program, the one way the stage makes a kind's material. The kind's GLSL
// defines `kindSurface`; the stage declares what it may read before it (its parameters' accessors, surfaceGlsl.ts; the
// stage's shared values, sharedValues.ts; what its declared attributes give it, surfaceReads.ts) and calls it once
// where three's diffuse and emissive terms are whole and nothing has lit them yet. A kind that moves vertices defines
// `kindDisplacement` too; its text is then compiled into the vertex stage as well, where KIND_VERTEX_STAGE is defined:
// what only a fragment stage has must sit inside `#ifndef KIND_VERTEX_STAGE`, and everything else compiles in both
// stages from what both declare.
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
// The kind's surface called, after what the stage writes for it just before (surfaceReads.ts).
const call = (before: string, diffuse: string, emissive: string) =>
  `${before}\n${MODEL_SURFACE_GLSL.surface}( ${diffuse}, ${emissive} );`;
/** What each `light` builds on: three's own program, what it is drawn with, and where the kind's surface is called. */
interface Base {
  readonly shader: THREE.ShaderLibShader;
  readonly defines: Record<string, string>;
  readonly lights: boolean;
  readonly surface: (source: string, replace: ModelShaderReplace, before: string) => string;
}
const BASES: Readonly<Record<ModelSurfaceKind['light'], Base>> = Object.freeze({
  // Lit by three's standard model: the surface is written just before the emission chunk.
  [MODEL_SURFACE_LIGHT.standard]: {shader: THREE.ShaderLib.standard, defines: {STANDARD: ''}, lights: true,
    surface: (source, replace, before) => replace(source, CHUNK.emission,
      `${call(before, 'diffuseColor', 'totalEmissiveRadiance')}\n${modelShaderChunk(CHUNK.emission)}`)},
  // Unlit, three's basic program: what the kind writes is drawn as it is, its diffuse colour plus its emission, which
  // the basic program has no term for, so the stage adds it to the output.
  [MODEL_SURFACE_LIGHT.unlit]: {shader: THREE.ShaderLib.basic, defines: {}, lights: false,
    surface: (source, replace, before) => replace(replace(source, CHUNK.basic, `${modelShaderChunk(CHUNK.basic)}\n` +
      `vec3 ${MODEL_SURFACE_GLSL.emissive} = vec3( 0.0 );\n` +
      call(before, 'diffuseColor', MODEL_SURFACE_GLSL.emissive)),
    CHUNK.output, `outgoingLight += ${MODEL_SURFACE_GLSL.emissive};\n${modelShaderChunk(CHUNK.output)}`)},
});
const SIDES = Object.freeze({[MODEL_SURFACE_SIDE.front]: THREE.FrontSide, [MODEL_SURFACE_SIDE.back]: THREE.BackSide,
  [MODEL_SURFACE_SIDE.double]: THREE.DoubleSide});
// Coverage as three's render state: a cut-out writes its alpha as coverage across the samples, a blended surface is
// sorted and blended and writes no depth.
const COVERAGE = Object.freeze({[MODEL_SURFACE_COVERAGE.opaque]: {alphaToCoverage: false, transparent: false},
  [MODEL_SURFACE_COVERAGE.cutout]: {alphaToCoverage: true, transparent: false},
  [MODEL_SURFACE_COVERAGE.blended]: {alphaToCoverage: false, transparent: true}});
export const MODEL_SURFACE_PROGRAM_TEXT = Object.freeze({
  attribute: (kind: string, name: string) => `Surface kind ${kind}: attribute ${name} is not one the web stage hands ` +
    `a kind by name (${MODEL_SURFACE_OWN_ATTRIBUTES.join(', ')}); a file's own attribute states its name and size.`,
});

/** A kind this stage can draw, and the program it builds on; refused by name when the stage is given one it cannot. */
export function modelSurfaceDrawable(kind: ModelSurfaceKind): Base {
  const unhanded = kind.attributes.find(attribute => typeof attribute === 'string' &&
    !MODEL_SURFACE_OWN_ATTRIBUTES.includes(attribute));
  if (unhanded) {
    throw new ModelStageRefusal(MODEL_SURFACE_PROGRAM_TEXT.attribute(kind.id, modelAttributeName(unhanded)));
  }
  return BASES[kind.light];
}

/** A kind's material, before its values: three's program for its light with the kind's program placed in it. */
export function createModelSurfaceProgram(kind: ModelSurfaceKind, program: string, shared: string) {
  const base = modelSurfaceDrawable(kind), slots = [...modelSurfaceSlots(kind).values()];
  const textures = slots.filter(({parameter}) => parameter.type === MODEL_SURFACE_PARAMETER.texture);
  const reads = modelSurfaceReads(kind);
  // What both stages declare: the shared values, the kind's values and textures, the varyings, the accessors.
  const both = [shared, slots.length ? `uniform vec4 ${MODEL_SURFACE_GLSL.values}[ ${slots.length} ];` : '',
    modelShaderUniforms(Object.fromEntries(textures.map(({name}) => [`${MODEL_SURFACE_GLSL.texture}${name}`,
      'sampler2D']))), ...reads.varyings, ...slots.map(modelSurfaceAccessor)].join('\n');
  const replace = modelShaderReplace(`surface kind ${kind.id}`);
  const fragmentShader = base.surface(replace(base.shader.fragmentShader, CHUNK.declarations,
    [modelShaderChunk(CHUNK.declarations), both, ...reads.fragmentDeclarations, program].join('\n')), replace,
  reads.beforeSurface.join('\n'));
  // The vertex stage is three's own unless the kind reads what three's vertex stage does not hand on (declared, and
  // written after the vertex begins or is projected) or moves vertices (its program declared there too, and its
  // displacement applied before the projection).
  const moves = kind.displacement !== null, vertex = (source: string) => {
    // A moving kind's declarations hold the varyings already, and say which stage this is (fwidth, dFdx,
    // gl_FrontFacing and discard are a fragment stage's alone).
    const handed = [...reads.vertexDeclarations, ...(moves ? [`#define ${MODEL_SURFACE_GLSL.vertexStage}`, both,
      program] : reads.varyings)].join('\n');
    const declared = replace(source, CHUNK.vertexDeclarations,
      `${modelShaderChunk(CHUNK.vertexDeclarations)}\n${handed}`);
    const begun = replace(declared, CHUNK.begin, `${modelShaderChunk(CHUNK.begin)}\n${reads.begun.join('\n')}`);
    const projected = [...(moves ? [DISPLACE] : []), modelShaderChunk(CHUNK.project), ...reads.projected];
    return reads.projected.length || moves ? replace(begun, CHUNK.project, projected.join('\n')) : begun;
  };
  const vertexShader = reads.vertexDeclarations.length || reads.varyings.length || moves ?
    vertex(base.shader.vertexShader) : base.shader.vertexShader;
  return {slots, textures, fragmentShader, vertexShader, make(uniforms: Record<string, THREE.IUniform>) {
    return new THREE.ShaderMaterial({vertexShader, fragmentShader, uniforms,
      defines: {...base.defines, ...reads.defines}, lights: base.lights, vertexColors: reads.vertexColors,
      fog: kind.fog, side: SIDES[kind.side], ...COVERAGE[kind.coverage],
      depthWrite: kind.coverage !== MODEL_SURFACE_COVERAGE.blended});
  }, baseUniforms: () => THREE.UniformsUtils.clone(base.shader.uniforms)};
}
export type ModelSurfaceProgram = ReturnType<typeof createModelSurfaceProgram>;
