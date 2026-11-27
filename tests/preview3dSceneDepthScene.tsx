// Mounted in Chromium by preview3dSceneDepth.browser.test.ts: the stage's own draw (draw.ts) over an opaque wall, an
// aid, an opaque and a cut-out panel and a blended veil, with nearest a sheet the stage's kind materials
// draw in that kind; the frame's bytes are read back (pixelReadScene.tsx). The look has no curve and no glow, and the
// canvas is linear, so each byte is the frame's own.
import * as THREE from 'three';
import {DEPTH_KIND, DEPTH_PROGRAM, DEPTH_SURFACE, DEPTH_VIEW, DEPTH_VIEWPORT} from './preview3dSceneDepthCases.ts';
import {mountPixelReadScene} from './pixelReadScene.tsx';
import {createKindDrawScene} from './preview3dKindDrawScene.ts';
import {markModelStageAids} from '../src/react/preview3d/layers.ts';

const view = mountPixelReadScene(DEPTH_VIEWPORT), {width, height} = DEPTH_VIEWPORT;
const camera = new THREE.PerspectiveCamera(DEPTH_VIEW.fieldOfView, width / height, DEPTH_VIEW.near, DEPTH_VIEW.far);
camera.updateMatrixWorld();
// A square at an eye depth, wide enough to fill the view, or its right half.
function square(depth: number, material?: THREE.Material, half = false) {
  const side = 4 * depth, mesh = new THREE.Mesh(new THREE.PlaneGeometry(half ? side / 2 : side, side), material);
  mesh.position.set(half ? side / 4 : 0, 0, -depth);
  return mesh;
}
// The view's left half at an eye depth, exactly, so its texels split the view as the columns read it.
function leftHalf(depth: number, material: THREE.Material) {
  const across = depth * Math.tan(THREE.MathUtils.degToRad(DEPTH_VIEW.fieldOfView / 2)) * (width / height);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(across, 4 * depth), material);
  mesh.position.set(-across / 2, 0, -depth);
  return mesh;
}
// The cut-out's coverage, two texels across the view's left half: its outer quarter a hole, its inner quarter solid.
const hole = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0, 255, 255, 255, 255]), 2, 1);
hole.needsUpdate = true;
const aid = square(DEPTH_SURFACE.aid, new THREE.MeshBasicMaterial());
markModelStageAids([aid]);
const scene = new THREE.Scene(), sheet = square(DEPTH_SURFACE.sheet);
scene.add(square(DEPTH_SURFACE.wall, new THREE.MeshBasicMaterial()), aid,
  leftHalf(DEPTH_SURFACE.cutout, new THREE.MeshBasicMaterial({alphaMap: hole, alphaTest: 0.5})),
  square(DEPTH_SURFACE.panel, new THREE.MeshBasicMaterial(), true),
  square(DEPTH_SURFACE.veil, new THREE.MeshBasicMaterial({transparent: true, opacity: 0.5, depthWrite: false})), sheet);
// The stage's own route: the kind material holds the draw's depth target from its build (linearFrame.ts).
const {draw, material} = createKindDrawScene(view.renderer, scene, camera,
  {kind: DEPTH_KIND, program: DEPTH_PROGRAM, record: {kind: DEPTH_KIND.id, values: {}}});

window.drawSceneDepth = async () => {
  sheet.material = await material();
  const {renderer} = view, programs = () => {
    const held = renderer.info.programs;
    if (!held) throw new Error('three keeps no list of its programs.');
    return held.length;
  };
  const frame = view.readFrame(draw.draw), once = programs();
  draw.draw();
  const gl = renderer.getContext(), mask: unknown = gl.getParameter(gl.COLOR_WRITEMASK);
  return {...frame, shadowsUpdate: renderer.shadowMap.autoUpdate, programs: [once, programs()],
    colourMask: Array.isArray(mask) ? mask.map(Boolean) : []};
};
