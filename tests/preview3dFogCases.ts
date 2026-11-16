// The stage fog scene's shared constants and types (preview3dFogScene.tsx, preview3dFog.browser.test.ts): one flat
// patch mesh placed at two depths under a time with fog and a twin time with fog: null.
import type {ModelStageFog, ModelStageLook} from '../src/react/preview3d/lookModel.ts';
import type {ModelStageActor, ModelStageDescription, ModelStageSurfaceMode} from '../src/react/preview3d/model.ts';

export const FOG_SCENE_ENTRY = 'tests/preview3dFogScene.tsx';
export const FOG_HOSTS_ID = 'fog-stage-hosts';
export const FOG_PATCH_URL = 'http://scene.local/patch.glb';
export const FOG_VIEWPORT = Object.freeze({width: 320, height: 200});
export const FOG_CURVE = 'aces-filmic' as const;
export const PATCH_BASE_COLOR = Object.freeze([0.2, 0.6, 0.8] as const);
export const PATCH_EMISSIVE = Object.freeze([0.2, 0.8, 0.2] as const);
export const NEAR_PATCH_DEPTH = 9;
export const FAR_PATCH_DEPTH = 19;
export const NEAR_CENTER = Object.freeze([-1.8, 0, -NEAR_PATCH_DEPTH] as const);
export const FAR_CENTER = Object.freeze([3.8, 0, -FAR_PATCH_DEPTH] as const);
export const FOG_SPEC: ModelStageFog = Object.freeze({
  near: {distance: 4, color: [0.1, 0.7, 0.95] as const},
  far: {distance: 24, color: [0.85, 0.1, 0.55] as const},
  height: null,
});

export type FogTimeId = 'haze' | 'clear';
export type RgbBytes = readonly [number, number, number];
export interface PatchSample {
  readonly nearRgb: RgbBytes;
  readonly farRgb: RgbBytes;
  readonly surfaceMode: ModelStageSurfaceMode;
  readonly lighting: string;
}
export interface FrameParity {
  readonly byteLength: number;
  readonly differingBytes: number;
  readonly firstDiff: string | null;
}
export interface FogSceneDriver {
  sample(time: FogTimeId, surfaceMode: ModelStageSurfaceMode): Promise<PatchSample>;
  compareNullFogWithNeverFogged(): Promise<FrameParity>;
}

declare global {
  interface Window {
    makePatchGlbBytes(): Promise<number[]>;
    bootFogScene(assetUrl: string): Promise<void>;
    fogScene: FogSceneDriver;
  }
}

const baseLook = (fog: ModelStageFog | null): ModelStageLook => ({
  backdrop: [0.02, 0.03, 0.05],
  key: {color: [1, 1, 1], strength: 0, direction: [0, 0, 1]},
  ambient: {sky: [1, 1, 1], ground: [1, 1, 1], strength: 0},
  shadow: [0, 0, 0],
  night: 0,
  aids: {floor: [0.1, 0.1, 0.1], share: 1},
  fog,
  toneCurve: FOG_CURVE,
  glow: null,
});

export function fogStageDescription(
  assetUrl: string, time: FogTimeId, surfaceMode: ModelStageSurfaceMode, includeHaze: boolean,
): ModelStageDescription {
  const clearTime = {id: 'clear', label: 'Clear', look: baseLook(null)};
  const times = includeHaze ? [{id: 'haze', label: 'Haze', look: baseLook(FOG_SPEC)}, clearTime] : [clearTime];
  const actor = (id: string, center: readonly [number, number, number], scaleXY: number): ModelStageActor => ({
    id, asset: {id: 'patch', path: assetUrl},
    placement: {position: center, rotationQuaternion: [0, 0, 0, 1], scale: [scaleXY, scaleXY, 1]},
    animation: {kind: 'rest'}, surfaces: {from: 'file'},
  });
  return {
    actors: {focus: 'near', actors: [actor('near', NEAR_CENTER, 1), actor('far', FAR_CENTER, 2)]},
    environment: null, framing: {kind: 'pose', position: [0, 0, 0], target: [0, 0, -10]}, orbit: false,
    lighting: {time, times}, surfaceSets: {}, display: 'model', surfaceMode, size: {rule: 'real'}, origin: 'file',
  };
}
