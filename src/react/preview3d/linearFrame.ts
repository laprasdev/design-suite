import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_STAGE} from './model.ts';
import {MODEL_SURFACE_SCENE_READ, type ModelSurfaceSceneRead} from './surfaceKindModel.ts';

// The frame in linear light: the scene's multisampled half-float target, which every surface is drawn and blended into
// as a URP camera's colour target is (blending in linear light, before any curve), and the one output pass that writes
// it to the canvas. How a frame draws with them is draw.ts's.
//
// The output pass: the target's colour, with the glow's colour added as it is where a glow is drawn (so a glow's
// strength means what it always has), to the canvas through three's own tone curve and display encoding (the chunks
// three gives every material drawn to the canvas).
const GLOW = 'MODEL_GLOW';
const OUTPUT = Object.freeze({vertexShader: 'varying vec2 vUv;\nvoid main() {\n  vUv = uv;\n' +
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}',
fragmentShader: 'uniform sampler2D modelSceneColor;\nuniform sampler2D modelGlow;\nvarying vec2 vUv;\nvoid main() {\n' +
  '  gl_FragColor = texture2D( modelSceneColor, vUv );\n' +
  `#ifdef ${GLOW}\n  gl_FragColor.rgb += texture2D( modelGlow, vUv ).rgb;\n#endif\n` +
  '  #include <tonemapping_fragment>\n' +
  '  #include <colorspace_fragment>\n}'});
// The samples of the frame's target: the canvas's own antialiasing, kept for the one draw of the scene.
const SAMPLES = 4;
// The bytes the frame holds for each drawing-buffer pixel, by part: half-float RGBA colour (8 bytes) and 24-bit depth
// (stored in 4), each multisampled at SAMPLES and each once more in the framebuffer it resolves into (three gives that
// one a depth renderbuffer of its own, WebGLTextures.js 1799): 60 in all, from the formats' sizes. Chrome's GPU
// process read 54, 62 and 66 on ANGLE Metal (perf-budgets' measured.md, Stage, "The stage's linear frame", 2026-11-26).
const PIXEL_BYTES = Object.freeze({multisampledColor: SAMPLES * 8, multisampledDepth: SAMPLES * 4, resolvedColor: 8,
  resolvedDepth: 4});
// The scene depth's target, held only while a kind material that reads it is built (sceneDepth.ts): an 8-bit red
// mask, which three's target needs and the depth pass never writes, and 24-bit depth (stored in 4) in a texture,
// single sampled as URP's camera depth texture is (its prepass draws without MSAA): a resolve of a multisampled depth
// keeps one sample a pixel, so samples would add bytes no reader sees. 5 in all.
const DEPTH_PIXEL_BYTES = Object.freeze({mask: 1, depth: 4});
const sum = (bytes: Readonly<Record<string, number>>) => Object.values(bytes).reduce((total, part) => total + part, 0);
/** The bytes the frame holds per drawing-buffer pixel, with the scene depth's target or without it. */
export const MODEL_LINEAR_FRAME_PIXEL_BYTES = Object.freeze({frame: sum(PIXEL_BYTES),
  withSceneDepth: sum(PIXEL_BYTES) + sum(DEPTH_PIXEL_BYTES)});
export const MODEL_LINEAR_FRAME_TEXT = Object.freeze({
  budget: (width: number, height: number, bytes: number, most: number) => `The stage's frame at ${width} by ` +
    `${height} drawing-buffer pixels would hold ${bytes} bytes, ${bytes - most} over its budget of ${most}.`,
});
// Refuses a drawing buffer whose frame would pass the stage's budget (`MODEL_STAGE.frameBytesLimit`), naming its size,
// its bytes and how far over.
function checkBudget(width: number, height: number, perPixel: number) {
  const bytes = width * height * perPixel, most = MODEL_STAGE.frameBytesLimit;
  if (bytes > most) throw new ModelStageRefusal(MODEL_LINEAR_FRAME_TEXT.budget(width, height, bytes, most));
}
const depthTarget = (width: number, height: number) => new THREE.WebGLRenderTarget(width, height,
  {format: THREE.RedFormat, depthTexture: new THREE.DepthTexture(width, height)});
/** What the frame's reads are held by: a kind material that reads the frame holds each of its reads from its build
 * until it is freed (surfaceMaterials.ts), and the frame holds what a read needs while one holds it. */
export interface ModelSceneReaders {
  /** Refused by name, holding nothing, when the frame's budget cannot hold what the read needs at its size. */
  hold(read: ModelSurfaceSceneRead): void;
  release(read: ModelSurfaceSceneRead): void;
}

/** The frame's target and output pass at a drawing-buffer size, and the scene depth's target while a reader holds it
 * (`sceneReaders`): its glow's colour is written by `setGlow`, its size by `resize`. A size past the stage's budget is
 * refused by name at either, or a read the budget cannot hold at `hold`, and the frame keeps what it had. */
export function createModelLinearFrame(size: THREE.Vector2) {
  checkBudget(size.x, size.y, MODEL_LINEAR_FRAME_PIXEL_BYTES.frame);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {type: THREE.HalfFloatType, samples: SAMPLES});
  let depth: THREE.WebGLRenderTarget | null = null;
  const readers: Record<ModelSurfaceSceneRead, number> = {[MODEL_SURFACE_SCENE_READ.depth]: 0};
  const perPixel = () => MODEL_LINEAR_FRAME_PIXEL_BYTES[depth ? 'withSceneDepth' : 'frame'];
  const glow: THREE.IUniform<THREE.Texture | null> = {value: null};
  const material = new THREE.ShaderMaterial({...OUTPUT,
    uniforms: {modelSceneColor: {value: target.texture}, modelGlow: glow}});
  const output = new FullScreenQuad(material);
  const sceneReaders: ModelSceneReaders = {
    hold(read) {
      if (readers[read] === 0) {
        checkBudget(target.width, target.height, MODEL_LINEAR_FRAME_PIXEL_BYTES.withSceneDepth);
        depth = depthTarget(target.width, target.height);
      }
      readers[read]++;
    },
    release(read) {
      if (--readers[read] > 0) return;
      depth?.dispose();
      depth = null;
    },
  };
  return {
    target,
    /** Where the scene's depth is drawn before the frame's pass (sceneDepth.ts), or null: no reader holds it. */
    get depth() {return depth;},
    sceneReaders,
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
    /** The canvas's drawing buffer is to be this size. */
    resize(width: number, height: number) {
      checkBudget(width, height, perPixel());
      target.setSize(width, height);
      depth?.setSize(width, height);
    },
    dispose() {
      target.dispose();
      depth?.dispose();
      output.dispose();
      material.dispose();
    },
  };
}
