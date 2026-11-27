import * as THREE from 'three';
import {MODEL_SURFACE_GLSL} from './surfaceGlsl.ts';
import {modelShaderUniforms} from './shading.ts';
import {MODEL_STAGE_LAYERS} from './layers.ts';

// The opaque scene's depth, as URP's camera depth texture (_CameraDepthTexture) hands a transparent shader graph's
// Scene Depth node. While a kind material that reads it is built, the frame first draws its scene layer once more,
// colour masked off, into a single-sampled depth target of its own (linearFrame.ts), whose depth is a texture; then the
// frame's one pass draws, and a kind reads that texture there. The stage's aids (layers.ts) never land in it, as an
// editor's never land in URP's. What lands in it is what writes depth: opaque and cut-out
// surfaces, with their own programs (so a cut-out's coverage and a kind's displacement shape it as in the frame), and
// never a blended one, which writes no depth (surfaceCoverageModel.ts), nor the backdrop. The target is never the
// frame's, so no draw samples what it is writing, as three's transmission pass draws its opaque objects into a target
// of its own (WebGLRenderer.js renderTransmissionPass). During the depth pass the texture is unbound, so a kind drawn
// there reads nothing stale. Shadow maps are not drawn again for it.
export const MODEL_SCENE_DEPTH = Object.freeze({texture: 'stageSceneDepth', view: 'stageSceneDepthView'});
const {sceneDepth, fragmentDepth, eyeDepth} = MODEL_SURFACE_GLSL;
/**
 * What a kind that reads the scene's depth declares, fragment stage only: `kindSceneDepth()`, the eye depth (metres
 * from the camera's plane) of the opaque scene at the fragment, as Unity's Scene Depth node in Eye mode gives it; and
 * `kindFragmentDepth()`, the fragment's own eye depth, which is a perspective camera's clip w (Unity's Screen Position
 * w). Both convert a depth-buffer value as the camera's projection wrote it, orthographic or perspective, as
 * `Unity_SceneDepth_Eye` branches on `unity_OrthoParams.w`. The view holds near, far, and one over the target's width
 * and height.
 */
export const MODEL_SCENE_DEPTH_READ = [modelShaderUniforms({[MODEL_SCENE_DEPTH.texture]: 'sampler2D',
  [MODEL_SCENE_DEPTH.view]: 'vec4'}),
`float ${eyeDepth}( float depth ) {
  float near = ${MODEL_SCENE_DEPTH.view}.x, far = ${MODEL_SCENE_DEPTH.view}.y;
  return isOrthographic ? near + depth * ( far - near ) : near * far / ( far - depth * ( far - near ) );
}
float ${sceneDepth}() {
  return ${eyeDepth}( texture2D( ${MODEL_SCENE_DEPTH.texture}, gl_FragCoord.xy * ${MODEL_SCENE_DEPTH.view}.zw ).x );
}
float ${fragmentDepth}() { return ${eyeDepth}( gl_FragCoord.z ); }`].join('\n');
/** The uniforms that carry it, placed by reference into every kind material (sharedValues.ts). */
export function createModelSceneDepthUniforms() {
  const texture: THREE.IUniform<THREE.Texture | null> = {value: null};
  return Object.freeze({[MODEL_SCENE_DEPTH.texture]: texture, [MODEL_SCENE_DEPTH.view]: {value: new THREE.Vector4()}});
}
export type ModelSceneDepthUniforms = ReturnType<typeof createModelSceneDepthUniforms>;

/** The depth pass into the frame's depth target: drawn before the frame's one pass, each frame a reader holds it. */
export function createModelSceneDepthPass(renderer: THREE.WebGLRenderer, scene: THREE.Scene,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, uniforms: ModelSceneDepthUniforms) {
  const texture = uniforms[MODEL_SCENE_DEPTH.texture], view = uniforms[MODEL_SCENE_DEPTH.view];
  return (target: THREE.WebGLRenderTarget) => {
    const colour = renderer.state.buffers.color, shadows = renderer.shadowMap;
    texture.value = null;
    const layers = camera.layers.mask;
    camera.layers.mask = MODEL_STAGE_LAYERS.scene;
    const drawsShadows = shadows.autoUpdate;
    shadows.autoUpdate = false;
    colour.setMask(false);
    colour.setLocked(true);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    // Three sets the colour mask again from each material it draws next.
    colour.setLocked(false);
    camera.layers.mask = layers;
    shadows.autoUpdate = drawsShadows;
    view.value.set(camera.near, camera.far, 1 / target.width, 1 / target.height);
    texture.value = target.depthTexture;
  };
}
