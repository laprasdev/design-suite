import * as THREE from 'three';
import {MODEL_STAGE as settings} from './model.ts';
import type {ModelStageTheme} from './model.ts';
import {MODEL_STAGE_DARK as dark, modelStageLighting} from './lightingModel.ts';
import type {ModelStageLighting} from './lightingModel.ts';

type Unlit = THREE.MeshBasicMaterial | THREE.LineBasicMaterial;
const unlit = (material: THREE.Material): material is Unlit =>
  material instanceof THREE.MeshBasicMaterial || material instanceof THREE.LineBasicMaterial;

// The unlit materials under these objects, each remembered at its authored colour. No light reaches them, so a
// lighting holds them to a share of that colour instead.
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

// What one lighting gives the stage: its colours, and the shares its lights and unlit aids keep.
type Look = Record<'backdrop' | 'ground' | 'floor' | 'light', THREE.ColorRepresentation>
  & Record<'lightShare' | 'aidShare', number>;

// The stage's backdrop, floor, two lights and unlit aids, as one lighting at a time.
export function createModelLighting(renderer: Pick<THREE.WebGLRenderer, 'setClearColor'>, theme: ModelStageTheme) {
  const looks: Record<ModelStageLighting, Look> = {
    light: {backdrop: theme.colors.stage, ground: theme.colors.surface, floor: theme.colors.surface,
      light: theme.colors.text, lightShare: 1, aidShare: 1},
    dark: {...dark, ground: dark.backdrop},
  };
  const ambient = new THREE.HemisphereLight();
  const key = new THREE.DirectionalLight();
  key.position.fromArray(settings.keyLightPosition);
  const aids = new Set<(share: number) => void>();
  const floors = new Set<THREE.MeshStandardMaterial>();
  let mode: ModelStageLighting = 'light';
  const apply = () => {
    const look = looks[mode];
    renderer.setClearColor(look.backdrop);
    ambient.color.set(look.light);
    ambient.groundColor.set(look.ground);
    ambient.intensity = settings.ambientIntensity * look.lightShare;
    key.color.set(look.light);
    key.intensity = settings.lightIntensity * look.lightShare;
    for (const floor of floors) floor.color.set(look.floor);
    for (const hold of aids) hold(look.aidShare);
  };
  apply();
  return {
    lights: [ambient, key] as const,
    get mode() {return mode;},
    set(value: ModelStageLighting) {
      mode = modelStageLighting(value);
      apply();
    },
    // The floor is lit, so it takes a colour from the lighting rather than a share.
    floor(material: THREE.MeshStandardMaterial) {
      floors.add(material);
      apply();
    },
    // Stage aids join at the current lighting; the returned release gives them back at their authored colours.
    attach(objects: readonly THREE.Object3D[]) {
      const hold = stageAids(objects);
      aids.add(hold);
      hold(looks[mode].aidShare);
      return () => {
        if (aids.delete(hold)) hold(1);
      };
    },
  };
}
