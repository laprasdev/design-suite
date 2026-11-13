import * as THREE from 'three';
import {writeModelColor} from './color.ts';
import type {ModelColor} from './colorModel.ts';
import {modelShaderChunk, modelShaderUniforms} from './shading.ts';

// The colour behind everything the stage draws, drawn as part of the scene, so that it passes through the look's tone
// curve and the display encoding as every colour the look gives does, through three's own <tonemapping_fragment> and
// <colorspace_fragment>: straight to the canvas without glow, and into the glow's linear target with it, which the
// output pass then curves. So fog that reaches its far colour meets a backdrop drawn by the same rule, on both paths.
// One triangle covering the view at the far plane, drawn first of everything and testing no depth, so that everything
// drawn after covers it: as three draws its own background plane (WebGLBackground.js, ShaderLib background).
const UNIFORM = 'modelStageBackdrop';
const CHUNK = Object.freeze({curve: 'tonemapping_fragment', encoding: 'colorspace_fragment'});
/** Before everything else in the scene's opaque list. */
const FIRST = Number.NEGATIVE_INFINITY;
const COVERING = Object.freeze([-1, -1, 0, 3, -1, 0, -1, 3, 0]);

export function createModelBackdrop() {
  const color = new THREE.Color();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(COVERING, 3));
  const material = new THREE.ShaderMaterial({uniforms: {[UNIFORM]: {value: color}}, depthTest: false,
    depthWrite: false, fog: false, vertexShader: 'void main() {\n  gl_Position = vec4( position.xy, 1.0, 1.0 );\n}',
    fragmentShader: `${modelShaderUniforms({[UNIFORM]: 'vec3'})}\nvoid main() {\n  gl_FragColor = vec4( ${UNIFORM}, ` +
      `1.0 );\n  ${modelShaderChunk(CHUNK.curve)}\n  ${modelShaderChunk(CHUNK.encoding)}\n}`});
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'stage backdrop';
  mesh.frustumCulled = false;
  mesh.renderOrder = FIRST;
  return {
    /** The backdrop, on the scene's layer: the scene owns it, and frees it with everything else it holds. */
    mesh,
    /** The look's backdrop colour, as the look states it (sRGB), held linear as every colour three draws. */
    set: (value: ModelColor) => {writeModelColor(color, value);},
  };
}
export type ModelBackdrop = ReturnType<typeof createModelBackdrop>;
