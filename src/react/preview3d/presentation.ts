import {modelPresentationPose, modelPresentationVector, type ModelPresentationPose} from './placementModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {modelIsRecord as object} from './recordModel.ts';
import {modelMaterialOutputs} from './runtimeMaterialModel.ts';
import type {ModelMaterialOutput, ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {modelSurfaceOutputs, type ModelSurfaceTakes} from './surfaceOutputModel.ts';
import {modelAnimationLayers} from './animationLayerModel.ts';
import type {ModelAnimationLayer} from './animationLayerModel.ts';

export const MODEL_PREVIEW_ENTITY_REFUSAL = Object.freeze({entity: 'Every frame entity requires an entityId.'});
export const MODEL_PREVIEW_CAPABILITIES = Object.freeze({
  pose: true, animationLayers: true, partPoses: false, materials: false,
});
// One entity of an engine frame: the actor it names and every channel the engine published for it.
export interface ModelPreviewEntity {
  readonly entityId: string;
  readonly modelId: string;
  readonly pose: ModelPresentationPose;
  readonly animationLayers: readonly ModelAnimationLayer[];
  readonly partPoses: readonly unknown[];
  readonly materials: readonly ModelMaterialOutput[];
}

// Validate every channel before any pose is applied; refusals name the entity. Accepted values never retain
// caller-owned arrays. `materials` is what the actor's renderers take: the runtime profile's renderers (until that
// route leaves, step 5e), or its surfaces' renderers; with neither, the frame states no material.
export function modelPreviewEntity(value: unknown, modelId: string,
  materials?: ModelRuntimeMaterialProfile | ModelSurfaceTakes): ModelPreviewEntity {
  if (!object(value) || typeof value.entityId !== 'string' || !value.entityId) {
    throw new ModelStageRefusal(MODEL_PREVIEW_ENTITY_REFUSAL.entity);
  }
  if (typeof value.modelId !== 'string' || value.modelId !== modelId) {
    throw new ModelStageRefusal(`Entity ${value.entityId}: modelId must match the declared model ${modelId}.`);
  }
  if (!Array.isArray(value.partPoses) || value.partPoses.length !== 0) {
    throw new ModelStageRefusal('partPoses must be an explicitly empty array for this preview.');
  }
  return Object.freeze({entityId: value.entityId, modelId: value.modelId,
    pose: modelPresentationPose(value.pose, `Entity ${value.entityId}`),
    animationLayers: modelAnimationLayers(value.animationLayers, value.entityId), partPoses: Object.freeze([]),
    materials: materials !== undefined && 'surfaces' in materials ?
      modelSurfaceOutputs(value.materials, materials, `Entity ${value.entityId}`) :
      modelMaterialOutputs(value.materials, materials)});
}

export function modelPreviewCamera(value: unknown) {
  if (!object(value)) throw new ModelStageRefusal('A complete preview camera is required.');
  const position = modelPresentationVector(value.position, 'camera position');
  const target = modelPresentationVector(value.target, 'camera target');
  const distance = Math.hypot(...position.map((component, index) => component - target[index]));
  if (!(distance > 0) || !Number.isFinite(distance)) {
    throw new ModelStageRefusal('Camera position and target must be distinct.');
  }
  return Object.freeze({position, target});
}
