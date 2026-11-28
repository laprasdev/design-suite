import * as THREE from 'three';
import type {BatchedRenderer} from 'three.quarks';
import {MODEL_EMITTER_CHANGE, MODEL_NO_EMITTER_CHANGES, type ModelEmitterChange} from './emitterFrameModel.ts';
import type {ModelVector} from './placementModel.ts';
import {MODEL_EMITTER_ORIGIN, MODEL_EMITTER_REFUSAL as refusal, MODEL_UNITY_EULER_ORDER, modelDeclaredEmitter,
  type ModelEmitterDrawing, type ModelEmitterProfile} from './emitterModel.ts';
import {MODEL_EMITTER_BUDGET, modelEmitterCapRefusal, modelEmitterCoverage, modelEmitterOverCap}
  from './emitterBudgetModel.ts';
import {createModelEmitterSystem} from './emitterSystems.ts';
import type {ModelStageCommit} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';

// An actor's particle emitters: one three.quarks system per declared profile (emitterSystems.ts), stepped and drawn by
// the stage's one batched renderer, which the stage advances by its presentation time each frame (stage.ts). A
// profile that follows its actor (`character`) emits under the actor's placement, so its particles move, turn and
// scale with it; one that stays where it was started (`environment`) emits under the scene, at the position where its
// start found the actor and unturned, as ISM's `StateParticleSystemProvider.attachByOrigin` places each. Either is
// offset and turned by its shape's `position` and `rotation` (`MODEL_UNITY_EULER_ORDER` states the axes).
const RUNNING = Object.freeze({no: 0, yes: 1});

function attachEmitterSystem(profile: ModelEmitterProfile, index: number, origin: THREE.Object3D,
  context: ModelEmittersContext) {
  const emitter = createModelEmitterSystem(profile), {system} = emitter;
  const follows = profile.origin === MODEL_EMITTER_ORIGIN.character;
  system.emitter.position.fromArray(profile.shape.position);
  const [x, y, z] = profile.shape.rotation, {degToRad} = THREE.MathUtils;
  system.emitter.rotation.set(degToRad(x), degToRad(y), degToRad(z), MODEL_UNITY_EULER_ORDER);
  (follows ? origin : context.scene).add(system.emitter);
  context.particles.addSystem(system);
  return {profile, index, follows, coverage: modelEmitterCoverage(profile), emitter, running: new Uint8Array(1)};
}
type ModelEmitter = ReturnType<typeof attachEmitterSystem>;
const isRunning = ({running}: ModelEmitter) => running[0] === RUNNING.yes;

/** What an actor's emitters need from its stage: the scene an emitter left where it started joins, and the batched
 * renderer that steps and draws every particle. */
export interface ModelEmittersContext {
  readonly scene: THREE.Object3D;
  readonly particles: BatchedRenderer;
}

// The engine's gravity for a modifier of 0: the scene's gravity times 0, which it states as 0 on every axis.
const fallsByNone = (gravity: ModelVector) => gravity[0] === 0 && gravity[1] === 0 && gravity[2] === 0;
/** Actor `entity`'s emitters, at `origin` (its placement): one per drawn profile. A change naming a skipped profile
 * changes nothing. The adapter prepares changes in place; quarks owns allocations made by a start or stop. */
export function createModelEmitters(entity: string, {drawn, skipped}: ModelEmitterDrawing,
  origin: THREE.Object3D, context: ModelEmittersContext) {
  const emitters: Readonly<Record<string, ModelEmitter>> = Object.freeze(Object.fromEntries(Object.entries(drawn)
    .map(([id, profile], index) => [id, attachEmitterSystem(profile, index, origin, context)])));
  const all = Object.values(emitters);
  const skips: ReadonlySet<string> = new Set(skipped.map(({profile}) => profile));
  const emitter = (id: string) => skips.has(id) ? null : modelDeclaredEmitter(emitters, entity, id);
  // Whether each emitter runs once a load's changes apply, by its index.
  const loaded = new Uint8Array(all.length);
  // The prepared changes: the frame's own records, the emitter each names, and the gravity each start of a drawn
  // profile states, by the change's index.
  const pending = {changes: MODEL_NO_EMITTER_CHANGES, items: new Array<ModelEmitter | null>(),
    gravities: new Array<ModelVector>()};
  const started = new THREE.Vector3();
  const commit: ModelStageCommit = () => {
    const {changes, items} = pending;
    for (let index = 0; index < changes.length; index++) {
      const item = items[index], change = changes[index];
      if (item === null) continue;
      if (change.change === MODEL_EMITTER_CHANGE.started) {
        if (!item.follows) {
          // Refreshes the origin's world matrix, which is otherwise refreshed only when the stage next draws.
          origin.getWorldPosition(started);
          item.emitter.system.emitter.position.fromArray(item.profile.shape.position).add(started);
          // quarks emits through the emitter's world matrix, which would otherwise wait for the next draw too.
          item.emitter.system.emitter.updateMatrixWorld();
        }
        item.emitter.start(change, pending.gravities[index]);
        item.running[0] = RUNNING.yes;
      } else if (isRunning(item)) {
        item.emitter.system.endEmit();
        item.running[0] = RUNNING.no;
      }
    }
  };
  return {
    /** What runs once `changes` apply, added into a load (`createModelEmitterLoad`). */
    addLoad(changes: readonly ModelEmitterChange[], into: Float64Array) {
      for (let index = 0; index < all.length; index++) loaded[index] = isRunning(all[index]) ? RUNNING.yes : RUNNING.no;
      for (let index = 0; index < changes.length; index++) {
        const item = emitter(changes[index].profile);
        if (item === null) continue;
        loaded[item.index] = changes[index].change === MODEL_EMITTER_CHANGE.started ? RUNNING.yes : RUNNING.no;
      }
      let running = 0, coverage = 0;
      for (let index = 0; index < all.length; index++) {
        running += loaded[index];
        coverage += loaded[index] * all[index].coverage;
      }
      into[MODEL_EMITTER_BUDGET.load.emitters.slot] += running;
      into[MODEL_EMITTER_BUDGET.load.coverage.slot] += coverage;
    },
    /** Applies changes as the frame does: a start begins afresh from nothing, a stop lets particles live out. A start
     * of a drawn profile is refused unless it states the gravity it falls by (emitterFrameModel.ts). */
    prepare(changes: readonly ModelEmitterChange[]): ModelStageCommit {
      for (let index = 0; index < changes.length; index++) {
        const change = changes[index], item = emitter(change.profile);
        if (item !== null && change.change === MODEL_EMITTER_CHANGE.started) {
          const rate = change.rate ?? item.profile.rate;
          if (change.gravity === undefined) throw new ModelStageRefusal(refusal.noGravity(entity, change.profile));
          if (!item.profile.falls && !fallsByNone(change.gravity)) {
            throw new ModelStageRefusal(refusal.fallsByNone(entity, change.profile));
          }
          pending.gravities[index] = change.gravity;
          if (modelEmitterOverCap(item.profile, rate)) {
            throw modelEmitterCapRefusal(`Frame entity ${entity}: emitter ${change.profile}`, item.profile, rate);
          }
        }
        pending.items[index] = item;
      }
      pending.changes = changes;
      return commit;
    },
    dispose() {
      // quarks' own dispose takes the system out of its renderer and its emitter out of its parent.
      for (const item of all) item.emitter.dispose();
    },
  };
}
export type ModelEmitters = ReturnType<typeof createModelEmitters>;
