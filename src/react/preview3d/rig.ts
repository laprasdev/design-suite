import * as THREE from 'three';
import {MODEL_STAGE as settings} from './model.ts';
import type {ModelStageDisplay, ModelStageTheme} from './model.ts';
import type {modelAttachments} from './asset.ts';

const renderable = (node: THREE.Object3D) =>
  node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Points;
const visibleInTree = (node: THREE.Object3D): boolean => node.visible && (!node.parent || visibleInTree(node.parent));

export function createModelRig(asset: THREE.Object3D, theme: ModelStageTheme,
  attachments: ReturnType<typeof modelAttachments>) {
  const bones: THREE.Bone[] = [];
  const renderables: {node: THREE.Object3D; visible: boolean}[] = [];
  asset.traverse(node => {
    if (node instanceof THREE.Bone) bones.push(node);
    if (renderable(node)) renderables.push({node, visible: node.visible});
  });
  const root = new THREE.Group();
  root.visible = false;
  const skeleton = new THREE.SkeletonHelper(asset);
  const materials = Array.isArray(skeleton.material) ? skeleton.material : [skeleton.material];
  for (const material of materials) {
    material.depthTest = false;
    material.depthWrite = false;
    material.toneMapped = false;
    if (material instanceof THREE.LineBasicMaterial) {
      material.vertexColors = false;
      material.color.set(theme.colors.teal);
    }
  }
  skeleton.renderOrder = 1;
  const height = new THREE.Box3().setFromObject(asset).getSize(new THREE.Vector3()).y;
  const radius = height * settings.jointRadiusRatio;
  const joints = new THREE.InstancedMesh(
    new THREE.SphereGeometry(radius, settings.jointSegments, settings.jointSegments),
    new THREE.MeshBasicMaterial({color: theme.colors.text, depthTest: false, depthWrite: false, toneMapped: false}),
    bones.length,
  );
  joints.renderOrder = 2;
  joints.frustumCulled = false;
  root.add(skeleton, joints);
  let display: ModelStageDisplay = 'model', factor = 1;
  const unit = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1);
  const position = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  return {
    root,
    /** The asset's renderables and their authored visibility; the actor writes their visibility, the rig reads it. */
    renderables: renderables as readonly {readonly node: THREE.Object3D; readonly visible: boolean}[],
    get display() {return display;},
    /** The scale the stage's size rule applied to the asset: the joints were sized for the file's own height. */
    setScale(value: number) {factor = value; scale.setScalar(value);},
    setDisplay(value: ModelStageDisplay) {
      display = value;
      root.visible = value !== 'model';
      for (const {marker} of attachments) marker.visible = root.visible;
    },
    update() {
      bones.forEach((bone, index) => {
        joints.setMatrixAt(index, matrix.compose(bone.getWorldPosition(position), unit, scale));
      });
      joints.instanceMatrix.needsUpdate = true;
      for (const {marker, bone} of attachments) bone.getWorldPosition(marker.position);
      root.updateMatrixWorld(true);
    },
    bounds() {
      const bounds = new THREE.Box3();
      if (display === 'both' || !bones.length) bounds.setFromObject(asset);
      for (const bone of bones) bounds.expandByPoint(bone.getWorldPosition(position));
      return bones.length ? bounds.expandByScalar(radius * factor) : bounds;
    },
    snapshot() {
      const visibleModelMeshes = renderables.filter(({node}) =>
        node instanceof THREE.Mesh && visibleInTree(node)).length;
      return {
        display, modelVisible: visibleModelMeshes > 0, visibleModelMeshes, rigVisible: root.visible && bones.length > 0,
        boneCount: bones.length, visibleRigJoints: root.visible ? bones.length : 0, skeletonVisible: root.visible,
      };
    },
  };
}
