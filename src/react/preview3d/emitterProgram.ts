import * as THREE from 'three';
import type {ModelEmitterForm} from './emitterModel.ts';
import {MODEL_EMITTER_FORMS as FORMS, MODEL_EMITTER_PLACEHOLDER} from './emitterForms.ts';
import {modelShaderComponent, type ModelShaderChange, type ModelShaderReplace} from './shading.ts';
import type {ModelStageProgramValues} from './sharedValues.ts';

// The program every emitter's material is extended with (emitters.ts makes the emitters): each particle's place, size
// and colour derived from the presentation time, its slot and its seed alone, with no per-particle write.
// The points form is built on three's points program, which hands a point its size (`scale`, set by three for points
// materials); the mesh form on three's basic mesh program, which scales the mesh's own vertices by the size.
const KEY = 'emitter';

/** A profile's times uniform, by slot: when it started, when it stops or stopped, and whether it runs with no stop set
 * (no stop holds while it does; the program mixes by it, so `yes` is 1). A profile that does not loop stops itself:
 * its start sets its stop `duration` on. */
export const MODEL_EMITTER_TIMES = Object.freeze({started: 0, stopped: 1, running: 2});
export const MODEL_EMITTER_RUNNING = Object.freeze({no: 0, yes: 1});
/** A profile's spawn uniform, by slot: particles a second, its cap, and the radius of the sphere they start in. */
export const MODEL_EMITTER_SPAWN = Object.freeze({rate: 0, particles: 1, radius: 2});
const times = (slot: keyof typeof MODEL_EMITTER_TIMES) =>
  modelShaderComponent('emitterTimes', MODEL_EMITTER_TIMES[slot]);
const spawn = (slot: keyof typeof MODEL_EMITTER_SPAWN) =>
  modelShaderComponent('emitterSpawn', MODEL_EMITTER_SPAWN[slot]);

const DECLARATIONS = `attribute float emitterSlot;
uniform vec3 emitterTimes;
uniform vec3 emitterSpawn;
uniform vec2 emitterLifetime;
uniform vec2 emitterSpeed;
uniform vec2 emitterSize;
uniform vec2 emitterSizeScale;
uniform vec3 emitterLinearMin;
uniform vec3 emitterLinearMax;
uniform vec4 emitterColorMin;
uniform vec4 emitterColorMax;
varying vec4 vEmitterColor;
varying float vEmitterSize;
vec4 emitterHash( vec2 p ) {
  vec4 q = fract( p.xyxy * vec4( 0.1031, 0.1030, 0.0973, 0.1099 ) );
  q += dot( q, q.wzxy + 33.33 );
  return fract( ( q.xxyz + q.yzzw ) * q.zywx );
}`;
// A particle's second and third hashes, of its slot and cycle moved this far, so their picks follow neither its seed
// nor each other.
const PICK_OFFSET = 17, DRIFT_OFFSET = 41;
// Slot s of n at rate r was last born at start + (s + k n) / r, its latest k whose birth is not after the stop.
const SIMULATE = `float emitterPeriod = ${spawn('particles')} / ${spawn('rate')};
float emitterUntil = mix( min( stagePresentationSeconds, ${times('stopped')} ), stagePresentationSeconds,
  ${times('running')} );
float emitterCycle = floor( ( ( emitterUntil - ${times('started')} ) * ${spawn('rate')} - emitterSlot ) /
  ${spawn('particles')} );
float emitterBorn = ${times('started')} + emitterSlot / ${spawn('rate')} + emitterCycle * emitterPeriod;
float emitterAge = stagePresentationSeconds - emitterBorn;
vec4 emitterSeed = emitterHash( vec2( emitterSlot, emitterCycle ) );
vec4 emitterPick = emitterHash( vec2( emitterCycle, emitterSlot ) + ${PICK_OFFSET.toFixed(1)} );
vec4 emitterDrift = emitterHash( vec2( emitterSlot, emitterCycle ) + ${DRIFT_OFFSET.toFixed(1)} );
float emitterLife = mix( emitterLifetime.x, emitterLifetime.y, emitterSeed.x );
float emitterAlive = step( 0.0, emitterCycle ) * step( emitterAge, emitterLife );
float emitterCos = emitterSeed.y * 2.0 - 1.0, emitterTurn = emitterSeed.z * PI2;
vec3 emitterDirection = vec3( sqrt( 1.0 - emitterCos * emitterCos ) * vec2( cos( emitterTurn ), sin( emitterTurn ) ),
  emitterCos );
float emitterOut = ${spawn('radius')} * pow( emitterSeed.w, 1.0 / 3.0 ) +
  mix( emitterSpeed.x, emitterSpeed.y, emitterPick.x ) * emitterAge;
// Velocity over lifetime's linear velocity, each axis drawn by its own pick, carries it on from where its start put it.
vec3 emitterCentre = emitterDirection * emitterOut +
  mix( emitterLinearMin, emitterLinearMax, emitterDrift.xyz ) * emitterAge;
vEmitterSize = emitterAlive * mix( emitterSize.x, emitterSize.y, emitterPick.y ) *
  mix( emitterSizeScale.x, emitterSizeScale.y, emitterPick.z );
vEmitterColor = mix( emitterColorMin, emitterColorMax, emitterPick.w );`;
/** The change that makes a material of `form` draw an emitter with `uniforms`. */
export function modelEmitterProgram(form: ModelEmitterForm, uniforms: Record<string, THREE.IUniform>,
  shared: ModelStageProgramValues): ModelShaderChange {
  const {place, project} = FORMS[form];
  return {key: `${KEY}-${form}`, apply(shader, replace: ModelShaderReplace) {
    Object.assign(shader.uniforms, shared.uniforms, uniforms);
    const declared = (source: string, varying: string) => replace(source, 'common',
      `#include <common>\n${shared.declarations}\n${varying}`);
    shader.vertexShader = replace(replace(declared(shader.vertexShader, DECLARATIONS), 'begin_vertex',
      `${SIMULATE}\n${place}`), 'fog_vertex', `#include <fog_vertex>\n${project}`);
    shader.fragmentShader = replace(declared(shader.fragmentShader, 'varying vec4 vEmitterColor;'),
      'color_fragment', `#include <color_fragment>\ndiffuseColor *= vEmitterColor;\n${
        MODEL_EMITTER_PLACEHOLDER.shade[form]}`);
  }};
}
