import * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {ModelStageDisplay, ModelStagePolicy, ModelStageTheme} from './model.ts';
import {MODEL_STAGE_ORIGIN, MODEL_STAGE_SIZE, type ModelStageOrigin, type ModelStageSize} from './sizeModel.ts';
import {applyModelTransform, disposeModelObject, modelObjectBounds, modelParts, prepareModelAsset}
  from './asset.ts';
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
/** How an actor's model sits in its placement: the stage's size rule and origin. */
export interface ModelActorSizing {readonly size: ModelStageSize; readonly origin: ModelStageOrigin}
export const MODEL_ACTOR_TEXT = Object.freeze({unlit: 'Runtime presentation requires lit materials.'});
/** A renderable's one visible value: authored, not hidden by the Rig display, and not hidden by the engine. */
export const modelRenderableVisible = (authored: boolean, display: ModelStageDisplay, engineHidden: boolean) =>
  authored && display !== 'rig' && !engineHidden;

// One loaded model and every owner it composes. Every actor is built alike; its declaration is applied through the
// same prepare a later declaration uses.
export function createModelActor(asset: GLTF, declaration: ModelStageActor, context: ModelActorContext) {
  const {id, asset: source} = declaration, acquired: Array<() => void> = [];
  const release = () => {for (const dispose of acquired.splice(0).reverse()) dispose();};
  try {
    acquired.push(() => {asset.scene.parent?.removeFromParent(); disposeModelObject(asset.scene);});
    const profile = modelRuntimeAssetProfile(declaration);
    const {placement, size: sized} = prepareModelAsset(asset);
    const points = modelParts(asset, context.theme);
    acquired.push(() => points.forEach(({marker}) => {marker.removeFromParent(); disposeModelObject(marker);}));
    asset.scene.traverse(node => {if (node instanceof THREE.Mesh) node.onAfterRender = () => context.rendered(node);});
    const materials = createModelMaterialInspection(asset.scene);
    acquired.push(() => materials.dispose());
    const runtimeMaterials = profile ? bindModelRuntimeMaterials(asset, profile) : undefined;
    if (runtimeMaterials) acquired.push(() => runtimeMaterials.dispose());
    const rig = createModelRig(asset.scene, context.theme, points);
    acquired.push(() => {rig.root.removeFromParent(); disposeModelObject(rig.root);});
    acquired.push(context.lighting.attach([rig.root, ...points.map(({marker}) => marker)]));
    const playback = createModelPlayback(asset.scene, asset.animations, context.policy.clock, id);
    acquired.push(() => playback.dispose());
    let current = declaration, driver: ModelStageDriver = MODEL_STAGE_DRIVER.host;
    // Built at its file's own size and origin; the description's size and origin apply with its other stage-wide parts.
    let sizing: ModelActorSizing = Object.freeze({size: {rule: MODEL_STAGE_SIZE.real},
      origin: MODEL_STAGE_ORIGIN.file});
    const setSizing = (value: ModelActorSizing) => {rig.setScale(sized(value.size, value.origin)); sizing = value;};
    setSizing(sizing);
    // The engine's last record of the renderers it hides; before any frame it hides none.
    let engineHidden: ReadonlySet<THREE.Object3D> = new Set();
    // The one writer of a renderable's visibility, from the person's display and the engine's record. Outputs say
    // what to hide and never override what the file itself hides.
    const showRenderables = () => {
      for (const {node, visible} of rig.renderables) {
        node.visible = modelRenderableVisible(visible, rig.display, engineHidden.has(node));
      }
    };
    // The host state of a declaration: where the actor stands and what it plays.
    const prepareHost = (next: ModelStageActor): ModelStageCommit => {
      const animation = playback.prepareAnimation(next.animation);
      return () => {
        animation();
        applyModelTransform(placement, next.placement);
        current = next;
      };
    };
    prepareHost(declaration)();
    context.scene.add(placement, rig.root, ...points.map(({marker}) => marker));
    return {
      id, asset, placement, points, rig, playback, materials, prepareHost,
      get declaration() {return current;},
      get driver() {return driver;},
      setDisplay(value: ModelStageDisplay) {rig.setDisplay(value); showRenderables();},
      get sizing() {return sizing;},
      setSizing,
      /** What the actor draws in its display: the model, its rig, or both. */
      bounds: () => rig.display === 'model' ? modelObjectBounds(placement) : rig.bounds(),
      // Everything that can refuse runs here; the returned commit only applies.
      prepare(entity: ModelPreviewEntity): ModelStageCommit {
        if (materials.snapshot().materialMode !== 'lit') throw new ModelStageRefusal(MODEL_ACTOR_TEXT.unlit);
        return prepareWhole([
          ...(runtimeMaterials ? [() => {
            const commit = runtimeMaterials.prepare(entity.materials);
            return () => {engineHidden = commit();};
          }] : []),
          () => playback.prepareLayers(entity.animationLayers),
          modelStageCommit(() => {
            applyModelTransform(placement, entity.pose);
            driver = MODEL_STAGE_DRIVER.engine;
            showRenderables();
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
