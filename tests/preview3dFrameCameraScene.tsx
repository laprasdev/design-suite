import {createModelFrameInbox, MODEL_ACTOR_SURFACES, MODEL_STAGE_CLOCK, MODEL_STAGE_FRAMING,
  MODEL_STAGE_SURFACE_MODE, modelRendererId, modelStageDescription, modelSurfaceKind, type ModelColor,
  type ModelStageController, type ModelStageDescription, type ModelStageSurfaceMode}
  from '../src/react/preview3d/model.ts';
import {createModelStage} from '../src/react/preview3d/stage.ts';
import {THEME, declaration, describing, stageLook, standingAt} from './preview3dActorFixture.ts';
import {ALT_CANVAS_SRGB, BOTTOM_CANVAS_SRGB, CAMERA_FOG, CAMERA_HOST_ID, CAMERA_ROUTES, FRAME_CAMERA_POSE,
  PAINTED_KIND_ID, TOP_CANVAS_SRGB, type FrameCameraSceneDriver} from './preview3dFrameCameraCases.ts';
import {makePanelGlbBytes, PANEL_GLB} from './preview3dPanelGlb.ts';
import {renderScene} from './renderScene.tsx';

const SETTLE_FRAMES = 6;
const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
const cssRgb = ([r, g, b]: ModelColor) =>
  `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;

function paintStripedCanvas(top: ModelColor, bottom: ModelColor): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Expected 2D canvas context.');
  ctx.fillStyle = cssRgb(top);
  ctx.fillRect(0, 0, 64, 32);
  ctx.fillStyle = cssRgb(bottom);
  ctx.fillRect(0, 32, 64, 32);
  return canvas;
}

function readPixelAt(canvas: HTMLCanvasElement, fx: number, fy: number): readonly [number, number, number] {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('Expected WebGL2 canvas.');
  const x = Math.floor(canvas.width * fx), y = Math.floor(canvas.height * fy);
  const pixel = new Uint8Array(4);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return [pixel[0], pixel[1], pixel[2]];
}

async function bootFrameCameraScene(programSha256: string): Promise<void> {
  document.body.style.margin = '0';
  const host = document.getElementById(CAMERA_HOST_ID);
  if (!host) throw new Error(`Missing #${CAMERA_HOST_ID} element.`);
  const primaryCanvas = paintStripedCanvas(TOP_CANVAS_SRGB, BOTTOM_CANVAS_SRGB);
  const altCanvas = paintStripedCanvas(ALT_CANVAS_SRGB, ALT_CANVAS_SRGB);
  const kind = modelSurfaceKind({
    id: PAINTED_KIND_ID,
    parameters: {MainTex: {type: 'texture', space: 'srgb'}},
    inert: {},
    attributes: ['uv'],
    light: 'standard',
    coverage: 'opaque',
    side: 'double',
    fog: true,
    displacement: null,
    webProgram: {path: CAMERA_ROUTES.program, sha256: programSha256},
  }, PAINTED_KIND_ID);

  const buildDescription = (options: {
    readonly image: HTMLCanvasElement | null;
    readonly mode: ModelStageSurfaceMode;
    readonly fogged: boolean;
    readonly frontPose: boolean;
  }) => {
    const actor = declaration(PANEL_GLB.id, PANEL_GLB.id, {
      asset: {id: PANEL_GLB.id, path: CAMERA_ROUTES.panel},
      placement: standingAt([0, 0, 0]),
      surfaces: options.image === null
        ? {from: MODEL_ACTOR_SURFACES.file}
        : {from: MODEL_ACTOR_SURFACES.set, set: 'painted'},
    });
    const surfaceSets = options.image === null ? {} : {
      painted: {
        [modelRendererId(0, 0)]: {
          kind: PAINTED_KIND_ID,
          values: {MainTex: {texture: {image: options.image, wrap: ['clamp', 'clamp'], scale: [1, 1], offset: [0, 0]}}},
        },
      },
    };
    return modelStageDescription(describing({
      actors: {focus: PANEL_GLB.id, actors: [actor]},
      surfaceSets,
      surfaceMode: options.mode,
      framing: options.frontPose
        ? {kind: MODEL_STAGE_FRAMING.pose, position: [0, 1, 2.2], target: [0, 1, 0], fieldOfView: 45}
        : {kind: MODEL_STAGE_FRAMING.focus},
      orbit: false,
      lighting: {
        time: 'studio',
        times: [{id: 'studio', label: 'Studio', look: stageLook({fog: options.fogged ? CAMERA_FOG : null})}],
      },
    }));
  };

  const initial = buildDescription({image: null, mode: MODEL_STAGE_SURFACE_MODE.lit, fogged: false, frontPose: false});
  const inbox = createModelFrameInbox();
  inbox.describe(initial, [kind]);
  const controller = await new Promise<ModelStageController>((ready, reject) => createModelStage(
    host, initial, THEME, ready, reject,
    {reviewKey: 'frameCameraReview', clock: MODEL_STAGE_CLOCK.external, floor: true, grid: true, kinds: [kind]},
  ));
  inbox.attach(value => controller.setFrame(value));
  const applyDescription = async (next: ModelStageDescription) => {
    await controller.setDescription(next);
    inbox.describe(next, [kind]);
  };
  const deliver = (rawFrame: unknown) => {
    if (inbox.receive(rawFrame) === 'error') throw inbox.failure;
  };
  const canvas = host.querySelector('canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Expected stage canvas.');
  const settle = async () => {
    for (let index = 0; index < SETTLE_FRAMES; index++) await nextFrame();
  };

  // Pre-allocated mutable frame records so runTicks measures only the stage's own per-tick allocations.
  const entityPos: [number, number, number] = [0, 0, 0];
  const entityRot: [number, number, number, number] = [0, 0, 0, 1];
  const entityScale: [number, number, number] = [1, 1, 1];
  const entityRecord = {
    entityId: PANEL_GLB.id, modelId: PANEL_GLB.id,
    pose: {position: entityPos, rotationQuaternion: entityRot, scale: entityScale},
    animationLayers: [] as const, partPoses: [] as const, materials: [] as const,
  };
  const cameraPos: [number, number, number] = [...FRAME_CAMERA_POSE.position];
  const cameraTarget: [number, number, number] = [...FRAME_CAMERA_POSE.target];
  const cameraInput = {position: cameraPos, target: cameraTarget, fieldOfView: FRAME_CAMERA_POSE.fieldOfView};
  const frameWithoutCamera = {simulationTimeSeconds: 0, entities: [entityRecord]};
  const frameWithCamera = {simulationTimeSeconds: 0, entities: [entityRecord], camera: cameraInput};

  const showDefaultCamera = async (image: HTMLCanvasElement | null) => {
    await applyDescription(buildDescription(
      {image, mode: MODEL_STAGE_SURFACE_MODE.lit, fogged: false, frontPose: false}));
    controller.resetCamera();
    await settle();
    return controller.snapshot().camera;
  };
  const driver: FrameCameraSceneDriver = {
    showFileDefaultCamera: () => showDefaultCamera(null),
    async showFileFrameCamera() {
      await applyDescription(buildDescription(
        {image: null, mode: MODEL_STAGE_SURFACE_MODE.lit, fogged: false, frontPose: false}));
      deliver({simulationTimeSeconds: 0.5, entities: [entityRecord], camera: FRAME_CAMERA_POSE});
      await settle();
      return controller.snapshot().camera;
    },
    showImageDefaultCamera: () => showDefaultCamera(primaryCanvas),
    async showSwappedImage() {
      await applyDescription(buildDescription(
        {image: altCanvas, mode: MODEL_STAGE_SURFACE_MODE.color, fogged: false, frontPose: true}));
      await settle();
      return readPixelAt(canvas, 0.5, 0.5);
    },
    async resetView() {
      controller.resetCamera();
      await settle();
      return controller.snapshot().camera;
    },
    async sampleBands(mode, fogged) {
      await applyDescription(buildDescription({image: primaryCanvas, mode, fogged, frontPose: true}));
      await settle();
      return {
        upperRgb: readPixelAt(canvas, 0.5, 0.65),
        lowerRgb: readPixelAt(canvas, 0.5, 0.35),
        surfaceMode: controller.snapshot().surfaceMode,
        camera: controller.snapshot().camera,
      };
    },
    runTicks(count, withCamera) {
      for (let tick = 1; tick <= count; tick++) {
        entityRecord.pose.position[0] = (tick % 8) * 0.01;
        if (withCamera) {
          frameWithCamera.simulationTimeSeconds = tick * 0.016;
          cameraInput.position[0] = FRAME_CAMERA_POSE.position[0] + (tick % 8) * 0.01;
          cameraInput.target[0] = (tick % 4) * 0.005;
          deliver(frameWithCamera);
        } else {
          frameWithoutCamera.simulationTimeSeconds = tick * 0.016;
          deliver(frameWithoutCamera);
        }
      }
    },
  };
  window.frameCameraScene = driver;
}

window.makePanelGlbBytes = makePanelGlbBytes;
window.bootFrameCameraScene = bootFrameCameraScene;
renderScene(<div id={CAMERA_HOST_ID} style={{width: '100vw', height: '100vh'}}/>);
