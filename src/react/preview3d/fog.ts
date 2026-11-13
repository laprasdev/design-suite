import * as THREE from 'three';
import type {ModelColor} from './colorModel.ts';
import type {ModelStageFog} from './lookModel.ts';
import {replaceModelShader, type ModelShader, type ModelShaderChange} from './shading.ts';

// The stage's fog rule, stated once. Every term is a field of a look's fog (lookModel.ts); depth is the fragment's
// distance along the view, as three's own fog measures it, and y its world height:
//   distance = smoothstep(near.distance, far.distance, depth)
//   colour   = mix(near.color, far.color, distance)
//   layer    = height.strength * (1 - smoothstep(height.base, height.top, y)) * smoothstep(0, near.distance, depth)
//   amount   = distance + layer * (1 - distance), the same as 1 - (1 - distance) * (1 - layer)
//   result   = mix(surface, colour, amount)
// The fog is mixed where three mixes its own, last: after tone mapping and the output conversion when the stage
// draws straight to the canvas. Every line the change adds sits inside USE_FOG, so with no fog in the look a program
// compiles to three's own.
const CHUNK = Object.freeze({parsVertex: '#include <fog_pars_vertex>', vertex: '#include <fog_vertex>',
  parsFragment: '#include <fog_pars_fragment>', fragment: '#include <fog_fragment>'});
const FOG_CHANGE = 'model-stage-fog';
const UNIFORM = Object.freeze({far: 'modelStageFogFar', height: 'modelStageFogHeight'});
const HEIGHT_VARYING = 'vModelStageFogY';
// No height layer: a strength of 0 makes the layer exactly 0, so the amount is the distance term; the base and top
// only keep smoothstep defined.
const NO_HEIGHT = Object.freeze({base: 0, top: 1, strength: 0});
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
  gl_FragColor.rgb = mix( gl_FragColor.rgb, mix( fogColor, ${UNIFORM.far}, modelStageFogDistance ),
    modelStageFogDistance + modelStageFogLayer * ( 1.0 - modelStageFogDistance ) );
#endif`;
const srgb = (target: THREE.Color, value: ModelColor) => target.setRGB(value[0], value[1], value[2],
  THREE.SRGBColorSpace);

/**
 * The scene's fog: one three.js Fog, which the scene holds while the look has fog (three checks it by identity, so it
 * is never replaced), carrying the near colour and both distances; and two shared uniforms, the far colour and the
 * height layer, read by every program the change was given to. A changed value is written in place; only fog arriving
 * or leaving recompiles the programs that take it, once.
 */
export function createModelFog(scene: THREE.Scene, outputSpace: string) {
  const fog = new THREE.Fog(0, NO_HEIGHT.top, NO_HEIGHT.top + 1);
  const far = new THREE.Color();
  const uniforms = {[UNIFORM.far]: {value: new THREE.Color()}, [UNIFORM.height]: {value: new THREE.Vector3()}};
  let space = outputSpace;
  const change: ModelShaderChange = {key: FOG_CHANGE, apply: (shader: ModelShader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = replaceModelShader(replaceModelShader(shader.vertexShader, CHUNK.parsVertex,
      `${CHUNK.parsVertex}\n#ifdef USE_FOG\nvarying float ${HEIGHT_VARYING};\n#endif`, FOG_CHANGE),
    CHUNK.vertex, `${CHUNK.vertex}${VERTEX}`, FOG_CHANGE);
    shader.fragmentShader = replaceModelShader(replaceModelShader(shader.fragmentShader, CHUNK.parsFragment,
      `${CHUNK.parsFragment}\n#ifdef USE_FOG\nuniform vec3 ${UNIFORM.far};\nuniform vec3 ${UNIFORM.height};\n` +
      `varying float ${HEIGHT_VARYING};\n#endif`, FOG_CHANGE), CHUNK.fragment, FRAGMENT, FOG_CHANGE);
  }};
  return {
    /** The change every material that takes the stage's fog is extended with. */
    change,
    set(value: ModelStageFog | null) {
      scene.fog = value === null ? null : fog;
      if (value === null) return;
      srgb(fog.color, value.near.color);
      fog.near = value.near.distance;
      fog.far = value.far.distance;
      srgb(far, value.far.color).getRGB(uniforms[UNIFORM.far].value, space);
      const height = value.height ?? NO_HEIGHT;
      uniforms[UNIFORM.height].value.set(height.base, height.top, height.strength);
    },
    /**
     * The space the frame's fog is mixed in, as three's own fog colour is: the canvas's output space when the stage
     * draws straight to it, linear when it draws into a render target.
     */
    encode(value: string) {
      space = value;
      far.getRGB(uniforms[UNIFORM.far].value, space);
    },
  };
}
export type ModelFog = ReturnType<typeof createModelFog>;
