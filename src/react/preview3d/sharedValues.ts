import * as THREE from 'three';
import {writeModelColor} from './color.ts';
import type {ModelStageLook} from './lookModel.ts';
import {modelShaderUniforms} from './shading.ts';

// What the stage shares with every kind's program, under names only the stage writes. Each uniform is one object,
// placed into every kind material by reference (never cloned), so one write reaches every program. The stage's numbers
// live in one typed array made here (the frame loop writes decorative time there every frame, where no number is
// boxed), read by a kind under their own names. The look's light is written when a look is, never per frame: a kind of
// its own lighting (an unlit toon ramp) reads it here, in the stage's space, world space (metres, Y up), and in three's
// units, the very values three hands its own lit programs for the key (directionalLights[0]) and the ambient
// (hemisphereLights[0]), which are view space there.
export const MODEL_STAGE_SHARED = Object.freeze({
  /** Decorative time, in seconds: it moves with the page's clock and holds under reduced motion and on a hidden page,
   * on either of the stage's clocks. It is never the game's time: a kind uses it for decoration only, and anything the
   * game decides reaches a kind as an engine value. */
  seconds: 'stageDecorativeSeconds',
  /** Where the time in force sits between day (0) and night (1): the look's `night`. */
  night: 'stageNight',
  /** The time in force's shadow colour, linear: the look's `shadow`, its one owner. */
  shadow: 'stageShadow',
  /** The unit direction from the scene toward the key light, in world space: the look's `key.direction`. */
  keyDirection: 'stageKeyDirection',
  /** The key light's colour times its strength, linear: what three's key light gives a surface facing it. */
  keyColor: 'stageKeyColor',
  /** The ambient's colour from the sky (+Y) and from the ground (-Y), each times its strength, linear. */
  ambientSky: 'stageAmbientSky',
  ambientGround: 'stageAmbientGround',
});
/** The uniforms that carry them: the numbers in one vec2 (seconds in x, night in y), each colour and the direction on
 * its own. */
export const MODEL_STAGE_SHARED_UNIFORM = Object.freeze({numbers: 'stageNumbers', shadow: MODEL_STAGE_SHARED.shadow,
  keyDirection: MODEL_STAGE_SHARED.keyDirection, keyColor: MODEL_STAGE_SHARED.keyColor,
  ambientSky: MODEL_STAGE_SHARED.ambientSky, ambientGround: MODEL_STAGE_SHARED.ambientGround});
const NUMBER = Object.freeze({seconds: 0, night: 1});
const U = MODEL_STAGE_SHARED_UNIFORM;

export function createModelStageSharedValues() {
  const numbers = new Float32Array(Object.keys(NUMBER).length);
  const uniforms = Object.freeze({[U.numbers]: {value: numbers}, [U.shadow]: {value: new THREE.Color()},
    [U.keyDirection]: {value: new THREE.Vector3()}, [U.keyColor]: {value: new THREE.Color()},
    [U.ambientSky]: {value: new THREE.Color()}, [U.ambientGround]: {value: new THREE.Color()}});
  return {
    uniforms,
    /** Their GLSL declarations, as a kind's program reads them. */
    declarations: [modelShaderUniforms({[U.numbers]: 'vec2', [U.shadow]: 'vec3', [U.keyDirection]: 'vec3',
      [U.keyColor]: 'vec3', [U.ambientSky]: 'vec3', [U.ambientGround]: 'vec3'}),
    `#define ${MODEL_STAGE_SHARED.seconds} ${U.numbers}.x`, `#define ${MODEL_STAGE_SHARED.night} ${U.numbers}.y`]
      .join('\n'),
    /** The look in force's night, shadow and light. */
    setLook(look: Pick<ModelStageLook, 'night' | 'shadow' | 'key' | 'ambient'>) {
      numbers[NUMBER.night] = look.night;
      writeModelColor(uniforms[U.shadow].value, look.shadow);
      uniforms[U.keyDirection].value.fromArray(look.key.direction).normalize();
      writeModelColor(uniforms[U.keyColor].value, look.key.color).multiplyScalar(look.key.strength);
      writeModelColor(uniforms[U.ambientSky].value, look.ambient.sky).multiplyScalar(look.ambient.strength);
      writeModelColor(uniforms[U.ambientGround].value, look.ambient.ground).multiplyScalar(look.ambient.strength);
    },
    /** The numbers the frame loop writes decorative time into, at `secondsAt`. */
    numbers,
    secondsAt: NUMBER.seconds,
  };
}
export type ModelStageSharedValues = ReturnType<typeof createModelStageSharedValues>;
