import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_STAGE_LAYER, MODEL_STAGE_LAYERS, markModelStageAids, markModelStageLights}
  from '../src/react/preview3d/layers.ts';
import {createModelDraw} from '../src/react/preview3d/draw.ts';
import {loadModelGlowPasses} from '../src/react/preview3d/glow.ts';
import {makeActor} from './preview3dActorFixture.ts';
import {createModelEnvironment} from '../src/react/preview3d/environment.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';

describe('the frame\'s layers', () => {
  it('puts the stage\'s aids, all of each, on their own layer, and lights on both', () => {
    const grid = new THREE.Group(), line = new THREE.Line();
    grid.add(line);
    markModelStageAids([grid]);
    assert.deepEqual([grid.layers.mask, line.layers.mask], [MODEL_STAGE_LAYERS.aids, MODEL_STAGE_LAYERS.aids]);
    const key = new THREE.DirectionalLight();
    markModelStageLights([key]);
    assert.equal(key.layers.mask, MODEL_STAGE_LAYERS.both, 'the lit floor is an aid');
    const {actor} = makeActor('a', []);
    assert.equal(actor.rig.root.layers.mask, MODEL_STAGE_LAYERS.aids, 'an actor\'s rig is an aid');
    assert.equal(actor.placement.layers.mask, 1 << MODEL_STAGE_LAYER.scene, 'its model is the scene');
    actor.dispose();
  });

  it('keeps the description\'s environment, its plane, grid and boxes, in the scene: never an aid', () => {
    const environment = createModelEnvironment({reflectZ: false, boxes: [{id: 'rock', position: [0, 0, 0],
      size: [1, 1, 1], color: [0.5, 0.5, 0.5]}], plane: {position: [0, 0, 0], size: [4, 4], color: [0.2, 0.2, 0.2],
      grid: {spacing: 1, color: [1, 1, 1]}}}, createModelFog(new THREE.Scene()).change);
    const masks = new Set<number>();
    environment.group.traverse(node => masks.add(node.layers.mask));
    assert.deepEqual([...masks], [MODEL_STAGE_LAYERS.scene]);
    assert.equal(environment.group.children.length, 3, 'the plane, its grid and the box');
    environment.dispose();
  });

  it('compiles a program as the scene pass draws it: into the glow\'s target while it glows, unless a mode inspects',
    async () => {
    const into: (THREE.WebGLRenderTarget | null)[] = [];
    let target: THREE.WebGLRenderTarget | null = null;
    const size = new THREE.Vector2(320, 200);
    const renderer = {toneMapping: THREE.NoToneMapping, debug: {onShaderError: null},
      extensions: {has: () => true}, getDrawingBufferSize: (value: THREE.Vector2) => value.copy(size),
      setRenderTarget: (value: THREE.WebGLRenderTarget | null) => {target = value;},
      compile: () => {into.push(target); return new Set();}};
    const view = {inspecting: false};
    const draw = createModelDraw(renderer as never, new THREE.Scene(), new THREE.Camera(),
      {loadPasses: loadModelGlowPasses, inspecting: () => view.inspecting});
    draw.compile(new THREE.Mesh());
    await Promise.all(draw.load({threshold: 1, strength: 1, radius: 0}, 'Time t: look.glow'));
    draw.prepare(null, {threshold: 1, strength: 1, radius: 0}, 'Time t: look.glow')();
    draw.compile(new THREE.Mesh());
    assert.equal(into[0], null);
    assert.ok(into[1] instanceof THREE.WebGLRenderTarget && into[1].samples === 4);
    assert.equal(target, null, 'the canvas is bound again after');
    view.inspecting = true;
    draw.compile(new THREE.Mesh());
    assert.equal(into[2], null, 'a mode drawn straight to the canvas compiles for the canvas');
  });
});
