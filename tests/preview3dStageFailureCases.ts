// What preview3dStageFailure.browser.test.ts and its scene share: a stage drawing one patch, whose host is then grown.
export const STAGE_FAILURE_SCENE_ENTRY = 'tests/preview3dStageFailureScene.tsx';
export const STAGE_FAILURE_HOST_ID = 'stage-failure-host';
export const STAGE_FAILURE_PATCH_URL = 'http://scene.local/patch.glb';
export const STAGE_FAILURE_VIEWPORT = Object.freeze({width: 64, height: 48});
// The page frames a size change is given to reach the stage and the frames after it to show what it did.
export const SETTLING_FRAMES = 6;

/** What the stage has done by the time a host size has settled. */
export interface StageAfterResize {
  /** Each error `onError` heard, as `name: message`. */
  readonly failures: readonly string[];
  /** How many frames the stage asked for while the size settled. */
  readonly framesAsked: number;
  readonly canvas: readonly [number, number];
}

declare global {
  interface Window {
    makeStageFailurePatch(): Promise<number[]>;
    bootStageFailure(assetUrl: string): Promise<void>;
    resizeStageHost(width: number, height: number): Promise<StageAfterResize>;
  }
}
