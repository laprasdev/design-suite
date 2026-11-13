import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_STAGE_LAYER, MODEL_STAGE_LAYERS, markModelStageAids, markModelStageLights}
  from '../src/react/preview3d/layers.ts';
import {createModelDraw} from '../src/react/preview3d/draw.ts';
import {makeActor} from './preview3dActorFixture.ts';

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

  it('compiles a program as the scene pass draws it: into the glow\'s target while the look has glow', async () => {
    const into: (THREE.WebGLRenderTarget | null)[] = [];
    let target: THREE.WebGLRenderTarget | null = null;
    const size = new THREE.Vector2(320, 200);
    const renderer = {toneMapping: THREE.NoToneMapping, debug: {onShaderError: null},
      extensions: {has: () => true}, getDrawingBufferSize: (value: THREE.Vector2) => value.copy(size),
      setRenderTarget: (value: THREE.WebGLRenderTarget | null) => {target = value;},
      compile: () => {into.push(target); return new Set();}};
    const draw = createModelDraw(renderer as never, new THREE.Scene(), new THREE.Camera());
    draw.compile(new THREE.Mesh());
    await Promise.all(draw.load({threshold: 1, strength: 1, radius: 0}, 'Time t: look.glow'));
    draw.prepare(null, {threshold: 1, strength: 1, radius: 0}, 'Time t: look.glow')();
    draw.compile(new THREE.Mesh());
    assert.equal(into[0], null);
    assert.ok(into[1] instanceof THREE.WebGLRenderTarget && into[1].samples === 4);
    assert.equal(target, null, 'the canvas is bound again after');
  });
});
