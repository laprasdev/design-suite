import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MODEL_STAGE as settings} from './model.ts';
import type {ModelStagePolicy, ModelStageTheme} from './model.ts';
import {createModelFraming} from './camera.ts';
import {disposeModelObject} from './asset.ts';
import {createModelLighting} from './lighting.ts';

export function createModelScene(host: HTMLElement, theme: ModelStageTheme, policy: ModelStagePolicy) {
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatioLimit));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(settings.fieldOfView, 1, settings.nearPlane, settings.farPlane);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = settings.cameraMinimum;
  controls.maxDistance = settings.cameraMaximum;
  controls.maxPolarAngle = Math.PI / 2;
  const lighting = createModelLighting(renderer, theme);
  scene.add(...lighting.lights);
  if (policy.floor) {
    const surface = new THREE.MeshStandardMaterial({roughness: 1});
    const floor = new THREE.Mesh(new THREE.CircleGeometry(settings.floorRadius, settings.floorSegments), surface);
    lighting.floor(surface);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = settings.floorOffset;
    scene.add(floor);
  }
  if (policy.grid) {
    const grid = new THREE.GridHelper(settings.gridSize, settings.gridDivisions,
      theme.colors.accentDeep, theme.colors.surfaceHi);
    grid.position.y = settings.floorOffset / 2;
    scene.add(grid);
    lighting.attach([grid]);
  }
  const framing = createModelFraming(camera, controls);
  const resize = () => {
    const {clientWidth: width, clientHeight: height} = host;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    framing.requestFit();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  return {
    renderer, scene, camera, controls, lighting, ...framing,
    /** The frame's one draw: the scene through the camera, to the canvas. */
    draw() {renderer.render(scene, camera);},
    dispose() {
      observer.disconnect();
      controls.dispose();
      disposeModelObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
