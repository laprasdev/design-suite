import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MODEL_STAGE as settings} from './model.ts';
import type {ModelStagePolicy, ModelStageTheme} from './model.ts';
import {createModelFraming} from './camera.ts';
import {disposeModelObject} from './asset.ts';
import {createModelLighting} from './lighting.ts';
import {modelStageBuiltInTimes} from './builtInTimes.ts';
import {createModelFog} from './fog.ts';
import {createModelDraw, type ModelDrawContext} from './draw.ts';
import {loadModelGlowPasses} from './glow.ts';
import {createModelStageSharedValues} from './sharedValues.ts';
import {markModelStageAids, markModelStageLights} from './layers.ts';

type AidLighting = Pick<ReturnType<typeof createModelLighting>, 'floor' | 'attach'>;
/** The stage's own floor and grid, as its policy asks: aids, so they take no fog; the floor is lit by the look. */
export function createModelStageAids(theme: ModelStageTheme, policy: ModelStagePolicy, lighting: AidLighting) {
  const aids: THREE.Object3D[] = [];
  if (policy.floor) {
    const surface = new THREE.MeshStandardMaterial({roughness: 1, fog: false});
    const floor = new THREE.Mesh(new THREE.CircleGeometry(settings.floorRadius, settings.floorSegments), surface);
    lighting.floor(surface);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = settings.floorOffset;
    aids.push(floor);
  }
  if (policy.grid) {
    const grid = new THREE.GridHelper(settings.gridSize, settings.gridDivisions,
      theme.colors.accentDeep, theme.colors.surfaceHi);
    grid.material.fog = false;
    grid.position.y = settings.floorOffset / 2;
    lighting.attach([grid]);
    aids.push(grid);
  }
  return aids;
}

// A browser the frame cannot be drawn in is refused before the canvas joins the page, and its context is let go.
function drawnOrReleased<T>(renderer: THREE.WebGLRenderer, create: () => T): T {
  try {
    return create();
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}
/** The stage's three.js side: its renderer and canvas, scene, camera and controls, lighting, fog and draw, sized to its
 * host at creation and at each `resize`. `modes` is what the Surface mode in force asks of the frame, which the draw
 * reads each frame (draw.ts). */
export function createModelScene(host: HTMLElement, theme: ModelStageTheme, policy: ModelStagePolicy,
  modes: ModelDrawContext['modes']) {
  // The theme is read before anything is built, so a theme the stage refuses leaves no canvas or context behind.
  const builtIn = modelStageBuiltInTimes(theme.colors);
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatioLimit));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  // The far plane is the look's, set as the lighting applies its first time.
  const camera = new THREE.PerspectiveCamera(settings.fieldOfView, 1, settings.nearPlane);
  const frame = drawnOrReleased(renderer, () => createModelDraw(renderer, scene, camera,
    {loadPasses: loadModelGlowPasses, modes}));
  host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = settings.cameraMinimum;
  controls.maxDistance = settings.cameraMaximum;
  controls.maxPolarAngle = Math.PI / 2;
  const framing = createModelFraming(camera, controls);
  const fog = createModelFog(scene);
  const shared = createModelStageSharedValues();
  const lighting = createModelLighting(builtIn, {fog, framing, output: frame, shared});
  const aids = createModelStageAids(theme, policy, lighting);
  markModelStageAids(aids);
  markModelStageLights(lighting.lights);
  scene.add(lighting.backdrop, ...lighting.lights, ...aids);
  const resize = () => {
    const {clientWidth: width, clientHeight: height} = host;
    if (!width || !height) return;
    frame.resize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    framing.requestFit();
  };
  const dispose = () => {
    controls.dispose();
    disposeModelObject(scene);
    frame.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
  // A size the frame's budget refuses at creation goes on, with what was built released.
  try {resize();} catch (error) {dispose(); throw error;}
  return {
    renderer, scene, camera, controls, lighting, fog, shared,
    // The framing the stage drives; the far plane is the look's, set through the lighting alone.
    requestFit: framing.requestFit, poseCoordinates: framing.poseCoordinates, frame: framing.frame, fit: framing.fit,
    cameraSnapshot: framing.cameraSnapshot,
    /** Compiles an object's programs inside the staged build (draw.ts). */
    compile: frame.compile,
    /** The frame's one draw, straight or through the look's glow; and the triangles its scene pass drew. */
    draw: frame.draw,
    triangles: () => frame.triangles,
    /** Sizes the canvas, the frame and the camera to the host as it is now; a size past the frame's budget is refused
     * by name, and the canvas keeps the size it had. */
    resize,
    dispose,
  };
}
