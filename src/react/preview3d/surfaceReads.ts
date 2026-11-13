import {MODEL_SURFACE_LIGHT, type ModelSurfaceAttribute, type ModelSurfaceKind} from './surfaceKindModel.ts';
import {MODEL_SURFACE_GLSL} from './surfaceGlsl.ts';
import {modelShaderChunk} from './shading.ts';

// What a kind reads beyond its parameters, by the vertex attributes it declares, as the GLSL each needs in the program
// of three's that the kind's light builds on. Nothing a kind does not declare is added, so a kind that declares none
// of these reads compiles to the program it always did. Three's own attributes, each by its name:
// - 'uv': three's first UV set, vUv; 'color': the vertex colour, vColor (three has already multiplied it into the
//   diffuse term when the kind's surface runs).
// - 'normal': `kindNormal`, the shading normal (three's, after its double-sided flip), and `kindViewDirection`, from
//   the fragment toward the camera; both unit vectors in world space, the stage's space (metres, Y up), the space the
//   look states its key's direction in. Fragment stage only.
// - 'position': `kindObjectPosition`, the fragment's position in the renderer's own space: the space the model file
//   states the mesh's vertices in (glTF: right-handed, Y up, metres), before the mesh's node, an instance's or a
//   batch's transform, after its morphs, skinning and the kind's own displacement. Fragment stage only.
// A file's own attribute is read in both stages as `surfaceAttribute` and its name.
const {normal, view, object, attribute: fileVarying} = MODEL_SURFACE_GLSL;
const GLSL_TYPE = Object.freeze({1: 'float', 2: 'vec2', 3: 'vec3', 4: 'vec4'});
/** The GLSL of what a kind reads, by stage. */
export interface ModelSurfaceReads {
  readonly defines: Readonly<Record<string, string>>;
  readonly vertexColors: boolean;
  /** Varyings, each declared once in each stage. */
  readonly varyings: readonly string[];
  /** What only the vertex stage declares, then what it writes after three's <begin_vertex> and <project_vertex>. */
  readonly vertexDeclarations: readonly string[];
  readonly begun: readonly string[];
  readonly projected: readonly string[];
  /** What only the fragment stage declares, and what it writes just before the kind's surface runs. */
  readonly fragmentDeclarations: readonly string[];
  readonly beforeSurface: readonly string[];
}
type Read = Partial<Omit<ModelSurfaceReads, 'defines'>> & {readonly defines?: Readonly<Record<string, string>>};
// Three's basic program draws no normal: an unlit kind that reads one is given three's own normal chunks, computed as
// its standard program computes them, where the basic program has not (it does so only with an environment map or
// skinning), and three's view position.
const UNLIT_NORMAL: Read = {vertexDeclarations: [modelShaderChunk('normal_pars_vertex'), 'varying vec3 vViewPosition;'],
  projected: ['#if ! defined ( USE_ENVMAP ) && ! defined ( USE_SKINNING )', modelShaderChunk('beginnormal_vertex'),
    modelShaderChunk('morphnormal_vertex'), modelShaderChunk('defaultnormal_vertex'), '#endif',
    modelShaderChunk('normal_vertex'), 'vViewPosition = - mvPosition.xyz;'],
  fragmentDeclarations: ['varying vec3 vViewPosition;'], beforeSurface: [modelShaderChunk('normal_fragment_begin')]};
const FACING: Read = {fragmentDeclarations: [`vec3 ${normal};`, `vec3 ${view};`], beforeSurface: [
  `${normal} = inverseTransformDirection( normal, viewMatrix );`,
  `${view} = inverseTransformDirection( isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition ), ` +
    'viewMatrix );']};
const OWN: Readonly<Record<string, (light: ModelSurfaceKind['light']) => readonly Read[]>> = Object.freeze({
  uv: () => [{defines: {USE_UV: ''}}],
  color: () => [{vertexColors: true}],
  normal: light => light === MODEL_SURFACE_LIGHT.unlit ? [UNLIT_NORMAL, FACING] : [FACING],
  position: () => [{varyings: [`varying vec3 ${object};`], projected: [`${object} = transformed;`]}],
});
/** Three's own attributes a kind may read, by name. */
export const MODEL_SURFACE_OWN_ATTRIBUTES: readonly string[] = Object.freeze(Object.keys(OWN));

function fileAttribute({name, size}: {readonly name: string; readonly size: keyof typeof GLSL_TYPE}): Read {
  const type = GLSL_TYPE[size], varying = `${fileVarying}${name}`;
  return {vertexDeclarations: [`attribute ${type} ${name};`], varyings: [`varying ${type} ${varying};`],
    begun: [`${varying} = ${name};`]};
}
const LISTS = Object.freeze(['varyings', 'vertexDeclarations', 'begun', 'projected', 'fragmentDeclarations',
  'beforeSurface'] as const);

/** What the kind's declared attributes add to its program; each attribute was checked to be one the stage hands. */
export function modelSurfaceReads(kind: ModelSurfaceKind): ModelSurfaceReads {
  const reads = kind.attributes.flatMap((attribute: ModelSurfaceAttribute) =>
    typeof attribute === 'string' ? OWN[attribute](kind.light) : [fileAttribute(attribute)]);
  return Object.freeze({defines: Object.assign({}, ...reads.map(read => read.defines ?? {})),
    vertexColors: reads.some(read => read.vertexColors === true),
    ...Object.fromEntries(LISTS.map(list => [list, reads.flatMap(read => read[list] ?? [])]))} as ModelSurfaceReads);
}
