import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelDraw, MODEL_DRAW_TEXT} from '../src/react/preview3d/draw.ts';
import {loadModelGlowPasses} from '../src/react/preview3d/glow.ts';
import type {ModelStageGlow, ModelStageToneCurve} from '../src/react/preview3d/lookModel.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {MODEL_STAGE_LAYERS} from '../src/react/preview3d/layers.ts';

// A renderer that records what each render call drew, where, whether it cleared first and under which tone mapping;
// the glow's passes are three's own, run against it.
interface Drawn {readonly what: 'scene' | 'pass'; readonly into: THREE.WebGLRenderTarget | null;
  readonly clears: boolean; readonly toneMapping: THREE.ToneMapping; readonly layers: number;
  readonly material?: THREE.Material}
function fixture(halfFloat = true, loadPasses = loadModelGlowPasses) {
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
  const view = {inspecting: false};
  const draw = createModelDraw(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.Camera(),
    {loadPasses, inspecting: () => view.inspecting});
  // A look's curve and glow as the lighting part applies them: what they need loaded, then checked, then applied.
  const set = async (curve: ModelStageToneCurve | null, glow: ModelStageGlow | null) => {
    await Promise.all(draw.load(glow, WHERE));
    draw.prepare(curve, glow, 'Time t: look.glow')();
  };
  return {draw, drawn, canvas, renderer, set, view};
}
const WHERE = 'Time t: look.glow';
const GLOW = {threshold: 1.5, strength: 0.8, radius: 0.4};
// A pass's uniforms: a shader pass's own, none for the bloom pass's copy of its input (a basic material).
const uniforms = (pass: Drawn): Record<string, THREE.IUniform> =>
  pass.material instanceof THREE.ShaderMaterial ? pass.material.uniforms : {};
const CANVAS = {what: 'scene', into: null, clears: true, layers: MODEL_STAGE_LAYERS.both};

describe('the frame\'s draw', () => {
  it('draws once, straight to the canvas, under the look\'s tone curve or none', async () => {
    const {draw, drawn, renderer, set} = fixture();
    await set('aces-filmic', null);
    draw.draw();
    assert.deepEqual(drawn, [{...CANVAS, toneMapping: THREE.ACESFilmicToneMapping}]);
    assert.equal(draw.triangles, 42);
    await set(null, null);
    assert.equal(renderer.toneMapping, THREE.NoToneMapping);
    assert.deepEqual(draw.load(null, WHERE), []);
  });

  it('with glow, draws the scene once into a multisampled half-float target, the bloom added at the output, then aids',
    async () => {
      const {draw, drawn, set} = fixture();
      await set('aces-filmic', GLOW);
      draw.draw();
      const [linear, ...rest] = drawn, aids = rest.at(-1)!, output = rest.at(-2)!;
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
      assert.match((output.material as THREE.ShaderMaterial).fragmentShader,
        /= texture2D\( modelSceneColor, vUv \);\n  gl_FragColor\.rgb \+= texture2D\( modelBloom, vUv \)\.rgb;/);
      assert.deepEqual([aids.what, aids.into, aids.clears, aids.layers],
        ['scene', null, false, MODEL_STAGE_LAYERS.aids]);
      assert.equal(drawn.filter(pass => pass.what === 'scene').length, 2, 'the scene once, the aids once');
      assert.equal(draw.triangles, 84, 'the scene and the aids, as the direct draw counts them');
    });

  it('draws straight to the canvas, the glow left out, while a Surface mode inspects the surfaces', async () => {
    const {draw, drawn, set, view} = fixture();
    await set('aces-filmic', GLOW);
    draw.draw();
    view.inspecting = true;
    drawn.length = 0;
    draw.draw();
    assert.deepEqual(drawn, [{...CANVAS, toneMapping: THREE.ACESFilmicToneMapping}]);
    view.inspecting = false;
    drawn.length = 0;
    draw.draw();
    assert.equal((drawn[0].into as THREE.WebGLRenderTarget | null)?.samples, 4, 'Lit again: the glow again');
  });

  it('applies the look\'s curve once, to the whole frame, and to nothing drawn after it', async () => {
    const {draw, drawn, set} = fixture();
    await set('aces-filmic', GLOW);
    draw.draw();
    // Every frame alike, the second too (the first frame after a look follows its commit).
    drawn.length = 0;
    draw.draw();
    // The output pass is the canvas's last word on the scene (it overwrites whatever the bloom pass drew there first).
    const at = drawn.findIndex(pass => 'modelBloom' in uniforms(pass));
    assert.deepEqual(drawn.slice(at).map(({what, into, toneMapping}) => [what, into, toneMapping]),
      [['pass', null, THREE.ACESFilmicToneMapping], ['scene', null, THREE.NoToneMapping]]);
    const output = drawn[at].material as THREE.ShaderMaterial;
    assert.equal(output.toneMapped, true);
    assert.match(output.fragmentShader, /#include <tonemapping_fragment>\s+#include <colorspace_fragment>/);
  });

  it('writes a changed glow into the same passes, follows the canvas size, and frees all of it', async () => {
    const {draw, drawn, canvas, set} = fixture();
    await set(null, GLOW);
    draw.draw();
    const target = drawn[0].into;
    await set(null, {...GLOW, threshold: 2});
    drawn.length = 0;
    draw.draw();
    assert.equal(drawn[0].into, target, 'a changed value makes no new target');
    const high = drawn.find(pass => 'luminosityThreshold' in uniforms(pass))!;
    assert.equal(uniforms(high).luminosityThreshold.value, 2);
    assert.ok(target?.depthTexture);
    canvas.set(640, 400);
    draw.resize();
    const bright = high.into;
    // Its depth texture follows when three next sets it up (WebGLTextures.js 1659): shown by a capture, not here.
    assert.deepEqual([target.width, target.height, bright?.width, bright?.height], [640, 400, 320, 200]);
    const targets = new Set(drawn.flatMap(({into}) => into ? [into] : []));
    const materials = new Set(drawn.flatMap(({material}) => material ? [material] : []));
    assert.equal(targets.size, 12, 'the scene\'s target, the bright pass and five blur levels each way');
    const disposed = new Set<unknown>(), owned = [...targets, ...materials, target.depthTexture];
    for (const each of owned) each.addEventListener('dispose', () => disposed.add(each));
    await set(null, null);
    assert.deepEqual(owned.filter(each => !disposed.has(each)), []);
    drawn.length = 0;
    draw.draw();
    assert.deepEqual(drawn, [{...CANVAS, toneMapping: THREE.NoToneMapping}]);
  });

  it('loads the glow\'s passes once, when a look first brings glow, and refuses glow it cannot draw', async () => {
    const {draw} = fixture();
    assert.throws(() => draw.prepare(null, GLOW, 'Time t: look.glow'), new RegExp(MODEL_DRAW_TEXT.unloaded));
    const first = draw.load(GLOW, WHERE);
    assert.equal(first.length, 1);
    assert.equal(draw.load(GLOW, WHERE)[0], first[0], 'one load while it is in flight');
    await Promise.all(first);
    assert.deepEqual(draw.load(GLOW, WHERE), []);
    const plain = fixture(false);
    await Promise.all(plain.draw.load(GLOW, WHERE));
    assert.throws(() => plain.draw.prepare(null, GLOW, 'Time t: look.glow'), (error: unknown) =>
      error instanceof ModelStageRefusal && error.message === MODEL_DRAW_TEXT.halfFloat('Time t: look.glow'));
    plain.draw.prepare(null, null, 'Time t: look.glow')();
  });

  it('fetches the passes again after a fetch that failed, which refuses naming the glow', async () => {
    let calls = 0;
    const flaky = () => ++calls === 1 ? Promise.reject(new Error('offline')) : loadModelGlowPasses();
    const {draw} = fixture(true, flaky);
    await assert.rejects(Promise.all(draw.load(GLOW, WHERE)), (error: unknown) =>
      error instanceof ModelStageRefusal && error.message === MODEL_DRAW_TEXT.passes(WHERE, 'offline'));
    await Promise.all(draw.load(GLOW, WHERE));
    assert.equal(calls, 2);
    draw.prepare(null, GLOW, WHERE)();
  });
});
