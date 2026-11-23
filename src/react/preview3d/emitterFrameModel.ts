import {modelName, modelOption, modelRecordStating, modelStates, type ModelStatingFields} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_EMITTER_REFUSAL as refusal} from './emitterModel.ts';

// What an engine frame says of an entity's emitters. Whether its actor declares each profile is checked as the frame
// applies (emitters.ts `addLoad`), before anything changes, where the actor is.
export const MODEL_EMITTER_CHANGE = Object.freeze({started: 'started', stopped: 'stopped', burst: 'burst'} as const);
/** What an engine frame says of one profile: it starts (again, from nothing, as Unity's provider clears before each
 * play) or stops emitting (its particles live out their lifetimes). */
export interface ModelEmitterChange {
  readonly profile: string;
  readonly change: typeof MODEL_EMITTER_CHANGE.started | typeof MODEL_EMITTER_CHANGE.stopped;
}
// The Emitter frame's whole record: its routed values are declared and refused by name until the stage draws them.
const CHANGE_FIELDS: ModelStatingFields = Object.freeze({stated: ['profile', 'change'],
  whenStated: ['origin', 'position', 'rate', 'tint', 'radius']});
export const MODEL_NO_EMITTER_CHANGES: readonly ModelEmitterChange[] = Object.freeze([]);

/** An entity's emitter changes, in order, each naming a profile. A frame that states none makes nothing. Written as
 * loops: it runs on every frame that changes an emitter, so it makes the list, a record per change and the readers'
 * `where` text, and no closure. */
export function modelEmitterChanges(value: unknown, entity: string): readonly ModelEmitterChange[] {
  if (Array.isArray(value) && !value.length) return MODEL_NO_EMITTER_CHANGES;
  const where = `Frame entity ${entity} emitters`;
  if (!Array.isArray(value)) throw new ModelStageRefusal(`${where} must be an array.`);
  const changes: ModelEmitterChange[] = [];
  for (let index = 0; index < value.length; index++) {
    const at = `${where}[${index}]`, record = modelRecordStating(value[index], CHANGE_FIELDS, at);
    for (let field = 0; field < CHANGE_FIELDS.whenStated.length; field++) {
      const routed = CHANGE_FIELDS.whenStated[field];
      if (modelStates(record, routed)) throw new ModelStageRefusal(refusal.routed(entity, routed));
    }
    const profile = modelName(record.profile, `${at}.profile`);
    const change = modelOption(record.change, MODEL_EMITTER_CHANGE, `${at}.change`);
    if (change === MODEL_EMITTER_CHANGE.burst) throw new ModelStageRefusal(refusal.burst(entity, profile));
    changes.push(Object.freeze({profile, change}));
  }
  return Object.freeze(changes);
}
