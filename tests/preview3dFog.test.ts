import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {modelStageLook, type ModelStageFog, type ModelStageLook} from '../src/react/preview3d/lookModel.ts';
import {modelMaterialChanges, type ModelShader} from '../src/react/preview3d/shading.ts';
import {makeActor} from './preview3dActorFixture.ts';

const FOG: ModelStageFog = {near: {distance: 8, color: [0.22, 0.14, 0.24]},
  far: {distance: 30, color: [0.15, 0.12, 0.24]}, height: {base: 0, top: 2, strength: 0.6}};
const srgb = (value: readonly number[]) => new THREE.Color().setRGB(value[0], value[1], value[2],
  THREE.SRGBColorSpace);
// Three's own program text with every USE_FOG block taken out, nested blocks included.
function withoutFog(source: string) {
  const kept: string[] = [];
  let depth = 0;
  for (const line of source.split('\n')) {
    const directive = line.trim();
    if (depth === 0 && directive === '#ifdef USE_FOG') {depth = 1; continue;}
    if (depth > 0) {
      if (directive.startsWith('#if')) depth++;
      if (directive === '#endif') depth--;
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n');
}
const program = (name: keyof typeof THREE.ShaderLib) => ({vertexShader: THREE.ShaderLib[name].vertexShader,
  fragmentShader: THREE.ShaderLib[name].fragmentShader, uniforms: {}}) as unknown as ModelShader;

describe('the stage\'s fog', () => {
  it('holds one three.js Fog on the scene while the look has fog, its values written in place', () => {
    const scene = new THREE.Scene(), fog = createModelFog(scene, THREE.SRGBColorSpace);
    fog.set(FOG);
    const held = scene.fog;
    assert.ok(held instanceof THREE.Fog);
    assert.deepEqual([held.near, held.far, held.color.getHex()], [8, 30, srgb(FOG.near.color).getHex()]);
    fog.set(null);
    assert.equal(scene.fog, null);
    fog.set({...FOG, near: {...FOG.near, distance: 4}});
    assert.equal(scene.fog, held);
    assert.equal(held.near, 4);
  });

  it('gives every program it changes the shared far colour, in the space three gives its own fog colour', () => {
    const fog = createModelFog(new THREE.Scene(), THREE.SRGBColorSpace), shader = program('physical');
    fog.change.apply(shader);
    fog.set(FOG);
    // Three writes its fog colour as fog.color.getRGB(uniform, space): the far colour takes the same path.
    const far = shader.uniforms.modelStageFogFar.value as THREE.Color;
    const encoded = (space: string) => {
      const value = new THREE.Color();
      srgb(FOG.far.color).getRGB(value, space);
      return value.toArray();
    };
    assert.deepEqual(far.toArray(), encoded(THREE.SRGBColorSpace));
    fog.encode(THREE.LinearSRGBColorSpace);
    assert.deepEqual(far.toArray(), encoded(THREE.LinearSRGBColorSpace));
    const other = program('basic');
    fog.change.apply(other);
    assert.equal(other.uniforms.modelStageFogFar, shader.uniforms.modelStageFogFar);
  });

  it('writes the height layer, and no layer as a strength of 0', () => {
    const fog = createModelFog(new THREE.Scene(), THREE.SRGBColorSpace), shader = program('physical');
    fog.change.apply(shader);
    fog.set(FOG);
    assert.deepEqual((shader.uniforms.modelStageFogHeight.value as THREE.Vector3).toArray(), [0, 2, 0.6]);
    fog.set({...FOG, height: null});
    assert.equal((shader.uniforms.modelStageFogHeight.value as THREE.Vector3).z, 0);
  });

  it('adds only lines inside USE_FOG, so with no fog every program is three\'s own', () => {
    for (const name of ['physical', 'standard', 'basic', 'lambert'] as const) {
      const shader = program(name), fog = createModelFog(new THREE.Scene(), THREE.SRGBColorSpace);
      fog.change.apply(shader);
      assert.notEqual(shader.fragmentShader, THREE.ShaderLib[name].fragmentShader, name);
      assert.equal(withoutFog(shader.vertexShader), withoutFog(THREE.ShaderLib[name].vertexShader), name);
      assert.equal(withoutFog(shader.fragmentShader).replace('#include <fog_fragment>', ''),
        withoutFog(THREE.ShaderLib[name].fragmentShader).replace('#include <fog_fragment>', ''), name);
    }
  });

  it('reaches a file\'s own materials, and none of the stage\'s aids', () => {
    const {actor} = makeActor('a', [{name: 'run', duration: 1}]);
    actor.asset.scene.traverse(node => {
      if (node instanceof THREE.Mesh) for (const material of [node.material].flat()) {
        assert.deepEqual(modelMaterialChanges(material).map(({key}) => key), ['model-stage-fog']);
      }
    });
    for (const aid of [actor.rig.root, ...actor.points.map(({marker}) => marker)]) aid.traverse(node => {
      if (node instanceof THREE.Mesh || node instanceof THREE.Line) {
        for (const material of [node.material].flat()) assert.equal(material.fog, false);
      }
    });
  });

  it('refuses a fog whose distances or height cannot be drawn, by its path', () => {
    const look = (fog: unknown) => ({backdrop: [0, 0, 0], key: {color: [1, 1, 1], strength: 1, direction: [0, 1, 0]},
      ambient: {sky: [1, 1, 1], ground: [0, 0, 0], strength: 1}, shadow: [0, 0, 0], night: 0,
      aids: {floor: [0, 0, 0], share: 1}, fog, glow: null}) as unknown as ModelStageLook;
    assert.equal(modelStageLook(look(null), 'L').fog, null);
    assert.deepEqual(modelStageLook(look(FOG), 'L').fog, FOG);
    assert.throws(() => modelStageLook(look({...FOG, near: {...FOG.near, distance: 0}}), 'L'),
      /L.fog.near.distance must be greater than 0/);
    assert.throws(() => modelStageLook(look({...FOG, far: {...FOG.far, distance: 8}}), 'L'),
      /L.fog.far.distance must be greater than its near distance/);
    assert.throws(() => modelStageLook(look({...FOG, height: {base: 2, top: 2, strength: 1}}), 'L'),
      /L.fog.height.top must be above its base/);
    assert.throws(() => modelStageLook(look({...FOG, height: {...FOG.height, strength: 2}}), 'L'),
      /L.fog.height.strength must be a finite number from 0 to 1/);
    const {height, ...heightless} = FOG;
    assert.ok(height);
    assert.throws(() => modelStageLook(look(heightless), 'L'), /L.fog omits height/);
  });

  it('takes a glow as data, refusing only what is not a glow: a value below 0 or not finite', () => {
    const glow = {threshold: 0.2, strength: 3, radius: 0};
    const look = (value: unknown) => ({...modelStageLook({backdrop: [0, 0, 0], key: {color: [1, 1, 1], strength: 1,
      direction: [0, 1, 0]}, ambient: {sky: [1, 1, 1], ground: [0, 0, 0], strength: 1}, shadow: [0, 0, 0], night: 0,
    aids: {floor: [0, 0, 0], share: 1}, fog: null, glow: null}, 'L'), glow: value});
    assert.deepEqual(modelStageLook(look(glow), 'L').glow, glow);
    assert.throws(() => modelStageLook(look({...glow, threshold: -1}), 'L'), /L.glow.threshold must be a finite/);
    assert.throws(() => modelStageLook(look({...glow, strength: Infinity}), 'L'), /L.glow.strength must be a finite/);
    assert.throws(() => modelStageLook(look({...glow, bloom: 1}), 'L'), /L.glow does not state bloom/);
  });
});
