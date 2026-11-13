import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelDraw, MODEL_DRAW_TEXT} from '../src/react/preview3d/draw.ts';
import type {ModelStageGlow, ModelStageToneCurve} from '../src/react/preview3d/lookModel.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';

// A renderer that records what each render call drew, where, whether it cleared first and under which tone mapping;
// the glow's passes are three's own, run against it.
interface Drawn {readonly what: 'scene' | 'pass'; readonly into: THREE.WebGLRenderTarget | null;
  readonly clears: boolean; readonly toneMapping: THREE.ToneMapping; readonly material?: THREE.Material}
function fixture(halfFloat = true) {
  const drawn: Drawn[] = [];
  let target: THREE.WebGLRenderTarget | null = null;
  const scene = new THREE.Scene(), canvas = new THREE.Vector2(320, 200);
  const renderer = {
    outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.NoToneMapping as THREE.ToneMapping,
    toneMappingExposure: 1, autoClear: true, info: {render: {triangles: 0}},
    extensions: {has: (name: string) => halfFloat && name === 'EXT_color_buffer_half_float'},
    state: {buffers: {stencil: {setTest: () => undefined}}},
    getDrawingBufferSize: (size: THREE.Vector2) => size.copy(canvas),
    getClearColor: (color: THREE.Color) => color, getClearAlpha: () => 1, setClearColor: () => undefined,
    clear: () => undefined, getRenderTarget: () => target,
    setRenderTarget: (value: THREE.WebGLRenderTarget | null) => {target = value;},
    render: (object: THREE.Object3D) => {
      const pass = object instanceof THREE.Mesh;
      drawn.push({what: pass ? 'pass' : 'scene', into: target, clears: renderer.autoClear,
        toneMapping: renderer.toneMapping, ...(pass && {material: object.material})});
      renderer.info.render.triangles = pass ? 1 : 42;
    },
  };
  const draw = createModelDraw(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.Camera());
  // A look's curve and glow as the lighting part applies them: what they need loaded, then checked, then applied.
  const set = async (curve: ModelStageToneCurve | null, glow: ModelStageGlow | null) => {
    await Promise.all(draw.load(glow));
    draw.prepare(curve, glow, 'Time t: look.glow')();
  };
  return {draw, drawn, canvas, renderer, set};
}
const GLOW = {threshold: 1.5, strength: 0.8, radius: 0.4};
const uniforms = (pass: Drawn) => (pass.material as THREE.ShaderMaterial).uniforms;
const CANVAS = {what: 'scene', into: null, clears: true};

describe('the frame\'s draw', () => {
  it('draws once, straight to the canvas, under the look\'s tone curve or none', async () => {
    const {draw, drawn, renderer, set} = fixture();
    await set('aces-filmic', null);
    draw.draw();
    assert.deepEqual(drawn, [{...CANVAS, toneMapping: THREE.ACESFilmicToneMapping}]);
    assert.equal(draw.triangles, 42);
    await set(null, null);
    assert.equal(renderer.toneMapping, THREE.NoToneMapping);
    assert.deepEqual(draw.load(null), []);
  });

  it('with glow, draws the canvas first exactly as without, then only adds the bloom onto it', async () => {
    const {draw, drawn, set} = fixture();
    await set(null, GLOW);
    draw.draw();
    const [canvas, linear, ...passes] = drawn;
    assert.deepEqual(canvas, {...CANVAS, toneMapping: THREE.NoToneMapping});
    assert.equal(linear.what, 'scene');
    assert.ok(linear.into);
    assert.deepEqual([linear.into.width, linear.into.height, linear.into.samples, linear.into.texture.type],
      [320, 200, 0, THREE.HalfFloatType]);
    assert.equal(uniforms(passes[0]).luminosityThreshold.value, GLOW.threshold);
    // The bloom's own strength and spread reach the pass that composites its five levels.
    const composite = passes.find(pass => pass.material && 'bloomStrength' in uniforms(pass));
    assert.ok(composite?.into);
    assert.deepEqual([uniforms(composite).bloomStrength.value, uniforms(composite).bloomRadius.value],
      [GLOW.strength, GLOW.radius]);
    // What is added is the composite's own result (three r180 leaves it there before blending it back).
    const added = passes.at(-1);
    assert.ok(added?.material instanceof THREE.ShaderMaterial);
    assert.equal(uniforms(added).glow.value, composite.into.texture);
    assert.deepEqual([added.into, added.clears, added.material.blending], [null, false, THREE.AdditiveBlending]);
    assert.ok(passes.slice(0, -1).every(pass => pass.into !== null));
    assert.equal(draw.triangles, 42);
  });

  it('never passes a material that is not tone-mapped through an output curve', async () => {
    const {draw, drawn, set} = fixture();
    await set(null, GLOW);
    draw.draw();
    // The canvas pass is the only one that draws the scene's materials to the screen, under the look's curve, which
    // a look with glow cannot have; nothing after it maps the frame through a curve.
    const toCanvas = drawn.filter(pass => pass.into === null);
    assert.deepEqual(toCanvas.map(({what, toneMapping}) => [what, toneMapping]),
      [['scene', THREE.NoToneMapping], ['pass', THREE.NoToneMapping]]);
    const added = toCanvas[1].material as THREE.ShaderMaterial;
    assert.equal(added.toneMapped, false);
    assert.doesNotMatch(added.fragmentShader, /tonemapping|toneMapping/i);
  });

  it('writes a changed glow into the same passes, follows the canvas size, and frees all of it', async () => {
    const {draw, drawn, canvas, set} = fixture();
    await set(null, GLOW);
    draw.draw();
    const target = drawn[1].into;
    await set(null, {...GLOW, threshold: 2});
    drawn.length = 0;
    draw.draw();
    assert.equal(drawn[1].into, target, 'a changed value makes no new target');
    assert.equal(uniforms(drawn[2]).luminosityThreshold.value, 2);
    assert.ok(target);
    canvas.set(640, 400);
    draw.resize();
    const bright = drawn[2].into;
    assert.deepEqual([target.width, target.height, bright?.width, bright?.height], [640, 400, 320, 200]);
    const targets = new Set(drawn.flatMap(({into}) => into ? [into] : []));
    const materials = new Set(drawn.flatMap(({material}) => material ? [material] : []));
    assert.equal(targets.size, 12, 'the linear source, the bright pass and five blur levels each way');
    const disposed = new Set<unknown>();
    for (const owned of [...targets, ...materials]) owned.addEventListener('dispose', () => disposed.add(owned));
    await set(null, null);
    assert.deepEqual([...targets, ...materials].filter(owned => !disposed.has(owned)), []);
    drawn.length = 0;
    draw.draw();
    assert.deepEqual(drawn, [{...CANVAS, toneMapping: THREE.NoToneMapping}]);
  });

  it('loads the glow\'s passes once, when a look first brings glow, and refuses glow it cannot draw', async () => {
    const {draw} = fixture();
    assert.throws(() => draw.prepare(null, GLOW, 'Time t: look.glow'), new RegExp(MODEL_DRAW_TEXT.unloaded));
    const first = draw.load(GLOW);
    assert.equal(first.length, 1);
    assert.equal(draw.load(GLOW)[0], first[0], 'one load while it is in flight');
    await Promise.all(first);
    assert.deepEqual(draw.load(GLOW), []);
    const plain = fixture(false);
    await Promise.all(plain.draw.load(GLOW));
    assert.throws(() => plain.draw.prepare(null, GLOW, 'Time t: look.glow'), (error: unknown) =>
      error instanceof ModelStageRefusal && error.message === MODEL_DRAW_TEXT.halfFloat('Time t: look.glow'));
    plain.draw.prepare(null, null, 'Time t: look.glow')();
  });
});
