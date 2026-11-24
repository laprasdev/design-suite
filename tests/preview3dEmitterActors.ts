import {ParticleSystem} from 'three.quarks';
import {MODEL_EMITTER_CHANGE} from '../src/react/preview3d/emitterFrameModel.ts';
import {modelEmitterRecords} from '../src/react/preview3d/emitterRecordModel.ts';
import {actorContext, entity, makeActor} from './preview3dActorFixture.ts';
import {emitterChange} from './preview3dEmitterCases.ts';

// The emitter tests' actor and frames: an actor with these profiles, and the changes a frame of entity `a` states.
/** An actor with these profiles, the three.quarks systems its emitters add to the stage's batched renderer, in the
 * profiles' order, and how many of them run (started, and stopped but living out). */
export function withEmitters(id: string, profiles: Record<string, unknown>) {
  const {context, scene} = actorContext();
  const actor = makeActor(id, [], {emitters: modelEmitterRecords(id, profiles)}, context).actor;
  const systems = [...context.particles.systemToBatchIndex.keys()].filter(item => item instanceof ParticleSystem);
  return {actor, scene, systems, particles: context.particles,
    visible: () => systems.filter(item => !item.paused).length};
}
const changed = (change: string) => (...profiles: string[]) => profiles.map(profile => emitterChange(change, profile));
export const starting = changed(MODEL_EMITTER_CHANGE.started), stopping = changed(MODEL_EMITTER_CHANGE.stopped);
export const changing = (...changes: unknown[]) => ({...entity('a'), emitters: changes});
