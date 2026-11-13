import type * as THREE from 'three';
import type {ModelStageLighting} from './lightingModel.ts';
import {createModelEnvironment} from './environment.ts';
import type {ModelActor, ModelActorSizing} from './actor.ts';
import type {ModelStageFraming} from './framingModel.ts';
import {MODEL_ACTOR_TEXT} from './actor.ts';
import {MODEL_STAGE_DRIVER} from './actorModel.ts';
import type {ModelStageDescription, ModelStageDescriptionPart} from './descriptionModel.ts';
import {modelStageCommit, type ModelStagePrepare} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelShaderChange} from './shading.ts';

export const MODEL_STAGE_PART_TEXT = Object.freeze({
  inspection: (id: string) => `Actor ${id} does not support material inspection.`,
});
// What the stage-wide parts apply to: the scene, its lighting, the fog its scenery takes and its camera framing.
export interface ModelStageSurface {
  readonly scene: THREE.Object3D;
  readonly lighting: {set(value: ModelStageLighting): void};
  readonly fog: {readonly change: ModelShaderChange};
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
  const materialMode = (next: ModelStageDescription, actors: readonly ModelActor[]): ModelStagePrepare[] => {
    const changing = actors.filter(actor => actor.materials.snapshot().materialMode !== next.materialMode);
    if (!changing.length) return [];
    return [() => {
      if (next.materialMode !== 'lit' && actors.some(actor => actor.driver === MODEL_STAGE_DRIVER.engine)) {
        throw new ModelStageRefusal(MODEL_ACTOR_TEXT.unlit);
      }
      const lacking = next.materialMode === 'lit' ? undefined :
        changing.find(actor => !actor.materials.snapshot().materialInspectionAvailable);
      if (lacking) throw new ModelStageRefusal(MODEL_STAGE_PART_TEXT.inspection(lacking.id));
      return () => {for (const actor of changing) actor.materials.setMode(next.materialMode);};
    }];
  };
  const scenery = (value: ModelStageDescription['environment']) => modelStageCommit(() => {
    if (value !== null && environment?.update(value)) return;
    const created = value === null ? undefined : createModelEnvironment(value, surface.fog.change);
    environment?.dispose();
    environment = created;
    if (created) surface.scene.add(created.group);
  });
  const stageWide: Record<Exclude<ModelStageDescriptionPart, 'actors' | 'display' | 'materialMode' | 'size' | 'origin'>,
    (next: ModelStageDescription) => ModelStagePrepare> = {
    environment: next => scenery(next.environment),
    lighting: next => modelStageCommit(() => surface.lighting.set(next.lighting)),
    framing: next => modelStageCommit(() => frame(next)),
    orbit: next => modelStageCommit(() => frame(next)),
  };
  return {
    prepares(next: ModelStageDescription, changed: ReadonlySet<ModelStageDescriptionPart>,
      actors: readonly ModelActor[]): ModelStagePrepare[] {
      const parts = (Object.keys(stageWide) as Array<keyof typeof stageWide>).filter(part => changed.has(part));
      return [...display(next, actors), ...sizing(next, actors), ...materialMode(next, actors),
        ...parts.map(part => stageWide[part](next))];
    },
    // The person orbited the view: return it to the described framing, the held pose or a fresh fit.
    resetCamera: frame,
    dispose() {environment?.dispose(); environment = undefined;},
  };
}
