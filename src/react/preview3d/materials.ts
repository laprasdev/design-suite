import * as THREE from 'three';
import {MODEL_PREVIEW_MATERIAL_OPTIONS, MODEL_PREVIEW_MATERIAL_SETTINGS as settings, type ModelStageMaterialMode}
  from './materialModel.ts';
import {modelMaterialOwned, modelShaderChunk, modelShaderUniforms, type ModelShader, type ModelShaderChange,
  type ModelShaderReplace} from './shading.ts';

// The Surface modes, as one change to the program of every model material the stage draws: the same material in
// every mode, never a copy, so whatever draws a renderer (the file's material, a kind's) shows the same modes. The mode
// is part of the program's key, so each mode compiles once per material and a mode change recompiles nothing it
// compiled before. Lit changes nothing. The other three show one term of the material without fog: Clay its shape in
// a neutral colour and finish (no texture but the base colour's alpha, no emission, none of the physical extras),
// Color its base colour untoned, Emission its emission.
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

/** The stage's one Surface mode, for every model material: the change each is extended with, and the mode in force. */
// Each mode's name in the program key, made once.
const KEYS = Object.freeze(Object.fromEntries(MODEL_PREVIEW_MATERIAL_OPTIONS.map(({value}) =>
  [value, `model-surface-mode:${value}`])) as Record<ModelStageMaterialMode, string>);

export function createModelSurfaceModes() {
  let mode: ModelStageMaterialMode = 'lit';
  const clayColor = {value: new THREE.Color().setHex(settings.clayColor)};
  const change: ModelShaderChange = {
    get key() {return KEYS[mode];},
    apply(shader, replace) {
      if (mode === 'lit') return;
      shader.fog = false;
      if (mode === 'clay') return clay(shader, replace, clayColor);
      if (mode === 'emission') {
        shader.fragmentShader = shown(replace, shader.fragmentShader, 'totalEmissiveRadiance');
        return;
      }
      // Color shows the base colour as stated: the frame's tone curve is left out of this mode's program.
      shader.fragmentShader = replace(shown(replace, shader.fragmentShader, 'diffuseColor.rgb'), CHUNK.toneMapping, '');
    },
  };
  return {change, get mode() {return mode;}, set(value: ModelStageMaterialMode) {mode = value;}};
}
export type ModelSurfaceModes = ReturnType<typeof createModelSurfaceModes>;

/**
 * What the materials an actor draws with allow, read each time it is asked, since its surfaces can change: whether
 * every one can show the modes (a standard material whose program only the stage changed, or a kind's material, which
 * the stage builds on three's standard program), how many emit, and the one way to have them compile the mode in
 * force. A kind's emission is its program's to compute, which the stage cannot read ahead, so a kind's material counts
 * as one that emits: the view never says "No emission" over a kind that glows.
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
      return materials.length > 0 && materials.every(material => kind(material) || standard(material));
    },
    get emissiveMaterialCount() {return distinct().filter(emits).length;},
    /** The mode changed: every material the actor draws with takes its program for it on its next draw. */
    refresh() {for (const material of distinct()) material.needsUpdate = true;},
  };
}
export type ModelMaterialInspection = ReturnType<typeof createModelMaterialInspection>;
