// What a browser scene mounts to draw one record of a kind as the stage does: the stage's own draw (draw.ts) with no
// curve and no glow, and its kind materials (surfaceMaterials.ts), whose material holds what its kind reads of the
// draw's frame from its build.
import type * as THREE from 'three';
import {createModelDraw} from '../src/react/preview3d/draw.ts';
import {loadModelGlowPasses} from '../src/react/preview3d/glow.ts';
import {modelSurfaceKinds} from '../src/react/preview3d/surfaceKindModel.ts';
import {modelSurfaceRecord} from '../src/react/preview3d/surfaceModel.ts';
import {createModelSurfaceMaterials} from '../src/react/preview3d/surfaceMaterials.ts';
import {createModelTextures, decodeModelImage} from '../src/react/preview3d/textures.ts';
import {kindStage} from './preview3dKindFixture.ts';

/** The kind's program and the one record drawn in it. */
export interface KindDrawn {
  readonly kind: object;
  readonly program: string;
  readonly record: unknown;
}

/** The draw over the scene, and the record's material, built once its program has loaded. */
export function createKindDrawScene(renderer: THREE.WebGLRenderer, scene: THREE.Scene,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, drawn: KindDrawn) {
  const program = new TextEncoder().encode(drawn.program).buffer, read = async () => program;
  const {shared, changes} = kindStage(scene);
  const draw = createModelDraw(renderer, scene, camera, {loadPasses: loadModelGlowPasses,
    modes: {inspecting: false, curved: false}, shared});
  const materials = createModelSurfaceMaterials({kinds: modelSurfaceKinds([drawn.kind]), shared,
    sceneReaders: draw.sceneReaders, changes, read, textures: createModelTextures(read, decodeModelImage)});
  const record = modelSurfaceRecord(drawn.record, 'sheet');
  const loaded = Promise.all(materials.load([record]).pending);
  draw.prepare({toneCurve: null, glow: null})();
  return {draw, material: async () => {
    await loaded;
    return materials.material(record).material;
  }};
}
