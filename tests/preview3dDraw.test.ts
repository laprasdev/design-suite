import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelDraw, MODEL_DRAW_TEXT} from '../src/react/preview3d/draw.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {ACES_CURVE} from './preview3dActorFixture.ts';
import {loadModelGlowPasses} from '../src/react/preview3d/glow.ts';
import type {ModelStageGlow, ModelStageToneCurve} from '../src/react/preview3d/lookModel.ts';
import {MODEL_STAGE_LAYERS} from '../src/react/preview3d/layers.ts';

// A renderer that records what each render call drew, where, whether it cleared first and under which tone mapping;
// the glow's passes are three's own, run against it.
interface Drawn {readonly what: 'scene' | 'pass'; readonly into: THREE.WebGLRenderTarget | null;
  readonly clears: boolean; readonly toneMapping: THREE.ToneMapping; readonly layers: number;
  readonly material?: THREE.Material}
function fixture(loadPasses = loadModelGlowPasses, halfFloat = true) {
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
    render: (object: THREE.Object3D, seen: THREE.Camera) => {
      const pass = object instanceof THREE.Mesh;
      drawn.push({what: pass ? 'pass' : 'scene', into: target, clears: renderer.autoClear,
        toneMapping: renderer.toneMapping, layers: seen.layers.mask, ...(pass && {material: object.material})});
      renderer.info.render.triangles = pass ? 1 : 42;
    },
  };
  const view = {inspecting: false, curved: true};
  const draw = createModelDraw(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.Camera(),
    {loadPasses, modes: view});
  // A look's curve and glow as the lighting part applies them: what they need loaded, then checked, then applied.
  const set = async (toneCurve: ModelStageToneCurve | null, glow: ModelStageGlow | null) => {
    await Promise.all(draw.load(glow, WHERE));
    draw.prepare({toneCurve, glow})();
  };
  return {draw, drawn, canvas, renderer, set, view};
}
const WHERE = 'Time t: look.glow';
const GLOW = {threshold: 1.5, strength: 0.8, radius: 0.4};
// A pass's uniforms: a shader pass's own, none for the bloom pass's copy of its input (a basic material).
const uniforms = (pass: Drawn): Record<string, THREE.IUniform> =>
  pass.material instanceof THREE.ShaderMaterial ? pass.material.uniforms : {};
// The frame's last two draws: its one output pass onto the canvas, then the aids onto it, uncleared and uncurved.
const ending = (drawn: readonly Drawn[]) => {
  const [output, aids] = drawn.slice(-2);
  assert.deepEqual([output.what, output.into, aids.what, aids.into, aids.clears, aids.layers, aids.toneMapping],
    ['pass', null, 'scene', null, false, MODEL_STAGE_LAYERS.aids, THREE.NoToneMapping]);
  return output;
};
const shader = ({material}: Drawn) => {
  assert.ok(material instanceof THREE.ShaderMaterial);
  return material;
};
const blooms = (output: Drawn) => Object.hasOwn(shader(output).defines, 'MODEL_BLOOM');

describe('the frame\'s draw', () => {
  it('draws the scene once into a multisampled half-float target, then the output pass under the look\'s curve',
    async () => {
      const {draw, drawn, set} = fixture();
      await set(ACES_CURVE, null);
      draw.draw();
      const [linear] = drawn, target = linear.into;
      assert.deepEqual([linear.what, linear.layers, target?.samples, target?.texture.type],
        ['scene', MODEL_STAGE_LAYERS.scene, 4, THREE.HalfFloatType]);
      assert.equal(drawn.length, 3, 'the scene, the output pass and the aids: no glow pass');
      const output = ending(drawn);
      // The output pass is the canvas's one curve: three gives a material drawn into a target none.
      assert.deepEqual([output.toneMapping, shader(output).toneMapped, uniforms(output).modelSceneColor.value,
        blooms(output)], [THREE.ACESFilmicToneMapping, true, target?.texture, false]);
      assert.match(shader(output).fragmentShader, /#include <tonemapping_fragment>\s+#include <colorspace_fragment>/);
      assert.deepEqual([draw.triangles, draw.load(null, WHERE)], [84, []]);
    });

  it('with glow, draws the scene once into a multisampled half-float target, the bloom added at the output, then aids',
    async () => {
      const {draw, drawn, set} = fixture();
      await set(ACES_CURVE, GLOW);
      draw.draw();
      const [linear, ...rest] = drawn, output = ending(drawn);
      const target = linear.into;
      assert.ok(target?.depthTexture);
      assert.deepEqual([linear.what, linear.layers, target.width, target.height, target.samples, target.texture.type,
        target.depthTexture.image.width], ['scene', MODEL_STAGE_LAYERS.scene, 320, 200, 4, THREE.HalfFloatType, 320]);
      assert.deepEqual(rest.filter(pass => pass.into === target), [], 'nothing drawn into the target after it');
      const high = rest.find(pass => 'luminosityThreshold' in uniforms(pass));
      assert.equal(high && uniforms(high).tDiffuse.value, target.texture, 'the bloom reads the resolved scene');
      assert.equal(high && uniforms(high).luminosityThreshold.value, GLOW.threshold);
      // The bloom's own strength and spread reach the pass that composites its five levels.
      const composite = rest.find(pass => 'bloomStrength' in uniforms(pass));
      assert.ok(composite?.into);
      assert.deepEqual([uniforms(composite).bloomStrength.value, uniforms(composite).bloomRadius.value],
        [GLOW.strength, GLOW.radius]);
      // The pass's own last blend draws nothing: the output pass adds the composite, its colour as it is.
      assert.deepEqual(rest.filter(pass => pass.material?.visible === false).map(pass => pass.material?.blending),
        [THREE.AdditiveBlending]);
      // One output pass writes the canvas, colour and depth, from the target and the composite; the aids are drawn
      // last onto it.
      assert.deepEqual([output.into, uniforms(output).modelSceneColor.value, uniforms(output).modelSceneDepth.value,
        uniforms(output).modelBloom.value, output.material?.depthFunc], [null, target.texture, target.depthTexture,
        composite.into.texture, THREE.AlwaysDepth]);
      assert.ok(blooms(output));
      assert.match(shader(output).fragmentShader,
        /modelSceneColor, vUv \);\n#ifdef MODEL_BLOOM\n {2}gl_FragColor\.rgb \+= texture2D\( modelBloom, vUv/);
      assert.equal(drawn.filter(pass => pass.what === 'scene').length, 2, 'the scene once, the aids once');
      assert.equal(draw.triangles, 84, 'the scene and the aids');
    });

  it('leaves the glow out while a Surface mode inspects, and the curve out where the mode shows its term untoned',
    async () => {
      const {draw, drawn, set, view} = fixture();
      const next = () => {
        drawn.length = 0;
        draw.draw();
        return ending(drawn);
      };
      await set(ACES_CURVE, GLOW);
      view.inspecting = true;
      const inspected = next();
      assert.deepEqual([drawn[0].into?.samples, drawn.length], [4, 3], 'into the linear target, no glow pass');
      assert.deepEqual([blooms(inspected), inspected.toneMapping], [false, THREE.ACESFilmicToneMapping]);
      view.curved = false;
      assert.equal(next().toneMapping, THREE.NoToneMapping);
      Object.assign(view, {inspecting: false, curved: true});
      assert.ok(blooms(next()), 'Lit again: the glow again');
    });

  it('draws the canvas under each look\'s exposure, with or without glow', async () => {
    const {draw, renderer} = fixture();
    draw.prepare({toneCurve: {...ACES_CURVE, exposure: 2}, glow: null})();
    assert.equal(renderer.toneMappingExposure, 2);
    await Promise.all(draw.load(GLOW, WHERE));
    draw.prepare({toneCurve: {...ACES_CURVE, exposure: 0.5}, glow: GLOW})();
    assert.equal(renderer.toneMappingExposure, 0.5);
  });

  it('writes a changed glow into the same passes, follows the canvas, frees the glow, then the frame', async () => {
    const {draw, drawn, canvas, set} = fixture();
    await set(null, GLOW);
    draw.draw();
    const target = drawn[0].into;
    await set(null, {...GLOW, threshold: 2});
    drawn.length = 0;
    draw.draw();
    assert.equal(drawn[0].into, target, 'a changed value makes no new target');
    const high = drawn.find(pass => 'luminosityThreshold' in uniforms(pass));
    assert.equal(high && uniforms(high).luminosityThreshold.value, 2);
    assert.ok(target?.depthTexture);
    canvas.set(640, 400);
    draw.resize();
    const bright = high?.into;
    // Its depth texture follows when three next sets it up (WebGLTextures.js 1659): shown by a capture, not here.
    assert.deepEqual([target.width, target.height, bright?.width, bright?.height], [640, 400, 320, 200]);
    const targets = new Set(drawn.flatMap(({into}) => into ? [into] : []));
    const materials = new Set(drawn.flatMap(({material}) => material ? [material] : []));
    assert.equal(targets.size, 12, 'the scene\'s target, the bright pass and five blur levels each way');
    const disposed = new Set<unknown>(), owned = [...targets, ...materials, target.depthTexture];
    for (const each of owned) each.addEventListener('dispose', () => disposed.add(each));
    await set(null, null);
    const output = ending(drawn).material;
    assert.deepEqual(owned.filter(each => !disposed.has(each)), [target, output, target.depthTexture],
      'the glow freed with its look; the frame kept');
    drawn.length = 0;
    draw.draw();
    assert.deepEqual([drawn.length, blooms(ending(drawn))], [3, false]);
    draw.dispose();
    assert.deepEqual(owned.filter(each => !disposed.has(each)), []);
  });

  it('loads the glow\'s pass once a look brings glow; a browser with no half floats is refused', async () => {
    const {draw} = fixture();
    assert.throws(() => draw.prepare({toneCurve: null, glow: GLOW}), new RegExp(MODEL_DRAW_TEXT.unloaded));
    const first = draw.load(GLOW, WHERE);
    assert.equal(first.length, 1);
    assert.equal(draw.load(GLOW, WHERE)[0], first[0], 'one load while it is in flight');
    await Promise.all(first);
    assert.deepEqual(draw.load(GLOW, WHERE), []);
    assert.throws(() => fixture(loadModelGlowPasses, false), (error: unknown) =>
      error instanceof ModelStageRefusal && error.message === MODEL_DRAW_TEXT.halfFloat);
  });

  it('fetches the passes again after a fetch that failed, which refuses naming the glow', async () => {
    let calls = 0;
    const flaky = () => ++calls === 1 ? Promise.reject(new Error('offline')) : loadModelGlowPasses();
    const {draw} = fixture(flaky);
    await assert.rejects(Promise.all(draw.load(GLOW, WHERE)), (error: unknown) =>
      error instanceof ModelStageRefusal && error.message === MODEL_DRAW_TEXT.passes(WHERE, 'offline'));
    await Promise.all(draw.load(GLOW, WHERE));
    assert.equal(calls, 2);
    draw.prepare({toneCurve: null, glow: GLOW})();
  });
});
