import type {ModelStageCameraSnapshot, ModelStageFog, ModelStageSurfaceMode} from '../src/react/preview3d/model.ts';
import {TERRAIN_VIEWPORTS} from './preview3dTerrainCases.ts';

export const CAMERA_SCENE_ENTRY = 'tests/preview3dFrameCameraScene.tsx';
export const CAMERA_HOST_ID = 'frame-camera-host';
export const CAMERA_ROUTES = Object.freeze({
  panel: 'http://scene.local/panel.glb',
  program: 'http://scene.local/painted.glsl',
});
export const PAINTED_KIND_ID = 'painted-panel';
export const PAINTED_PROGRAM = `void kindSurface( inout vec4 diffuse, inout vec3 emissive ) {
  diffuse = surfaceParameterMainTex( vUv );
}`;
export const CAMERA_VIEWPORTS = TERRAIN_VIEWPORTS;
export const TOP_CANVAS_SRGB = Object.freeze([0.08, 0.72, 0.66] as const);
export const BOTTOM_CANVAS_SRGB = Object.freeze([0.88, 0.36, 0.14] as const);
export const ALT_CANVAS_SRGB = Object.freeze([0.24, 0.34, 0.86] as const);
export const CAMERA_FOG: ModelStageFog = Object.freeze({
  near: {distance: 1, color: [0.5, 0.55, 0.65] as const},
  far: {distance: 5, color: [0.5, 0.55, 0.65] as const},
  height: null,
});
export const FRAME_CAMERA_POSE = Object.freeze({
  position: [1.15, 1.55, 3.6] as const,
  target: [0, 1, 0] as const,
  fieldOfView: 54,
});

export interface CanvasBandsSample {
  readonly upperRgb: readonly [number, number, number];
  readonly lowerRgb: readonly [number, number, number];
  readonly surfaceMode: ModelStageSurfaceMode;
  readonly camera: ModelStageCameraSnapshot;
}

export interface FrameCameraSceneDriver {
  showBefore(): Promise<ModelStageCameraSnapshot>;
  showAfter(): Promise<ModelStageCameraSnapshot>;
  showSwappedImage(): Promise<readonly [number, number, number]>;
  resetView(): Promise<ModelStageCameraSnapshot>;
  sampleBands(mode: ModelStageSurfaceMode, fogged: boolean): Promise<CanvasBandsSample>;
  runTicks(count: number, withCamera: boolean): void;
}

declare global {
  interface Window {
    makePanelGlbBytes: () => Promise<number[]>;
    bootFrameCameraScene: (programSha256: string) => Promise<void>;
    frameCameraScene: FrameCameraSceneDriver;
  }
}
