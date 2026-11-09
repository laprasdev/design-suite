import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MODEL_STAGE as settings} from './model.ts';
import type {ModelStagePolicy, ModelStageTheme} from './model.ts';
import {createModelFraming} from './camera.ts';
import {disposeModelObject} from './asset.ts';

export function createModelScene(host: HTMLElement, theme: ModelStageTheme, policy: ModelStagePolicy) {
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatioLimit));
  renderer.setClearColor(theme.colors.stage);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(settings.fieldOfView, 1, settings.nearPlane, settings.farPlane);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = policy.orbit;
  controls.minDistance = settings.cameraMinimum;
  controls.maxDistance = settings.cameraMaximum;
  controls.maxPolarAngle = Math.PI / 2;
  scene.add(new THREE.HemisphereLight(theme.colors.text, theme.colors.surface, settings.ambientIntensity));
  const light = new THREE.DirectionalLight(theme.colors.text, settings.lightIntensity);
  light.position.fromArray(settings.keyLightPosition);
  scene.add(light);
  if (policy.floor) {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(settings.floorRadius, settings.floorSegments),
      new THREE.MeshStandardMaterial({color: theme.colors.surface, roughness: 1}));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = settings.floorOffset;
    scene.add(floor);
  }
  if (policy.grid) {
    const grid = new THREE.GridHelper(settings.gridSize, settings.gridDivisions,
      theme.colors.accentDeep, theme.colors.surfaceHi);
    grid.position.y = settings.floorOffset / 2;
    scene.add(grid);
  }
  const framing = createModelFraming(camera, controls, policy.orbit);
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
    renderer, scene, camera, controls, ...framing,
    dispose() {
      observer.disconnect();
      controls.dispose();
      disposeModelObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
