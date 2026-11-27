import * as THREE from 'three';
import {ApplyForce, ConstantValue, Vector3} from 'three.quarks';
import type {ModelVector} from './placementModel.ts';
import {ModelEmitterSpaceTurn} from './emitterSpace.ts';

/** Unity's `main.gravityModifier` as three.quarks' own `ApplyForce`: each frame, every particle's velocity gains the
 * acceleration the engine's start states (emitterFrameModel.ts: the modifier times the scene's gravity, world space),
 * drawn as stated, turned into the system's space when it simulates in the emitter's, as Unity's does. */
export class ModelEmitterGravityForce extends ApplyForce {
  private readonly acceleration = new THREE.Vector3();
  private readonly turned = new THREE.Vector3();
  private readonly turn: ModelEmitterSpaceTurn;
  constructor(emitter: THREE.Object3D, worldSpace: boolean) {
    super(new Vector3(), new ConstantValue(1));
    this.turn = new ModelEmitterSpaceTurn(emitter, {stated: true, system: worldSpace});
  }

  /** Holds the acceleration a start states. */
  fallBy(gravity: ModelVector) {
    this.acceleration.set(gravity[0], gravity[1], gravity[2]);
  }

  frameUpdate(delta: number) {
    super.frameUpdate(delta);
    this.turn.refresh();
    const {x, y, z} = this.turn.apply(this.turned.copy(this.acceleration));
    this.direction.set(x, y, z);
  }

  clone() {
    const force = new ModelEmitterGravityForce(this.turn.emitter, this.turn.spaces.system);
    force.acceleration.copy(this.acceleration);
    return force;
  }
}
