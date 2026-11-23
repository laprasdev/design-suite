import * as THREE from 'three';
import {MODEL_EMITTER_CHANGE} from '../src/react/preview3d/emitterFrameModel.ts';
import {modelEmitterRecords} from '../src/react/preview3d/emitterProfileModel.ts';
import {actorContext, entity, makeActor} from './preview3dActorFixture.ts';
import {emitterChange} from './preview3dEmitterCases.ts';

// The emitter tests' actor and frames: an actor with these profiles, and the changes a frame of entity `a` states.
/** An actor with these profiles, and the points its emitters add to its scene, in the profiles' order. */
export function withEmitters(id: string, profiles: Record<string, unknown>) {
  const {context, scene} = actorContext();
  const actor = makeActor(id, [], {emitters: modelEmitterRecords(profiles, `Actor ${id}.emitters`)}, context).actor;
  const points = scene.children.filter(child => child instanceof THREE.Points);
  return {actor, points, visible: () => points.filter(item => item.visible).length};
}
const changed = (change: string) => (...profiles: string[]) => profiles.map(profile => emitterChange(change, profile));
export const starting = changed(MODEL_EMITTER_CHANGE.started), stopping = changed(MODEL_EMITTER_CHANGE.stopped);
export const changing = (...changes: unknown[]) => ({...entity('a'), emitters: changes});
