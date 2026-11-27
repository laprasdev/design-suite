// Mounted in Chromium by preview3dBlendOrder.browser.test.ts: the stage's own draw (draw.ts) over a floor on the aids'
// layer, nearer the camera a sheet the stage's kind materials draw blended, and reads the frame's bytes back
// (pixelReadScene.tsx). The look has no curve and no glow, and the canvas is linear, so each byte is the frame's own.
import * as THREE from 'three';
import {markModelStageAids} from '../src/react/preview3d/layers.ts';
import {BLEND_ORDER_PROGRAM, BLEND_ORDER_VIEWPORT, BLENDED_SHEET_KIND, blendedSheetRecord, FLOOR_COLOR}
  from './preview3dBlendOrderCases.ts';
import {mountPixelReadScene} from './pixelReadScene.tsx';
import {createKindDrawScene} from './preview3dKindDrawScene.ts';

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
const {draw, material} = createKindDrawScene(view.renderer, scene, camera,
  {kind: BLENDED_SHEET_KIND, program: BLEND_ORDER_PROGRAM, record: blendedSheetRecord()});

window.drawBlendOrder = async () => {
  sheet.material = await material();
  return view.readFrame(draw.draw);
};
