import type * as THREE from 'three';

// The stage's two layers. The scene's look (models, scenery, the backdrop's fog) is on three's default layer; the
// stage's aids (its floor and grid, each actor's rig and part markers) are on their own. The frame's one pass draws
// both (draw.ts), so a blended surface mixes over the aids behind it as over the scene. Lights light both.
export const MODEL_STAGE_LAYER = Object.freeze({scene: 0, aids: 1});
/** The camera's layer masks: each layer's, and both, which the frame's one pass draws. */
export const MODEL_STAGE_LAYERS = Object.freeze({scene: 1 << MODEL_STAGE_LAYER.scene,
  aids: 1 << MODEL_STAGE_LAYER.aids, both: (1 << MODEL_STAGE_LAYER.scene) | (1 << MODEL_STAGE_LAYER.aids)});

/** Objects, and everything under them, are the stage's aids. */
export function markModelStageAids(objects: Iterable<THREE.Object3D>) {
  for (const object of objects) object.traverse(node => node.layers.set(MODEL_STAGE_LAYER.aids));
}
/** Lights reach the aids' layer as well as the scene's. */
export function markModelStageLights(lights: Iterable<THREE.Light>) {
  for (const light of lights) light.layers.enable(MODEL_STAGE_LAYER.aids);
}
