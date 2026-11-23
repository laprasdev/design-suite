import {isFiniteNumber, isNonEmptyString} from '../../valueChecks.ts';
import {modelIsOption, modelName, modelOption, modelRecordStating, modelStates, modelStatesExactly,
  type ModelStatingFields} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_EMITTER_REFUSAL as refusal} from './emitterModel.ts';

// What an engine frame says of an entity's emitters. Whether its actor declares each profile is checked as the frame
// applies (emitters.ts `addLoad`), before anything changes, where the actor is.
export const MODEL_EMITTER_CHANGE = Object.freeze({started: 'started', stopped: 'stopped', burst: 'burst'} as const);
// The changes the stage draws; a burst is refused by name.
const DRAWN_CHANGE = Object.freeze({started: MODEL_EMITTER_CHANGE.started, stopped: MODEL_EMITTER_CHANGE.stopped});
/** Linear red, green and blue, each multiplying the profile's start colour; alpha is not routed. */
export type ModelEmitterTint = readonly [number, number, number];
/**
 * What an engine frame says of one profile: it starts (again, from nothing, as Unity's provider clears before each
 * play) or stops emitting (its particles live out their lifetimes). A start carries the routed values its state
 * declares, each only when declared: `rate` (particles a second) and `radius` (metres) replace the profile's own, and
 * `tint` multiplies its start colour. One a start leaves out means the profile's own value: this is where that rule is
 * stated, and emitters.ts `start` applies it.
 */
export type ModelEmitterChange = ({readonly profile: string; readonly change: typeof DRAWN_CHANGE.started} &
  ModelEmitterRouted) | {readonly profile: string; readonly change: typeof DRAWN_CHANGE.stopped};
/** A start's routed values, each stated only when its state declares it. */
export interface ModelEmitterRouted {
  readonly rate?: number;
  readonly tint?: ModelEmitterTint;
  readonly radius?: number;
}

function isTint(value: unknown): value is ModelEmitterTint {
  if (!Array.isArray(value) || value.length !== 3) return false;
  for (let index = 0; index < value.length; index++) {
    if (!isFiniteNumber(value[index]) || value[index] < 0) return false;
  }
  return true;
}
/** The routed values the stage draws, each with its check and what it must be. A rate of 0 emits nothing, which a
 * profile is refused for too. */
export const MODEL_EMITTER_ROUTED = Object.freeze({
  rate: Object.freeze({drawn: (value: unknown) => isFiniteNumber(value) && value > 0,
    is: 'a finite number of particles a second above 0'}),
  tint: Object.freeze({drawn: isTint, is: 'three finite channels, each at least 0'}),
  radius: Object.freeze({drawn: (value: unknown) => isFiniteNumber(value) && value >= 0,
    is: 'a finite number of metres of at least 0'}),
});
// Listed once: the check runs on every frame that changes an emitter.
const ROUTED = Object.freeze(Object.entries(MODEL_EMITTER_ROUTED)
  .map(([field, rule]) => Object.freeze({field, ...rule})));
// The record's fields the engine names but does not send yet, each refused by name until the stage draws it.
const STUBBED = Object.freeze(['burst', 'origin', 'position']);
// The Emitter frame's whole record.
const CHANGE_FIELDS: ModelStatingFields = Object.freeze({stated: ['profile', 'change'],
  whenStated: [...ROUTED.map(({field}) => field), ...STUBBED]});
export const MODEL_NO_EMITTER_CHANGES: readonly ModelEmitterChange[] = Object.freeze([]);

// The first stubbed field a change states, or none: the one walk both the per-tick check and its refusal read.
function stubbedField(record: Record<string, unknown>) {
  for (let index = 0; index < STUBBED.length; index++) {
    if (modelStates(record, STUBBED[index])) return STUBBED[index];
  }
  return undefined;
}
// The first routed value a change states that the stage does not draw (one not a start carries, or one out of its
// range), or none.
function undrawnRouted(record: Record<string, unknown>) {
  for (let index = 0; index < ROUTED.length; index++) {
    const routed = ROUTED[index];
    if (modelStates(record, routed.field) &&
      (record.change !== DRAWN_CHANGE.started || !routed.drawn(record[routed.field]))) return routed;
  }
  return undefined;
}
const isDrawnChange = (value: unknown): value is ModelEmitterChange => modelStatesExactly(value, CHANGE_FIELDS) &&
  stubbedField(value) === undefined && isNonEmptyString(value.profile) && modelIsOption(value.change, DRAWN_CHANGE) &&
  undrawnRouted(value) === undefined;
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
  const stubbed = stubbedField(record);
  if (stubbed !== undefined) throw new ModelStageRefusal(refusal.stubbed(entity, stubbed));
  const profile = modelName(record.profile, `${at}.profile`);
  const change = modelOption(record.change, MODEL_EMITTER_CHANGE, `${at}.change`);
  if (!modelIsOption(change, DRAWN_CHANGE)) throw new ModelStageRefusal(refusal.burst(entity, profile));
  // What is left of a change the stage does not draw is a routed value.
  const routed = undrawnRouted(record);
  if (routed === undefined) throw new Error(`${at} was refused by no rule.`);
  if (change !== DRAWN_CHANGE.started) {
    throw new ModelStageRefusal(refusal.routedOff(entity, profile, routed.field, change));
  }
  throw new ModelStageRefusal(refusal.routedValue(entity, profile, routed.field, routed.is));
}

/** An entity's emitter changes, in order, each naming a profile: the frame's own records, checked in place, so a
 * frame that changes an emitter makes no list, record or text. A frame that states none makes nothing. */
export function modelEmitterChanges(value: unknown, entity: string): readonly ModelEmitterChange[] {
  if (isDrawnChanges(value)) return value;
  return refuseEmitterChanges(value, entity);
}
