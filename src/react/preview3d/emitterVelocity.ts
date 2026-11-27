import * as THREE from 'three';
import type {Behavior, Particle, ValueGenerator} from 'three.quarks';

/** Unity's velocity over lifetime as a three.quarks behaviour, which quarks has none of: each particle moves by its
 * own linear velocity besides the velocity it was started with, and Unity's speed modifier scales both, as quarks'
 * own `speedModifier` scales a particle's velocity when it integrates. The linear velocity is added to the position,
 * never to the particle's velocity, so a constant one moves a particle at a constant rate. Stated in the space other
 * than the system's, it turns by the emitter's world rotation each frame, as Unity's does. */
export class VelocityOverLifetime implements Behavior {
  readonly type = 'VelocityOverLifetime';
  private readonly linear = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  /**
   * @param axes  the linear velocity's x, y and z in metres a second, each drawn once a particle.
   * @param speedModifier  what the particle's whole speed is multiplied by, drawn once a particle.
   * @param emitter  the system's emitter, whose world rotation turns a velocity stated in the other space.
   * @param worldSpace  whether the velocity is `stated` in world space (Unity's `velocityOverLifetime.space`), and
   * whether the `system` simulates in it (`main.simulationSpace`).
   */
  constructor(axes: readonly [ValueGenerator, ValueGenerator, ValueGenerator], speedModifier: ValueGenerator,
    emitter: THREE.Object3D, worldSpace: {readonly stated: boolean; readonly system: boolean}) {
    this.axes = axes;
    this.speedModifier = speedModifier;
    this.emitter = emitter;
    this.worldSpace = worldSpace;
    this.turned = worldSpace.stated !== worldSpace.system;
  }
  private readonly axes: readonly [ValueGenerator, ValueGenerator, ValueGenerator];
  private readonly speedModifier: ValueGenerator;
  private readonly emitter: THREE.Object3D;
  private readonly worldSpace: {readonly stated: boolean; readonly system: boolean};
  private readonly turned: boolean;

  initialize(particle: Particle) {
    for (const axis of this.axes) axis.startGen(particle.memory);
    this.speedModifier.startGen(particle.memory);
    particle.speedModifier = this.speedModifier.genValue(particle.memory);
  }

  frameUpdate() {
    if (!this.turned) return;
    this.emitter.getWorldQuaternion(this.turn);
    if (this.worldSpace.stated) this.turn.invert();
  }

  update(particle: Particle, delta: number) {
    const [x, y, z] = this.axes, {memory} = particle;
    this.linear.set(x.genValue(memory), y.genValue(memory), z.genValue(memory));
    if (this.turned) this.linear.applyQuaternion(this.turn);
    // The particle's position is quarks' own vector type, which takes no three.js vector.
    const step = delta * particle.speedModifier, {position} = particle;
    position.set(position.x + this.linear.x * step, position.y + this.linear.y * step,
      position.z + this.linear.z * step);
  }

  toJSON() {
    return {type: this.type};
  }

  clone() {
    const [x, y, z] = this.axes;
    return new VelocityOverLifetime([x.clone(), y.clone(), z.clone()], this.speedModifier.clone(), this.emitter,
      this.worldSpace);
  }

  reset() {}
}
