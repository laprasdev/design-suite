import * as THREE from 'three';

/** The scene's gravity in metres a second squared, world space, as the engine's frames state it (`gravity`, the
 * scene's own, ISM's `SceneDefinition.Gravity`): the stage keeps the latest a frame stated. Until one has, nothing it
 * draws may fall by it, and a start of a profile that would is refused (emitters.ts). */
export interface ModelSceneGravity {
  readonly acceleration: THREE.Vector3;
  stated: boolean;
}
export const createModelSceneGravity = (): ModelSceneGravity => ({acceleration: new THREE.Vector3(), stated: false});

/** Whether gravity is in force once a frame stating `framed` (or none) applies. */
export const modelGravityInForce = (gravity: ModelSceneGravity, framed: Float64Array | null) =>
  framed !== null || gravity.stated;

/** Holds the gravity a frame states; a frame stating none keeps what is held, as a frame camera does. */
export function applyModelSceneGravity(gravity: ModelSceneGravity, framed: Float64Array | null) {
  if (framed === null) return;
  gravity.acceleration.set(framed[0], framed[1], framed[2]);
  gravity.stated = true;
}
