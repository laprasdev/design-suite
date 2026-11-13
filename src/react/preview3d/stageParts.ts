import type * as THREE from 'three';
import type {ModelStageLighting} from './lightingModel.ts';
import {createModelEnvironment} from './environment.ts';
import type {ModelActor, ModelActorSizing} from './actor.ts';
import type {ModelStageFraming} from './framingModel.ts';
import {MODEL_ACTOR_TEXT} from './actor.ts';
import {MODEL_STAGE_DRIVER} from './actorModel.ts';
import type {ModelStageDescription, ModelStageDescriptionPart} from './descriptionModel.ts';
import {modelStageCommit, prepareWhole, type ModelStageCommit, type ModelStagePrepare} from './commit.ts';
import type {ModelStagedLoad} from './fileCache.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelShaderChange} from './shading.ts';
import {modelSurfaceFiles, modelSurfaceRecords, modelSurfaceRecordsFit} from './surfaceModel.ts';
import type {ModelTextures} from './textures.ts';
import type {ModelSurfaceKind} from './surfaceKindModel.ts';
import type {ModelSurfaceModes} from './materials.ts';
import {MODEL_STAGE_SURFACE_MODE} from './surfaceModeModel.ts';
import type {ModelSurfaceMaterials} from './surfaceMaterials.ts';

export const MODEL_STAGE_PART_TEXT = Object.freeze({
  inspection: (id: string) => `Actor ${id} does not support material inspection.`,
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
  /** The textures surface records name, read in the staged load. */
  readonly textures: Pick<ModelTextures, 'load' | 'keep'>;
  /** The kinds' materials: their programs read in the staged load, and those no actor draws with freed. */
  readonly materials: Pick<ModelSurfaceMaterials, 'load' | 'sweep'>;
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
  const surfaceMode = (next: ModelStageDescription, actors: readonly ModelActor[]): ModelStagePrepare[] => {
    const lit = next.surfaceMode === MODEL_STAGE_SURFACE_MODE.lit;
    if (lit && surface.modes.mode === MODEL_STAGE_SURFACE_MODE.lit) return [];
    return [() => {
      if (!lit && actors.some(actor => actor.driver === MODEL_STAGE_DRIVER.engine)) {
        throw new ModelStageRefusal(MODEL_ACTOR_TEXT.unlit);
      }
      const lacking = lit ? undefined : actors.find(actor => !actor.materials.available);
      if (lacking) throw new ModelStageRefusal(MODEL_STAGE_PART_TEXT.inspection(lacking.id));
      return () => {
        if (surface.modes.mode === next.surfaceMode) return;
        surface.modes.set(next.surfaceMode);
        for (const actor of actors) actor.materials.refresh();
      };
    }];
  };
  // Every actor's surfaces are prepared (the records were checked against their kinds before anything loaded): a set
  // names exactly its file's renderers, and each record an actor's renderer now takes has its kind's material ready
  // and compiled on that renderer. A kept actor whose surfaces or set changed takes the change here.
  const surfaces = (next: ModelStageDescription, changed: ReadonlySet<ModelStageDescriptionPart>,
    actors: readonly ModelActor[]): ModelStagePrepare[] => {
    if (!changed.has('surfaceSets') && !changed.has('actors')) return [];
    return [() => prepareWhole(next.actors.actors.map((declared, index) =>
      () => actors[index].surfaces.prepare(declared.surfaces, next.surfaceSets)))];
  };
  const scenery = (value: ModelStageDescription['environment']) => modelStageCommit(() => {
    if (value !== null && environment?.update(value)) return;
    const created = value === null ? undefined : createModelEnvironment(value, surface.fog.change);
    environment?.dispose();
    environment = created;
    if (created) surface.scene.add(created.group);
  });
  const stageWide: Record<Exclude<ModelStageDescriptionPart,
    'actors' | 'display' | 'surfaceMode' | 'size' | 'origin' | 'surfaceSets'>,
    (next: ModelStageDescription) => ModelStagePrepare> = {
    environment: next => scenery(next.environment),
    lighting: next => () => surface.lighting.prepare(next.lighting),
    framing: next => modelStageCommit(() => frame(next)),
    orbit: next => modelStageCommit(() => frame(next)),
  };
  return {
    /**
     * What a description needs loaded before its parts can be prepared, beside its actors' models. What can be
     * refused without loading anything (every record against its kind) is refused first, so no read starts for it.
     */
    loads(next: ModelStageDescription): ModelStagedLoad {
      modelSurfaceRecordsFit(next.surfaceSets, surface.kinds);
      const records = modelSurfaceRecords(next.surfaceSets, next.actors.actors);
      const files = [surface.textures.load(modelSurfaceFiles(next.surfaceSets, next.actors.actors)),
        surface.materials.load(records)];
      return {pending: [...surface.lighting.load(next.lighting), ...files.flatMap(({pending}) => pending)],
        release() {for (const file of files) file.release();}};
    },
    /** A description is in force: the materials no actor draws with are freed, then every texture file it does not
     * name. (A kind's program, once read, is held for the stage's life: surfaceMaterials.ts.) */
    keep(next: ModelStageDescription) {
      surface.materials.sweep();
      surface.textures.keep(modelSurfaceFiles(next.surfaceSets, next.actors.actors));
    },
    prepares(next: ModelStageDescription, changed: ReadonlySet<ModelStageDescriptionPart>,
      actors: readonly ModelActor[]): ModelStagePrepare[] {
      const parts = (Object.keys(stageWide) as Array<keyof typeof stageWide>).filter(part => changed.has(part));
      return [...surfaces(next, changed, actors), ...display(next, actors), ...sizing(next, actors),
        ...surfaceMode(next, actors),
        ...parts.map(part => stageWide[part](next))];
    },
    // The person orbited the view: return it to the described framing, the held pose or a fresh fit.
    resetCamera: frame,
    dispose() {environment?.dispose(); environment = undefined;},
  };
}
