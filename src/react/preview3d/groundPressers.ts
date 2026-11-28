import {isFiniteNumber} from '../../valueChecks.ts';
import type {ModelVector} from './placementModel.ts';
import {modelRecord} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_SURFACE_GLSL} from './surfaceGlsl.ts';

// What stands on the ground and how far round it presses: the engine states it on a frame entity as `presser`, its
// radius in world metres, pressing at the entity's pose position. The stage decides none of it; it carries every
// presser of the applied frame, in the frame's entity order, to each kind that reads them (`sceneReads: ['pressers']`),
// as one vec4 each (the position in xyz, the radius in w) and their count, in both of a kind's stages. A frame that
// states more than the budget carries is refused by name before anything of it applies.
export const MODEL_GROUND_PRESSERS = Object.freeze({pressers: 'stageGroundPressers', count: 'stageGroundPresserCount'});
/** The most pressers the stage carries at once: a placeholder until measured on the stage. */
export const MODEL_GROUND_PRESSER_BUDGET = Object.freeze({pressers: 16});
const PRESSER_FIELDS = Object.freeze(['radius']);
const VEC4 = 4;
/** What one entity presses with. */
export interface ModelGroundPresser {
  readonly radius: number;
}
/** An entity's stated pressing, at its pose position. */
export interface ModelPressingEntity {
  readonly pose: {readonly position: ModelVector};
  readonly presser: ModelGroundPresser | null;
}
export const MODEL_GROUND_PRESSER_REFUSAL = Object.freeze({
  radius: (where: string) => `${where}.radius must be a finite number above 0, in world metres.`,
  budget: (stated: number) => `The frame states ${stated} ground pressers; the stage's ground presser budget ` +
    `carries ${MODEL_GROUND_PRESSER_BUDGET.pressers}.`,
});

/** An entity's `presser`, checked whole. */
export function modelGroundPresser(value: unknown, where: string): ModelGroundPresser {
  const {radius} = modelRecord(value, PRESSER_FIELDS, where);
  if (!isFiniteNumber(radius) || radius <= 0) throw new ModelStageRefusal(MODEL_GROUND_PRESSER_REFUSAL.radius(where));
  return Object.freeze({radius});
}

/** Refuses a frame whose entities state more pressers than the budget carries. Allocates nothing. */
export function checkModelGroundPresserBudget(entities: readonly ModelPressingEntity[]) {
  let stated = 0;
  for (let index = 0; index < entities.length; index++) if (entities[index].presser !== null) stated++;
  if (stated > MODEL_GROUND_PRESSER_BUDGET.pressers) {
    throw new ModelStageRefusal(MODEL_GROUND_PRESSER_REFUSAL.budget(stated));
  }
}

const {pressers, count} = MODEL_GROUND_PRESSERS, {presserCount, presser} = MODEL_SURFACE_GLSL;
/** What a kind that reads the pressers declares, in both stages: `kindPresserCount()`, how many the applied frame
 * states, and `kindPresser( index )`, one of them below that count, its world position in xyz and its radius in w. */
export const MODEL_GROUND_PRESSER_READ = [`uniform vec4 ${pressers}[ ${MODEL_GROUND_PRESSER_BUDGET.pressers} ];`,
  `uniform int ${count};`, `int ${presserCount}() { return ${count}; }`,
  `vec4 ${presser}( int index ) { return ${pressers}[ index ]; }`].join('\n');

/** The uniforms that carry them, placed by reference into every kind material (sharedValues.ts), and their writer. */
export function createModelGroundPressers() {
  const values = new Float32Array(MODEL_GROUND_PRESSER_BUDGET.pressers * VEC4), stated = {value: 0};
  return Object.freeze({
    uniforms: Object.freeze({[pressers]: {value: values}, [count]: stated}),
    /** Writes the pressers of a frame whose budget was checked. Allocates nothing. */
    write(entities: readonly ModelPressingEntity[]) {
      let written = 0;
      for (let index = 0; index < entities.length; index++) {
        const {pose: {position}, presser: pressing} = entities[index];
        if (pressing === null) continue;
        const at = written++ * VEC4;
        values[at] = position[0];
        values[at + 1] = position[1];
        values[at + 2] = position[2];
        values[at + 3] = pressing.radius;
      }
      stated.value = written;
    },
  });
}
export type ModelGroundPressers = ReturnType<typeof createModelGroundPressers>;
