import * as THREE from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MODEL_STAGE as settings} from './model.ts';
import type {ModelStageAsset, ModelStagePolicy, ModelStageTheme} from './model.ts';
import {MODEL_STAGE_SIZE, type ModelStageSize} from './sizeModel.ts';
import type {ModelPresentationPose} from './placementModel.ts';
import type {ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {loadModelRuntimeAsset} from './runtimeMaterialBinding.ts';

export function disposeModelObject(object: THREE.Object3D) {
  const skeletons = new Set<THREE.Skeleton>();
  object.traverse(node => {
    if (node instanceof THREE.SkinnedMesh && node.skeleton) skeletons.add(node.skeleton);
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Points)) return;
    if (node instanceof THREE.InstancedMesh) node.dispose();
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    }
  });
  for (const skeleton of skeletons) skeleton.dispose();
}

// The asset at its file's own size inside a placement group. `size` applies the stage's size rule over the file's
// scale, never compounding, stands the model on the floor when the policy asks, and returns the factor it applied.
export function prepareModelAsset(asset: Pick<GLTF, 'scene'>, policy: ModelStagePolicy) {
  const bounds = new THREE.Box3().setFromObject(asset.scene);
  const height = bounds.getSize(new THREE.Vector3()).y;
  if (!(height > 0)) throw new Error('The model has no measurable height.');
  const scale = asset.scene.scale.clone(), origin = asset.scene.position.clone();
  const placement = new THREE.Group();
  placement.add(asset.scene);
  return {placement, size(rule: ModelStageSize) {
    const factor = rule.rule === MODEL_STAGE_SIZE.real ? 1 : rule.height / height;
    asset.scene.scale.copy(scale).multiplyScalar(factor);
    asset.scene.position.copy(origin);
    if (policy.centerOnFloor) {
      // The file's bounds scale about the scene's own origin.
      const center = bounds.getCenter(new THREE.Vector3()).sub(origin).multiplyScalar(factor).add(origin);
      const floor = origin.y + (bounds.min.y - origin.y) * factor;
      asset.scene.position.sub(new THREE.Vector3(center.x, floor, center.z));
    }
    return factor;
  }};
}

export function applyModelTransform(placement: THREE.Group, value: ModelPresentationPose) {
  placement.position.fromArray(value.position);
  placement.quaternion.fromArray(value.rotationQuaternion);
  placement.scale.fromArray(value.scale);
}

export function modelAttachments(asset: Pick<GLTF, 'scene'>, character: ModelStageAsset, theme: ModelStageTheme) {
  const bones = new Map<string, THREE.Bone>();
  asset.scene.traverse(node => {
    if (node instanceof THREE.Bone) bones.set(node.userData.name ?? node.name, node);
  });
  const colors: Record<string, string> = {
    leftHand: theme.colors.teal, rightHand: theme.colors.accent,
    leftFoot: theme.colors.teal, rightFoot: theme.colors.accent,
    head: theme.colors.accent, tailTip: theme.colors.accent,
  };
  const sockets = Object.entries(character.attachments).map(([key, name]) => {
    const bone = bones.get(name);
    if (!bone) throw new Error(`Missing attachment bone: ${name}`);
    return {key, bone};
  });
  return sockets.map(({key, bone}) => {
    const geometry = new THREE.SphereGeometry(settings.markerRadius, settings.markerSegments, settings.markerSegments);
    const material = new THREE.MeshBasicMaterial({color: colors[key] ?? theme.colors.accent, depthTest: false});
    const marker = new THREE.Mesh(geometry, material);
    marker.renderOrder = 2;
    marker.visible = false;
    return {key, bone, marker};
  });
}

// The one loader for every actor: a verified runtime asset when materials are bound, otherwise the plain GLB.
export async function loadModelStageAsset(path: string, runtimeMaterials: ModelRuntimeMaterialProfile | undefined,
  signal: AbortSignal): Promise<GLTF> {
  if (runtimeMaterials) return loadModelRuntimeAsset(path, runtimeMaterials, signal);
  const asset = await new GLTFLoader().loadAsync(path);
  if (signal.aborted) {
    disposeModelObject(asset.scene);
    signal.throwIfAborted();
  }
  return asset;
}
