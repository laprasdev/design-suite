// Generated stage scene mounted in Chromium by preview3dFog.browser.test.ts: exports one flat patch mesh to GLB in the
// page, draws two actors at distinct depths through createModelStage, and reads their WebGL pixels back.
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {MODEL_STAGE} from '../src/react/preview3d/model.ts';
import type {ModelStageController, ModelStageDescription} from '../src/react/preview3d/model.ts';
import {createModelStage} from '../src/react/preview3d/stage.ts';
import {THEME} from './preview3dActorFixture.ts';
import {
  FAR_CENTER, FOG_HOSTS_ID, FOG_VIEWPORT, fogStageDescription, NEAR_CENTER,
  PATCH_BASE_COLOR, PATCH_EMISSIVE, type RgbBytes,
} from './preview3dFogCases.ts';
import {renderScene} from './renderScene.tsx';

const waitTwoFrames = () => new Promise<void>(next => {
  requestAnimationFrame(() => requestAnimationFrame(() => next()));
});

async function makePatchGlbBytes(): Promise<number[]> {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(...PATCH_BASE_COLOR, THREE.SRGBColorSpace),
    emissive: new THREE.Color().setRGB(...PATCH_EMISSIVE, THREE.SRGBColorSpace),
    emissiveIntensity: 1, roughness: 1, metalness: 0,
  });
  const glb = await new GLTFExporter().parseAsync(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material), {
    binary: true,
  });
  if (!(glb instanceof ArrayBuffer)) throw new Error('Expected binary GLB from GLTFExporter.');
  return Array.from(new Uint8Array(glb));
}

function mountStage(parent: HTMLElement, description: ModelStageDescription): Promise<{
  readonly host: HTMLDivElement; readonly controller: ModelStageController; readonly dispose: () => void;
}> {
  const host = document.createElement('div');
  host.style.width = `${FOG_VIEWPORT.width}px`;
  host.style.height = `${FOG_VIEWPORT.height}px`;
  parent.append(host);
  return new Promise((ready, reject) => {
    const dispose = createModelStage(
      host, description, THEME, controller => ready({host, controller, dispose}), reject,
      {reviewKey: 'fogReview', clock: 'local', floor: false, grid: false, kinds: []},
    );
  });
}

function glContext(host: HTMLElement): WebGLRenderingContext | WebGL2RenderingContext {
  const canvas = host.querySelector('canvas');
  const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
  if (!gl) throw new Error('Stage host holds no WebGL context.');
  return gl;
}

function readProjectedPixel(
  gl: WebGLRenderingContext | WebGL2RenderingContext, center: readonly [number, number, number],
): RgbBytes {
  const halfHeightTan = Math.tan(THREE.MathUtils.degToRad(MODEL_STAGE.fieldOfView / 2));
  const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
  const depth = -center[2];
  const x = Math.floor(((center[0] / (depth * halfHeightTan * aspect)) * 0.5 + 0.5) * gl.drawingBufferWidth);
  const y = Math.floor(((center[1] / (depth * halfHeightTan)) * 0.5 + 0.5) * gl.drawingBufferHeight);
  const rgba = new Uint8Array(4);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  return [rgba[0], rgba[1], rgba[2]];
}

function readWholeCanvas(host: HTMLElement): Uint8Array {
  const gl = glContext(host);
  const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
}

async function bootFogScene(assetUrl: string): Promise<void> {
  document.body.style.margin = '0';
  const container = document.getElementById(FOG_HOSTS_ID);
  if (!container) throw new Error(`Missing #${FOG_HOSTS_ID} element.`);
  const primary = await mountStage(container, fogStageDescription(assetUrl, 'haze', 'lit', true));
  await waitTwoFrames();

  window.fogScene = {
    async sample(time, surfaceMode) {
      await primary.controller.setDescription(fogStageDescription(assetUrl, time, surfaceMode, true));
      await waitTwoFrames();
      const gl = glContext(primary.host);
      const snap = primary.controller.snapshot();
      return {
        nearRgb: readProjectedPixel(gl, NEAR_CENTER), farRgb: readProjectedPixel(gl, FAR_CENTER),
        surfaceMode: snap.surfaceMode, lighting: snap.lighting,
      };
    },
    async compareNullFogWithNeverFogged() {
      await primary.controller.setDescription(fogStageDescription(assetUrl, 'clear', 'lit', true));
      await waitTwoFrames();
      const afterFog = readWholeCanvas(primary.host);
      const fresh = await mountStage(container, fogStageDescription(assetUrl, 'clear', 'lit', false));
      try {
        await waitTwoFrames();
        const neverFogged = readWholeCanvas(fresh.host);
        let differingBytes = 0;
        let firstDiff: string | null = null;
        for (let index = 0; index < afterFog.length; index++) {
          if (afterFog[index] === neverFogged[index]) continue;
          differingBytes++;
          firstDiff ??= `byte ${index}: after-fog ${afterFog[index]} vs fresh ${neverFogged[index]}`;
        }
        return {byteLength: afterFog.length, differingBytes, firstDiff};
      } finally {
        fresh.dispose();
        fresh.host.remove();
      }
    },
  };
}

window.makePatchGlbBytes = makePatchGlbBytes;
window.bootFogScene = bootFogScene;
renderScene(<div id={FOG_HOSTS_ID}/>);
