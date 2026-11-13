import * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {ModelStagePolicy, ModelStageTheme, ModelStageTransform} from './model.ts';
import {applyModelTransform, disposeModelObject, modelAttachments, prepareModelAsset} from './asset.ts';
import {createModelRig} from './rig.ts';
import {createModelPlayback} from './playback.ts';
import {createModelMaterialInspection} from './materials.ts';
import {bindModelRuntimeMaterials} from './runtimeMaterialBinding.ts';
import {MODEL_STAGE_DRIVER, modelPreviewFrame, modelRuntimeAssetProfile} from './actorModel.ts';
import type {ModelStageActor, ModelStageActorSnapshot, ModelStageDriver} from './actorModel.ts';
import type {ModelPreviewEntity} from './presentation.ts';
import {modelStageCommit, prepareWhole, type ModelStageCommit} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';

// What every actor shares from its stage: the policy, the theme, the scene it joins and the lighting of its aids.
export interface ModelActorContext {
  readonly policy: ModelStagePolicy;
  readonly theme: ModelStageTheme;
  readonly scene: THREE.Object3D;
  readonly lighting: {attach(objects: readonly THREE.Object3D[]): () => void};
  readonly rendered: (mesh: THREE.Mesh) => void;
}
export const MODEL_ACTOR_TEXT = Object.freeze({unlit: 'Runtime presentation requires lit materials.'});
// A declared placement is whole: a component it leaves out is the identity, not the previous value.
const IDENTITY_PLACEMENT = Object.freeze({position: [0, 0, 0], rotationQuaternion: [0, 0, 0, 1],
  scale: [1, 1, 1]} as const satisfies ModelStageTransform);

// One loaded model and every owner it composes. Every actor is built alike; its declaration is applied through the
// same prepare a later declaration uses.
export function createModelActor(asset: GLTF, declaration: ModelStageActor, context: ModelActorContext) {
  const {id, asset: source} = declaration, acquired: Array<() => void> = [];
  const release = () => {for (const dispose of acquired.splice(0).reverse()) dispose();};
  try {
    acquired.push(() => {asset.scene.parent?.removeFromParent(); disposeModelObject(asset.scene);});
    const profile = modelRuntimeAssetProfile(declaration);
    const placement = prepareModelAsset(asset, context.policy);
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
    const playback = createModelPlayback(asset.scene, asset.animations, context.policy.clock, id);
    acquired.push(() => playback.dispose());
    let current = declaration, driver: ModelStageDriver = MODEL_STAGE_DRIVER.host;
    let presentation: ModelPreviewEntity | undefined;
    // The host state of a declaration: where the actor stands and what it plays.
    const prepareHost = (next: ModelStageActor): ModelStageCommit => {
      const animation = playback.prepareAnimation(next.animation);
      return () => {
        animation();
        applyModelTransform(placement, {...IDENTITY_PLACEMENT, ...next.placement});
        current = next;
      };
    };
    prepareHost(declaration)();
    context.scene.add(placement, rig.root, ...markers.map(({marker}) => marker));
    return {
      id, asset, placement, markers, rig, playback, materials, prepareHost,
      get declaration() {return current;},
      get driver() {return driver;},
      get presentation() {return presentation;},
      // Everything that can refuse runs here; the returned commit only applies.
      prepare(entity: ModelPreviewEntity): ModelStageCommit {
        if (materials.snapshot().materialMode !== 'lit') throw new ModelStageRefusal(MODEL_ACTOR_TEXT.unlit);
        return prepareWhole([
          ...(runtimeMaterials ? [() => runtimeMaterials.prepare(entity.materials)] : []),
          () => playback.prepareLayers(entity.animationLayers),
          modelStageCommit(() => {
            applyModelTransform(placement, entity.pose);
            presentation = entity;
            driver = MODEL_STAGE_DRIVER.engine;
            if (rig.display === 'rig') rig.setDisplay('rig');
          }),
        ]);
      },
      snapshot(): ModelStageActorSnapshot {
        const {animation, samples} = playback.review();
        return Object.freeze({id, modelId: source.id, driver, animation, samples,
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

// Validate the frame and prepare every named actor before any commits: a refusal leaves every actor as it was. An
// actor the frame does not name keeps what it shows.
export function applyModelFrame(actors: readonly ModelActor[], value: unknown) {
  const accepted = modelPreviewFrame(value, actors.map(actor => actor.declaration));
  const named = new Map(accepted.entities.map(entity => [entity.entityId, entity]));
  prepareWhole(actors.flatMap(actor => {
    const entity = named.get(actor.id);
    return entity ? [() => actor.prepare(entity)] : [];
  }))();
  return accepted.simulationTimeSeconds;
}
