import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

// The frame in linear light: the scene's multisampled half-float target, which every surface is drawn and blended into
// as a URP camera's colour target is (blending in linear light, before any curve), and the one output pass that writes
// it to the canvas. How a frame draws with them is draw.ts's.
//
// The output pass: the target's colour, with the glow's colour added as it is where a glow is drawn (so a glow's
// strength means what it always has), to the canvas through three's own tone curve and display encoding (the chunks
// three gives every material drawn to the canvas); and the target's depth into the canvas's depth, so that the aids
// drawn after it hide behind the scene.
const BLOOM = 'MODEL_BLOOM';
const OUTPUT = Object.freeze({vertexShader: 'varying vec2 vUv;\nvoid main() {\n  vUv = uv;\n' +
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}',
fragmentShader: 'uniform sampler2D modelSceneColor;\nuniform sampler2D modelSceneDepth;\n' +
  'uniform sampler2D modelBloom;\nvarying vec2 vUv;\nvoid main() {\n' +
  '  gl_FragColor = texture2D( modelSceneColor, vUv );\n' +
  `#ifdef ${BLOOM}\n  gl_FragColor.rgb += texture2D( modelBloom, vUv ).rgb;\n#endif\n` +
  '  gl_FragDepth = texture2D( modelSceneDepth, vUv ).r;\n  #include <tonemapping_fragment>\n' +
  '  #include <colorspace_fragment>\n}'});
// The samples of the frame's target: the canvas's own antialiasing, kept for the one draw of the scene.
const SAMPLES = 4;

/** The frame's target and output pass at a drawing-buffer size: its glow is written by `bloom`, its size by
 * `resize`. */
export function createModelLinearFrame(size: THREE.Vector2) {
  const depth = new THREE.DepthTexture(size.x, size.y);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {type: THREE.HalfFloatType, samples: SAMPLES,
    depthTexture: depth});
  const bloom: THREE.IUniform<THREE.Texture | null> = {value: null};
  const material = new THREE.ShaderMaterial({...OUTPUT, depthFunc: THREE.AlwaysDepth,
    uniforms: {modelSceneColor: {value: target.texture}, modelSceneDepth: {value: depth}, modelBloom: bloom}});
  const output = new FullScreenQuad(material);
  return {
    target,
    /** The glow's colour the output adds, or none: a change of the two compiles the pass's other program once. */
    bloom(texture: THREE.Texture | null) {
      if (bloom.value === texture) return;
      if ((bloom.value === null) !== (texture === null)) {
        if (texture === null) delete material.defines[BLOOM];
        else material.defines[BLOOM] = '';
        material.needsUpdate = true;
      }
      bloom.value = texture;
    },
    /** The output pass, onto the bound canvas. */
    output: (renderer: THREE.WebGLRenderer) => output.render(renderer),
    /** The canvas changed size (three sizes the target's depth texture to it when it next sets it up, WebGLTextures.js
     * 1659). */
    resize: (width: number, height: number) => target.setSize(width, height),
    dispose() {
      depth.dispose();
      target.dispose();
      output.dispose();
      material.dispose();
    },
  };
}
export type ModelLinearFrame = ReturnType<typeof createModelLinearFrame>;
