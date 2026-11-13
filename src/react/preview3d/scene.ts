import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MODEL_STAGE as settings} from './model.ts';
import type {ModelStagePolicy, ModelStageTheme} from './model.ts';
import {createModelFraming} from './camera.ts';
import {disposeModelObject} from './asset.ts';
import {createModelLighting} from './lighting.ts';
import {modelStageBuiltInTimes} from './lightingModel.ts';
import {createModelFog} from './fog.ts';
import {createModelDraw} from './draw.ts';

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

export function createModelScene(host: HTMLElement, theme: ModelStageTheme, policy: ModelStagePolicy) {
  // The theme is read before anything is built, so a theme the stage refuses leaves no canvas or context behind.
  const builtIn = modelStageBuiltInTimes(theme.colors);
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatioLimit));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(settings.fieldOfView, 1, settings.nearPlane, settings.farPlane);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = settings.cameraMinimum;
  controls.maxDistance = settings.cameraMaximum;
  controls.maxPolarAngle = Math.PI / 2;
  const fog = createModelFog(scene);
  const frame = createModelDraw(renderer, scene, camera);
  const lighting = createModelLighting(renderer, builtIn, {fog, output: frame});
  scene.add(...lighting.lights, ...createModelStageAids(theme, policy, lighting));
  const framing = createModelFraming(camera, controls);
  const resize = () => {
    const {clientWidth: width, clientHeight: height} = host;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    frame.resize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    framing.requestFit();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  return {
    renderer, scene, camera, controls, lighting, fog, ...framing,
    /** The frame's one draw, straight or through the look's glow; and the triangles its scene pass drew. */
    draw: frame.draw,
    triangles: () => frame.triangles,
    dispose() {
      observer.disconnect();
      controls.dispose();
      disposeModelObject(scene);
      frame.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
