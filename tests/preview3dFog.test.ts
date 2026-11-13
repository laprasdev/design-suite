import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {modelStageLook, type ModelStageFog, type ModelStageLook} from '../src/react/preview3d/lookModel.ts';
import {extendModelMaterial, extendModelMaterials, modelMaterialChanges, type ModelShader, type ModelShaderChange}
  from '../src/react/preview3d/shading.ts';
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
// A change applied to a program the way three applies it: through the hook the stage composes on a material.
const compile = (change: ModelShaderChange, shader: ModelShader) =>
  extendModelMaterial(new THREE.MeshBasicMaterial(), [change]).onBeforeCompile(shader, {} as THREE.WebGLRenderer);

describe('the stage\'s fog', () => {
  it('holds one three.js Fog on the scene while the look has fog, its values written in place', () => {
    const scene = new THREE.Scene(), fog = createModelFog(scene);
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

  it('gives every program the shared far colour, linear, converted as the program converts its own output', () => {
    const fog = createModelFog(new THREE.Scene()), shader = program('physical');
    compile(fog.change, shader);
    fog.set(FOG);
    // Held linear whatever is drawn into: the program's own output conversion, which three compiles for the target
    // bound (sRGB to the canvas, linear into a glow target), takes it to the space three gives its near colour.
    const far = shader.uniforms.modelStageFogFar.value as THREE.Color;
    assert.deepEqual(far.toArray(), srgb(FOG.far.color).toArray());
    assert.ok(far.r < FOG.far.color[0], 'the far colour is held decoded from sRGB, not as stated');
    assert.match(shader.fragmentShader,
      /vec3 modelStageFogFarColor = linearToOutputTexel\( vec4\( modelStageFogFar, 1\.0 \) \)\.rgb;/);
    assert.match(shader.fragmentShader, /mix\( fogColor, modelStageFogFarColor, modelStageFogDistance \)/);
    const other = program('basic');
    compile(fog.change, other);
    assert.equal(other.uniforms.modelStageFogFar, shader.uniforms.modelStageFogFar);
  });

  it('writes the height layer, and no layer as a strength of 0', () => {
    const fog = createModelFog(new THREE.Scene()), shader = program('physical');
    compile(fog.change, shader);
    fog.set(FOG);
    assert.deepEqual((shader.uniforms.modelStageFogHeight.value as THREE.Vector3).toArray(), [0, 2, 0.6]);
    fog.set({...FOG, height: null});
    assert.equal((shader.uniforms.modelStageFogHeight.value as THREE.Vector3).z, 0);
  });

  it('adds only lines inside USE_FOG, so with no fog every program is three\'s own', () => {
    for (const name of ['physical', 'standard', 'basic', 'lambert', 'points'] as const) {
      const shader = program(name), fog = createModelFog(new THREE.Scene());
      compile(fog.change, shader);
      assert.notEqual(shader.fragmentShader, THREE.ShaderLib[name].fragmentShader, name);
      assert.equal(withoutFog(shader.vertexShader), withoutFog(THREE.ShaderLib[name].vertexShader), name);
      assert.equal(withoutFog(shader.fragmentShader).replace('#include <fog_fragment>', ''),
        withoutFog(THREE.ShaderLib[name].fragmentShader).replace('#include <fog_fragment>', ''), name);
    }
  });

  it('reaches a model\'s lines and points as well as its meshes', () => {
    const root = new THREE.Group(), fog = createModelFog(new THREE.Scene());
    root.add(new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()),
      new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial()));
    extendModelMaterials(root, () => [fog.change]);
    root.traverse(node => {
      if (node instanceof THREE.Line || node instanceof THREE.Points) {
        assert.deepEqual(modelMaterialChanges(node.material as THREE.Material).map(({key}) => key),
          ['model-stage-fog']);
      }
    });
  });

  it('reaches a file\'s own materials, and none of the stage\'s aids', () => {
    const {actor} = makeActor('a', [{name: 'run', duration: 1}]);
    // The fixture's skinned box draws three's basic material, which the Surface modes do not cover: fog alone.
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
      aids: {floor: [0, 0, 0], share: 1}, fog, toneCurve: null, glow: null}) as unknown as ModelStageLook;
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

  it('takes a glow as data, refusing what is not a glow: below 0, not finite, or a spread outside 0 to 1', () => {
    const glow = {threshold: 0.2, strength: 3, radius: 0};
    const look = (value: unknown) => ({...modelStageLook({backdrop: [0, 0, 0], key: {color: [1, 1, 1], strength: 1,
      direction: [0, 1, 0]}, ambient: {sky: [1, 1, 1], ground: [0, 0, 0], strength: 1}, shadow: [0, 0, 0], night: 0,
    aids: {floor: [0, 0, 0], share: 1}, fog: null, toneCurve: null, glow: null}, 'L'), glow: value});
    assert.deepEqual(modelStageLook(look(glow), 'L').glow, glow);
    assert.throws(() => modelStageLook(look({...glow, threshold: -1}), 'L'), /L.glow.threshold must be a finite/);
    assert.throws(() => modelStageLook(look({...glow, strength: Infinity}), 'L'), /L.glow.strength must be a finite/);
    assert.throws(() => modelStageLook(look({...glow, bloom: 1}), 'L'), /L.glow does not state bloom/);
    assert.deepEqual(modelStageLook(look({...glow, radius: 1}), 'L').glow, {...glow, radius: 1});
    for (const radius of [1.01, 2, -0.1]) {
      assert.throws(() => modelStageLook(look({...glow, radius}), 'L'),
        /L.glow.radius must be a finite number from 0 to 1/);
    }
  });
});
