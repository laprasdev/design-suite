import * as THREE from 'three';
import type {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import type {ModelStageGlow} from './lookModel.ts';

// The glow's own resources: three's bloom pass and its targets, made when a look first brings glow and freed when it
// leaves. It reads the frame's resolved target (linearFrame.ts); how a frame draws with it is draw.ts's.
/** The glow's pass: three's bloom. */
export interface ModelGlowPasses {readonly Bloom: typeof UnrealBloomPass}
/** The glow's pass, three's own, fetched the first time a look brings glow, so a page that never glows never downloads
 * it. */
export async function loadModelGlowPasses(): Promise<ModelGlowPasses> {
  const bloom = await import('three/addons/postprocessing/UnrealBloomPass.js');
  return {Bloom: bloom.UnrealBloomPass};
}
/** One glow's resources at a drawing-buffer size: its values are written by `set`, its sizes by `resize`. */
export function createModelGlow({Bloom}: ModelGlowPasses, size: THREE.Vector2) {
  // three's pass ends by blending its composite into what it read. Drawn to the screen instead, that blend is made to
  // draw nothing (its material not visible), and its first step's copy of the scene to the canvas is overwritten by the
  // frame's output pass, which adds the composite itself: the frame's target is never drawn into after its one resolve.
  const bloom = new Bloom(size, 0, 0, 0);
  bloom.renderToScreen = true;
  bloom.blendMaterial.visible = false;
  return {
    /** The composite of the bloom's levels, which the frame's output adds. */
    texture: bloom.renderTargetsHorizontal[0].texture,
    /** The bloom, from the frame's resolved colour into its own targets; nothing is drawn into the frame's target. */
    bloom: (renderer: THREE.WebGLRenderer, frame: THREE.WebGLRenderTarget) =>
      bloom.render(renderer, frame, frame, 0, false),
    set(value: ModelStageGlow) {
      bloom.threshold = value.threshold;
      bloom.strength = value.strength;
      bloom.radius = value.radius;
    },
    resize: (width: number, height: number) => bloom.setSize(width, height),
    dispose() {
      bloom.dispose();
      // three r182's UnrealBloomPass.dispose frees every material of the pass but its high-pass filter.
      bloom.materialHighPassFilter.dispose();
    },
  };
}
export type ModelGlow = ReturnType<typeof createModelGlow>;
