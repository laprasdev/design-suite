import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelDraw} from '../src/react/preview3d/draw.ts';

// A renderer that records what each render call drew, where, and whether it cleared first; the glow's passes are
// three's own, run against it.
interface Drawn {readonly what: 'scene' | 'pass'; readonly into: THREE.WebGLRenderTarget | null;
  readonly clears: boolean; readonly material?: THREE.Material}
function fixture() {
  const drawn: Drawn[] = [], encoded: string[] = [];
  let target: THREE.WebGLRenderTarget | null = null;
  const scene = new THREE.Scene(), canvas = new THREE.Vector2(320, 200);
  const renderer = {
    outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.NoToneMapping as THREE.ToneMapping,
    toneMappingExposure: 1, autoClear: true, info: {render: {triangles: 0}},
    state: {buffers: {stencil: {setTest: () => undefined}}},
    getDrawingBufferSize: (size: THREE.Vector2) => size.copy(canvas),
    getClearColor: (color: THREE.Color) => color, getClearAlpha: () => 1, setClearColor: () => undefined,
    clear: () => undefined, getRenderTarget: () => target,
    setRenderTarget: (value: THREE.WebGLRenderTarget | null) => {target = value;},
    render: (object: THREE.Object3D) => {
      const pass = object instanceof THREE.Mesh;
      drawn.push({what: pass ? 'pass' : 'scene', into: target, clears: renderer.autoClear,
        ...(pass && {material: object.material})});
      renderer.info.render.triangles = pass ? 1 : 42;
    },
  };
  const draw = createModelDraw(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.Camera(),
    {encode: space => {encoded.push(space);}});
  return {draw, drawn, encoded, canvas, renderer};
}
const GLOW = {threshold: 1.5, strength: 0.8, radius: 0.4};

describe('the frame\'s draw', () => {
  it('draws once, straight to the canvas, under the look\'s tone curve or none', () => {
    const {draw, drawn, encoded, renderer} = fixture();
    draw.set('aces-filmic', null);
    assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
    draw.draw();
    assert.deepEqual(drawn, [{what: 'scene', into: null, clears: true}]);
    assert.equal(draw.triangles, 42);
    assert.deepEqual(encoded, []);
    draw.set(null, null);
    assert.equal(renderer.toneMapping, THREE.NoToneMapping);
  });

  it('with glow, draws the canvas first exactly as without, then only adds the bloom onto it', () => {
    const {draw, drawn, encoded} = fixture();
    draw.set(null, GLOW);
    draw.draw();
    const [canvas, hdr, ...passes] = drawn;
    assert.deepEqual(canvas, {what: 'scene', into: null, clears: true});
    assert.equal(hdr.what, 'scene');
    assert.ok(hdr.into);
    assert.deepEqual([hdr.into.width, hdr.into.height, hdr.into.samples, hdr.into.texture.type],
      [320, 200, 0, THREE.HalfFloatType]);
    const highPass = passes[0].material as THREE.ShaderMaterial;
    assert.equal(highPass.uniforms.luminosityThreshold.value, GLOW.threshold);
    const added = passes.at(-1);
    assert.ok(added?.material instanceof THREE.ShaderMaterial);
    assert.deepEqual([added.into, added.clears, added.material.blending], [null, false, THREE.AdditiveBlending]);
    assert.ok(passes.slice(0, -1).every(pass => pass.into !== null));
    assert.equal(draw.triangles, 42);
    assert.deepEqual(encoded, [THREE.ColorManagement.workingColorSpace, THREE.SRGBColorSpace]);
  });

  it('follows the canvas size, and frees the target when the glow leaves', () => {
    const {draw, drawn, canvas} = fixture();
    draw.set(null, GLOW);
    draw.draw();
    const target = drawn[1].into;
    assert.ok(target);
    canvas.set(640, 400);
    draw.resize();
    assert.deepEqual([target.width, target.height], [640, 400]);
    let disposed = false;
    target.addEventListener('dispose', () => {disposed = true;});
    draw.set(null, null);
    assert.equal(disposed, true);
    drawn.length = 0;
    draw.draw();
    assert.deepEqual(drawn, [{what: 'scene', into: null, clears: true}]);
  });
});
