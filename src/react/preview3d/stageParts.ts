import type * as THREE from 'three';
import type {ModelStageLighting} from './lightingModel.ts';
import {createModelEnvironment} from './environment.ts';
import type {ModelActor, ModelActorSizing} from './actor.ts';
import type {ModelStageFraming} from './framingModel.ts';
import {MODEL_ACTOR_TEXT} from './actor.ts';
import {MODEL_STAGE_DRIVER} from './actorModel.ts';
import type {ModelStageDescription, ModelStageDescriptionPart} from './descriptionModel.ts';
import {modelStageCommit, type ModelStageCommit, type ModelStagePrepare} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelShaderChange} from './shading.ts';
import {MODEL_ACTOR_SURFACES, modelSurfaceRecordsFit} from './surfaceModel.ts';
import type {ModelSurfaceKind} from './surfaceKindModel.ts';
import {modelSurfaceSetCovers} from './renderers.ts';
import type {ModelSurfaceModes} from './materials.ts';

export const MODEL_STAGE_PART_TEXT = Object.freeze({
  inspection: (id: string) => `Actor ${id} does not support material inspection.`,
  undrawn: (where: string, kind: string) => `${where}: the stage cannot draw kind ${kind} yet.`,
});
// What the stage-wide parts apply to: the scene, its lighting, the fog its scenery takes and its camera framing.
export interface ModelStageSurface {
  readonly scene: THREE.Object3D;
  readonly lighting: {
    load(value: ModelStageLighting): readonly Promise<void>[];
    prepare(value: ModelStageLighting): ModelStageCommit;
  };
  readonly fog: {readonly change: ModelShaderChange};
  /** The surface kinds the stage was given, by id. */
  readonly kinds: ReadonlyMap<string, ModelSurfaceKind>;
  /** The stage's one Surface mode, which every actor shows. */
  readonly modes: Pick<ModelSurfaceModes, 'mode' | 'set'>;
  frame(framing: ModelStageFraming, orbit: boolean): void;
}

// The prepares of every part a description changes, beside the actors' own. Each part keeps its one applier.
export function createModelStageParts(surface: ModelStageSurface) {
  let environment: ReturnType<typeof createModelEnvironment> | undefined;
  // The described framing and whether the person may orbit, applied as one.
  const frame = (next: ModelStageDescription) => surface.frame(next.framing, next.orbit);
  // The display and the surface are per actor: an actor that already shows the described one is left as it is. A
  // display change re-applies nothing: the actor computes each renderable's visibility from it and the engine's record.
  const display = (next: ModelStageDescription, actors: readonly ModelActor[]): ModelStagePrepare[] => {
    const changing = actors.filter(actor => actor.rig.display !== next.display);
    if (!changing.length) return [];
    return [modelStageCommit(() => {for (const actor of changing) actor.setDisplay(next.display);})];
  };
  const sizing = (next: ModelStageDescription, actors: readonly ModelActor[]): ModelStagePrepare[] => {
    const value: ModelActorSizing = Object.freeze({size: next.size, origin: next.origin});
    const changing = actors.filter(actor => JSON.stringify(actor.sizing) !== JSON.stringify(value));
    return changing.length ? [modelStageCommit(() => {for (const actor of changing) actor.setSizing(value);})] : [];
  };
  // The Surface mode is the stage's, shown by every actor alike. A mode other than Lit is refused while an engine
  // drives an actor, and for any actor whose materials cannot show it, including one the description adds.
  const materialMode = (next: ModelStageDescription, actors: readonly ModelActor[]): ModelStagePrepare[] => {
    if (next.materialMode === 'lit' && surface.modes.mode === 'lit') return [];
    return [() => {
      if (next.materialMode !== 'lit' && actors.some(actor => actor.driver === MODEL_STAGE_DRIVER.engine)) {
        throw new ModelStageRefusal(MODEL_ACTOR_TEXT.unlit);
      }
      const lacking = next.materialMode === 'lit' ? undefined : actors.find(actor => !actor.materials.available);
      if (lacking) throw new ModelStageRefusal(MODEL_STAGE_PART_TEXT.inspection(lacking.id));
      return () => {
        if (surface.modes.mode === next.materialMode) return;
        surface.modes.set(next.materialMode);
        for (const actor of actors) actor.materials.refresh();
      };
    }];
  };
  // Every record fits its kind, and every actor drawn from a set has exactly its file's renderers in it. Until the
  // stage builds kind materials (step 5d), a record of a supplied kind is refused by name.
  const surfaces = (next: ModelStageDescription, changed: ReadonlySet<ModelStageDescriptionPart>,
    actors: readonly ModelActor[]): ModelStagePrepare[] => {
    if (!changed.has('surfaceSets') && !changed.has('actors')) return [];
    return [() => {
      modelSurfaceRecordsFit(next.surfaceSets, surface.kinds);
      for (const [name, set] of Object.entries(next.surfaceSets)) for (const [id, entry] of Object.entries(set)) {
        if ('values' in entry) {
          throw new ModelStageRefusal(MODEL_STAGE_PART_TEXT.undrawn(`Surface set ${name}, renderer ${id}`, entry.kind));
        }
      }
      next.actors.actors.forEach((declared, index) => {
        if (declared.surfaces.kind !== MODEL_ACTOR_SURFACES.set) return;
        modelSurfaceSetCovers(declared.id, declared.surfaces.set, next.surfaceSets[declared.surfaces.set],
          actors[index].renderers());
      });
      return () => undefined;
    }];
  };
  const scenery = (value: ModelStageDescription['environment']) => modelStageCommit(() => {
    if (value !== null && environment?.update(value)) return;
    const created = value === null ? undefined : createModelEnvironment(value, surface.fog.change);
    environment?.dispose();
    environment = created;
    if (created) surface.scene.add(created.group);
  });
  const stageWide: Record<Exclude<ModelStageDescriptionPart,
    'actors' | 'display' | 'materialMode' | 'size' | 'origin' | 'surfaceSets'>,
    (next: ModelStageDescription) => ModelStagePrepare> = {
    environment: next => scenery(next.environment),
    lighting: next => () => surface.lighting.prepare(next.lighting),
    framing: next => modelStageCommit(() => frame(next)),
    orbit: next => modelStageCommit(() => frame(next)),
  };
  return {
    /** What a description needs loaded before its parts can be prepared, beside its actors' models. */
    loads: (next: ModelStageDescription) => surface.lighting.load(next.lighting),
    prepares(next: ModelStageDescription, changed: ReadonlySet<ModelStageDescriptionPart>,
      actors: readonly ModelActor[]): ModelStagePrepare[] {
      const parts = (Object.keys(stageWide) as Array<keyof typeof stageWide>).filter(part => changed.has(part));
      return [...surfaces(next, changed, actors), ...display(next, actors), ...sizing(next, actors),
        ...materialMode(next, actors),
        ...parts.map(part => stageWide[part](next))];
    },
    // The person orbited the view: return it to the described framing, the held pose or a fresh fit.
    resetCamera: frame,
    dispose() {environment?.dispose(); environment = undefined;},
  };
}
