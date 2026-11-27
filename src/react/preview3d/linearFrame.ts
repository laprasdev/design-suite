import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_STAGE} from './model.ts';

// The frame in linear light: the scene's multisampled half-float target, which every surface is drawn and blended into
// as a URP camera's colour target is (blending in linear light, before any curve), and the one output pass that writes
// it to the canvas. How a frame draws with them is draw.ts's.
//
// The output pass: the target's colour, with the glow's colour added as it is where a glow is drawn (so a glow's
// strength means what it always has), to the canvas through three's own tone curve and display encoding (the chunks
// three gives every material drawn to the canvas); and the target's depth into the canvas's depth, so that the aids
// drawn after it hide behind the scene.
const GLOW = 'MODEL_GLOW';
const OUTPUT = Object.freeze({vertexShader: 'varying vec2 vUv;\nvoid main() {\n  vUv = uv;\n' +
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}',
fragmentShader: 'uniform sampler2D modelSceneColor;\nuniform sampler2D modelSceneDepth;\n' +
  'uniform sampler2D modelGlow;\nvarying vec2 vUv;\nvoid main() {\n' +
  '  gl_FragColor = texture2D( modelSceneColor, vUv );\n' +
  `#ifdef ${GLOW}\n  gl_FragColor.rgb += texture2D( modelGlow, vUv ).rgb;\n#endif\n` +
  '  gl_FragDepth = texture2D( modelSceneDepth, vUv ).r;\n  #include <tonemapping_fragment>\n' +
  '  #include <colorspace_fragment>\n}'});
// The samples of the frame's target: the canvas's own antialiasing, kept for the one draw of the scene.
const SAMPLES = 4;
// The bytes the frame holds for each drawing-buffer pixel, by part: half-float RGBA colour (8 bytes) and 24-bit depth
// (stored in 4), each multisampled at SAMPLES and resolved once: 60 in all, from the formats' sizes. Chrome's GPU
// process read 54 and 62 on ANGLE Metal (perf-budgets' measured.md, Stage, "The stage's linear frame", 2026-11-26).
const PIXEL_BYTES = Object.freeze({multisampledColor: SAMPLES * 8, multisampledDepth: SAMPLES * 4, resolvedColor: 8,
  resolvedDepth: 4});
const BYTES_PER_PIXEL = Object.values(PIXEL_BYTES).reduce((sum, bytes) => sum + bytes, 0);
export const MODEL_LINEAR_FRAME_TEXT = Object.freeze({
  budget: (width: number, height: number, bytes: number, most: number) => `The stage's frame at ${width} by ` +
    `${height} drawing-buffer pixels would hold ${bytes} bytes, ${bytes - most} over its budget of ${most}.`,
});
// Refuses a drawing buffer whose frame would pass the stage's budget (`MODEL_STAGE.frameBytesLimit`), naming its size,
// its bytes and how far over.
function checkBudget(width: number, height: number) {
  const bytes = width * height * BYTES_PER_PIXEL, most = MODEL_STAGE.frameBytesLimit;
  if (bytes > most) throw new ModelStageRefusal(MODEL_LINEAR_FRAME_TEXT.budget(width, height, bytes, most));
}

/** The frame's target and output pass at a drawing-buffer size: its glow's colour is written by `setGlow`, its size by
 * `resize`. A size past the stage's budget is refused by name at either, and the frame keeps the size it had. */
export function createModelLinearFrame(size: THREE.Vector2) {
  checkBudget(size.x, size.y);
  const depth = new THREE.DepthTexture(size.x, size.y);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {type: THREE.HalfFloatType, samples: SAMPLES,
    depthTexture: depth});
  const glow: THREE.IUniform<THREE.Texture | null> = {value: null};
  const material = new THREE.ShaderMaterial({...OUTPUT, depthFunc: THREE.AlwaysDepth,
    uniforms: {modelSceneColor: {value: target.texture}, modelSceneDepth: {value: depth}, modelGlow: glow}});
  const output = new FullScreenQuad(material);
  return {
    target,
    /** The glow's colour the output adds, or none: a change of the two compiles the pass's other program once. */
    setGlow(texture: THREE.Texture | null) {
      if (glow.value === texture) return;
      if ((glow.value === null) !== (texture === null)) {
        if (texture === null) delete material.defines[GLOW];
        else material.defines[GLOW] = '';
        material.needsUpdate = true;
      }
      glow.value = texture;
    },
    /** The output pass, onto the bound canvas. */
    output: (renderer: THREE.WebGLRenderer) => output.render(renderer),
    /** The canvas's drawing buffer is to be this size (three sizes the target's depth texture to it when it next sets
     * it up, WebGLTextures.js 1659). */
    resize(width: number, height: number) {
      checkBudget(width, height);
      target.setSize(width, height);
    },
    dispose() {
      depth.dispose();
      target.dispose();
      output.dispose();
      material.dispose();
    },
  };
}
