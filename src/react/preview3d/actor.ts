import * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MODEL_REST_POSE} from './model.ts';
import type {ModelStagePolicy, ModelStageTheme, ModelStageTransform} from './model.ts';
import {applyModelTransform, disposeModelObject, modelAttachments, prepareModelAsset} from './asset.ts';
import {createModelRig} from './rig.ts';
import {createModelPlayback} from './playback.ts';
import {createModelMaterialInspection} from './materials.ts';
import {bindModelRuntimeMaterials, modelRuntimeAssetProfile} from './runtimeMaterialBinding.ts';
import {MODEL_STAGE_DRIVER, modelPreviewFrame} from './actorModel.ts';
import type {ModelStageActor, ModelStageActorSnapshot, ModelStageDriver} from './actorModel.ts';
import type {ModelPreviewPresentation} from './presentation.ts';
import {ModelStageRefusal} from './refusal.ts';

// What every actor shares from its stage: the policy, the theme, the scene it joins and the lighting of its aids.
export interface ModelActorContext {
  readonly policy: ModelStagePolicy;
  readonly theme: ModelStageTheme;
  readonly scene: THREE.Object3D;
  readonly lighting: {attach(objects: readonly THREE.Object3D[]): () => void};
  readonly rendered: (mesh: THREE.Mesh) => void;
}
export const MODEL_ACTOR_TEXT = Object.freeze({
  hostPlacement: (id: string) => `Actor ${id} is engine-driven; a host placement is refused.`,
  unlit: 'Runtime presentation requires lit materials.',
});

// One loaded model and every owner it composes. The stage's character and each declared actor are built alike.
export function createModelActor(asset: GLTF, declaration: ModelStageActor, context: ModelActorContext) {
  const {id, asset: source} = declaration, acquired: Array<() => void> = [];
  const release = () => {for (const dispose of acquired.splice(0).reverse()) dispose();};
  try {
    acquired.push(() => {asset.scene.parent?.removeFromParent(); disposeModelObject(asset.scene);});
    const profile = modelRuntimeAssetProfile(source);
    const placement = prepareModelAsset(asset, context.policy);
    applyModelTransform(placement, declaration.placement);
    const markers = modelAttachments(asset, source, context.theme);
    acquired.push(() => markers.forEach(({marker}) => {marker.removeFromParent(); disposeModelObject(marker);}));
    asset.scene.traverse(node => {if (node instanceof THREE.Mesh) node.onAfterRender = () => context.rendered(node);});
    const materials = createModelMaterialInspection(asset.scene);
    acquired.push(() => materials.dispose());
    const runtimeMaterials = profile ? bindModelRuntimeMaterials(asset, profile) : undefined;
    if (runtimeMaterials) acquired.push(() => runtimeMaterials.dispose());
    const rig = createModelRig(asset.scene, context.theme, markers);
    acquired.push(() => {rig.root.removeFromParent(); disposeModelObject(rig.root);});
    acquired.push(context.lighting.attach([rig.root, ...markers.map(({marker}) => marker)]));
    const playback = createModelPlayback(asset.scene, asset.animations, context.policy.clock,
      id);
    acquired.push(() => playback.dispose());
    const held = declaration.heldAnimation === undefined ? MODEL_REST_POSE : declaration.heldAnimation;
    if (declaration.heldAnimation !== undefined) playback.setAnimation(playback.resolve(held).name);
    context.scene.add(placement, rig.root, ...markers.map(({marker}) => marker));
    let driver: ModelStageDriver = MODEL_STAGE_DRIVER.host;
    let presentation: ModelPreviewPresentation | undefined;
    return {
      id, declaration, asset, placement, markers, rig, playback, materials, runtimeMaterials, profile,
      get driver() {return driver;},
      get presentation() {return presentation;},
      setPlacement(value: ModelStageTransform) {
        if (driver === MODEL_STAGE_DRIVER.engine) throw new ModelStageRefusal(MODEL_ACTOR_TEXT.hostPlacement(id));
        applyModelTransform(placement, value);
      },
      // Everything that can refuse runs here; the returned commit only applies.
      prepare(value: ModelPreviewPresentation) {
        const materialCommit = runtimeMaterials?.prepare(value.materials);
        if (materials.snapshot().materialMode !== 'lit') throw new ModelStageRefusal(MODEL_ACTOR_TEXT.unlit);
        const layerCommit = playback.prepareLayers(value.animationLayers);
        return () => {
          materialCommit?.();
          layerCommit();
          applyModelTransform(placement, value.pose);
          presentation = value;
          driver = MODEL_STAGE_DRIVER.engine;
          if (rig.display === 'rig') rig.setDisplay('rig');
        };
      },
      snapshot(): ModelStageActorSnapshot {
        return Object.freeze({id, modelId: source.id, driver, held, samples: playback.review().samples,
          pose: Object.freeze({position: placement.position.toArray(),
            rotationQuaternion: placement.quaternion.toArray(), scale: placement.scale.toArray()})});
      },
      dispose: release,
    };
  } catch (error) {
    release();
    throw error;
  }
}
export type ModelActor = ReturnType<typeof createModelActor>;

// Validate and prepare every named actor before any commits: a refusal leaves every actor as it was.
export function applyModelFrame(actors: readonly ModelActor[], value: unknown) {
  const accepted = modelPreviewFrame(value, new Map(actors.map(actor =>
    [actor.id, {modelId: actor.declaration.asset.id, runtimeMaterials: actor.profile}])));
  const named = new Map(accepted.entities.map(entity => [entity.entityId, entity]));
  const commits = actors.flatMap(actor => {
    const entity = named.get(actor.id);
    return entity ? [actor.prepare(entity)] : [];
  });
  for (const commit of commits) commit();
  return accepted.simulationTimeSeconds;
}
