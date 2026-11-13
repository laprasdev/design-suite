import * as THREE from 'three';
import {MODEL_STAGE as settings} from './model.ts';
import type {ModelStageDisplay, ModelStageTheme} from './model.ts';
import {modelObjectBounds, type ModelPart} from './asset.ts';

const renderable = (node: THREE.Object3D) =>
  node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Points;
const visibleInTree = (node: THREE.Object3D): boolean => node.visible && (!node.parent || visibleInTree(node.parent));

/**
 * The joints the skin uses: every bone that some skinned vertex carries weight for, in skeleton order. A joint the
 * skin lists but weights no vertex to, such as an end marker, moves nothing and is not drawn.
 */
export function modelSkinJoints(asset: THREE.Object3D): THREE.Bone[] {
  const weighted = new Set<THREE.Bone>(), order: THREE.Bone[] = [];
  asset.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh)) return;
    const index = node.geometry.getAttribute('skinIndex'), weight = node.geometry.getAttribute('skinWeight');
    order.push(...node.skeleton.bones);
    for (let vertex = 0; vertex < index.count; vertex++) {
      for (let slot = 0; slot < index.itemSize; slot++) {
        if (weight.getComponent(vertex, slot) > 0) weighted.add(node.skeleton.bones[index.getComponent(vertex, slot)]);
      }
    }
  });
  return [...new Set(order)].filter(bone => weighted.has(bone));
}

// Each drawn joint joined to its nearest drawn ancestor.
function jointLinks(joints: readonly THREE.Bone[]) {
  const drawn = new Set<THREE.Object3D>(joints), links: [THREE.Bone, THREE.Object3D][] = [];
  for (const joint of joints) {
    let parent = joint.parent;
    while (parent && !drawn.has(parent)) parent = parent.parent;
    // A joint with no drawn ancestor is a root of the drawn rig.
    if (parent) links.push([joint, parent]);
  }
  return links;
}

// The rig aid draws the joints the skin uses and the model's parts; the fit in Rig and Both follows what it draws.
export function createModelRig(asset: THREE.Object3D, theme: ModelStageTheme, parts: readonly ModelPart[]) {
  const bones = modelSkinJoints(asset), links = jointLinks(bones);
  const renderables: {node: THREE.Object3D; visible: boolean}[] = [];
  asset.traverse(node => {if (renderable(node)) renderables.push({node, visible: node.visible});});
  const root = new THREE.Group();
  root.visible = false;
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(links.length * 6), 3)),
  new THREE.LineBasicMaterial({color: theme.colors.teal, depthTest: false, depthWrite: false, toneMapped: false}));
  lines.renderOrder = 1;
  lines.frustumCulled = false;
  const height = new THREE.Box3().setFromObject(asset).getSize(new THREE.Vector3()).y;
  const radius = height * settings.jointRadiusRatio;
  const joints = new THREE.InstancedMesh(
    new THREE.SphereGeometry(radius, settings.jointSegments, settings.jointSegments),
    new THREE.MeshBasicMaterial({color: theme.colors.text, depthTest: false, depthWrite: false, toneMapped: false}),
    bones.length,
  );
  joints.renderOrder = 2;
  joints.frustumCulled = false;
  root.add(lines, joints);
  let display: ModelStageDisplay = 'model', factor = 1;
  const unit = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1);
  const position = new THREE.Vector3(), other = new THREE.Vector3();
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
      for (const {marker} of parts) marker.visible = root.visible;
    },
    update() {
      bones.forEach((bone, index) => {
        joints.setMatrixAt(index, matrix.compose(bone.getWorldPosition(position), unit, scale));
      });
      joints.instanceMatrix.needsUpdate = true;
      const ends = lines.geometry.getAttribute('position');
      links.forEach(([joint, parent], index) => {
        ends.setXYZ(index * 2, ...joint.getWorldPosition(position).toArray());
        ends.setXYZ(index * 2 + 1, ...parent.getWorldPosition(other).toArray());
      });
      ends.needsUpdate = true;
      for (const {marker, node} of parts) node.getWorldPosition(marker.position);
      root.updateMatrixWorld(true);
    },
    /** What the aid draws, with the model in Both: the drawn joints and parts; the model alone when it has none. */
    bounds() {
      const bounds = display === 'both' || !bones.length ? modelObjectBounds(asset) : new THREE.Box3();
      for (const node of [...bones, ...parts.map(part => part.node)]) {
        bounds.expandByPoint(node.getWorldPosition(position));
      }
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
