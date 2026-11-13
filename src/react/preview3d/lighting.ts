import * as THREE from 'three';
import {writeModelColor} from './color.ts';
import type {ModelStageLook} from './lookModel.ts';
import type {ModelFog} from './fog.ts';
import type {ModelDraw} from './draw.ts';
import type {ModelStageCommit} from './commit.ts';
import {MODEL_STAGE_THEME_LIGHTING, modelStageTimeInForce, type ModelStageLighting, type ModelStageTime}
  from './lightingModel.ts';

type Unlit = THREE.MeshBasicMaterial | THREE.LineBasicMaterial;
const unlit = (material: THREE.Material): material is Unlit =>
  material instanceof THREE.MeshBasicMaterial || material instanceof THREE.LineBasicMaterial;

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

/** The parts of a look the scene owns: its fog, and the draw that applies its tone curve and adds its glow. */
export interface ModelLookLayers {
  readonly fog: Pick<ModelFog, 'set'>;
  readonly output: Pick<ModelDraw, 'load' | 'prepare'>;
}
// The stage's backdrop, floor, two lights, unlit aids, fog, tone curve and glow, as the look of one time at a time. A
// look is written into the same objects every time: a changed colour, strength or distance allocates nothing and
// compiles nothing. What does compile, once each, read from three r180's program key (WebGLPrograms.js 420, 463):
// fog arriving or leaving recompiles every program that takes it; a tone curve arriving, leaving or changing
// recompiles every program the canvas pass draws; and glow arriving compiles, on its first frame, a second variant of
// every program the scene draws, for the linear, curve-less target its source is drawn into (WebGLPrograms.js 165-171,
// 202). Those variants stay in each material's programs after glow leaves, so a later return compiles nothing.
export function createModelLighting(renderer: Pick<THREE.WebGLRenderer, 'setClearColor'>,
  builtIn: readonly ModelStageTime[], layers: ModelLookLayers) {
  const ambient = new THREE.HemisphereLight();
  const key = new THREE.DirectionalLight();
  const backdrop = new THREE.Color();
  const aids = new Set<(share: number) => void>();
  const floors = new Set<THREE.MeshStandardMaterial>();
  const resolve = (value: ModelStageLighting) => modelStageTimeInForce(value.time, [...builtIn, ...value.times]);
  const prepare = (time: ModelStageTime): ModelStageCommit => {
    const {look} = time;
    const output = layers.output.prepare(look.toneCurve, look.glow, `Time ${time.id}: look.glow`);
    return () => {
      current = time;
      apply(look);
      output();
    };
  };
  const apply = (look: ModelStageLook) => {
    renderer.setClearColor(writeModelColor(backdrop, look.backdrop));
    writeModelColor(ambient.color, look.ambient.sky);
    writeModelColor(ambient.groundColor, look.ambient.ground);
    ambient.intensity = look.ambient.strength;
    writeModelColor(key.color, look.key.color);
    key.intensity = look.key.strength;
    key.position.fromArray(look.key.direction);
    for (const floor of floors) writeModelColor(floor.color, look.aids.floor);
    for (const hold of aids) hold(look.aids.share);
    layers.fog.set(look.fog);
  };
  // The stage starts at the consumer's own theme, the time it shows when a description states no other.
  let current = resolve(MODEL_STAGE_THEME_LIGHTING);
  prepare(current)();
  return {
    lights: [ambient, key] as const,
    /** The id of the time in force. */
    get time() {return current.id;},
    /** What showing a described lighting needs loaded first: the glow's passes, when its time brings glow. */
    load: (value: ModelStageLighting) => layers.output.load(resolve(value).look.glow),
    /** A described lighting, already checked whole: its time in force resolved, and what drawing it needs refused. */
    prepare: (value: ModelStageLighting) => prepare(resolve(value)),
    // The floor is lit, so it takes a colour from the look rather than a share.
    floor(material: THREE.MeshStandardMaterial) {
      floors.add(material);
      writeModelColor(material.color, current.look.aids.floor);
    },
    // Stage aids join at the current look; the returned release gives them back at their authored colours.
    attach(objects: readonly THREE.Object3D[]) {
      const hold = stageAids(objects);
      aids.add(hold);
      hold(current.look.aids.share);
      return () => {
        if (aids.delete(hold)) hold(1);
      };
    },
  };
}
