import * as THREE from 'three';
import {writeModelColor} from './color.ts';
import type {ModelStageFog} from './lookModel.ts';
import {modelShaderChunk, modelShaderUniforms, type ModelShaderChange} from './shading.ts';

// The stage's fog rule, stated once. Every term is a field of a look's fog (lookModel.ts); depth is the fragment's
// distance along the view, as three's own fog measures it, and y its world height:
//   distance = smoothstep(near.distance, far.distance, depth)
//   colour   = mix(near.color, far.color, distance)
//   layer    = height.strength * (1 - smoothstep(height.base, height.top, y)) * smoothstep(0, near.distance, depth)
//   amount   = distance + layer * (1 - distance), the same as 1 - (1 - distance) * (1 - layer)
//   result   = mix(surface, colour, amount)
// The fog is mixed where three mixes its own, last: after tone mapping and the output conversion, so in the space of
// whatever the program draws into. three encodes its own fog colour (the near one) for that space at every render;
// the far colour is held in the working space and converted by the program's own `linearToOutputTexel`, so the two
// always agree, whatever target is bound. Every line the change adds sits inside USE_FOG, so with no fog in the look
// a program compiles to three's own.
const CHUNK = Object.freeze({parsVertex: 'fog_pars_vertex', vertex: 'fog_vertex', parsFragment: 'fog_pars_fragment',
  fragment: 'fog_fragment'});
export const MODEL_FOG_CHANGE = 'model-stage-fog';
const UNIFORM = Object.freeze({far: 'modelStageFogFar', height: 'modelStageFogHeight'});
const HEIGHT_VARYING = 'vModelStageFogY';
// A look with no height layer is drawn with a layer strength of 0, which makes the layer term exactly 0 and leaves the
// distance term alone; its base and top are any range smoothstep accepts (GLSL leaves base >= top undefined, even
// when multiplied by 0). This is the rule's own statement of "no layer", not a value standing in for missing data.
const NO_LAYER = Object.freeze({base: 0, top: 1, strength: 0});
const VERTEX = `
#ifdef USE_FOG
  vec4 modelStageFogWorld = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    modelStageFogWorld = batchingMatrix * modelStageFogWorld;
  #endif
  #ifdef USE_INSTANCING
    modelStageFogWorld = instanceMatrix * modelStageFogWorld;
  #endif
  ${HEIGHT_VARYING} = ( modelMatrix * modelStageFogWorld ).y;
#endif`;
const FRAGMENT = `
#ifdef USE_FOG
  float modelStageFogDistance = smoothstep( fogNear, fogFar, vFogDepth );
  float modelStageFogLayer = ${UNIFORM.height}.z * ( 1.0 - smoothstep( ${UNIFORM.height}.x, ${UNIFORM.height}.y,
    ${HEIGHT_VARYING} ) ) * smoothstep( 0.0, fogNear, vFogDepth );
  vec3 modelStageFogFarColor = linearToOutputTexel( vec4( ${UNIFORM.far}, 1.0 ) ).rgb;
  gl_FragColor.rgb = mix( gl_FragColor.rgb, mix( fogColor, modelStageFogFarColor, modelStageFogDistance ),
    modelStageFogDistance + modelStageFogLayer * ( 1.0 - modelStageFogDistance ) );
#endif`;
const inFog = (lines: string) => `\n#ifdef USE_FOG\n${lines}\n#endif`;

/**
 * The scene's fog: one three.js Fog, which the scene holds while the look has fog (three checks it by identity, so it
 * is never replaced), carrying the near colour and both distances; and two shared uniforms, the far colour and the
 * height layer, read by every program the change was given to. A changed value, the height layer arriving or leaving
 * included, is written in place; only fog arriving or leaving recompiles the programs that take it, once.
 */
export function createModelFog(scene: THREE.Scene) {
  // Its distances and colour are written by `set` before the scene ever holds it.
  const fog = new THREE.Fog(0);
  const uniforms = {[UNIFORM.far]: {value: new THREE.Color()}, [UNIFORM.height]: {value: new THREE.Vector3()}};
  const varying = `varying float ${HEIGHT_VARYING};`;
  const declared = modelShaderUniforms({[UNIFORM.far]: 'vec3', [UNIFORM.height]: 'vec3'});
  const change: ModelShaderChange = {key: MODEL_FOG_CHANGE, apply: (shader, replace) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = replace(replace(shader.vertexShader, CHUNK.parsVertex,
      modelShaderChunk(CHUNK.parsVertex) + inFog(varying)), CHUNK.vertex, modelShaderChunk(CHUNK.vertex) + VERTEX);
    shader.fragmentShader = replace(replace(shader.fragmentShader, CHUNK.parsFragment,
      modelShaderChunk(CHUNK.parsFragment) + inFog(`${declared}\n${varying}`)), CHUNK.fragment, FRAGMENT);
  }};
  return {
    /** The change every material that takes the stage's fog is extended with. */
    change,
    set(value: ModelStageFog | null) {
      scene.fog = value === null ? null : fog;
      if (value === null) return;
      writeModelColor(fog.color, value.near.color);
      fog.near = value.near.distance;
      fog.far = value.far.distance;
      writeModelColor(uniforms[UNIFORM.far].value, value.far.color);
      const height = value.height === null ? NO_LAYER : value.height;
      uniforms[UNIFORM.height].value.set(height.base, height.top, height.strength);
    },
  };
}
export type ModelFog = ReturnType<typeof createModelFog>;
