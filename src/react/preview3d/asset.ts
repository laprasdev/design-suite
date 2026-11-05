import * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MODEL_STAGE as settings} from './model.ts';
import type {ModelStageAsset, ModelStagePolicy, ModelStageTheme, ModelStageTransform} from './model.ts';

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

export function prepareModelAsset(asset: Pick<GLTF, 'scene'>, policy: ModelStagePolicy) {
  const height = new THREE.Box3().setFromObject(asset.scene).getSize(new THREE.Vector3()).y;
  if (!(height > 0)) throw new Error('The model has no measurable height.');
  if (policy.normalizeHeight !== null) asset.scene.scale.multiplyScalar(policy.normalizeHeight / height);
  if (policy.centerOnFloor) {
    const bounds = new THREE.Box3().setFromObject(asset.scene);
    const center = bounds.getCenter(new THREE.Vector3());
    asset.scene.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  }
  const placement = new THREE.Group();
  placement.add(asset.scene);
  return placement;
}

export function applyModelTransform(placement: THREE.Group, value: ModelStageTransform) {
  if (value.position) placement.position.fromArray(value.position);
  if (value.rotationQuaternion) placement.quaternion.fromArray(value.rotationQuaternion);
  if (value.scale) placement.scale.fromArray(value.scale);
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
