import * as THREE from 'three';

/** Whether a vector is `stated` in world space, and whether the `system` it moves particles of simulates in it. */
export interface ModelEmitterSpaces {readonly stated: boolean; readonly system: boolean}

/** How a vector stated in one space reaches a system simulating in the other, as Unity's velocity over lifetime and
 * gravity do: turned by the emitter's world rotation, from the emitter's space into world space, or by its inverse,
 * from world space into the emitter's; unturned when both are one. Read again each frame (`refresh`), as the emitter
 * turns; allocates nothing. */
export class ModelEmitterSpaceTurn {
  private readonly turn = new THREE.Quaternion();
  readonly turned: boolean;
  constructor(emitter: THREE.Object3D, spaces: ModelEmitterSpaces) {
    this.emitter = emitter;
    this.spaces = spaces;
    this.turned = spaces.stated !== spaces.system;
  }
  readonly emitter: THREE.Object3D;
  readonly spaces: ModelEmitterSpaces;

  refresh() {
    if (!this.turned) return;
    this.emitter.getWorldQuaternion(this.turn);
    if (this.spaces.stated) this.turn.invert();
  }

  /** `vector`, turned in place into the system's space. */
  apply(vector: THREE.Vector3) {
    return this.turned ? vector.applyQuaternion(this.turn) : vector;
  }
}
