import * as THREE from 'three';
import {writeModelColor} from './color.ts';
import type {ModelStageLook} from './lookModel.ts';
import {modelShaderUniforms} from './shading.ts';

// What the stage shares with every kind's program, under names only the stage writes. Each uniform is one object,
// placed into every kind material by reference (never cloned), so one write reaches every program. The stage's numbers
// live in one typed array made here (the frame loop writes decorative time there every frame, where no number is
// boxed), read by a kind under their own names.
export const MODEL_STAGE_SHARED = Object.freeze({
  /** Decorative time, in seconds: it moves with the page's clock and holds under reduced motion and on a hidden page,
   * on either of the stage's clocks. It is never the game's time: a kind uses it for decoration only, and anything the
   * game decides reaches a kind as an engine value. */
  seconds: 'stageDecorativeSeconds',
  /** Where the time in force sits between day (0) and night (1): the look's `night`. */
  night: 'stageNight',
  /** The time in force's shadow colour, linear: the look's `shadow`, its one owner. */
  shadow: 'stageShadow',
});
/** The uniforms that carry them: the numbers in one vec2 (seconds in x, night in y), the shadow colour on its own. */
export const MODEL_STAGE_SHARED_UNIFORM = Object.freeze({numbers: 'stageNumbers', shadow: MODEL_STAGE_SHARED.shadow});
const NUMBER = Object.freeze({seconds: 0, night: 1});

export function createModelStageSharedValues() {
  const numbers = new Float32Array(Object.keys(NUMBER).length);
  const uniforms = Object.freeze({[MODEL_STAGE_SHARED_UNIFORM.numbers]: {value: numbers},
    [MODEL_STAGE_SHARED_UNIFORM.shadow]: {value: new THREE.Color()}});
  return {
    uniforms,
    /** Their GLSL declarations, as a kind's program reads them. */
    declarations: [modelShaderUniforms({[MODEL_STAGE_SHARED_UNIFORM.numbers]: 'vec2',
      [MODEL_STAGE_SHARED_UNIFORM.shadow]: 'vec3'}),
    `#define ${MODEL_STAGE_SHARED.seconds} ${MODEL_STAGE_SHARED_UNIFORM.numbers}.x`,
    `#define ${MODEL_STAGE_SHARED.night} ${MODEL_STAGE_SHARED_UNIFORM.numbers}.y`].join('\n'),
    /** The look in force's night and shadow. */
    setLook(look: Pick<ModelStageLook, 'night' | 'shadow'>) {
      numbers[NUMBER.night] = look.night;
      writeModelColor(uniforms[MODEL_STAGE_SHARED_UNIFORM.shadow].value, look.shadow);
    },
    /** The numbers the frame loop writes decorative time into, at `secondsAt`. */
    numbers,
    secondsAt: NUMBER.seconds,
  };
}
export type ModelStageSharedValues = ReturnType<typeof createModelStageSharedValues>;
