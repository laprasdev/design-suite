import {MODEL_SURFACE_LIGHT, type ModelSurfaceAttribute, type ModelSurfaceKind} from './surfaceKindModel.ts';
import {MODEL_SURFACE_GLSL} from './surfaceGlsl.ts';
import {modelShaderChunk, type ModelShaderReplace} from './shading.ts';

// What a kind reads beyond its parameters, by the vertex attributes it declares, as the GLSL each needs in the program
// of three's that the kind's light builds on. Nothing a kind does not declare is added, so a kind that declares none
// of these reads compiles to the program it always did. Three's own attributes, each by its name:
// - 'uv': three's first UV set, vUv; 'color': the vertex colour, vColor (three has already multiplied it into the
//   diffuse term when the kind's surface runs).
// - 'normal': `kindNormal`, the shading normal (three's, after its double-sided flip), and `kindViewDirection`, from
//   the fragment toward the camera; both unit vectors in world space, the stage's space (metres, Y up), the space the
//   look states its key's direction in. A lit kind may write `kindNormal` (from a normal map, through
//   `kindNormalFromTangentSpace`), and three's lighting then uses it. Fragment stage only.
// - 'position': `kindObjectPosition`, the fragment's position in the renderer's own space: the space the model file
//   states the mesh's vertices in (glTF: right-handed, Y up, metres), before the mesh's node, an instance's or a
//   batch's transform, after its morphs, skinning and the kind's own displacement; and `kindWorldPosition`, the same
//   point in world space, the stage's space (metres, Y up), through the object's world transform: three's own world
//   position, so the same placed geometry reads the same point whatever transform places it. Fragment stage only.
// A file's own attribute is read in both stages as `surfaceAttribute` and its name.
const {normal, view, object, world, objectToWorld, attribute: fileVarying} = MODEL_SURFACE_GLSL;
const GLSL_TYPE = Object.freeze({1: 'float', 2: 'vec2', 3: 'vec3', 4: 'vec4'});
/** The GLSL of what a kind reads, by stage. */
export interface ModelSurfaceReads {
  readonly defines: Readonly<Record<string, string>>;
  readonly vertexColors: boolean;
  /** Whether the vertex stage reads the object's world transform. */
  readonly objectToWorld: boolean;
  /** Varyings, each declared once in each stage. */
  readonly varyings: readonly string[];
  /** What only the vertex stage declares, then what it writes after three's <begin_vertex> and <project_vertex>. */
  readonly vertexDeclarations: readonly string[];
  readonly begun: readonly string[];
  readonly projected: readonly string[];
  /** What only the fragment stage declares, and what it writes just before and just after the kind's surface runs. */
  readonly fragmentDeclarations: readonly string[];
  readonly beforeSurface: readonly string[];
  readonly afterSurface: readonly string[];
}
// The object's world transform, `kindObjectToWorld`: its model, instance and batch matrices, multiplied as three's own
// world position multiplies them, after its batching and before its projection.
const OBJECT_TO_WORLD = Object.freeze({declarations: 'common', begin: 'begin_vertex',
  declaration: `mat4 ${objectToWorld};`, set: `${objectToWorld} = modelMatrix;
  #ifdef USE_INSTANCING
    ${objectToWorld} = ${objectToWorld} * instanceMatrix;
  #endif
  #ifdef USE_BATCHING
    ${objectToWorld} = ${objectToWorld} * batchingMatrix;
  #endif`});
/** A vertex stage that holds the object's world transform, `kindObjectToWorld`, as above: declared once, after three's
 * <common>, and set once as the vertex begins, so every read of it in the stage (a kind's displacement and world
 * position, the fog's height) reads that one value. A stage that holds it already is returned as it is. */
export function modelSurfaceObjectToWorld(vertexShader: string, replace: ModelShaderReplace): string {
  if (vertexShader.includes(OBJECT_TO_WORLD.declaration)) return vertexShader;
  const {declarations, begin, declaration, set} = OBJECT_TO_WORLD;
  return replace(replace(vertexShader, declarations, `${modelShaderChunk(declarations)}\n${declaration}`), begin,
    `${modelShaderChunk(begin)}\n${set}`);
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
// The shading normal a tangent-space normal map gives, in world space: three's own frame for a normal map on a mesh
// without tangents (normal_pars_fragment's getTangentFrame, "Normal Mapping Without Precomputed Tangents", which three
// declares only with its own normal map in use), built from the view position's and the map's uv's derivatives about
// the face-flipped normal, its tangent and bitangent flipped too on a double-sided surface's back, as three flips them.
const FROM_TANGENT_SPACE = `vec3 ${MODEL_SURFACE_GLSL.viewNormal};
vec3 ${MODEL_SURFACE_GLSL.fromMap}( vec3 tangentNormal, vec2 uv ) {
  vec3 q0 = dFdx( - vViewPosition ), q1 = dFdy( - vViewPosition );
  vec2 st0 = dFdx( uv ), st1 = dFdy( uv );
  vec3 q1perp = cross( q1, ${MODEL_SURFACE_GLSL.viewNormal} ), q0perp = cross( ${MODEL_SURFACE_GLSL.viewNormal}, q0 );
  vec3 tangent = q1perp * st0.x + q0perp * st1.x, bitangent = q1perp * st0.y + q0perp * st1.y;
  float det = max( dot( tangent, tangent ), dot( bitangent, bitangent ) );
  float scale = det == 0.0 ? 0.0 : inversesqrt( det );
  mat3 frame = mat3( tangent * scale, bitangent * scale, ${MODEL_SURFACE_GLSL.viewNormal} );
  #ifdef DOUBLE_SIDED
    float face = gl_FrontFacing ? 1.0 : - 1.0;
    frame[ 0 ] *= face;
    frame[ 1 ] *= face;
  #endif
  return inverseTransformDirection( frame * tangentNormal, viewMatrix );
}`;
const FACING: Read = {fragmentDeclarations: [`vec3 ${normal};`, `vec3 ${view};`, FROM_TANGENT_SPACE], beforeSurface: [
  `${MODEL_SURFACE_GLSL.viewNormal} = normal;`, `${normal} = inverseTransformDirection( normal, viewMatrix );`,
  `${view} = inverseTransformDirection( isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition ), ` +
    'viewMatrix );']};
// A lit kind's normal is three's for its lighting: what the kind wrote goes back into three's view-space normal.
const LIT_NORMAL: Read = {afterSurface: [`normal = normalize( ( viewMatrix * vec4( ${normal}, 0.0 ) ).xyz );`]};
const OWN: Readonly<Record<string, (light: ModelSurfaceKind['light']) => readonly Read[]>> = Object.freeze({
  uv: () => [{defines: {USE_UV: ''}}],
  color: () => [{vertexColors: true}],
  normal: light => light === MODEL_SURFACE_LIGHT.unlit ? [UNLIT_NORMAL, FACING] : [FACING, LIT_NORMAL],
  position: () => [{varyings: [`varying vec3 ${object};`, `varying vec3 ${world};`],
    projected: [`${object} = transformed;`,
      `${world} = ( ${objectToWorld} * vec4( transformed, 1.0 ) ).xyz;`], objectToWorld: true}],
});
/** Three's own attributes a kind may read, by name. */
export const MODEL_SURFACE_OWN_ATTRIBUTES: readonly string[] = Object.freeze(Object.keys(OWN));

function fileAttribute({name, size}: {readonly name: string; readonly size: keyof typeof GLSL_TYPE}): Read {
  const type = GLSL_TYPE[size], varying = `${fileVarying}${name}`;
  return {vertexDeclarations: [`attribute ${type} ${name};`], varyings: [`varying ${type} ${varying};`],
    begun: [`${varying} = ${name};`]};
}
const LISTS = Object.freeze(['varyings', 'vertexDeclarations', 'begun', 'projected', 'fragmentDeclarations',
  'beforeSurface', 'afterSurface'] as const);

/** What the kind's declared attributes add to its program; each attribute was checked to be one the stage hands. */
export function modelSurfaceReads(kind: ModelSurfaceKind): ModelSurfaceReads {
  const reads = kind.attributes.flatMap((attribute: ModelSurfaceAttribute) =>
    typeof attribute === 'string' ? OWN[attribute](kind.light) : [fileAttribute(attribute)]);
  return Object.freeze({defines: Object.assign({}, ...reads.map(read => read.defines ?? {})),
    vertexColors: reads.some(read => read.vertexColors === true),
    objectToWorld: reads.some(read => read.objectToWorld === true),
    ...Object.fromEntries(LISTS.map(list => [list, reads.flatMap(read => read[list] ?? [])]))} as ModelSurfaceReads);
}
