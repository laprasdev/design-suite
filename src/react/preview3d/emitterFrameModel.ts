import {isFiniteNumber, isNonEmptyString} from '../../valueChecks.ts';
import {modelIsOption, modelName, modelOption, modelRecordStating, modelStates, modelStatesExactly,
  type ModelStatingFields} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_EMITTER_REFUSAL as refusal} from './emitterModel.ts';
import {MODEL_VECTOR_AXES, type ModelVector} from './placementModel.ts';

// What an engine frame says of an entity's emitters. Whether its actor declares each profile is checked as the frame
// applies (emitters.ts `addLoad`), before anything changes, where the actor is.
export const MODEL_EMITTER_CHANGE = Object.freeze({started: 'started', stopped: 'stopped', burst: 'burst'} as const);
// The changes the stage draws; a burst is refused by name.
const DRAWN_CHANGE = Object.freeze({started: MODEL_EMITTER_CHANGE.started, stopped: MODEL_EMITTER_CHANGE.stopped});
/** Linear red, green and blue, each multiplying the profile's start colour; alpha is not routed. */
export type ModelEmitterTint = readonly [number, number, number];
const TINT_CHANNELS: ModelEmitterTint['length'] = 3;
/**
 * What an engine frame says of one profile: it starts (again, from nothing, as Unity's provider clears before each
 * play) or stops emitting (its particles live out their lifetimes). A start carries the routed values its state
 * declares (`ModelEmitterRouted`), and the gravity its particles fall by, which no state routes: the engine works it
 * out (the profile's `gravityModifier` times the machine's scene gravity, as Unity's ParticleSystem does) and the
 * stage draws it as stated, metres a second squared in world space. The engine states it on every start of a profile
 * whose modifier is one Constant on the 3D source, which is every profile the stage draws; a skipped profile's start
 * may leave it out, and a drawn one's start that leaves it out is refused (emitters.ts `prepare`). This is where those
 * rules are stated, and emitterSystems.ts `start` applies them.
 */
export type ModelEmitterChange = ({readonly profile: string; readonly change: typeof DRAWN_CHANGE.started} &
  ModelEmitterRouted & {readonly gravity?: ModelVector}) |
  {readonly profile: string; readonly change: typeof DRAWN_CHANGE.stopped};
/** A start's routed values, each stated only when its state declares it: `rate` (particles a second) and `radius`
 * (metres) replace the profile's own, and `tint` multiplies its start colour; one a start leaves out means the
 * profile's own value. */
export interface ModelEmitterRouted {
  readonly rate?: number;
  readonly tint?: ModelEmitterTint;
  readonly radius?: number;
}

// `length` finite numbers, each at least `least`: a tint's channels or a gravity's axes.
function isNumbers<T extends readonly number[]>(value: unknown, length: T['length'], least: number): value is T {
  if (!Array.isArray(value) || value.length !== length) return false;
  for (let index = 0; index < value.length; index++) {
    if (!isFiniteNumber(value[index]) || value[index] < least) return false;
  }
  return true;
}
/** The values a start states that the stage draws, routed or worked out by the engine, each with its check of a change
 * and what it must be. A rate of 0 emits nothing, which a profile is refused for too. Each check reads its own field
 * by name: a number read by a computed key and passed on is boxed, an allocation on every frame that changes an
 * emitter. */
export const MODEL_EMITTER_START = Object.freeze({
  rate: Object.freeze({drawn: ({rate}: Record<string, unknown>) => isFiniteNumber(rate) && rate > 0,
    is: 'a finite number of particles a second above 0'}),
  tint: Object.freeze({drawn: ({tint}: Record<string, unknown>) => isNumbers<ModelEmitterTint>(tint, TINT_CHANNELS, 0),
    is: 'three finite channels, each at least 0'}),
  radius: Object.freeze({drawn: ({radius}: Record<string, unknown>) => isFiniteNumber(radius) && radius >= 0,
    is: 'a finite number of metres of at least 0'}),
  gravity: Object.freeze({
    drawn: ({gravity}: Record<string, unknown>) => isNumbers<ModelVector>(gravity, MODEL_VECTOR_AXES, -Infinity),
    is: 'three finite metres a second squared, in world space'}),
});
// Listed once: the check runs on every frame that changes an emitter.
const START = Object.freeze(Object.entries(MODEL_EMITTER_START)
  .map(([field, rule]) => Object.freeze({field, ...rule})));
// The record's fields the engine names but does not send yet, each refused by name until the stage draws it.
const STUBBED = Object.freeze(['burst', 'origin', 'position']);
/** The Emitter frame's whole record, field by field as the engine's `EmitterChange` names them. */
export const MODEL_EMITTER_CHANGE_FIELDS: ModelStatingFields = Object.freeze({stated: ['profile', 'change'],
  whenStated: [...START.map(({field}) => field), ...STUBBED]});
export const MODEL_NO_EMITTER_CHANGES: readonly ModelEmitterChange[] = Object.freeze([]);

// The first stubbed field a change states, or none: the one walk both the per-tick check and its refusal read.
function stubbedField(record: Record<string, unknown>) {
  for (let index = 0; index < STUBBED.length; index++) {
    if (modelStates(record, STUBBED[index])) return STUBBED[index];
  }
  return undefined;
}
// The first start value a change states that the stage does not draw (one not a start carries, or one out of its
// range), or none.
function undrawnStart(record: Record<string, unknown>) {
  for (let index = 0; index < START.length; index++) {
    const value = START[index];
    if (modelStates(record, value.field) &&
      (record.change !== DRAWN_CHANGE.started || !value.drawn(record))) return value;
  }
  return undefined;
}
const isDrawnChange = (value: unknown): value is ModelEmitterChange =>
  modelStatesExactly(value, MODEL_EMITTER_CHANGE_FIELDS) && stubbedField(value) === undefined &&
  isNonEmptyString(value.profile) && modelIsOption(value.change, DRAWN_CHANGE) && undrawnStart(value) === undefined;
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
  const at = `${where}[${index}]`, record = modelRecordStating(value[index], MODEL_EMITTER_CHANGE_FIELDS, at);
  const stubbed = stubbedField(record);
  if (stubbed !== undefined) throw new ModelStageRefusal(refusal.stubbed(entity, stubbed));
  const profile = modelName(record.profile, `${at}.profile`);
  const change = modelOption(record.change, MODEL_EMITTER_CHANGE, `${at}.change`);
  if (!modelIsOption(change, DRAWN_CHANGE)) throw new ModelStageRefusal(refusal.burst(entity, profile));
  // What is left of a change the stage does not draw is a start value.
  const undrawn = undrawnStart(record);
  if (undrawn === undefined) throw new Error(`${at} was refused by no rule.`);
  if (change !== DRAWN_CHANGE.started) {
    throw new ModelStageRefusal(refusal.startOff(entity, profile, undrawn.field, change));
  }
  throw new ModelStageRefusal(refusal.startValue(entity, profile, undrawn.field, undrawn.is));
}

/** An entity's emitter changes, in order, each naming a profile: the frame's own records, checked in place, so a
 * frame that changes an emitter makes no list, record or text. A frame that states none makes nothing. */
export function modelEmitterChanges(value: unknown, entity: string): readonly ModelEmitterChange[] {
  if (isDrawnChanges(value)) return value;
  return refuseEmitterChanges(value, entity);
}
