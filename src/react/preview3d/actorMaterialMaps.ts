import * as THREE from 'three';
import {writeModelColor} from './color.ts';
import type {ModelActorMaterialMap} from './materialMapModel.ts';
import {modelStates} from './recordModel.ts';
import {extendModelMaterial, modelMaterialChanges} from './shading.ts';
import {MODEL_COLOR_SPACE, type ModelColorSpace} from './surfaceKindModel.ts';

const SPACES: Readonly<Record<ModelColorSpace, string>> = Object.freeze({
  [MODEL_COLOR_SPACE.srgb]: THREE.SRGBColorSpace,
  [MODEL_COLOR_SPACE.linear]: THREE.NoColorSpace,
});

const markUpdated = (material: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(material)) {
    for (const slot of material) slot.needsUpdate = true;
  } else {
    material.needsUpdate = true;
  }
};

const disposeHeld = (heldClones: readonly THREE.Material[], heldTextures: readonly THREE.Texture[]) => {
  for (const clone of heldClones) clone.dispose();
  for (const texture of heldTextures) texture.dispose();
};

// Manages per-actor material-map overrides on a file actor's scene. Clones matched MeshStandardMaterials from the
// file's originals (never compounding clones), preserves the stage's shader extensions (fog and Surface modes),
// deduplicates textures sharing the same (image, colorSpace, flipY), and restores originals while freeing clones and
// uploaded textures on replace, clear (null) or dispose.
export function createModelActorMaterialMaps(scene: THREE.Object3D) {
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  scene.traverse(node => {
    if (node instanceof THREE.Mesh) originals.set(node, node.material);
  });
  let swapped = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  let clones: THREE.MeshStandardMaterial[] = [];
  let textures: THREE.Texture[] = [];
  let active = false;

  const restoreMesh = (mesh: THREE.Mesh) => {
    const original = originals.get(mesh);
    if (!original) return;
    mesh.material = original;
    markUpdated(original);
  };

  const clear = () => {
    for (const mesh of swapped.keys()) restoreMesh(mesh);
    disposeHeld(clones, textures);
    swapped = new Map();
    clones = [];
    textures = [];
    active = false;
  };

  return {
    get active() {return active;},
    apply(maps: Readonly<Record<string, ModelActorMaterialMap>> | null) {
      if (maps === null || !Object.keys(maps).length) {
        clear();
        return;
      }
      const nextTextures: THREE.Texture[] = [];
      const nextClones = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();
      const nextSwapped = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
      const byImage = new Map<TexImageSource, Map<string, THREE.Texture>>();
      const textureFor = (entry: ModelActorMaterialMap): THREE.Texture => {
        const space = entry.colorSpace ?? MODEL_COLOR_SPACE.srgb;
        const flipY = entry.flipY ?? false;
        const key = `${space}:${flipY}`;
        let variants = byImage.get(entry.image);
        if (!variants) {
          variants = new Map();
          byImage.set(entry.image, variants);
        }
        const cached = variants.get(key);
        if (cached) return cached;
        const texture = new THREE.Texture(entry.image);
        texture.colorSpace = SPACES[space];
        texture.flipY = flipY;
        texture.needsUpdate = true;
        variants.set(key, texture);
        nextTextures.push(texture);
        return texture;
      };
      const cloneFor = (material: THREE.Material): THREE.Material => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return material;
        if (!material.name || !modelStates(maps, material.name)) return material;
        const cached = nextClones.get(material);
        if (cached) return cached;
        const entry = maps[material.name];
        const cloned = extendModelMaterial(material.clone(), modelMaterialChanges(material));
        cloned.map = textureFor(entry);
        if (entry.color) writeModelColor(cloned.color, entry.color);
        cloned.needsUpdate = true;
        nextClones.set(material, cloned);
        return cloned;
      };
      try {
        for (const [mesh, original] of originals) {
          if (Array.isArray(original)) {
            let changed = false;
            const next = original.map(slot => {
              const replacement = cloneFor(slot);
              if (replacement !== slot) changed = true;
              return replacement;
            });
            if (changed) nextSwapped.set(mesh, next);
          } else {
            const replacement = cloneFor(original);
            if (replacement !== original) nextSwapped.set(mesh, replacement);
          }
        }
      } catch (error) {
        disposeHeld([...nextClones.values()], nextTextures);
        throw error;
      }
      for (const mesh of swapped.keys()) if (!nextSwapped.has(mesh)) restoreMesh(mesh);
      for (const [mesh, next] of nextSwapped) mesh.material = next;
      disposeHeld(clones, textures);
      swapped = nextSwapped;
      clones = [...nextClones.values()];
      textures = nextTextures;
      active = true;
    },
    dispose: clear,
  };
}
