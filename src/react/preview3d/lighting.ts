import * as THREE from 'three';
import type {ModelStageTheme} from './model.ts';
import type {ModelColor} from './colorModel.ts';
import type {ModelStageLook} from './lookModel.ts';
import {modelStageBuiltInTimes, modelStageLighting, modelStageTimeInForce, type ModelStageLighting,
  type ModelStageTime} from './lightingModel.ts';

type Unlit = THREE.MeshBasicMaterial | THREE.LineBasicMaterial;
const unlit = (material: THREE.Material): material is Unlit =>
  material instanceof THREE.MeshBasicMaterial || material instanceof THREE.LineBasicMaterial;
const srgb = (target: THREE.Color, value: ModelColor) => target.setRGB(value[0], value[1], value[2],
  THREE.SRGBColorSpace);

// The unlit materials under these objects, each remembered at its authored colour. No light reaches them, so a look
// holds them to a share of that colour instead.
function stageAids(objects: readonly THREE.Object3D[]) {
  const authored = new Map<Unlit, THREE.Color>();
  for (const object of objects) object.traverse(node => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Line)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (unlit(material) && !authored.has(material)) authored.set(material, material.color.clone());
    }
  });
  return (share: number) => {
    for (const [material, color] of authored) material.color.copy(color).multiplyScalar(share);
  };
}

// The stage's backdrop, floor, two lights and unlit aids, as the look of one time at a time. A look is written into the
// same objects every time: changing a colour or a strength allocates nothing and compiles nothing.
export function createModelLighting(renderer: Pick<THREE.WebGLRenderer, 'setClearColor'>, theme: ModelStageTheme) {
  const builtIn = modelStageBuiltInTimes(theme.colors);
  const ambient = new THREE.HemisphereLight();
  const key = new THREE.DirectionalLight();
  const backdrop = new THREE.Color();
  const aids = new Set<(share: number) => void>();
  const floors = new Set<THREE.MeshStandardMaterial>();
  let time: ModelStageTime = builtIn[0];
  const apply = (look: ModelStageLook) => {
    renderer.setClearColor(srgb(backdrop, look.backdrop));
    srgb(ambient.color, look.ambient.sky);
    srgb(ambient.groundColor, look.ambient.ground);
    ambient.intensity = look.ambient.strength;
    srgb(key.color, look.key.color);
    key.intensity = look.key.strength;
    key.position.fromArray(look.key.direction);
    for (const floor of floors) srgb(floor.color, look.aids.floor);
    for (const hold of aids) hold(look.aids.share);
  };
  apply(time.look);
  return {
    lights: [ambient, key] as const,
    /** The id of the time in force. */
    get time() {return time.id;},
    set(value: ModelStageLighting) {
      time = modelStageTimeInForce(modelStageLighting(value), builtIn);
      apply(time.look);
    },
    // The floor is lit, so it takes a colour from the look rather than a share.
    floor(material: THREE.MeshStandardMaterial) {
      floors.add(material);
      srgb(material.color, time.look.aids.floor);
    },
    // Stage aids join at the current look; the returned release gives them back at their authored colours.
    attach(objects: readonly THREE.Object3D[]) {
      const hold = stageAids(objects);
      aids.add(hold);
      hold(time.look.aids.share);
      return () => {
        if (aids.delete(hold)) hold(1);
      };
    },
  };
}
