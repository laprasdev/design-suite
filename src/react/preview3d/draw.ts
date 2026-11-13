import * as THREE from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {MODEL_STAGE_TONE_CURVE, type ModelStageGlow, type ModelStageToneCurve} from './lookModel.ts';
import type {ModelFog} from './fog.ts';

const CURVES: Readonly<Record<ModelStageToneCurve, THREE.ToneMapping>> = Object.freeze({
  [MODEL_STAGE_TONE_CURVE.acesFilmic]: THREE.ACESFilmicToneMapping,
});
// Adds a texture's colour to what the canvas already shows, unconverted and uncurved.
const ADD = Object.freeze({vertexShader: 'varying vec2 vUv;\nvoid main() {\n  vUv = uv;\n' +
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}',
fragmentShader: 'uniform sampler2D glow;\nvarying vec2 vUv;\nvoid main() {\n' +
  '  gl_FragColor = vec4( texture2D( glow, vUv ).rgb, 1.0 );\n}'});
type Glow = {target: THREE.WebGLRenderTarget; bloom: UnrealBloomPass; add: FullScreenQuad;
  material: THREE.ShaderMaterial};

/**
 * The frame's one draw: the scene through the camera to the canvas, under the look's tone curve or none. Glow adds to
 * that frame and changes nothing else in it. The scene is drawn a second time, in linear light, into a half-float
 * target that only feeds three's bloom pass; the bloom alone (three r180 leaves it in the pass's first horizontal
 * target before blending it back) is then added onto the canvas. Where nothing is brighter than the threshold the
 * bloom is 0 and the canvas is exactly the direct draw. A look with both a curve and glow is refused (lookModel.ts).
 */
export function createModelDraw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera,
  fog: Pick<ModelFog, 'encode'>) {
  const size = new THREE.Vector2();
  let glow: Glow | undefined;
  let triangles = 0;
  const release = () => {
    if (!glow) return;
    glow.target.dispose();
    glow.bloom.dispose();
    glow.add.dispose();
    glow.material.dispose();
    glow = undefined;
  };
  const create = (): Glow => {
    renderer.getDrawingBufferSize(size);
    const bloom = new UnrealBloomPass(size, 0, 0, 0);
    const material = new THREE.ShaderMaterial({...ADD, blending: THREE.AdditiveBlending, depthTest: false,
      depthWrite: false, toneMapped: false, uniforms: {glow: {value: bloom.renderTargetsHorizontal[0].texture}}});
    return {bloom, material, add: new FullScreenQuad(material),
      target: new THREE.WebGLRenderTarget(size.x, size.y, {type: THREE.HalfFloatType})};
  };
  const add = (passes: Glow) => {
    // The fog colour follows the space of what is drawn into, as three's own does.
    fog.encode(THREE.ColorManagement.workingColorSpace);
    renderer.setRenderTarget(passes.target);
    renderer.render(scene, camera);
    fog.encode(renderer.outputColorSpace);
    passes.bloom.render(renderer, passes.target, passes.target, 0, false);
    renderer.setRenderTarget(null);
    const clears = renderer.autoClear;
    renderer.autoClear = false;
    passes.add.render(renderer);
    renderer.autoClear = clears;
  };
  return {
    set(curve: ModelStageToneCurve | null, value: ModelStageGlow | null) {
      renderer.toneMapping = curve === null ? THREE.NoToneMapping : CURVES[curve];
      if (value === null) {
        release();
        return;
      }
      glow ??= create();
      glow.bloom.threshold = value.threshold;
      glow.bloom.strength = value.strength;
      glow.bloom.radius = value.radius;
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
