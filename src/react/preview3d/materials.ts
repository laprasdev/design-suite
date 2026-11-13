import * as THREE from 'three';
import {MODEL_PREVIEW_MATERIAL_SETTINGS as settings, modelStageMaterialMode} from './materialModel.ts';
import type {ModelStageMaterialMode} from './materialModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {extendModelMaterial, modelMaterialOwned, replaceModelShader} from './shading.ts';

const COLOR_FRAGMENT = '#include <color_fragment>';
const OUTPUT_FRAGMENT = '#include <opaque_fragment>';
const INSPECTION = 'material inspection';
function clay(material: THREE.MeshStandardMaterial) {
  material.color.setHex(settings.clayColor);
  material.roughness = settings.roughness;
  material.metalness = settings.metalness;
  material.normalMap = material.bumpMap = material.displacementMap = null;
  material.roughnessMap = material.metalnessMap = material.aoMap = material.lightMap = null;
  material.envMap = material.emissiveMap = null;
  material.emissive.setRGB(0, 0, 0);
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.clearcoat = material.transmission = material.sheen = material.iridescence = material.anisotropy = 0;
    material.specularIntensity = 0;
  }
}
function inspectionMaterial(original: THREE.MeshStandardMaterial, mode: ModelStageMaterialMode) {
  const material = original.clone();
  if (mode === 'clay') clay(material);
  if (mode === 'color') material.toneMapped = false;
  material.fog = false;
  // Keep the original map/vertex alpha path, including cutouts. Only replace the inspected RGB channel.
  return extendModelMaterial(material, [{key: `model-material-inspection:${mode}`, apply: shader => {
    shader.fragmentShader = mode === 'clay' ? replaceModelShader(shader.fragmentShader, COLOR_FRAGMENT,
      `${COLOR_FRAGMENT}\ndiffuseColor.rgb = diffuse;`, INSPECTION) : replaceModelShader(shader.fragmentShader,
      OUTPUT_FRAGMENT, `outgoingLight = ${mode === 'emission' ? 'totalEmissiveRadiance' : 'diffuseColor.rgb'};\n` +
      OUTPUT_FRAGMENT, INSPECTION);
  }}]);
}
function supported(material: THREE.Material): material is THREE.MeshStandardMaterial {
  return material instanceof THREE.MeshStandardMaterial && modelMaterialOwned(material);
}

// Overrides belong to this loaded model instance. Textures and geometry remain owned by its original materials/scene.
export function createModelMaterialInspection(root: THREE.Object3D) {
  const meshes: {mesh: THREE.Mesh; material: THREE.Material | THREE.Material[]}[] = [];
  root.traverse(node => {if (node instanceof THREE.Mesh) meshes.push({mesh: node, material: node.material});});
  const originals = [...new Set(meshes.flatMap(({material}) => Array.isArray(material) ? material : [material]))];
  const available = originals.length > 0 && originals.every(supported);
  const emissiveMaterialCount = originals.filter(material => supported(material) && material.emissiveIntensity > 0 &&
    Math.max(material.emissive.r, material.emissive.g, material.emissive.b) > 0).length;
  let mode: ModelStageMaterialMode = 'lit';
  let clones = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  let disposed = false;
  const restore = () => {for (const entry of meshes) entry.mesh.material = entry.material;};
  return {
    setMode(value: ModelStageMaterialMode) {
      const next = modelStageMaterialMode(value);
      if (disposed) throw new Error('Material inspection has been disposed.');
      if (next !== 'lit' && !available) throw new ModelStageRefusal('This model does not support material inspection.');
      if (next === mode) return;
      const replacements = new Map<THREE.Material, THREE.MeshStandardMaterial>();
      try {
        if (next !== 'lit') for (const original of originals) {
          if (!supported(original)) throw new ModelStageRefusal('This model does not support material inspection.');
          replacements.set(original, inspectionMaterial(original, next));
        }
      } catch (error) {
        for (const material of replacements.values()) material.dispose();
        throw error;
      }
      restore();
      if (next !== 'lit') for (const {mesh, material} of meshes) {
        const replacement = (original: THREE.Material) => replacements.get(original)!;
        mesh.material = Array.isArray(material) ? material.map(replacement) : replacement(material);
      }
      for (const material of clones.values()) material.dispose();
      clones = replacements;
      mode = next;
    },
    snapshot: () => ({materialMode: mode, materialInspectionAvailable: available, emissiveMaterialCount}),
    dispose() {
      if (disposed) return;
      disposed = true;
      restore();
      for (const material of clones.values()) material.dispose();
      clones.clear();
      mode = 'lit';
    },
  };
}
