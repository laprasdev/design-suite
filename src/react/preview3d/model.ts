import {element} from '../elementContract.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelStageMaterialMode} from './materialModel.ts';
import type {ModelStageLighting} from './lightingModel.ts';
import type {ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import type {ModelEnvironment} from './environment.ts';
import type {ModelPreviewFrame, ModelStageActorSnapshot} from './actorModel.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
export {MODEL_RUNTIME_MATERIAL, modelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
export type {ModelRuntimeMaterialProfile, ModelMaterialOutput, ModelRendererBinding} from './runtimeMaterialModel.ts';
export type {ModelEnvironment, ModelEnvironmentBox} from './environment.ts';
export {MODEL_PREVIEW_MATERIAL_TEXT, MODEL_PREVIEW_MATERIAL_OPTIONS} from './materialModel.ts';
export type {ModelStageMaterialMode} from './materialModel.ts';
export {MODEL_PREVIEW_LIGHTING_TEXT, MODEL_PREVIEW_LIGHTING_OPTIONS} from './lightingModel.ts';
export type {ModelStageLighting} from './lightingModel.ts';
export {modelPreviewEntity, modelPoseForBinding, MODEL_PREVIEW_CAPABILITIES,
  MODEL_PREVIEW_QUATERNION_TOLERANCE} from './presentation.ts';
export {MODEL_PREVIEW_WEIGHT_TOLERANCE} from './animationLayerModel.ts';
export type {ModelPreviewEntity, ModelPresentationPose, ModelPoseBinding} from './presentation.ts';
export {ModelStageRefusal, MODEL_STAGE_FAILURE, modelStageFailure} from './refusal.ts';
export type {ModelStageFailure, ModelStageFailureKind} from './refusal.ts';
export {MODEL_ANIMATION_LAYER, MODEL_ANIMATION_REFUSAL, modelAnimationLayers} from './animationLayerModel.ts';
export type {ModelAnimationLayer, ModelAnimationSample} from './animationLayerModel.ts';
export {MODEL_ACTOR_REFUSAL, MODEL_STAGE_DRIVER, modelPreviewFrame, modelStageActorSet} from './actorModel.ts';
export type {ModelPreviewFrame, ModelStageActor, ModelStageActorAnimation, ModelStageActorSet,
  ModelStageActorSnapshot, ModelStageDriver} from './actorModel.ts';
export type {ModelStageDescription, ModelStageDescriptionPart} from './descriptionModel.ts';

export const MODEL_READY_ATTRIBUTE = 'data-model-ready';
export const MODEL_REST_POSE = 'rest-pose';
export const MODEL_ANIMATION_SAMPLES = 'animation-samples';
export const MODEL_PREVIEW_REVIEW = 'modelPreviewReview';
export const ModelPreviewElement = Object.freeze({
  ROOT: element('model-preview'), STAGE: element('model-preview-stage'), CONTROLS: element('model-preview-controls'),
});
export type ModelStageDisplay = 'model' | 'rig' | 'both';
export type ModelStageClock = 'local' | 'external';
export const MODEL_PREVIEW_TEXT = Object.freeze({
  model: 'Model', modelSearch: 'models', animation: 'Animation', display: 'Display',
  play: 'Play', pause: 'Pause', rest: 'Rest Pose', reset: 'Reset Camera', rig: 'Rig', both: 'Both',
  loading: 'Loading model…', retry: 'Retry',
  unavailable: 'No model is available.', orbit: 'Drag to orbit. Scroll or pinch to zoom.',
  runtimeWaiting: 'Waiting for a runtime pose…', refused: 'Not applied', stopped: 'Preview stopped',
  runtimeReady: (name: string) => `${name} runtime pose ready`,
  ready: (name: string) => `${name} ready`, canvas: (name: string) => `${name} animation viewer`,
});
export const MODEL_PREVIEW_DISPLAY_OPTIONS = Object.freeze([
  {value: 'model', label: MODEL_PREVIEW_TEXT.model},
  {value: 'rig', label: MODEL_PREVIEW_TEXT.rig},
  {value: 'both', label: MODEL_PREVIEW_TEXT.both},
] satisfies {value: ModelStageDisplay; label: string}[]);
export function modelStageDisplay(value: unknown): ModelStageDisplay {
  const option = MODEL_PREVIEW_DISPLAY_OPTIONS.find(item => item.value === value);
  if (!option) throw new ModelStageRefusal('Unknown stage display.');
  return option.value;
}

export const MODEL_STAGE = Object.freeze({
  pixelRatioLimit: 2, fieldOfView: 38, nearPlane: 0.01, farPlane: 100,
  cameraMinimum: 1, cameraMaximum: 16, cameraDirection: [0.75, 0.4, 1], fitPadding: 1.4,
  ambientIntensity: 2, lightIntensity: 3, keyLightPosition: [3, 5, 4],
  floorRadius: 4, floorSegments: 64, floorOffset: -0.025, gridSize: 8, gridDivisions: 16,
  normalizedHeight: 2, markerRadius: 0.035, markerSegments: 12, jointRadiusRatio: 0.008, jointSegments: 8,
  millisecondsPerSecond: 1000, maxFrameDelta: 0.05,
});
export type ModelVector = readonly [number, number, number];
export type ModelRotation = readonly [number, number, number, number];
export interface ModelStageAsset {
  id: string;
  path: string;
  revision?: string;
  sha256?: string;
  attachments: Readonly<Record<string, string>>;
  runtimeMaterials?: ModelRuntimeMaterialProfile;
}
export interface ModelPreviewAsset extends ModelStageAsset {
  name: string;
  idleAnimation: string;
  animations: readonly {name: string; label: string}[];
}
export interface ModelStageTheme {
  colors: {
    stage: string; text: string; surface: string; surfaceHi: string;
    accent: string; accentDeep: string; teal: string;
  };
}
export interface ModelStageOptions {
  reviewKey?: string;
  clock?: ModelStageClock;
  normalizeHeight?: number | null;
  centerOnFloor?: boolean;
  floor?: boolean;
  grid?: boolean;
  orbit?: boolean;
}
export interface ModelStageTransform {
  position?: ModelVector;
  rotationQuaternion?: ModelRotation;
  scale?: ModelVector;
}
export interface ModelStageCamera {
  position: ModelVector;
  target: ModelVector;
}
export interface ModelStageSnapshot {
  id: string;
  animation: string;
  /** null while engine samples play: `actors` holds what was applied. */
  time: number | null;
  playing: boolean;
  skeletonVisible: boolean;
  display: ModelStageDisplay;
  modelVisible: boolean;
  visibleModelMeshes: number;
  rigVisible: boolean;
  boneCount: number;
  visibleRigJoints: number;
  materialMode: ModelStageMaterialMode;
  materialInspectionAvailable: boolean;
  emissiveMaterialCount: number;
  lighting: ModelStageLighting;
  attachmentPositions: Record<string, ModelVector>;
  attachmentProjections: Record<string, ModelVector>;
  poses: Record<string, ModelRotation>;
  triangles: number;
  renderedModelMeshes: number;
  canvas: {width: number; height: number};
  actors: readonly ModelStageActorSnapshot[];
  actorsPending: boolean;
}
export interface ModelStageController {
  /**
   * Applies the whole description of what is on the stage, keeping every unchanged part (an unchanged asset is not
   * reloaded), whole or refused. Throws at once for an invalid description, and for any refusal when nothing needs
   * loading. Otherwise the promise settles when the loads arrive, or when a later description supersedes it; it
   * rejects when they cannot be shown, and the previous description then stands.
   */
  setDescription(value: ModelStageDescription): Promise<void>;
  /** Applies one host-built frame to every actor it names, or refuses it whole before anything changes. */
  setFrame(value: ModelPreviewFrame): void;
  /** An action, not state: returns a view the person orbited to the described camera, a held pose or a fresh fit. */
  resetCamera(): void;
  snapshot(): ModelStageSnapshot;
}
export function modelStagePolicy(options: ModelStageOptions = {}) {
  const clock = options.clock === undefined ? 'local' : options.clock;
  if (clock !== 'local' && clock !== 'external') {
    throw new ModelStageRefusal('Preview clock must be local or external.');
  }
  const height = options.normalizeHeight === undefined ? MODEL_STAGE.normalizedHeight : options.normalizeHeight;
  if (height !== null && (!Number.isFinite(height) || height <= 0)) {
    throw new ModelStageRefusal('Preview height must be positive or null.');
  }
  return {
    clock, normalizeHeight: height, centerOnFloor: options.centerOnFloor ?? true,
    floor: options.floor ?? true, grid: options.grid ?? true, orbit: options.orbit ?? true,
  };
}
export type ModelStagePolicy = ReturnType<typeof modelStagePolicy>;
