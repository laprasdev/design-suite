import {MODEL_ATTRACTION, MODEL_CURVE_MODE, MODEL_EMITTER_REFUSAL as refusal, MODEL_GRADIENT_MODE, MODEL_RENDER_MODE,
  MODEL_SHADOW_CASTING, MODEL_SHAPE_TYPE, MODEL_SIMULATION_SPACE, type ModelEmitterValue}
  from '../src/react/preview3d/emitterModel.ts';
import {MODEL_EMITTER_UNDRAWN_MODULES} from '../src/react/preview3d/emitterProfileModel.ts';
import {MODEL_EMITTER_DRAWN as DRAWN, MODEL_EMITTER_DRAWN_VALUE as VALUE}
  from '../src/react/preview3d/emitterValueModel.ts';
import {isRecord} from '../src/valueChecks.ts';
import {curve, emitterProfile, gradient} from './preview3dEmitterCases.ts';

// Every value of a pack's record the stage refuses, one row each: where in the record it is set, what is set there,
// and the refusal that names it. The drawn options come from the reader's own contract, so a row states only the
// record's side; a new refusal is a new row.
export const EMITTER_WHERE = 'Profile';
export interface EmitterRefusalCase {
  readonly path: readonly string[];
  readonly value: unknown;
  readonly refusal: string;
}
const where = (path: readonly string[]) => [EMITTER_WHERE, ...path].join('.');
const setting = (path: readonly string[], value: ModelEmitterValue,
  drawn: readonly ModelEmitterValue[]): EmitterRefusalCase => ({path, value, refusal: refusal.undrawn(where(path),
  value, drawn)});
// A curve set at `path`, refused at its own field `field` for `refused`.
const curveCase = (path: readonly string[], value: ReturnType<typeof curve>, field: keyof ReturnType<typeof curve>,
  refused: ModelEmitterValue, drawn: readonly ModelEmitterValue[]): EmitterRefusalCase =>
  ({path, value, refusal: refusal.undrawn(where([...path, field]), refused, drawn)});
const heldAt = (held: number) => (path: readonly string[], min: number, max: number, mode: number) =>
  curveCase(path, curve(min, max, mode), min === held ? 'm_ConstantMax' : 'm_ConstantMin', min === held ? max : min,
    [held]);
const heldAtZero = heldAt(VALUE.heldAtZero), heldUnscaled = heldAt(VALUE.unscaled);
const main = (field: string) => ['mainSettings', field];
const emission = (field: string) => ['emissionSettings', field];
const shape = (...field: string[]) => ['shapeSettings', ...field];
const velocity = (field: string) => ['velocitySettings', field];
const {constant, curve: oneCurve, twoCurves, twoConstants} = MODEL_CURVE_MODE;

export const EMITTER_REFUSAL_CASES: readonly EmitterRefusalCase[] = Object.freeze([
  ...[oneCurve, twoCurves].map(mode => curveCase(main('startSpeed'), curve(0, 1, mode), 'm_Mode', mode, DRAWN.curve)),
  curveCase(emission('rateOverTime'), curve(0, 9, twoConstants), 'm_Mode', twoConstants, DRAWN.rate),
  ...[MODEL_GRADIENT_MODE.gradient, MODEL_GRADIENT_MODE.twoGradients, MODEL_GRADIENT_MODE.randomColor].map(mode =>
    ({path: ['colorOverLifetime', 'color'], value: gradient(mode),
      refusal: refusal.undrawn(where(['colorOverLifetime', 'color', 'm_Mode']), mode, DRAWN.gradient)})),
  setting(main('startRotation3D'), !VALUE.off, [VALUE.off]),
  heldAtZero(main('startRotationX'), -5, 0, twoConstants),
  heldAtZero(main('startRotationY'), 0, 2, constant),
  heldAtZero(main('startRotationZ'), 0, 1, twoConstants),
  setting(main('simulationSpace'), MODEL_SIMULATION_SPACE.world, DRAWN.space),
  setting(main('simulationSpeed'), 2, [VALUE.unscaled]),
  heldAtZero(main('gravityModifier'), 0, 1, constant),
  setting(emission('hasBurst'), !VALUE.off, [VALUE.off]),
  heldAtZero(emission('rateOverDistance'), 0, 55, constant),
  {path: emission('rateOverTime'), value: curve(0, 0, constant),
    refusal: refusal.emitsNothing(where(['emissionSettings']))},
  setting(['emitOnContact'], !VALUE.off, [VALUE.off]),
  setting(['attraction'], MODEL_ATTRACTION.attractToCharacter, DRAWN.attraction),
  setting(['renderMode'], MODEL_RENDER_MODE.stretch, DRAWN.render),
  setting(['shadowCasting'], MODEL_SHADOW_CASTING.on, DRAWN.shadow),
  setting(['sizeOverLifetime', 'separateAxes'], !VALUE.off, [VALUE.off]),
  setting(shape('shapeType'), MODEL_SHAPE_TYPE.cone, DRAWN.shape),
  setting(shape('radiusThickness'), 0.5, [VALUE.wholeVolume]),
  setting(shape('arc'), 180, [VALUE.wholeTurn]),
  setting(shape('position', 'y'), 1, [VALUE.centred[1]]),
  setting(shape('scale', 'x'), 2, [VALUE.unstretched[0]]),
  setting(shape('alignToDirection'), !VALUE.off, [VALUE.off]),
  {path: shape('texture'), value: {fileID: '10300', guid: '0000000000000000f000000000000000', type: 0},
    refusal: refusal.undrawnAsset(where(shape('texture')))},
  ...[oneCurve, twoCurves].map(mode =>
    curveCase(velocity('linearY'), curve(0, 1, mode), 'm_Mode', mode, DRAWN.curve)),
  setting(velocity('space'), MODEL_SIMULATION_SPACE.world, DRAWN.velocitySpace),
  heldUnscaled(velocity('speedModifier'), 1, 0.2, constant),
  ...['orbitalX', 'orbitalOffsetY', 'radial'].map(field => heldAtZero(velocity(field), 0, 2, constant)),
  ...Object.keys(MODEL_EMITTER_UNDRAWN_MODULES).map(module => setting([module, 'enabled'], !VALUE.off, [VALUE.off])),
]);

/** A fresh whole profile with `value` set at `path`. */
export function emitterProfileWith({path, value}: EmitterRefusalCase): Record<string, unknown> {
  const profile: Record<string, unknown> = emitterProfile();
  let record = profile;
  for (const key of path.slice(0, -1)) {
    const next = record[key];
    if (!isRecord(next)) throw new Error(`${where(path)}: ${key} is not a record of the profile.`);
    record = next;
  }
  record[path[path.length - 1]] = value;
  return profile;
}
