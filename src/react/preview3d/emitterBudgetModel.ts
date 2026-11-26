import {ModelStageRefusal} from './refusal.ts';
import {MODEL_EMITTER_REFUSAL as refusal, type ModelEmitterBurst, type ModelEmitterProfile} from './emitterModel.ts';

// How many particles the stage runs at once: each profile's own cap, held when it is read and at each start, and the
// stage's budget on every live emitter together, held at each frame that changes one.
/** Whether a profile run at `rate` could pass its cap: at most its rate times its longest lifetime are alive at once,
 * and its bursts' most. A check that reads only numbers, so a start makes its refusal's text only when it refuses. */
export const modelEmitterOverCap = (profile: ModelEmitterProfile, rate: number) =>
  rate * profile.lifetime.max + profile.burstParticles > profile.maxParticles;
/** The cycles of `burst` a run of `duration` seconds fires: three.quarks fires none past the run's end. */
export const modelEmitterBurstCycles = ({time, cycles, interval}: ModelEmitterBurst, duration: number) =>
  interval > 0 ? Math.min(cycles, Math.floor((duration - time) / interval) + 1) : cycles;
/**
 * The most of a profile's burst particles alive at once, each living up to `lifetime` seconds. In one run, a burst's
 * cycles `interval` apart overlap only as many as one lifetime spans. Looping, each cycle fires again each `duration`,
 * and one lifetime spans that many runs of it, so every cycle counts once a run spanned.
 */
export function modelEmitterLiveBurstParticles(bursts: readonly ModelEmitterBurst[], lifetime: number,
  looping: boolean, duration: number) {
  let live = 0;
  for (const burst of bursts) {
    const fired = modelEmitterBurstCycles(burst, duration);
    const overlap = burst.interval > 0 ? Math.min(fired, Math.floor(lifetime / burst.interval) + 1) : fired;
    live += burst.count * (looping ? fired * Math.ceil(lifetime / duration) : overlap);
  }
  return live;
}
/** The refusal of a profile run at `rate` past its cap (`modelEmitterOverCap`), named by `where`. */
export const modelEmitterCapRefusal = (where: string, profile: ModelEmitterProfile, rate: number) =>
  new ModelStageRefusal(refusal.overCap(where, rate, profile.lifetime.max, profile.burstParticles,
    profile.maxParticles));
/**
 * The stage's particle budget on what runs at once, each part of a load with its slot in the load's `Float64Array`
 * and its most: live emitters, and their coverage, the sum of each live profile's cap times its largest particle's
 * area in square metres. A start that would pass either is refused by name. `particles` is one profile's cap, checked
 * as the profile is read, not a load. The numbers are placeholders until measured on the stage.
 */
export const MODEL_EMITTER_BUDGET = Object.freeze({
  load: Object.freeze({emitters: Object.freeze({slot: 0, most: 16}), coverage: Object.freeze({slot: 1, most: 64})}),
  particles: 4096,
});
// Listed once: the budget check runs on every frame that changes an emitter.
const LOAD_PARTS = Object.freeze(Object.entries(MODEL_EMITTER_BUDGET.load).map(([part, {slot, most}]) =>
  Object.freeze({part, slot, most})));
/** A load to add into: zeroed, one slot per part. */
export const createModelEmitterLoad = () => new Float64Array(LOAD_PARTS.length);
export const modelEmitterCoverage = (profile: ModelEmitterProfile) =>
  profile.maxParticles * (profile.size.max * profile.sizeScale) ** 2;
/** Refuses a load over the budget, naming what passes it. */
export function checkModelEmitterBudget(load: Float64Array) {
  for (let index = 0; index < LOAD_PARTS.length; index++) {
    const {part, slot, most} = LOAD_PARTS[index];
    if (load[slot] > most) throw new ModelStageRefusal(refusal.budget(part, load[slot], most));
  }
}
