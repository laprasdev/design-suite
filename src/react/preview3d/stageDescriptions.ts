import type * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {ModelStageTheme} from './model.ts';
import type {ModelStagePolicy} from './stageOptionsModel.ts';
import {createModelActor, type ModelActor, type ModelActorContext} from './actor.ts';
import {createModelActorSet} from './actorSet.ts';
import {modelAssetDigest} from './actorModel.ts';
import {modelFrameScope, type ModelFrameScope} from './frameModel.ts';
import {modelStageDescription, modelStageDescriptionChanges, modelStageFramed, modelStageRefit,
  type ModelStageDescription} from './descriptionModel.ts';
import {createModelStageParts, type ModelStageSurface} from './stageParts.ts';
import {modelStageChanges, type ModelSurfaceModes} from './materials.ts';
import {createModelTextures, type ModelImageDecoder} from './textures.ts';
import type {ModelFileReader} from './files.ts';
import {createModelSurfaceMaterials} from './surfaceMaterials.ts';
import type {ModelStageSharedValues} from './sharedValues.ts';
import {prepareWhole} from './commit.ts';

// Before a description is shown no actor is declared, so a frame may name none.
const NO_ACTORS: ModelFrameScope = Object.freeze({actors: [], takes: new Map()});
/** What the descriptions are applied to: the stage's scene side (scene.ts), as far as a description reaches it. */
export interface ModelStageScenePart extends Pick<ModelStageSurface, 'scene' | 'fog' | 'frame'> {
  readonly lighting: ModelStageSurface['lighting'] & ModelActorContext['lighting'];
  readonly shared: ModelStageSharedValues;
  /** Compiles what drawing an object needs, inside the staged build (draw.ts). */
  readonly compile: (object: THREE.Object3D) => void;
  requestFit(): void;
}
export interface ModelStageDescriptionsContext {
  readonly policy: ModelStagePolicy;
  readonly theme: ModelStageTheme;
  readonly stage: ModelStageScenePart;
  readonly modes: ModelSurfaceModes;
  /** The one loader of an actor's file (asset.ts), its read verified against the digest the description states. */
  readonly load: (path: string, sha256: string | undefined, signal: AbortSignal) => Promise<GLTF>;
  /** The one read of every other file a description names (files.ts), and the decoder of its images. */
  readonly read: ModelFileReader;
  readonly decode: ModelImageDecoder;
}

/**
 * Everything a stage holds for its descriptions, with no renderer of its own: the registries of what they name (their
 * textures and kinds' materials, shared by every actor), the declared actors, the stage-wide parts, and the one way a
 * description is applied, whole or refused, after everything it needs has loaded.
 */
export function createModelStageDescriptions(context: ModelStageDescriptionsContext) {
  const {policy, stage, modes} = context;
  const textures = createModelTextures(context.read, context.decode);
  const changes = modelStageChanges(stage.fog.change, modes);
  const materials = createModelSurfaceMaterials({kinds: policy.kinds, read: context.read, textures,
    shared: stage.shared, changes});
  const actorContext: ModelActorContext = {policy, theme: context.theme, scene: stage.scene, lighting: stage.lighting,
    changes, surfaceModes: modes, surfaces: {materials, kinds: policy.kinds, compile: stage.compile}};
  const actors = createModelActorSet((declaration, signal) => context.load(declaration.asset.path,
    modelAssetDigest(declaration), signal), (asset, declaration) => createModelActor(asset, declaration, actorContext));
  const parts = createModelStageParts({...stage, kinds: policy.kinds, modes, textures, materials});
  let applied: ModelStageDescription | undefined, scope = NO_ACTORS;
  // The actors the framing fits, taken when a description is shown.
  let framed: readonly ModelActor[] = [];
  return {
    actors, parts,
    /** The description in force; none before the first is shown. */
    get applied() {return applied;},
    /** What a frame is checked against: the description in force's actors and what their renderers take. */
    get scope() {return scope;},
    get framed() {return framed;},
    /** A description, checked whole at once, then applied when what it needs has loaded (actorSet.ts). */
    set(value: unknown): Promise<void> {
      const next = modelStageDescription(value);
      return actors.replace(next.actors, parts.loads(next), staged => {
        const changed = modelStageDescriptionChanges(applied, next), refit = modelStageRefit(applied, next);
        prepareWhole([staged.prepare, ...parts.prepares(next, changed, staged.actors)])();
        applied = next;
        scope = modelFrameScope(next, policy.kinds);
        parts.keep(next);
        const ids = new Set(modelStageFramed(next).map(({id}) => id));
        framed = staged.actors.filter(actor => ids.has(actor.id));
        if (refit) stage.requestFit();
      });
    },
    dispose() {
      actors.dispose();
      parts.dispose();
      materials.dispose();
      textures.dispose();
    },
  };
}
export type ModelStageDescriptions = ReturnType<typeof createModelStageDescriptions>;
