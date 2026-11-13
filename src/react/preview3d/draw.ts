import * as THREE from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import type {ModelStageGlow} from './lookModel.ts';
import type {ModelFog} from './fog.ts';

// The target keeps the canvas's own antialiasing: the canvas asks for it, and a target has none unless it samples.
const GLOW_SAMPLES = 4;

/**
 * The frame's one draw. With no glow in the look it is the stage's single pass, straight to the canvas, tone-mapped
 * and converted per material as it always was. With glow, the scene is drawn into a half-float target in linear light,
 * three's bloom pass adds back what is brighter than the threshold, and one output pass tone-maps and converts the
 * whole frame at the end; so with glow the backdrop and the fog colours pass through tone mapping too, which they do
 * not without it. The targets exist only while the look has glow. The frame's triangle count is the scene pass's.
 */
export function createModelDraw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera,
  fog: Pick<ModelFog, 'encode'>) {
  const size = new THREE.Vector2();
  let glow: {target: THREE.WebGLRenderTarget; bloom: UnrealBloomPass; output: OutputPass} | undefined;
  let triangles = 0;
  const release = () => {
    if (!glow) return;
    glow.target.dispose();
    glow.bloom.dispose();
    glow.output.dispose();
    glow = undefined;
  };
  const create = () => {
    renderer.getDrawingBufferSize(size);
    const output = new OutputPass();
    output.renderToScreen = true;
    return {output, bloom: new UnrealBloomPass(size, 0, 0, 0),
      target: new THREE.WebGLRenderTarget(size.x, size.y, {type: THREE.HalfFloatType, samples: GLOW_SAMPLES})};
  };
  return {
    set(value: ModelStageGlow | null) {
      if (value === null) {
        release();
        fog.encode(renderer.outputColorSpace);
        return;
      }
      glow ??= create();
      glow.bloom.threshold = value.threshold;
      glow.bloom.strength = value.strength;
      glow.bloom.radius = value.radius;
      // Inside a target, three gives fog its colour in the working space, not the canvas's.
      fog.encode(THREE.ColorManagement.workingColorSpace);
    },
    /** The canvas changed size: the glow's target and passes follow its drawing buffer. */
    resize() {
      if (!glow) return;
      renderer.getDrawingBufferSize(size);
      glow.target.setSize(size.x, size.y);
      glow.bloom.setSize(size.x, size.y);
    },
    draw() {
      if (!glow) {
        renderer.render(scene, camera);
        triangles = renderer.info.render.triangles;
        return;
      }
      renderer.setRenderTarget(glow.target);
      renderer.render(scene, camera);
      triangles = renderer.info.render.triangles;
      glow.bloom.render(renderer, glow.target, glow.target, 0, false);
      glow.output.render(renderer, glow.target, glow.target, 0, false);
    },
    /** The triangles the scene pass drew in the last frame; the glow's own full-screen passes are not counted. */
    get triangles() {return triangles;},
    dispose: release,
  };
}
export type ModelDraw = ReturnType<typeof createModelDraw>;
