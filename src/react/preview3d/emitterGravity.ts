import * as THREE from 'three';
import {ApplyForce, type ValueGenerator, Vector3} from 'three.quarks';
import type {ModelSceneGravity} from './sceneGravity.ts';
import {ModelEmitterSpaceTurn} from './emitterSpace.ts';

/** Unity's `main.gravityModifier` as three.quarks' own `ApplyForce`, the modifier its `magnitude`: each frame, every
 * particle's velocity gains the scene's gravity (world space, as the frame states it) times the modifier, turned into
 * the system's space when it simulates in the emitter's, as Unity's does. */
export class ModelSceneGravityForce extends ApplyForce {
  private readonly turned = new THREE.Vector3();
  constructor(gravity: ModelSceneGravity, modifier: ValueGenerator, emitter: THREE.Object3D, worldSpace: boolean) {
    super(new Vector3(), modifier);
    this.gravity = gravity;
    this.turn = new ModelEmitterSpaceTurn(emitter, {stated: true, system: worldSpace});
  }
  private readonly gravity: ModelSceneGravity;
  private readonly turn: ModelEmitterSpaceTurn;

  frameUpdate(delta: number) {
    super.frameUpdate(delta);
    this.turn.refresh();
    const {x, y, z} = this.turn.apply(this.turned.copy(this.gravity.acceleration));
    this.direction.set(x, y, z);
  }

  clone() {
    return new ModelSceneGravityForce(this.gravity, this.magnitude.clone(), this.turn.emitter,
      this.turn.spaces.system);
  }
}
