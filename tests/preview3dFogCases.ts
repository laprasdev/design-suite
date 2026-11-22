// The stage fog scene's shared constants and types (preview3dFogScene.tsx, preview3dFog.browser.test.ts): one flat
// patch mesh placed at two depths under a time with fog, a time with fog and a height layer, and a twin time with
// fog: null.
import * as THREE from 'three';
import {
  MODEL_STAGE, MODEL_STAGE_FRAMING, MODEL_STAGE_TONE_CURVE, modelStageDescription,
  type ModelColor, type ModelFileActor, type ModelStageDescription, type ModelStageFog,
  type ModelStageSurfaceMode, type ModelStageTime, type ModelVector,
} from '../src/react/preview3d/model.ts';
import {declaration, describing, stageLook, standingAt} from './preview3dActorFixture.ts';

export const FOG_SCENE_ENTRY = 'tests/preview3dFogScene.tsx';
export const FOG_HOSTS_ID = 'fog-stage-hosts';
export const FOG_PATCH_URL = 'http://scene.local/patch.glb';
export const FOG_VIEWPORT = Object.freeze({width: 320, height: 200});
export const FOG_CURVE = MODEL_STAGE_TONE_CURVE.acesFilmic;
export const PATCH_BASE_COLOR: ModelColor = Object.freeze([0.2, 0.6, 0.8]);
export const PATCH_EMISSIVE: ModelColor = Object.freeze([0.2, 0.8, 0.2]);
// The near patch is raised by its placement: its centre's object height is 0 and its world height is not, so the
// height layer shows which of the two the fog reads.
export const NEAR_CENTER: ModelVector = Object.freeze([-1.8, 1.2, -9]);
export const FAR_CENTER: ModelVector = Object.freeze([3.8, 0, -19]);
const POSE_POSITION: ModelVector = Object.freeze([0, 0, 0]);
const POSE_TARGET: ModelVector = Object.freeze([0, 0, -10]);
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
// A layer far wider than one pixel's height on the near patch, so the read pixel's offset from the centre stays within
// a byte, while the patch's object and world heights draw layers bytes apart.
export const FOG_LAYER_SPEC: ModelStageFog = Object.freeze({...FOG_SPEC, height: {base: -4, top: 6, strength: 0.8}});

export const FOG_TIME_ID = Object.freeze({haze: 'haze', layered: 'layered', clear: 'clear'} as const);
export type FogTimeId = typeof FOG_TIME_ID[keyof typeof FOG_TIME_ID];

const DEFAULT_LOOK = stageLook();

const unlitSceneLook = (fog: ModelStageFog | null) => stageLook({
  backdrop: [0.02, 0.03, 0.05],
  key: {...DEFAULT_LOOK.key, strength: 0},
  ambient: {...DEFAULT_LOOK.ambient, strength: 0},
  aids: {floor: [0.1, 0.1, 0.1], share: 1},
  fog,
  toneCurve: FOG_CURVE, exposure: 1,
});

export const CLEAR_TIME: ModelStageTime = Object.freeze({
  id: FOG_TIME_ID.clear, label: 'Clear', look: unlitSceneLook(null),
});
export const HAZE_TIME: ModelStageTime = Object.freeze({
  id: FOG_TIME_ID.haze, label: 'Haze', look: unlitSceneLook(FOG_SPEC),
});
export const LAYERED_TIME: ModelStageTime = Object.freeze({
  id: FOG_TIME_ID.layered, label: 'Layered', look: unlitSceneLook(FOG_LAYER_SPEC),
});
export const FOG_SCENE_TIMES: readonly ModelStageTime[] = Object.freeze([HAZE_TIME, LAYERED_TIME, CLEAR_TIME]);
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

export function framingCamera(width: number, height: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    MODEL_STAGE.fieldOfView, width / height, MODEL_STAGE.nearPlane, MODEL_STAGE.farPlane,
  );
  camera.position.fromArray(FOG_FRAMING.position);
  camera.lookAt(...FOG_FRAMING.target);
  camera.updateMatrixWorld();
  return camera;
}

export function fogStageDescription(
  assetUrl: string, time: FogTimeId, surfaceMode: ModelStageSurfaceMode, times: readonly ModelStageTime[],
): ModelStageDescription {
  const patch = (id: string, center: ModelVector, scaleXY: number): ModelFileActor => {
    const actor = declaration(id, 'patch', {placement: {...standingAt(center), scale: [scaleXY, scaleXY, 1]}});
    return {...actor, asset: {...actor.asset, path: assetUrl}};
  };
  return modelStageDescription(describing({
    actors: {focus: 'near', actors: [patch('near', NEAR_CENTER, 1), patch('far', FAR_CENTER, 2)]},
    framing: FOG_FRAMING,
    orbit: false,
    lighting: {time, times},
    surfaceMode,
  }));
}
