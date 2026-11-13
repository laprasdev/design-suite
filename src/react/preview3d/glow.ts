import * as THREE from 'three';
import type {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import type {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import type {ModelStageGlow} from './lookModel.ts';

// The glow's own resources: the scene's multisampled half-float target, three's bloom pass and the one output pass,
// made when a look first brings glow and freed when it leaves. How a frame draws with them is draw.ts's.
/** The glow's passes: three's bloom and its full-screen draw. */
export interface ModelGlowPasses {readonly Bloom: typeof UnrealBloomPass; readonly Quad: typeof FullScreenQuad}
/** The glow's passes, three's own, fetched the first time a look brings glow, so a page that never glows never
 * downloads them. */
export async function loadModelGlowPasses(): Promise<ModelGlowPasses> {
  const [bloom, pass] = await Promise.all([import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/Pass.js')]);
  return {Bloom: bloom.UnrealBloomPass, Quad: pass.FullScreenQuad};
}
// The output pass: the target's colour (the scene, linear) with the bloom's colour added as it is (so a glow's strength
// means what it always has), to the canvas through three's own tone curve and display encoding (the chunks three gives
// every material drawn to the canvas); and the target's depth into the canvas's depth, so that the aids drawn after it
// hide behind the scene as they do in the direct draw.
const OUTPUT = Object.freeze({vertexShader: 'varying vec2 vUv;\nvoid main() {\n  vUv = uv;\n' +
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}',
fragmentShader: 'uniform sampler2D modelSceneColor;\nuniform sampler2D modelSceneDepth;\n' +
  'uniform sampler2D modelBloom;\nvarying vec2 vUv;\nvoid main() {\n' +
  '  gl_FragColor = texture2D( modelSceneColor, vUv );\n' +
  '  gl_FragColor.rgb += texture2D( modelBloom, vUv ).rgb;\n' +
  '  gl_FragDepth = texture2D( modelSceneDepth, vUv ).r;\n  #include <tonemapping_fragment>\n' +
  '  #include <colorspace_fragment>\n}'});
// The samples of the glow's target: the canvas's own antialiasing, kept for the one draw of the scene.
const SAMPLES = 4;
/**
 * The weights of one of the bloom's blur levels, its taps 0 to radius - 1: a Gaussian whose radius is three standard
 * deviations, so it falls to nothing at its last tap. three r180's UnrealBloomPass weighs its taps with a standard
 * deviation equal to the radius and stops there, so its last tap still weighs 0.6 of its first: a near-flat kernel cut
 * off hard, which, blurred across and then down, is a square. At the game's emission (55 to 83) those squares were the
 * halos' outlines (measured, step E3: diagonal against axis 1.09 to 1.13, round with these weights, 1.0).
 */
export const modelGlowKernel = (radius: number) =>
  Array.from({length: radius}, (_, tap) => Math.exp(-0.5 * (tap * 3 / radius) ** 2));

/** One glow's resources at a drawing-buffer size: its values are written by `set`, its sizes by `resize`. */
export function createModelGlow({Bloom, Quad}: ModelGlowPasses, size: THREE.Vector2) {
  const depth = new THREE.DepthTexture(size.x, size.y);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {type: THREE.HalfFloatType, samples: SAMPLES,
    depthTexture: depth});
  // three's pass ends by blending its composite into what it read. Drawn to the screen instead, that blend is made to
  // draw nothing (its material not visible), and its first step's copy of the scene to the canvas is overwritten by the
  // output pass, which adds the composite itself: the scene's target is never drawn into after its one resolve.
  const bloom = new Bloom(size, 0, 0, 0);
  bloom.renderToScreen = true;
  bloom.blendMaterial.visible = false;
  for (const blur of bloom.separableBlurMaterials) {
    blur.uniforms.gaussianCoefficients.value = modelGlowKernel(Number(blur.defines.KERNEL_RADIUS));
  }
  const material = new THREE.ShaderMaterial({...OUTPUT, depthFunc: THREE.AlwaysDepth,
    uniforms: {modelSceneColor: {value: target.texture}, modelSceneDepth: {value: depth},
      modelBloom: {value: bloom.renderTargetsHorizontal[0].texture}}});
  const output = new Quad(material);
  return {
    target,
    /** The bloom, from the target's resolved colour into its own targets; nothing is drawn into the target. */
    bloom: (renderer: THREE.WebGLRenderer) => bloom.render(renderer, target, target, 0, false),
    /** The output pass, onto the bound canvas. */
    output: (renderer: THREE.WebGLRenderer) => output.render(renderer),
    set(value: ModelStageGlow) {
      bloom.threshold = value.threshold;
      bloom.strength = value.strength;
      bloom.radius = value.radius;
    },
    /** The canvas changed size (three sizes the target's depth texture to it when it next sets it up, WebGLTextures.js
     * 1659). */
    resize(width: number, height: number) {
      target.setSize(width, height);
      bloom.setSize(width, height);
    },
    dispose() {
      depth.dispose();
      target.dispose();
      bloom.dispose();
      // three r180's UnrealBloomPass.dispose frees every material of the pass but its high-pass filter.
      bloom.materialHighPassFilter.dispose();
      output.dispose();
      material.dispose();
    },
  };
}
export type ModelGlow = ReturnType<typeof createModelGlow>;
