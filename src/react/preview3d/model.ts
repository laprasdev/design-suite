import {element} from '../elementContract.ts';
import type {ModelStageSurfaceMode} from './surfaceModeModel.ts';
import type {ModelStageActorSnapshot} from './actorModel.ts';
import type {ModelPreviewFrame} from './frameModel.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
import type {ModelRotation, ModelVector} from './placementModel.ts';
import {MODEL_STAGE_DISPLAY, type ModelStageDisplay} from './displayModel.ts';
export {MODEL_RUNTIME_MATERIAL, modelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
export type {ModelRuntimeMaterialProfile, ModelMaterialOutput, ModelRendererBinding} from './runtimeMaterialModel.ts';
export {MODEL_ENVIRONMENT_GRID, MODEL_ENVIRONMENT_REFUSAL, modelEnvironment} from './environmentModel.ts';
export type {ModelEnvironment, ModelEnvironmentBox} from './environmentModel.ts';
export {MODEL_PREVIEW_SURFACE_TEXT, MODEL_PREVIEW_SURFACE_OPTIONS, MODEL_STAGE_SURFACE_MODE, modelStageSurfaceMode}
  from './surfaceModeModel.ts';
export type {ModelStageSurfaceMode} from './surfaceModeModel.ts';
export {MODEL_STAGE_DISPLAY, modelStageDisplay} from './displayModel.ts';
export type {ModelStageDisplay} from './displayModel.ts';
export {MODEL_STAGE_CLOCK, modelStagePolicy} from './stageOptionsModel.ts';
export type {ModelStageClock, ModelStageOptions, ModelStagePolicy} from './stageOptionsModel.ts';
export {MODEL_RECORD_REFUSAL} from './recordModel.ts';
export {MODEL_PREVIEW_LIGHTING_TEXT, MODEL_STAGE_BUILT_IN_TIMES, MODEL_STAGE_THEME_LIGHTING, MODEL_STAGE_TIME,
  modelStageLighting, modelStageTimeOptions} from './lightingModel.ts';
export type {ModelStageLighting, ModelStageTime} from './lightingModel.ts';
export {MODEL_STAGE_GLOW_WIDEST, MODEL_STAGE_TONE_CURVE} from './lookModel.ts';
export type {ModelStageFog, ModelStageGlow, ModelStageLook, ModelStageToneCurve} from './lookModel.ts';
export type {ModelColor} from './colorModel.ts';
// A surface kind's declaration, records and sets, and what a frame's renderers take: checked here with no renderer,
// by a host, a scene package or a kind's author.
export {MODEL_SURFACE_PARAMETER, MODEL_COLOR_SPACE, MODEL_SURFACE_LIGHT, MODEL_SURFACE_COVERAGE, MODEL_SURFACE_SIDE,
  MODEL_VECTOR_SIZE, MODEL_FILE_SURFACE, MODEL_SURFACE_KIND_REFUSAL, modelSurfaceKind, modelSurfaceKinds}
  from './surfaceKindModel.ts';
export type {ModelColorSpace, ModelSurfaceKind, ModelSurfaceParameter} from './surfaceKindModel.ts';
export {MODEL_ACTOR_SURFACES, MODEL_FILE_ENTRY, MODEL_SURFACE_REFUSAL, MODEL_TEXTURE_FORMATS, MODEL_TEXTURE_WRAP,
  MODEL_TEXTURE_CONSTANT, modelActorSurfaces, modelRendererId, modelSurfaceFiles, modelSurfaceRecordsFit,
  modelSurfaceSets} from './surfaceModel.ts';
export type {ModelActorSurfaces, ModelSurfaceEntry, ModelSurfaceFile, ModelSurfaceRecord, ModelSurfaceSet,
  ModelSurfaceTexture, ModelSurfaceValue} from './surfaceModel.ts';
export {MODEL_RENDERER_SLOT, MODEL_SURFACE_OUTPUT_REFUSAL, modelSurfaceTakes} from './surfaceOutputModel.ts';
export type {ModelSurfaceTakes} from './surfaceOutputModel.ts';
export {modelFrameScope, modelPreviewFrame} from './frameModel.ts';
export type {ModelFrameScope, ModelPreviewFrame} from './frameModel.ts';
export {modelPreviewEntity, MODEL_PREVIEW_CAPABILITIES} from './presentation.ts';
export {modelPoseForBinding, MODEL_PREVIEW_QUATERNION_TOLERANCE} from './placementModel.ts';
export type {ModelVector, ModelRotation, ModelPresentationPose, ModelPoseBinding} from './placementModel.ts';
export {MODEL_PREVIEW_WEIGHT_TOLERANCE} from './animationLayerModel.ts';
export type {ModelPreviewEntity} from './presentation.ts';
export {ModelStageRefusal, MODEL_STAGE_FAILURE, modelStageFailure} from './refusal.ts';
export type {ModelStageFailure, ModelStageFailureKind} from './refusal.ts';
export {MODEL_ANIMATION_LAYER, MODEL_ANIMATION_REFUSAL, modelAnimationLayers} from './animationLayerModel.ts';
export type {ModelAnimationLayer, ModelAnimationSample} from './animationLayerModel.ts';
export {MODEL_ACTOR_ANIMATION, MODEL_ACTOR_REFUSAL, MODEL_STAGE_DRIVER, modelStageActorSet} from './actorModel.ts';
export type {ModelStageActor, ModelStageActorAnimation, ModelStageActorSet, ModelStageActorSnapshot,
  ModelStageAsset, ModelStageDriver} from './actorModel.ts';
// The whole description, checked with no renderer: every part, and every actor's set against the description's sets.
export {MODEL_STAGE_DESCRIPTION_PARTS, modelStageActorSets, modelStageDescription} from './descriptionModel.ts';
export type {ModelStageDescription, ModelStageDescriptionPart} from './descriptionModel.ts';
export {MODEL_STAGE_SIZE, MODEL_STAGE_ORIGIN} from './sizeModel.ts';
export type {ModelStageSize, ModelStageOrigin} from './sizeModel.ts';
export {MODEL_STAGE_FRAMING} from './framingModel.ts';
export type {ModelStageFraming} from './framingModel.ts';

export const MODEL_READY_ATTRIBUTE = 'data-model-ready';
export const MODEL_REST_POSE = 'rest-pose';
export const MODEL_ANIMATION_SAMPLES = 'animation-samples';
export const MODEL_PREVIEW_REVIEW = 'modelPreviewReview';
export const ModelPreviewElement = Object.freeze({
  ROOT: element('model-preview'), STAGE: element('model-preview-stage'), CONTROLS: element('model-preview-controls'),
});
/** Why the local clock's time is held still: the person asks for reduced motion, or the page is hidden. */
export const MODEL_STAGE_HOLD = Object.freeze({reducedMotion: 'reduced-motion', hidden: 'hidden'} as const);
export type ModelStageHold = typeof MODEL_STAGE_HOLD[keyof typeof MODEL_STAGE_HOLD];
export const MODEL_PREVIEW_TEXT = Object.freeze({
  model: 'Model', modelSearch: 'models', animation: 'Animation', display: 'Display',
  play: 'Play', pause: 'Pause', held: {[MODEL_STAGE_HOLD.reducedMotion]: 'Reduced motion',
    [MODEL_STAGE_HOLD.hidden]: 'Hidden'} satisfies Record<ModelStageHold, string>,
  rest: 'Rest Pose', reset: 'Reset Camera', rig: 'Rig', both: 'Both',
  loading: 'Loading model…', retry: 'Retry',
  unavailable: 'No model is available.', orbit: 'Drag to orbit. Scroll or pinch to zoom.',
  runtimeWaiting: 'Waiting for a runtime pose…', refused: 'Not applied', stopped: 'Preview stopped',
  runtimeReady: (name: string) => `${name} runtime pose ready`,
  ready: (name: string) => `${name} ready`, canvas: (name: string) => `${name} animation viewer`,
});
export const MODEL_PREVIEW_DISPLAY_OPTIONS = Object.freeze([
  {value: MODEL_STAGE_DISPLAY.model, label: MODEL_PREVIEW_TEXT.model},
  {value: MODEL_STAGE_DISPLAY.rig, label: MODEL_PREVIEW_TEXT.rig},
  {value: MODEL_STAGE_DISPLAY.both, label: MODEL_PREVIEW_TEXT.both},
] satisfies {value: ModelStageDisplay; label: string}[]);

export const MODEL_STAGE = Object.freeze({
  pixelRatioLimit: 2, fieldOfView: 38, nearPlane: 0.01, farPlane: 100,
  cameraMinimum: 1, cameraMaximum: 16, cameraDirection: [0.75, 0.4, 1], fitPadding: 1.4,
  floorRadius: 4, floorSegments: 64, floorOffset: -0.025, gridSize: 8, gridDivisions: 16,
  normalizedHeight: 2, markerRadius: 0.035, markerSegments: 12, jointRadiusRatio: 0.008, jointSegments: 8,
  millisecondsPerSecond: 1000, maxFrameDelta: 0.05,
});
/** Why the local clock's time is held still, from the page as it is now; null while it runs. */
export function modelLocalHold(reducedMotion: boolean, hidden: boolean): ModelStageHold | null {
  if (reducedMotion) return MODEL_STAGE_HOLD.reducedMotion;
  return hidden ? MODEL_STAGE_HOLD.hidden : null;
}
/**
 * How far the local clock's one presentation time moves in a frame: by the elapsed time, capped, or not at all while
 * it is held. Everything that moves with the local clock reads this time.
 */
export const modelLocalAdvance = (elapsedMilliseconds: number, hold: ModelStageHold | null) => hold === null ?
  Math.min(elapsedMilliseconds / MODEL_STAGE.millisecondsPerSecond, MODEL_STAGE.maxFrameDelta) : 0;
/** A model as the view's catalog names it: its asset id, its name, and the clips its picker offers. */
export interface ModelPreviewAsset {
  readonly id: string;
  readonly name: string;
  readonly animations: readonly {readonly name: string; readonly label: string}[];
}
export interface ModelStageTheme {
  colors: {
    stage: string; text: string; surface: string; surfaceHi: string;
    accent: string; accentDeep: string; teal: string;
  };
}
export interface ModelStageSnapshot {
  id: string;
  animation: string;
  /** null while engine samples play: `actors` holds what was applied. */
  time: number | null;
  /** The focused clip plays on the local clock, as declared. */
  playing: boolean;
  /** Why the local clock's time is held, so nothing playing moves; null while it runs, and under the engine's clock. */
  hold: ModelStageHold | null;
  skeletonVisible: boolean;
  display: ModelStageDisplay;
  modelVisible: boolean;
  visibleModelMeshes: number;
  rigVisible: boolean;
  boneCount: number;
  visibleRigJoints: number;
  surfaceMode: ModelStageSurfaceMode;
  surfaceModesAvailable: boolean;
  emissiveMaterialCount: number;
  /** The id of the time of day in force. */
  lighting: string;
  /** The focused model's parts (its PART- nodes), each by its name with its world pose. */
  parts: readonly {name: string; position: ModelVector; rotationQuaternion: ModelRotation}[];
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
  /** An action, not state: returns a view the person orbited to the described framing, a held pose or a fresh fit. */
  resetCamera(): void;
  snapshot(): ModelStageSnapshot;
}
