// Mounted in Chromium by preview3dBlendOrder.browser.test.ts: the stage's own draw (draw.ts) over a floor on the aids'
// layer, nearer the camera a sheet the stage's kind materials draw blended, and reads the frame's bytes back
// (pixelReadScene.tsx). The look has no curve and no glow, and the canvas is linear, so each byte is the frame's own.
import * as THREE from 'three';
import {createModelDraw} from '../src/react/preview3d/draw.ts';
import {loadModelGlowPasses} from '../src/react/preview3d/glow.ts';
import {markModelStageAids} from '../src/react/preview3d/layers.ts';
import {modelSurfaceKinds} from '../src/react/preview3d/surfaceKindModel.ts';
import {modelSurfaceRecord} from '../src/react/preview3d/surfaceModel.ts';
import {createModelSurfaceMaterials} from '../src/react/preview3d/surfaceMaterials.ts';
import {createModelTextures, decodeModelImage} from '../src/react/preview3d/textures.ts';
import {BLEND_ORDER_PROGRAM, BLEND_ORDER_VIEWPORT, BLENDED_SHEET_KIND, blendedSheetRecord, FLOOR_COLOR}
  from './preview3dBlendOrderCases.ts';
import {mountPixelReadScene} from './pixelReadScene.tsx';
import {kindStage} from './preview3dKindFixture.ts';

const view = mountPixelReadScene(BLEND_ORDER_VIEWPORT);
const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.set(0, 0, 5);
camera.updateMatrixWorld();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({color: new THREE.Color().setRGB(...FLOOR_COLOR, THREE.LinearSRGBColorSpace)}));
floor.position.z = -1;
markModelStageAids([floor]);
const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 2));
sheet.position.x = -0.5;
scene.add(floor, sheet);
const program = new TextEncoder().encode(BLEND_ORDER_PROGRAM).buffer;
const read = async () => program;
const {shared, changes} = kindStage(scene);
const materials = createModelSurfaceMaterials({kinds: modelSurfaceKinds([BLENDED_SHEET_KIND]), shared, changes, read,
  textures: createModelTextures(read, decodeModelImage)});
const record = modelSurfaceRecord(blendedSheetRecord(), 'sheet');
const loaded = Promise.all(materials.load([record]).pending);
const draw = createModelDraw(view.renderer, scene, camera, {loadPasses: loadModelGlowPasses,
  modes: {inspecting: false, curved: false}});
draw.prepare({toneCurve: null, glow: null})();

window.drawBlendOrder = async () => {
  await loaded;
  sheet.material = materials.material(record).material;
  return view.readFrame(draw.draw);
};
