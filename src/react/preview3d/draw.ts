import * as THREE from 'three';
import type {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import type {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {MODEL_STAGE_TONE_CURVE, type ModelStageGlow, type ModelStageToneCurve} from './lookModel.ts';
import type {ModelStageCommit} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';

const CURVES: Readonly<Record<ModelStageToneCurve, THREE.ToneMapping>> = Object.freeze({
  [MODEL_STAGE_TONE_CURVE.acesFilmic]: THREE.ACESFilmicToneMapping,
});
// Adds a texture's colour to what the canvas already shows, unconverted and uncurved: the bloom is linear light added
// onto the canvas's display-encoded colours, so its strength is read on the screen, not in linear light.
const ADD = Object.freeze({vertexShader: 'varying vec2 vUv;\nvoid main() {\n  vUv = uv;\n' +
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}',
fragmentShader: 'uniform sampler2D glow;\nvarying vec2 vUv;\nvoid main() {\n' +
  '  gl_FragColor = vec4( texture2D( glow, vUv ).rgb, 1.0 );\n}'});
// What three must offer for glow: a colour buffer of half floats, for the linear source and the bloom's own targets.
const HALF_FLOAT = Object.freeze(['EXT_color_buffer_float', 'EXT_color_buffer_half_float']);
export const MODEL_DRAW_TEXT = Object.freeze({
  halfFloat: (where: string) => `${where}: glow needs half-float render targets; this browser's WebGL has none.`,
  unloaded: 'The glow was prepared before its passes were loaded.',
});
interface GlowPasses {readonly Bloom: typeof UnrealBloomPass; readonly Quad: typeof FullScreenQuad}
type Glow = {target: THREE.WebGLRenderTarget; bloom: UnrealBloomPass; add: FullScreenQuad;
  material: THREE.ShaderMaterial};
// The glow's passes are three's own, fetched the first time a look brings glow, so a page that never glows never
// downloads them.
async function loadGlowPasses(): Promise<GlowPasses> {
  const [bloom, pass] = await Promise.all([import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/Pass.js')]);
  return {Bloom: bloom.UnrealBloomPass, Quad: pass.FullScreenQuad};
}

/**
 * The frame's one draw: the scene through the camera to the canvas, under the look's tone curve or none. Glow adds to
 * that frame and changes nothing else in it. The scene is drawn a second time, in linear light, into a half-float
 * target that only feeds three's bloom pass; the bloom alone (three r180 leaves it in the pass's first horizontal
 * target before blending it back) is then added onto the canvas. Where nothing is brighter than the threshold the
 * bloom is 0 and the canvas is exactly the direct draw. A look with both a curve and glow is refused (lookModel.ts).
 */
export function createModelDraw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const size = new THREE.Vector2();
  let passes: GlowPasses | undefined, loading: Promise<void> | undefined;
  let glow: Glow | undefined;
  let triangles = 0;
  const release = () => {
    if (!glow) return;
    glow.target.dispose();
    glow.bloom.dispose();
    // three r180's UnrealBloomPass.dispose frees every material of the pass but its high-pass filter.
    glow.bloom.materialHighPassFilter.dispose();
    glow.add.dispose();
    glow.material.dispose();
    glow = undefined;
  };
  const create = ({Bloom, Quad}: GlowPasses): Glow => {
    renderer.getDrawingBufferSize(size);
    const bloom = new Bloom(size, 0, 0, 0);
    const material = new THREE.ShaderMaterial({...ADD, blending: THREE.AdditiveBlending, depthTest: false,
      depthWrite: false, toneMapped: false, uniforms: {glow: {value: bloom.renderTargetsHorizontal[0].texture}}});
    return {bloom, material, add: new Quad(material),
      target: new THREE.WebGLRenderTarget(size.x, size.y, {type: THREE.HalfFloatType})};
  };
  const add = (value: Glow) => {
    renderer.setRenderTarget(value.target);
    renderer.render(scene, camera);
    value.bloom.render(renderer, value.target, value.target, 0, false);
    renderer.setRenderTarget(null);
    const clears = renderer.autoClear;
    renderer.autoClear = false;
    value.add.render(renderer);
    renderer.autoClear = clears;
  };
  const curve = (value: ModelStageToneCurve | null) => {
    renderer.toneMapping = value === null ? THREE.NoToneMapping : CURVES[value];
  };
  const bloom = (value: ModelStageGlow, loaded: GlowPasses) => {
    glow ??= create(loaded);
    glow.bloom.threshold = value.threshold;
    glow.bloom.strength = value.strength;
    glow.bloom.radius = value.radius;
  };
  return {
    /** What drawing this glow needs loaded first: the glow's passes, fetched once, when a look first brings glow. */
    load(value: ModelStageGlow | null): readonly Promise<void>[] {
      if (value === null || passes) return [];
      loading ??= loadGlowPasses().then(loaded => {passes = loaded;}, (error: unknown) => {
        loading = undefined;
        throw error;
      });
      return [loading];
    },
    /** A look's tone curve and glow, checked; `where` names the glow in a refusal. */
    prepare(toneCurve: ModelStageToneCurve | null, value: ModelStageGlow | null, where: string): ModelStageCommit {
      if (value === null) return () => {curve(toneCurve); release();};
      if (!HALF_FLOAT.some(name => renderer.extensions.has(name))) {
        throw new ModelStageRefusal(MODEL_DRAW_TEXT.halfFloat(where));
      }
      const loaded = passes;
      if (!loaded) throw new Error(MODEL_DRAW_TEXT.unloaded);
      return () => {curve(toneCurve); bloom(value, loaded);};
    },
    /** The canvas changed size: the glow's target and passes follow its drawing buffer. */
    resize() {
      if (!glow) return;
      renderer.getDrawingBufferSize(size);
      glow.target.setSize(size.x, size.y);
      glow.bloom.setSize(size.x, size.y);
    },
    draw() {
      renderer.render(scene, camera);
      triangles = renderer.info.render.triangles;
      if (glow) add(glow);
    },
    /** The triangles the canvas pass drew in the last frame; the glow's passes are not counted. */
    get triangles() {return triangles;},
    dispose: release,
  };
}
export type ModelDraw = ReturnType<typeof createModelDraw>;
