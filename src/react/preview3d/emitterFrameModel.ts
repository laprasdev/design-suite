import {isNonEmptyString} from '../../valueChecks.ts';
import {modelIsOption, modelName, modelOption, modelRecordStating, modelStates, modelStatesExactly,
  type ModelStatingFields} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_EMITTER_REFUSAL as refusal} from './emitterModel.ts';

// What an engine frame says of an entity's emitters. Whether its actor declares each profile is checked as the frame
// applies (emitters.ts `addLoad`), before anything changes, where the actor is.
export const MODEL_EMITTER_CHANGE = Object.freeze({started: 'started', stopped: 'stopped', burst: 'burst'} as const);
// The changes the stage draws; a burst is refused by name.
const DRAWN_CHANGE = Object.freeze({started: MODEL_EMITTER_CHANGE.started, stopped: MODEL_EMITTER_CHANGE.stopped});
/** What an engine frame says of one profile: it starts (again, from nothing, as Unity's provider clears before each
 * play) or stops emitting (its particles live out their lifetimes). */
export interface ModelEmitterChange {
  readonly profile: string;
  readonly change: (typeof DRAWN_CHANGE)[keyof typeof DRAWN_CHANGE];
}
// The Emitter frame's whole record: its routed values are declared and refused by name until the stage draws them.
const CHANGE_FIELDS: ModelStatingFields = Object.freeze({stated: ['profile', 'change'],
  whenStated: ['origin', 'position', 'rate', 'tint', 'radius']});
export const MODEL_NO_EMITTER_CHANGES: readonly ModelEmitterChange[] = Object.freeze([]);

// The first routed value a change states, or none: the one walk both the per-tick check and its refusal read.
function routedField(record: Record<string, unknown>) {
  for (let index = 0; index < CHANGE_FIELDS.whenStated.length; index++) {
    if (modelStates(record, CHANGE_FIELDS.whenStated[index])) return CHANGE_FIELDS.whenStated[index];
  }
  return undefined;
}
const isDrawnChange = (value: unknown): value is ModelEmitterChange => modelStatesExactly(value, CHANGE_FIELDS) &&
  routedField(value) === undefined && isNonEmptyString(value.profile) && modelIsOption(value.change, DRAWN_CHANGE);
function isDrawnChanges(value: unknown): value is readonly ModelEmitterChange[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index++) {
    if (!isDrawnChange(value[index])) return false;
  }
  return true;
}
// Reads the changes again with their readers' `where` text, to name what the frame states that the stage does not
// draw: run only to refuse.
function refuseEmitterChanges(value: unknown, entity: string): never {
  const where = `Frame entity ${entity} emitters`;
  if (!Array.isArray(value)) throw new ModelStageRefusal(`${where} must be an array.`);
  const index = value.findIndex(item => !isDrawnChange(item));
  const at = `${where}[${index}]`, record = modelRecordStating(value[index], CHANGE_FIELDS, at);
  const routed = routedField(record);
  if (routed !== undefined) throw new ModelStageRefusal(refusal.routed(entity, routed));
  const profile = modelName(record.profile, `${at}.profile`);
  modelOption(record.change, MODEL_EMITTER_CHANGE, `${at}.change`);
  // What is left of a change the stage does not draw is a burst.
  throw new ModelStageRefusal(refusal.burst(entity, profile));
}

/** An entity's emitter changes, in order, each naming a profile: the frame's own records, checked in place, so a
 * frame that changes an emitter makes no list, record or text. A frame that states none makes nothing. */
export function modelEmitterChanges(value: unknown, entity: string): readonly ModelEmitterChange[] {
  if (isDrawnChanges(value)) return value;
  return refuseEmitterChanges(value, entity);
}
