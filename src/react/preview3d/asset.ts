import * as THREE from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MODEL_STAGE as settings} from './model.ts';
import type {ModelStageTheme} from './model.ts';
import {MODEL_STAGE_ORIGIN, MODEL_STAGE_SIZE, type ModelStageOrigin, type ModelStageSize} from './sizeModel.ts';
import type {ModelPresentationPose} from './placementModel.ts';
import {modelIsRenderer, modelRendererMaterials} from './renderers.ts';
import {readModelFile} from './files.ts';

export function disposeModelObject(object: THREE.Object3D) {
  const skeletons = new Set<THREE.Skeleton>();
  object.traverse(node => {
    if (node instanceof THREE.SkinnedMesh && node.skeleton) skeletons.add(node.skeleton);
    if (!modelIsRenderer(node)) return;
    if (node instanceof THREE.InstancedMesh) node.dispose();
    node.geometry.dispose();
    for (const material of modelRendererMaterials(node)) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    }
  });
  for (const skeleton of skeletons) skeleton.dispose();
}

/**
 * How many meshes under these roots the camera's last frame drew: visible in the tree and, unless never culled, inside
 * the camera's view, by three's own test (Frustum.intersectsObject, as its renderer culls). Read when asked, never in a
 * frame; a model's meshes are on the scene's layer, which every frame draws.
 */
export function modelDrawnMeshCount(roots: Iterable<THREE.Object3D>, camera: THREE.Camera) {
  const view = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix, camera.matrixWorldInverse));
  let count = 0;
  for (const root of roots) {
    root.traverseVisible(node => {
      if (node instanceof THREE.Mesh && (!node.frustumCulled || view.intersectsObject(node))) count++;
    });
  }
  return count;
}

/** The world bounds of what an object draws, its skinned meshes in their current pose. */
export function modelObjectBounds(object: THREE.Object3D) {
  object.traverse(node => {
    if (node instanceof THREE.SkinnedMesh) {node.skeleton.update(); node.computeBoundingBox();}
  });
  return new THREE.Box3().setFromObject(object);
}

// The asset at its file's own size inside a placement group. `size` applies the stage's size rule over the file's
// scale, never compounding, centres the model over its placement when the origin asks, and returns the factor.
export function prepareModelAsset(asset: Pick<GLTF, 'scene'>) {
  const bounds = new THREE.Box3().setFromObject(asset.scene);
  const height = bounds.getSize(new THREE.Vector3()).y;
  if (!(height > 0)) throw new Error('The model has no measurable height.');
  const scale = asset.scene.scale.clone(), origin = asset.scene.position.clone();
  const placement = new THREE.Group();
  placement.add(asset.scene);
  return {placement, size(rule: ModelStageSize, standing: ModelStageOrigin) {
    const factor = rule.rule === MODEL_STAGE_SIZE.real ? 1 : rule.height / height;
    asset.scene.scale.copy(scale).multiplyScalar(factor);
    asset.scene.position.copy(origin);
    if (standing === MODEL_STAGE_ORIGIN.centred) {
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

/** The prefix of a part's node name; what follows it is the part's name, the engine's own. */
export const MODEL_PART_PREFIX = 'PART-';
/** A point of the model a host attaches to: an empty node, named PART-<name>, parented to the bone it follows. */
export interface ModelPart {readonly name: string; readonly node: THREE.Object3D; readonly marker: THREE.Mesh}

// A file's node keeps its authored name in userData.name; three sanitises node.name. A node without an authored
// name is no part.
export function modelParts(asset: Pick<GLTF, 'scene'>, theme: ModelStageTheme): ModelPart[] {
  const parts: ModelPart[] = [];
  asset.scene.traverse(node => {
    const authored: unknown = node.userData.name;
    if (typeof authored !== 'string' || !authored.startsWith(MODEL_PART_PREFIX)) return;
    const geometry = new THREE.SphereGeometry(settings.markerRadius, settings.markerSegments, settings.markerSegments);
    const material = new THREE.MeshBasicMaterial({color: theme.colors.accent, depthTest: false, fog: false});
    const marker = new THREE.Mesh(geometry, material);
    marker.renderOrder = 2;
    marker.visible = false;
    parts.push({name: authored.slice(MODEL_PART_PREFIX.length), node, marker});
  });
  return parts;
}

/**
 * The one loader for every actor's file: read whole through the stage's one read (files.ts: its SHA-256 checked when
 * the description states one, the read abortable), then parsed by three's loader, the files it names resolved beside
 * it. A parse that lands after its load was let go of is freed at once.
 */
export async function loadModelStageAsset(path: string, sha256: string | undefined,
  signal: AbortSignal): Promise<GLTF> {
  const bytes = await readModelFile(path, sha256, signal);
  const asset = await new GLTFLoader().parseAsync(bytes, new URL('.', new URL(path, document.baseURI)).href);
  if (signal.aborted) {
    disposeModelObject(asset.scene);
    signal.throwIfAborted();
  }
  return asset;
}
