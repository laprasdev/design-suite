import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelDraw} from '../src/react/preview3d/draw.ts';

// A renderer that records what each render call drew and where; the glow's passes are three's own, run against it.
interface Drawn {readonly what: 'scene' | 'pass'; readonly into: THREE.WebGLRenderTarget | null;
  readonly material?: THREE.Material}
function fixture() {
  const drawn: Drawn[] = [], encoded: string[] = [];
  let target: THREE.WebGLRenderTarget | null = null;
  const scene = new THREE.Scene(), canvas = new THREE.Vector2(320, 200);
  const renderer = {
    outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1,
    autoClear: true, info: {render: {triangles: 0}}, state: {buffers: {stencil: {setTest: () => undefined}}},
    getDrawingBufferSize: (size: THREE.Vector2) => size.copy(canvas),
    getClearColor: (color: THREE.Color) => color, getClearAlpha: () => 1, setClearColor: () => undefined,
    clear: () => undefined, getRenderTarget: () => target,
    setRenderTarget: (value: THREE.WebGLRenderTarget | null) => {target = value;},
    render: (object: THREE.Object3D) => {
      const pass = object instanceof THREE.Mesh;
      drawn.push({what: pass ? 'pass' : 'scene', into: target, ...(pass && {material: object.material})});
      renderer.info.render.triangles = pass ? 1 : 42;
    },
  };
  const draw = createModelDraw(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.Camera(),
    {encode: space => {encoded.push(space);}});
  return {draw, drawn, encoded, canvas};
}
const GLOW = {threshold: 1.5, strength: 0.8, radius: 0.4};

describe('the frame\'s draw', () => {
  it('draws once, straight to the canvas, while the look has no glow', () => {
    const {draw, drawn, encoded} = fixture();
    draw.set(null);
    draw.draw();
    assert.deepEqual(drawn, [{what: 'scene', into: null}]);
    assert.equal(draw.triangles, 42);
    assert.deepEqual(encoded, [THREE.SRGBColorSpace]);
  });

  it('draws the scene into a half-float antialiased target, blooms above the threshold, and ends on the canvas', () => {
    const {draw, drawn, encoded} = fixture();
    draw.set(GLOW);
    draw.draw();
    const [first, ...passes] = drawn;
    assert.equal(first.what, 'scene');
    assert.ok(first.into);
    assert.deepEqual([first.into.width, first.into.height, first.into.samples, first.into.texture.type],
      [320, 200, 4, THREE.HalfFloatType]);
    const highPass = passes[0].material as THREE.ShaderMaterial;
    assert.equal(highPass.uniforms.luminosityThreshold.value, GLOW.threshold);
    assert.equal(passes.at(-1)?.into, null);
    assert.ok(passes.every(pass => pass.what === 'pass'));
    assert.equal(draw.triangles, 42);
    assert.deepEqual(encoded, [THREE.ColorManagement.workingColorSpace]);
  });

  it('follows the canvas size, and frees the target when the glow leaves', () => {
    const {draw, drawn, encoded, canvas} = fixture();
    draw.set(GLOW);
    draw.draw();
    const target = drawn[0].into;
    assert.ok(target);
    canvas.set(640, 400);
    draw.resize();
    assert.deepEqual([target.width, target.height], [640, 400]);
    let disposed = false;
    target.addEventListener('dispose', () => {disposed = true;});
    draw.set(null);
    assert.equal(disposed, true);
    assert.equal(encoded.at(-1), THREE.SRGBColorSpace);
    drawn.length = 0;
    draw.draw();
    assert.deepEqual(drawn, [{what: 'scene', into: null}]);
  });
});
