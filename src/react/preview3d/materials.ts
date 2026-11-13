import * as THREE from 'three';
import {MODEL_PREVIEW_SURFACE_SETTINGS as settings, MODEL_STAGE_SURFACE_MODE as MODE, type ModelStageSurfaceMode}
  from './surfaceModeModel.ts';
import {modelMaterialOwned, modelShaderChunk, modelShaderUniforms, type ModelShader, type ModelShaderChange,
  type ModelShaderReplace} from './shading.ts';

// The Surface modes, as one change to the program of every model surface the stage draws: the same material in every
// mode, never a copy, so whatever draws a renderer (the file's material, a kind's) shows the same modes. The mode is
// part of the program's key, so each mode compiles once per material and a mode change recompiles nothing it compiled
// before. Lit changes nothing. The other three inspect one term of the surface, as stated: no fog, no glow (the frame
// is drawn straight to the canvas while one is in force, draw.ts), Clay its shape in a neutral colour and finish (no
// texture but the base colour's alpha, no emission, none of the physical extras), Color its base colour untoned,
// Emission its emission.
//
// The change covers the programs three compiles as STANDARD (its standard and physical programs, and a kind built on
// the standard one), which hold every chunk a mode writes at. A material of any other program (a line's, points', an
// unlit surface's) is never given the change: it is drawn as it states in every mode, so no mode can fail to compile
// or throw inside a frame. A line or points is no surface and does not count toward whether the modes are available;
// an unlit mesh does, and refuses them (stageParts.ts).
const CHUNK = Object.freeze({colorDeclarations: 'color_pars_fragment',
  roughness: 'roughnessmap_fragment', metalness: 'metalnessmap_fragment', emission: 'emissivemap_fragment',
  physical: 'lights_physical_fragment', output: 'opaque_fragment', toneMapping: 'tonemapping_fragment'});
const CLAY_UNIFORM = 'modelSurfaceClay';
// What Clay leaves out, as the program's own switches: every map but the base colour's (its alpha keeps cut-outs), the
// environment, and the physical extras. three compares none of these per frame, so they hold for the mode's program.
const CLAY_OFF = Object.freeze(['envMap', 'envMapMode', 'envMapCubeUVHeight', 'aoMap', 'lightMap', 'bumpMap',
  'normalMap', 'normalMapObjectSpace', 'normalMapTangentSpace', 'displacementMap', 'emissiveMap', 'metalnessMap',
  'roughnessMap', 'anisotropy', 'anisotropyMap', 'clearcoat', 'clearcoatMap', 'clearcoatNormalMap',
  'clearcoatRoughnessMap', 'iridescence', 'iridescenceMap', 'iridescenceThicknessMap', 'sheen', 'sheenColorMap',
  'sheenRoughnessMap', 'transmission', 'transmissionMap', 'thicknessMap'] as const);
const float = (value: number) => Number.isInteger(value) ? `${value}.0` : `${value}`;
// A physical material's specular intensity held at 0, as three's own lights_physical_fragment computes it with 0.
const CLAY_SPECULAR = `
#if defined( IOR ) && defined( USE_SPECULAR )
  material.specularF90 = mix( 0.0, 1.0, metalnessFactor );
  material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor,
    vec3( 1.0 ) ) * 0.0, diffuseColor.rgb, metalnessFactor );
#endif`;
const after = (replace: ModelShaderReplace, source: string, chunk: string, lines: string) =>
  replace(source, chunk, `${modelShaderChunk(chunk)}\n${lines}`);

function clay(shader: ModelShader, replace: ModelShaderReplace, color: {value: THREE.Color}) {
  for (const name of CLAY_OFF) Reflect.set(shader, name, false);
  shader.uniforms[CLAY_UNIFORM] = color;
  let source = after(replace, shader.fragmentShader, CHUNK.colorDeclarations,
    modelShaderUniforms({[CLAY_UNIFORM]: 'vec3'}));
  source = after(replace, source, CHUNK.roughness, `roughnessFactor = ${float(settings.roughness)};`);
  source = after(replace, source, CHUNK.metalness, `metalnessFactor = ${float(settings.metalness)};`);
  // After the emission chunk, so after a kind's surface too (surfaceProgram.ts calls it just before that chunk); no
  // chunk between the base colour and here reads the colour's rgb, only its alpha.
  source = after(replace, source, CHUNK.emission,
    `diffuseColor.rgb = ${CLAY_UNIFORM};\ntotalEmissiveRadiance = vec3( 0.0 );`);
  // Standard and physical programs both include this chunk; only a physical one defines IOR and USE_SPECULAR.
  shader.fragmentShader = after(replace, source, CHUNK.physical, CLAY_SPECULAR);
}
// The term a mode shows, written as the frame's light just before three's output.
const shown = (replace: ModelShaderReplace, source: string, term: string) =>
  replace(source, CHUNK.output, `outgoingLight = ${term};\n${modelShaderChunk(CHUNK.output)}`);

// Each mode's name in the program key, made once.
const KEYS = Object.freeze(Object.fromEntries(Object.values(MODE).map(value =>
  [value, `model-surface-mode:${value}`])) as Record<ModelStageSurfaceMode, string>);
/** Whether the Surface modes change a material's program: three's standard and physical programs, by their own
 * STANDARD switch, which a kind built on the standard program carries too. */
export const modelSurfaceModesCover = (material: THREE.Material) => material instanceof THREE.MeshStandardMaterial ||
  (material instanceof THREE.ShaderMaterial && Object.hasOwn(material.defines, 'STANDARD'));

/** The stage's one Surface mode: the change every surface it covers is extended with, and the mode in force. */
export function createModelSurfaceModes() {
  let mode: ModelStageSurfaceMode = MODE.lit;
  const clayColor = {value: new THREE.Color().setHex(settings.clayColor)};
  const change: ModelShaderChange = {
    get key() {return KEYS[mode];},
    apply(shader, replace) {
      if (mode === MODE.lit) return;
      shader.fog = false;
      if (mode === MODE.clay) return clay(shader, replace, clayColor);
      if (mode === MODE.emission) {
        shader.fragmentShader = shown(replace, shader.fragmentShader, 'totalEmissiveRadiance');
        return;
      }
      // Color shows the base colour as stated: the frame's tone curve is left out of this mode's program.
      shader.fragmentShader = replace(shown(replace, shader.fragmentShader, 'diffuseColor.rgb'), CHUNK.toneMapping, '');
    },
  };
  return {change, covers: modelSurfaceModesCover, get mode() {return mode;},
    /** Whether a mode other than Lit is in force: the frame then shows a term of each surface, not the look. */
    get inspecting() {return mode !== MODE.lit;},
    set(value: ModelStageSurfaceMode) {mode = value;}};
}
export type ModelSurfaceModes = ReturnType<typeof createModelSurfaceModes>;

/** The stage's changes a model material takes: its fog, and its Surface mode where the mode covers the material's
 * program. Each list is made once, so asking makes nothing. */
export function modelStageChanges(fog: ModelShaderChange, modes: Pick<ModelSurfaceModes, 'change'>) {
  const surface = Object.freeze([fog, modes.change]), other = Object.freeze([fog]);
  return (material: THREE.Material): readonly ModelShaderChange[] =>
    modelSurfaceModesCover(material) ? surface : other;
}
export type ModelStageChanges = ReturnType<typeof modelStageChanges>;

/**
 * What the materials an actor's meshes draw with allow, read each time it is asked, since its surfaces can change:
 * whether every one can show the modes (its program one the modes cover, and changed only by the stage), how many
 * emit, and the one way to have them compile the mode in force. A kind's emission is its program's to compute, which
 * the stage cannot read ahead, so a kind's material counts as one that emits: the view never says "No emission" over
 * a kind that glows.
 */
export function createModelMaterialInspection(shown: () => Iterable<THREE.Material>,
  kind: (material: THREE.Material) => boolean) {
  const standard = (material: THREE.Material): material is THREE.MeshStandardMaterial =>
    material instanceof THREE.MeshStandardMaterial && modelMaterialOwned(material);
  const emits = (material: THREE.Material) => kind(material) || (standard(material) &&
    material.emissiveIntensity > 0 && Math.max(material.emissive.r, material.emissive.g, material.emissive.b) > 0);
  const distinct = () => [...new Set(shown())];
  return {
    get available() {
      const materials = distinct();
      return materials.length > 0 &&
        materials.every(material => modelSurfaceModesCover(material) && modelMaterialOwned(material));
    },
    get emissiveMaterialCount() {return distinct().filter(emits).length;},
    /** The mode changed: every material the actor draws with takes its program for it on its next draw. */
    refresh() {for (const material of distinct()) material.needsUpdate = true;},
  };
}
export type ModelMaterialInspection = ReturnType<typeof createModelMaterialInspection>;
