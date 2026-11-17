// The stage fog scene's shared constants and types (preview3dFogScene.tsx, preview3dFog.browser.test.ts): one flat
// patch mesh placed at two depths under a time with fog and a twin time with fog: null.
import {
  MODEL_STAGE_FRAMING, MODEL_STAGE_TONE_CURVE, modelStageDescription,
  type ModelColor, type ModelStageDescription, type ModelStageFog, type ModelStageSurfaceMode, type ModelStageTime,
} from '../src/react/preview3d/model.ts';
import {declaration, describing, stageLook, standingAt} from './preview3dActorFixture.ts';

export const FOG_SCENE_ENTRY = 'tests/preview3dFogScene.tsx';
export const FOG_HOSTS_ID = 'fog-stage-hosts';
export const FOG_PATCH_URL = 'http://scene.local/patch.glb';
export const FOG_VIEWPORT = Object.freeze({width: 320, height: 200});
export const FOG_CURVE = MODEL_STAGE_TONE_CURVE.acesFilmic;
export const PATCH_BASE_COLOR: ModelColor = Object.freeze([0.2, 0.6, 0.8]);
export const PATCH_EMISSIVE: ModelColor = Object.freeze([0.2, 0.8, 0.2]);
export const NEAR_PATCH_DEPTH = 9;
export const FAR_PATCH_DEPTH = 19;
export const NEAR_CENTER: readonly [number, number, number] = Object.freeze([-1.8, 0, -NEAR_PATCH_DEPTH]);
export const FAR_CENTER: readonly [number, number, number] = Object.freeze([3.8, 0, -FAR_PATCH_DEPTH]);
const POSE_POSITION: readonly [number, number, number] = Object.freeze([0, 0, 0]);
const POSE_TARGET: readonly [number, number, number] = Object.freeze([0, 0, -10]);
export const FOG_FRAMING = Object.freeze({
  kind: MODEL_STAGE_FRAMING.pose,
  position: POSE_POSITION,
  target: POSE_TARGET,
});
const NEAR_FOG_COLOR: ModelColor = Object.freeze([0.1, 0.7, 0.95]);
const FAR_FOG_COLOR: ModelColor = Object.freeze([0.85, 0.1, 0.55]);
export const FOG_SPEC: ModelStageFog = Object.freeze({
  near: {distance: 4, color: NEAR_FOG_COLOR},
  far: {distance: 24, color: FAR_FOG_COLOR},
  height: null,
});

export const FOG_TIME_ID = Object.freeze({haze: 'haze', clear: 'clear'} as const);
export type FogTimeId = typeof FOG_TIME_ID[keyof typeof FOG_TIME_ID];

const unlitSceneLook = (fog: ModelStageFog | null) => stageLook({
  backdrop: [0.02, 0.03, 0.05],
  key: {color: [1, 1, 1], strength: 0, direction: [0, 0, 1]},
  ambient: {sky: [1, 1, 1], ground: [1, 1, 1], strength: 0},
  aids: {floor: [0.1, 0.1, 0.1], share: 1},
  fog,
  toneCurve: FOG_CURVE,
});

export const CLEAR_TIME: ModelStageTime = Object.freeze({
  id: FOG_TIME_ID.clear, label: 'Clear', look: unlitSceneLook(null),
});
export const HAZE_TIME: ModelStageTime = Object.freeze({
  id: FOG_TIME_ID.haze, label: 'Haze', look: unlitSceneLook(FOG_SPEC),
});
export const FOG_SCENE_TIMES: readonly ModelStageTime[] = Object.freeze([HAZE_TIME, CLEAR_TIME]);
export const CLEAR_ONLY_TIMES: readonly ModelStageTime[] = Object.freeze([CLEAR_TIME]);

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

export function fogStageDescription(
  assetUrl: string, time: FogTimeId, surfaceMode: ModelStageSurfaceMode, times: readonly ModelStageTime[],
): ModelStageDescription {
  const patch = (id: string, center: readonly [number, number, number], scaleXY: number) =>
    declaration(id, 'patch', {
      asset: {id: 'patch', path: assetUrl},
      placement: {...standingAt(center), scale: [scaleXY, scaleXY, 1]},
    });
  return modelStageDescription(describing({
    actors: {focus: 'near', actors: [patch('near', NEAR_CENTER, 1), patch('far', FAR_CENTER, 2)]},
    framing: FOG_FRAMING,
    orbit: false,
    lighting: {time, times},
    surfaceMode,
  }));
}
