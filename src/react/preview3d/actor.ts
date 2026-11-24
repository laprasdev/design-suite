import * as THREE from 'three';
import type {BatchedRenderer} from 'three.quarks';
import type {ModelStageDisplay, ModelStagePolicy, ModelStageTheme} from './model.ts';
import {MODEL_STAGE_DISPLAY} from './displayModel.ts';
import {MODEL_STAGE_ORIGIN, MODEL_STAGE_SIZE, type ModelStageOrigin, type ModelStageSize} from './sizeModel.ts';
import {applyModelTransform, disposeModelObject, modelObjectBounds, modelParts, prepareModelAsset}
  from './asset.ts';
import {createModelRig} from './rig.ts';
import {createModelPlayback} from './playback.ts';
import type {ModelStageChanges, ModelSurfaceModes} from './materials.ts';
import {createModelActorSurfaces, type ModelActorSurfacesContext} from './actorSurfaces.ts';
import {markModelStageAids} from './layers.ts';
import {MODEL_STAGE_DRIVER, modelActorDrawsFile, modelActorHost} from './actorModel.ts';
import type {ModelDrawn} from './drawn.ts';
import type {ModelStageActor, ModelStageActorSnapshot, ModelStageDriver} from './actorModel.ts';
import type {ModelPreviewEntity} from './presentation.ts';
import {MODEL_STAGE_UNCHANGED, type ModelStageCommit} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';
import {extendModelMaterials} from './shading.ts';
import {createModelEmitters} from './emitters.ts';
import {modelEmitterDrawing} from './emitterRecordModel.ts';
import {MODEL_NO_EMITTER_CHANGES} from './emitterFrameModel.ts';
import {MODEL_NO_EMITTERS} from './emitterModel.ts';

// What every actor shares from its stage: the policy, the theme, the scene it joins, the lighting of its aids and the
// changes its file's materials take.
export interface ModelActorContext {
  readonly policy: ModelStagePolicy;
  readonly theme: ModelStageTheme;
  readonly scene: THREE.Object3D;
  readonly lighting: {attach(objects: readonly THREE.Object3D[]): () => void};
  /** The stage's changes each of its file's materials takes: the fog, and the Surface mode where it covers one. */
  readonly changes: ModelStageChanges;
  /** The stage's Surface mode in force. */
  readonly surfaceModes: Pick<ModelSurfaceModes, 'inspecting'>;
  /** The stage's kind materials, its kinds and its compile, which the actor's surfaces draw with. */
  readonly surfaces: ModelActorSurfacesContext;
  /** The stage's batched particle renderer, which steps and draws its emitters. */
  readonly particles: BatchedRenderer;
}
/** How an actor's model sits in its placement: the stage's size rule and origin. */
export interface ModelActorSizing {readonly size: ModelStageSize; readonly origin: ModelStageOrigin}
export const MODEL_ACTOR_TEXT = Object.freeze({
  unlit: 'Runtime presentation requires lit materials.',
});
/** A renderable's one visible value: authored, not hidden by the Rig display, and not hidden by the engine. */
export const modelRenderableVisible = (authored: boolean, display: ModelStageDisplay, engineHidden: boolean) =>
  authored && display !== MODEL_STAGE_DISPLAY.rig && !engineHidden;

// What an actor draws, from either source, and every owner it composes. Every actor is built alike; its declaration
// is applied through the same prepare a later declaration uses.
export function createModelActor(drawn: ModelDrawn, declaration: ModelStageActor, context: ModelActorContext) {
  const {id} = declaration, acquired: Array<() => void> = [];
  const release = () => {for (const dispose of acquired.splice(0).reverse()) dispose();};
  try {
    acquired.push(() => {drawn.scene.parent?.removeFromParent(); disposeModelObject(drawn.scene);});
    const {placement, prepareSize} = prepareModelAsset(drawn, id);
    const points = modelParts(drawn, context.theme);
    acquired.push(() => points.forEach(({marker}) => {marker.removeFromParent(); disposeModelObject(marker);}));
    extendModelMaterials(drawn.scene, context.changes);
    const surfaces = createModelActorSurfaces(drawn, id, context.surfaces);
    acquired.push(() => surfaces.dispose());
    const runtimeMaterials = drawn.runtimeMaterials?.();
    if (runtimeMaterials) acquired.push(() => runtimeMaterials.dispose());
    const rig = createModelRig(drawn.scene, context.theme, points);
    acquired.push(() => {rig.root.removeFromParent(); disposeModelObject(rig.root);});
    acquired.push(context.lighting.attach([rig.root, ...points.map(({marker}) => marker)]));
    const playback = createModelPlayback(drawn.scene, drawn.clips, context.policy.clock, id);
    acquired.push(() => playback.dispose());
    const drawing = modelEmitterDrawing(modelActorDrawsFile(declaration) ? declaration.emitters : MODEL_NO_EMITTERS);
    const emitters = createModelEmitters(id, drawing, placement, context);
    acquired.push(() => emitters.dispose());
    let current = declaration, driver: ModelStageDriver = MODEL_STAGE_DRIVER.host;
    // Built at its file's own size and origin; the description's size and origin apply with its other stage-wide parts.
    let sizing: ModelActorSizing = Object.freeze({size: {rule: MODEL_STAGE_SIZE.real},
      origin: MODEL_STAGE_ORIGIN.file});
    const prepareSizing = (value: ModelActorSizing): ModelStageCommit => {
      const size = prepareSize(value.size, value.origin);
      return () => {rig.setScale(size()); sizing = value;};
    };
    prepareSizing(sizing)();
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
      const host = modelActorHost(next), animation = playback.prepareAnimation(host.animation);
      return () => {
        animation();
        applyModelTransform(placement, host.placement);
        current = next;
      };
    };
    prepareHost(declaration)();
    // A frame's prepared parts, written by each prepare into what the one commit made here reads, so a frame tick
    // makes no step of its own. Every prepare writes all four before its commit runs.
    const framed = {hidden: (): ReadonlySet<THREE.Object3D> => engineHidden, layers: MODEL_STAGE_UNCHANGED,
      pose: declaration.placement, emitters: emitters.prepare(MODEL_NO_EMITTER_CHANGES)};
    const commitFrame: ModelStageCommit = () => {
      engineHidden = framed.hidden();
      framed.layers();
      // The pose applies first: an emitter started in this frame starts where the frame puts its actor.
      applyModelTransform(placement, framed.pose);
      driver = MODEL_STAGE_DRIVER.engine;
      showRenderables();
      framed.emitters();
    };
    markModelStageAids([rig.root, ...points.map(({marker}) => marker)]);
    context.scene.add(placement, rig.root, ...points.map(({marker}) => marker));
    return {
      id, drawn, placement, points, rig, playback, emitters, prepareHost,
      /** What draws the file's renderers, as the description's surfaces state it. */
      surfaces,
      /** What the materials the actor draws with allow: the Surface modes, and how many emit. */
      materials: surfaces.inspection,
      get declaration() {return current;},
      get driver() {return driver;},
      setDisplay(value: ModelStageDisplay) {rig.setDisplay(value); showRenderables();},
      get sizing() {return sizing;},
      prepareSizing,
      /** What the actor draws in its display: the model, its rig, or both. */
      bounds: () => rig.display === MODEL_STAGE_DISPLAY.model ? modelObjectBounds(placement) : rig.bounds(),
      // Everything that can refuse runs here; the returned commit only applies.
      prepare(entity: ModelPreviewEntity): ModelStageCommit {
        if (context.surfaceModes.inspecting) throw new ModelStageRefusal(MODEL_ACTOR_TEXT.unlit);
        // The engine's values and visibility reach the renderers through the runtime profile when the asset states
        // one (the description refuses one beside a set; the route leaves in step 5e), else through the surfaces.
        framed.hidden = runtimeMaterials ? runtimeMaterials.prepare(entity.materials) :
          surfaces.prepareValues(entity.materials);
        framed.layers = playback.prepareLayers(entity.animationLayers);
        framed.pose = entity.pose;
        framed.emitters = emitters.prepare(entity.emitters);
        return commitFrame;
      },
      snapshot(): ModelStageActorSnapshot {
        const {animation, samples} = playback.review();
        const modelId = modelActorDrawsFile(declaration) ? declaration.asset.id : null;
        return Object.freeze({id, modelId, driver, animation, samples, skipped: drawing.skipped,
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
