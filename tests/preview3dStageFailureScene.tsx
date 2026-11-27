// Mounted in Chromium by preview3dStageFailure.browser.test.ts: a stage through createModelStage over one flat patch,
// with the page's animation frames counted as the stage asks for them, and its host resized on the test's word.
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {MODEL_STAGE_CLOCK, modelStageDescription} from '../src/react/preview3d/model.ts';
import {createModelStage} from '../src/react/preview3d/stage.ts';
import {declaration, describing, standingAt, THEME} from './preview3dActorFixture.ts';
import {SETTLING_FRAMES, STAGE_FAILURE_HOST_ID, STAGE_FAILURE_VIEWPORT} from './preview3dStageFailureCases.ts';
import {renderScene} from './renderScene.tsx';

const PATCH_ID = 'patch';
// The page's own frames, for the scene's waits; the stage's requests go through the counted ones.
const pageFrame = window.requestAnimationFrame.bind(window);
let framesAsked = 0;
window.requestAnimationFrame = step => {
  framesAsked++;
  return pageFrame(step);
};
const settle = async () => {
  for (let frame = 0; frame < SETTLING_FRAMES; frame++) await new Promise(next => pageFrame(next));
};
const failures: string[] = [];

window.makeStageFailurePatch = async () => {
  const glb = await new GLTFExporter().parseAsync(new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
    new THREE.MeshStandardMaterial()), {binary: true});
  if (!(glb instanceof ArrayBuffer)) throw new Error('Expected binary GLB from GLTFExporter.');
  return Array.from(new Uint8Array(glb));
};
window.bootStageFailure = async assetUrl => {
  document.body.style.margin = '0';
  const host = document.getElementById(STAGE_FAILURE_HOST_ID);
  if (!host) throw new Error(`Missing #${STAGE_FAILURE_HOST_ID} element.`);
  const description = modelStageDescription(describing({actors: {focus: PATCH_ID, actors: [declaration(PATCH_ID,
    PATCH_ID, {asset: {id: PATCH_ID, path: assetUrl}, placement: standingAt([0, 0, 0])})]}, orbit: false}));
  await new Promise<void>((ready, reject) => createModelStage(host, description, THEME, () => ready(), error => {
    failures.push(`${error.name}: ${error.message}`);
    reject(error);
  }, {reviewKey: 'stageFailureReview', clock: MODEL_STAGE_CLOCK.local, floor: false, grid: false, kinds: []}));
  window.resizeStageHost = async (width, height) => {
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
    const asked = framesAsked;
    await settle();
    const canvas = host.querySelector('canvas');
    if (!canvas) throw new Error('The stage host holds no canvas.');
    return {failures: [...failures], framesAsked: framesAsked - asked, canvas: [canvas.width, canvas.height]};
  };
};
renderScene(<div id={STAGE_FAILURE_HOST_ID} style={{width: STAGE_FAILURE_VIEWPORT.width,
  height: STAGE_FAILURE_VIEWPORT.height}}/>);
