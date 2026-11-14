import {ModelStageRefusal} from './refusal.ts';
import {isNonEmptyString as named, isRecord as object} from '../../valueChecks.ts';
// The engine's animation layers for one actor, validated from unknown input. Clip lookup belongs to playback.
// Engine cross-fade weights are floats: each weight's range and a layer's sum are compared within this tolerance.
export const MODEL_PREVIEW_WEIGHT_TOLERANCE = 1e-6;
export const MODEL_ANIMATION_LAYER = Object.freeze({
  override: 'override', additive: 'additive', maskField: 'maskId', layerLimit: 1,
} as const);
export interface ModelAnimationSample {
  readonly sampleId: string;
  readonly clipId: string;
  readonly timeSeconds: number;
  readonly weight: number;
}
export interface ModelAnimationLayer {
  readonly layerId: string;
  readonly weight: number;
  readonly blendMode: typeof MODEL_ANIMATION_LAYER.override;
  readonly samples: readonly ModelAnimationSample[];
}
export const MODEL_ANIMATION_REFUSAL = Object.freeze({
  layers: (owner: string) => `Actor ${owner}: animationLayers must be an array of layers.`,
  layerLimit: (owner: string, count: number, clips: string) => `Actor ${owner}: ${count} animation layers ` +
    `(clips ${clips}) given; this stage plays at most ${MODEL_ANIMATION_LAYER.layerLimit}.`,
  layer: (owner: string) => `Actor ${owner}: an animation layer requires a layerId, a weight in [0, 1] and samples.`,
  mask: (owner: string, layer: string, clips: string) => `Actor ${owner}: layer ${layer} (clips ${clips}) ` +
    `has a ${MODEL_ANIMATION_LAYER.maskField}; masks are not supported.`,
  additive: (owner: string, layer: string, clips: string) =>
    `Actor ${owner}: layer ${layer} (clips ${clips}) is ${MODEL_ANIMATION_LAYER.additive}; only override plays.`,
  blendMode: (owner: string, layer: string) => `Actor ${owner}: layer ${layer} has an unknown blendMode.`,
  empty: (owner: string, layer: string) => `Actor ${owner}: layer ${layer} has no samples.`,
  sample: (owner: string, layer: string, clip: string) => `Actor ${owner}: layer ${layer} clip ${clip}: ` +
    'a sample requires a sampleId, a clipId, a finite nonnegative timeSeconds and a weight in [0, 1].',
  repeated: (owner: string, layer: string, clip: string, id: string) =>
    `Actor ${owner}: layer ${layer} clip ${clip}: sampleId ${id} is repeated.`,
  weightSum: (owner: string, layer: string, clips: string) =>
    `Actor ${owner}: layer ${layer} (clips ${clips}) has sample weights summing past 1.`,
});
const refusal = MODEL_ANIMATION_REFUSAL;
const unit = (value: unknown): value is number => typeof value === 'number' &&
  value >= -MODEL_PREVIEW_WEIGHT_TOLERANCE && value <= 1 + MODEL_PREVIEW_WEIGHT_TOLERANCE;
const clipList = (samples: readonly unknown[]) =>
  samples.map(sample => object(sample) && named(sample.clipId) ? sample.clipId : '?').join(', ');

function sample(value: unknown, owner: string, layer: string): ModelAnimationSample {
  const clip = object(value) && named(value.clipId) ? value.clipId : '?';
  if (!object(value) || !named(value.sampleId) || !named(value.clipId) || typeof value.timeSeconds !== 'number' ||
    !Number.isFinite(value.timeSeconds) || value.timeSeconds < 0 || !unit(value.weight)) {
    throw new ModelStageRefusal(refusal.sample(owner, layer, clip));
  }
  return Object.freeze({sampleId: value.sampleId, clipId: value.clipId, timeSeconds: value.timeSeconds,
    weight: value.weight});
}

function layer(value: unknown, owner: string): ModelAnimationLayer {
  if (!object(value) || !named(value.layerId) || !unit(value.weight) || !Array.isArray(value.samples)) {
    throw new ModelStageRefusal(refusal.layer(owner));
  }
  const id = value.layerId, given: readonly unknown[] = Array.from(value.samples);
  if (value[MODEL_ANIMATION_LAYER.maskField] !== undefined) {
    throw new ModelStageRefusal(refusal.mask(owner, id, clipList(given)));
  }
  if (value.blendMode === MODEL_ANIMATION_LAYER.additive) {
    throw new ModelStageRefusal(refusal.additive(owner, id, clipList(given)));
  }
  if (value.blendMode !== MODEL_ANIMATION_LAYER.override) throw new ModelStageRefusal(refusal.blendMode(owner, id));
  if (given.length === 0) throw new ModelStageRefusal(refusal.empty(owner, id));
  const samples = given.map(entry => sample(entry, owner, id));
  const ids = new Set<string>();
  for (const entry of samples) {
    if (ids.has(entry.sampleId)) throw new ModelStageRefusal(refusal.repeated(owner, id, entry.clipId, entry.sampleId));
    ids.add(entry.sampleId);
  }
  const total = samples.reduce((sum, entry) => sum + entry.weight, 0);
  if (total > 1 + MODEL_PREVIEW_WEIGHT_TOLERANCE) {
    throw new ModelStageRefusal(refusal.weightSum(owner, id, clipList(given)));
  }
  return Object.freeze({layerId: id, weight: value.weight, blendMode: MODEL_ANIMATION_LAYER.override,
    samples: Object.freeze(samples)});
}

// Every layer is checked before any is returned; `owner` is the actor the layers belong to, named in each refusal.
export function modelAnimationLayers(value: unknown, owner: string): readonly ModelAnimationLayer[] {
  if (!Array.isArray(value)) throw new ModelStageRefusal(refusal.layers(owner));
  if (value.length > MODEL_ANIMATION_LAYER.layerLimit) {
    const samples = value.flatMap(entry => object(entry) && Array.isArray(entry.samples) ? entry.samples : []);
    throw new ModelStageRefusal(refusal.layerLimit(owner, value.length, clipList(samples)));
  }
  return Object.freeze(Array.from(value, entry => layer(entry, owner)));
}
