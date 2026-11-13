import {element} from '../elementContract.ts';
import type {ModelStageMaterialMode} from './materialModel.ts';
import type {ModelStageLighting} from './lightingModel.ts';
import type {ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import type {ModelEnvironment} from './environment.ts';
import type {ModelPreviewPresentation} from './presentation.ts';
export {MODEL_RUNTIME_MATERIAL, modelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
export type {ModelRuntimeMaterialProfile, ModelMaterialOutput, ModelRendererBinding} from './runtimeMaterialModel.ts';
export type {ModelEnvironment, ModelEnvironmentBox} from './environment.ts';
export {MODEL_PREVIEW_MATERIAL_TEXT, MODEL_PREVIEW_MATERIAL_OPTIONS} from './materialModel.ts';
export type {ModelStageMaterialMode} from './materialModel.ts';
export {MODEL_PREVIEW_LIGHTING_TEXT, MODEL_PREVIEW_LIGHTING_OPTIONS} from './lightingModel.ts';
export type {ModelStageLighting} from './lightingModel.ts';
export {modelPreviewPresentation, modelPoseForBinding, MODEL_PREVIEW_CAPABILITIES,
  MODEL_PREVIEW_QUATERNION_TOLERANCE} from './presentation.ts';
export type {ModelPreviewPresentation, ModelPresentationPose, ModelPoseBinding} from './presentation.ts';

export const MODEL_READY_ATTRIBUTE = 'data-model-ready';
export const MODEL_REST_POSE = 'rest-pose';
export const MODEL_PREVIEW_REVIEW = 'modelPreviewReview';
export const ModelPreviewElement = Object.freeze({
  ROOT: element('model-preview'), STAGE: element('model-preview-stage'), CONTROLS: element('model-preview-controls'),
});
export type ModelStageDisplay = 'model' | 'rig' | 'both';
export type ModelStageClock = 'local' | 'external';
export const MODEL_PREVIEW_TEXT = Object.freeze({
  model: 'Model', modelSearch: 'models', animation: 'Animation', display: 'Display',
  play: 'Play', pause: 'Pause', rest: 'Rest Pose', reset: 'Reset Camera', rig: 'Rig', both: 'Both',
  loading: 'Loading model…', failed: 'The model could not be loaded.', retry: 'Retry',
  unavailable: 'No model is available.', orbit: 'Drag to orbit. Scroll or pinch to zoom.',
  runtimeWaiting: 'Waiting for a runtime pose…', runtimeInvalid: 'The runtime pose could not be shown.',
  sceneInvalid: 'The scene update could not be shown.',
  runtimeReady: (name: string) => `${name} runtime pose ready`,
  ready: (name: string) => `${name} ready`, canvas: (name: string) => `${name} animation viewer`,
});
export const MODEL_PREVIEW_DISPLAY_OPTIONS = Object.freeze([
  {value: 'model', label: MODEL_PREVIEW_TEXT.model},
  {value: 'rig', label: MODEL_PREVIEW_TEXT.rig},
  {value: 'both', label: MODEL_PREVIEW_TEXT.both},
] satisfies {value: ModelStageDisplay; label: string}[]);

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
  time: number;
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
}
export interface ModelStageController {
  setAnimation(name: string): void;
  setAnimationTime(timeSeconds: number): void;
  setPlaying(value: boolean): void;
  setSkeleton(value: boolean): void;
  setDisplay(value: ModelStageDisplay): void;
  setMaterialMode(value: ModelStageMaterialMode): void;
  setLighting(value: ModelStageLighting): void;
  setTransform(value: ModelStageTransform): void;
  setPresentation(value: ModelPreviewPresentation): void;
  setEnvironment(value: ModelEnvironment | null): void;
  setCamera(value: ModelStageCamera): void;
  resetCamera(): void;
  snapshot(): ModelStageSnapshot;
}
export function modelStagePolicy(options: ModelStageOptions = {}) {
  const clock = options.clock === undefined ? 'local' : options.clock;
  if (clock !== 'local' && clock !== 'external') throw new Error('Preview clock must be local or external.');
  const height = options.normalizeHeight === undefined ? MODEL_STAGE.normalizedHeight : options.normalizeHeight;
  if (height !== null && (!Number.isFinite(height) || height <= 0)) {
    throw new Error('Preview height must be positive or null.');
  }
  return {
    clock, normalizeHeight: height, centerOnFloor: options.centerOnFloor ?? true,
    floor: options.floor ?? true, grid: options.grid ?? true, orbit: options.orbit ?? true,
  };
}
export type ModelStagePolicy = ReturnType<typeof modelStagePolicy>;
