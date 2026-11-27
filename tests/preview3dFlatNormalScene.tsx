// Mounted in Chromium by preview3dFlatNormal.browser.test.ts: draws a square facing the camera through the stage's kind
// materials and its own texture registry, lit by one oblique light and nothing else, and reads the frame's bytes back
// (pixelReadScene.tsx).
import * as THREE from 'three';
import {modelSurfaceKinds} from '../src/react/preview3d/surfaceKindModel.ts';
import {modelSurfaceRecord} from '../src/react/preview3d/surfaceModel.ts';
import {createModelSurfaceMaterials} from '../src/react/preview3d/surfaceMaterials.ts';
import {createModelTextures, decodeModelImage} from '../src/react/preview3d/textures.ts';
import {FLAT_NORMAL_KIND, FLAT_NORMAL_PROGRAM, FLAT_NORMAL_VIEWPORT, flatNormalRecord, NORMAL_DECODE}
  from './preview3dFlatNormalCases.ts';
import {mountPixelReadScene} from './pixelReadScene.tsx';
import {kindStage} from './preview3dKindFixture.ts';

const view = mountPixelReadScene(FLAT_NORMAL_VIEWPORT);
const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.set(0, 0, 5);
camera.updateMatrixWorld();
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(1, 1.5, 2);
scene.add(light);
const square = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
scene.add(square);
const program = new TextEncoder().encode(FLAT_NORMAL_PROGRAM).buffer;
const read = async () => program;
const {shared, sceneReaders, changes} = kindStage(scene);
const materials = createModelSurfaceMaterials({kinds: modelSurfaceKinds([FLAT_NORMAL_KIND]), shared, sceneReaders,
  changes, read,
  textures: createModelTextures(read, decodeModelImage)});
const records = new Map(Object.values(NORMAL_DECODE).map(decode => [decode,
  modelSurfaceRecord(flatNormalRecord(decode), `decode ${decode}`)]));
const loaded = Promise.all(materials.load([...records.values()]).pending);

window.drawFlatNormal = async decode => {
  await loaded;
  const record = records.get(decode);
  if (!record) throw new Error(`No record decodes ${decode}.`);
  square.material = materials.material(record).material;
  return view.readFrame(() => view.renderer.render(scene, camera));
};
