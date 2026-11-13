import type * as THREE from 'three';
import type {ModelStageCamera} from './model.ts';
import type {ModelStageLighting} from './lightingModel.ts';
import {createModelEnvironment} from './environment.ts';
import type {ModelActor} from './actor.ts';
import {MODEL_ACTOR_TEXT} from './actor.ts';
import {MODEL_STAGE_DRIVER} from './actorModel.ts';
import type {ModelStageDescription, ModelStageDescriptionPart} from './descriptionModel.ts';
import {modelStageCommit, type ModelStagePrepare} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';

export const MODEL_STAGE_PART_TEXT = Object.freeze({
  inspection: (id: string) => `Actor ${id} does not support material inspection.`,
});
// What the stage-wide parts apply to: the scene, its lighting and its camera framing.
export interface ModelStageSurface {
  readonly scene: THREE.Object3D;
  readonly lighting: {set(value: ModelStageLighting): void};
  setCamera(value: ModelStageCamera): void;
  resetCamera(): void;
}

// The prepares of every part a description changes, beside the actors' own. Each part keeps its one applier.
export function createModelStageParts(surface: ModelStageSurface) {
  let environment: ReturnType<typeof createModelEnvironment> | undefined;
  // The described camera: a held pose, or the fit of the focused actor.
  const frame = (camera: ModelStageCamera | null) => camera ? surface.setCamera(camera) : surface.resetCamera();
  // The display and the surface are per actor: an actor that already shows the described one is left as it is. A
  // display change re-applies nothing: the actor computes each renderable's visibility from it and the engine's record.
  const display = (next: ModelStageDescription, actors: readonly ModelActor[]): ModelStagePrepare[] => {
    const changing = actors.filter(actor => actor.rig.display !== next.display);
    if (!changing.length) return [];
    return [modelStageCommit(() => {for (const actor of changing) actor.setDisplay(next.display);})];
  };
  const size = (next: ModelStageDescription, actors: readonly ModelActor[]): ModelStagePrepare[] => {
    const changing = actors.filter(actor => JSON.stringify(actor.size) !== JSON.stringify(next.size));
    return changing.length ? [modelStageCommit(() => {for (const actor of changing) actor.setSize(next.size);})] : [];
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
    const created = value === null ? undefined : createModelEnvironment(value);
    environment?.dispose();
    environment = created;
    if (created) surface.scene.add(created.group);
  });
  const stageWide: Record<Exclude<ModelStageDescriptionPart, 'actors' | 'display' | 'materialMode' | 'size'>,
    (next: ModelStageDescription) => ModelStagePrepare> = {
    environment: next => scenery(next.environment),
    lighting: next => modelStageCommit(() => surface.lighting.set(next.lighting)),
    camera: next => modelStageCommit(() => frame(next.camera)),
  };
  return {
    prepares(next: ModelStageDescription, changed: ReadonlySet<ModelStageDescriptionPart>,
      actors: readonly ModelActor[]): ModelStagePrepare[] {
      const parts = (Object.keys(stageWide) as Array<keyof typeof stageWide>).filter(part => changed.has(part));
      return [...display(next, actors), ...size(next, actors), ...materialMode(next, actors),
        ...parts.map(part => stageWide[part](next))];
    },
    // The person orbited the view: return it to the described camera, the held pose or a fresh fit.
    resetCamera: (applied: ModelStageDescription) => frame(applied.camera),
    dispose() {environment?.dispose(); environment = undefined;},
  };
}
