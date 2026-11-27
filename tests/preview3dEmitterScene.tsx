// Mounted in Chromium by preview3dEmitters.browser.test.ts: the stage with one panel actor and its two emitters, run by
// engine frames on the external clock, and the share and span of the picture the emitters change.
import {createModelFrameInbox, MODEL_STAGE_CLOCK, MODEL_STAGE_FRAMING, modelStageDescription,
  type ModelStageController} from '../src/react/preview3d/model.ts';
import {MODEL_EMITTER_CHANGE} from '../src/react/preview3d/emitterFrameModel.ts';
import {createModelStage} from '../src/react/preview3d/stage.ts';
import {THEME, declaration, describing, standingAt} from './preview3dActorFixture.ts';
import {EMITTER_HOST_ID, EMITTER_SCENE_LIGHTING, EMITTER_SCENE_PROFILES, EMITTER_SCENE_ROUTED, EMITTER_SCENE_RUN,
  type EmitterDraws, type EmitterSceneDriver} from './preview3dEmitterSceneCases.ts';
import {emitterChange} from './preview3dEmitterCases.ts';
import {makePanelGlbBytes, PANEL_GLB} from './preview3dPanelGlb.ts';
import {FRAME_PIXEL, readFramePixels} from './framePixels.ts';
import {renderScene} from './renderScene.tsx';
import {seededRandom} from '../src/seededRandom.ts';

const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
// A pixel counts as changed when a channel moves more than this, past dithering.
const CHANGED_BYTES = 2;

function pixels(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('Expected the stage\'s WebGL2 canvas.');
  return readFramePixels(gl);
}
// The draw calls of each frame, counted by wrapping the stage's context: instanced draws by their instance count, and
// points draws.
function countDraws(gl: WebGL2RenderingContext) {
  const counted = {instances: new Array<number>(), points: 0};
  const drawElementsInstanced = gl.drawElementsInstanced.bind(gl), drawArrays = gl.drawArrays.bind(gl);
  gl.drawElementsInstanced = (mode, count, type, offset, instances) => {
    counted.instances.push(instances);
    drawElementsInstanced(mode, count, type, offset, instances);
  };
  gl.drawArrays = (mode, first, count) => {
    if (mode === gl.POINTS) counted.points++;
    drawArrays(mode, first, count);
  };
  return {take(): EmitterDraws {
    const taken = {instances: counted.instances.splice(0), points: counted.points};
    counted.points = 0;
    return taken;
  }};
}
// How many pixels changed, and the area of the box around them.
function changedPixels(before: Uint8Array, after: Uint8Array, width: number) {
  let changed = 0, left = width, right = -1, bottom = Number.POSITIVE_INFINITY, top = -1;
  for (let pixel = 0; pixel < before.length; pixel += FRAME_PIXEL.stride) {
    for (let channel = 0; channel < FRAME_PIXEL.colorChannels; channel++) {
      if (Math.abs(before[pixel + channel] - after[pixel + channel]) > CHANGED_BYTES) {
        const column = (pixel / FRAME_PIXEL.stride) % width, row = Math.floor(pixel / FRAME_PIXEL.stride / width);
        changed++;
        left = Math.min(left, column);
        right = Math.max(right, column);
        bottom = Math.min(bottom, row);
        top = Math.max(top, row);
        break;
      }
    }
  }
  return {changed, extent: right < left ? 0 : (right - left + 1) * (top - bottom + 1)};
}

async function bootEmitterScene(): Promise<EmitterSceneDriver> {
  document.body.style.margin = '0';
  const host = document.getElementById(EMITTER_HOST_ID);
  if (!host) throw new Error(`Missing #${EMITTER_HOST_ID} element.`);
  const actor = {...declaration(PANEL_GLB.id, PANEL_GLB.id, {asset: {id: PANEL_GLB.id, path: PANEL_GLB.route},
    placement: standingAt([0, 0, 0])}), emitters: EMITTER_SCENE_PROFILES};
  const description = modelStageDescription(describing({actors: {focus: PANEL_GLB.id, actors: [actor]},
    framing: {kind: MODEL_STAGE_FRAMING.pose, position: [0, 1.2, 4], target: [0, 1, 0], fieldOfView: 45},
    orbit: false, lighting: EMITTER_SCENE_LIGHTING}));
  const inbox = createModelFrameInbox();
  inbox.describe(description, []);
  const controller = await new Promise<ModelStageController>((ready, reject) => createModelStage(host, description,
    THEME, ready, reject, {reviewKey: 'emitterReview', clock: MODEL_STAGE_CLOCK.external, floor: true, grid: false,
      kinds: []}));
  inbox.attach(value => controller.setFrame(value));
  const canvas = host.querySelector('canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Expected the stage canvas.');
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('Expected the stage\'s WebGL2 canvas.');
  const draws = countDraws(gl);
  const position: [number, number, number] = [0, 0, 0];
  const deliver = (time: number, emitters: readonly unknown[]) => {
    const entity = {entityId: PANEL_GLB.id, modelId: PANEL_GLB.id, pose: {position, rotationQuaternion: [0, 0, 0, 1],
      scale: [1, 1, 1]}, animationLayers: [], partPoses: [], materials: [], emitters};
    if (inbox.receive({simulationTimeSeconds: time, entities: [entity]}) === 'error') throw inbox.failure;
  };
  const drawn = async (time: number, emitters: readonly unknown[]) => {
    deliver(time, emitters);
    draws.take();
    await nextFrame();
    return {read: pixels(canvas), draws: draws.take()};
  };
  // Frame records made once, so the ticks measure only what the stage allocates. A start routes every value, as a
  // state that declares them does.
  const {dark, sparse, wide} = EMITTER_SCENE_ROUTED, everyRouted = {...dark, ...sparse, ...wide};
  const changes = (change: string, routed: object) => Object.keys(EMITTER_SCENE_PROFILES)
    .map(profile => ({...emitterChange(change, profile), ...routed}));
  const turns = [changes(MODEL_EMITTER_CHANGE.started, everyRouted), changes(MODEL_EMITTER_CHANGE.stopped, {})];
  const still: readonly unknown[] = [];
  const tickEntity = {entityId: PANEL_GLB.id, modelId: PANEL_GLB.id, pose: {position, rotationQuaternion: [0, 0, 0, 1],
    scale: [1, 1, 1]}, animationLayers: still, partPoses: still, materials: still, emitters: still};
  const tickFrame = {simulationTimeSeconds: 0, entities: [tickEntity]};
  let tickTime = 0;
  return {
    runTicks(count, changing) {
      for (let tick = 0; tick < count; tick++) {
        tickTime += EMITTER_SCENE_RUN.step;
        tickFrame.simulationTimeSeconds = tickTime;
        tickEntity.emitters = changing ? turns[tick % turns.length] : still;
        if (inbox.receive(tickFrame) === 'error') throw inbox.failure;
      }
    },
    async run(routed) {
      const {step, frames, travel, seed} = EMITTER_SCENE_RUN;
      Math.random = seededRandom(seed);
      // The panel where the run ends, before any particle: what the emitters change is the only difference.
      position[0] = travel;
      const before = await drawn(0, []);
      position[0] = 0;
      let after = await drawn(step, Object.keys(EMITTER_SCENE_PROFILES).map(profile =>
        ({...emitterChange(MODEL_EMITTER_CHANGE.started, profile), ...routed})));
      for (let frame = 2; frame <= frames; frame++) {
        position[0] = travel * frame / frames;
        after = await drawn(frame * step, []);
      }
      return {...changedPixels(before.read, after.read, canvas.width), pixels: canvas.width * canvas.height,
        draws: {before: before.draws, after: after.draws}};
    },
  };
}

window.makePanelGlbBytes = makePanelGlbBytes;
window.bootEmitterScene = bootEmitterScene;
renderScene(<div id={EMITTER_HOST_ID} style={{width: '100vw', height: '100vh'}}/>);
