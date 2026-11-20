// The stage scene mounted in Chromium by preview3dTerrain.browser.test.ts and preview3dTerrainMeasure.ts: a box on the
// stage's flat floor, or the same box on a rolling terrain drawn by a lit ground kind; it reports how many meshes a
// frame draws and what a terrain's description and frames cost.
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {MODEL_STAGE_CLOCK, MODEL_STAGE_FRAMING, modelStageDescription, modelSurfaceKind,
  type ModelStageController} from '../src/react/preview3d/model.ts';
import {createModelStage} from '../src/react/preview3d/stage.ts';
import {THEME, declaration, describing, standingAt} from './preview3dActorFixture.ts';
import {GROUND_ACTOR_ID, GROUND_KIND_ID, rollingTerrain, TERRAIN_HOST_ID, TERRAIN_ROUTES, type TerrainSceneDriver,
  FRAMES_TIMED, MEASURE_RUNS} from './preview3dTerrainCases.ts';
import {renderScene} from './renderScene.tsx';
import {modelActorIdentity} from '../src/react/preview3d/actorModel.ts';
import {modelStageRefit} from '../src/react/preview3d/descriptionModel.ts';

// Frames a fit is given to settle before what a frame draws is read.
const FRAMES_SETTLING = 30;
const nextFrame = () => new Promise<number>(next => requestAnimationFrame(next));
const median = (values: number[]) => values.toSorted((a, b) => a - b)[values.length >> 1];
const timed = (run: () => unknown) => {
  const started = performance.now();
  run();
  return performance.now() - started;
};

// Every draw the page's WebGL2 contexts run is counted, by wrapping each draw entry of the context's prototype once.
let drawCalls = 0;
for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced',
  'drawRangeElements'] as const) {
  const draw: (...values: never[]) => void = WebGL2RenderingContext.prototype[name];
  Object.defineProperty(WebGL2RenderingContext.prototype, name, {value(this: WebGL2RenderingContext,
    ...values: never[]) {
    drawCalls++;
    draw.apply(this, values);
  }});
}

async function makeBoxGlbBytes(): Promise<number[]> {
  const material = new THREE.MeshStandardMaterial({color: new THREE.Color(0.8, 0.35, 0.2), roughness: 1});
  const glb = await new GLTFExporter().parseAsync(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    material), {binary: true});
  if (!(glb instanceof ArrayBuffer)) throw new Error('Expected binary GLB from GLTFExporter.');
  return Array.from(new Uint8Array(glb));
}

const describe = (side: number | null) => {
  const box = declaration('box', 'box', {placement: standingAt([0, 0, 0])});
  const ground = side === null ? [] : [{id: GROUND_ACTOR_ID, terrain: rollingTerrain(side),
    placement: standingAt([0, -1, 0]),
    surface: {kind: GROUND_KIND_ID, values: {_Color: {color: [0.32, 0.4, 0.22, 1]}}}}];
  return modelStageDescription(describing({actors: {focus: 'box', actors: [{...box, asset: {...box.asset,
    path: TERRAIN_ROUTES.box}}, ...ground]}, framing: {kind: MODEL_STAGE_FRAMING.all}, orbit: false}));
};

async function bootTerrainScene(programSha256: string, floor: boolean): Promise<void> {
  document.body.style.margin = '0';
  const host = document.getElementById(TERRAIN_HOST_ID);
  if (!host) throw new Error(`Missing #${TERRAIN_HOST_ID} element.`);
  const kind = modelSurfaceKind({id: GROUND_KIND_ID, parameters: {_Color: {type: 'color', space: 'srgb', hdr: false}},
    inert: {},
    attributes: ['uv'], light: 'standard', coverage: 'opaque', side: 'front', fog: true, displacement: null,
    webProgram: {path: TERRAIN_ROUTES.program, sha256: programSha256}}, GROUND_KIND_ID);
  const controller = await new Promise<ModelStageController>((ready, reject) => createModelStage(host, describe(null),
    THEME, ready, reject, {reviewKey: 'terrainReview', clock: MODEL_STAGE_CLOCK.local, floor, grid: false,
      kinds: [kind]}));
  const drawnMeshes = async () => {
    for (let frame = 0; frame < FRAMES_SETTLING; frame++) await nextFrame();
    return controller.snapshot().renderedModelMeshes;
  };
  const framesOf = async () => {
    const started = drawCalls, first = await nextFrame();
    let last = first;
    for (let frame = 0; frame < FRAMES_TIMED; frame++) last = await nextFrame();
    return {interval: (last - first) / FRAMES_TIMED, calls: (drawCalls - started) / (FRAMES_TIMED + 1)};
  };
  const runOf = async (side: number) => {
    await controller.setDescription(describe(null));
    const description = describe(side);
    const terrainActor = description.actors.actors.find(({id}) => id === GROUND_ACTOR_ID);
    if (!terrainActor) throw new Error(`The description holds no actor ${GROUND_ACTOR_ID}.`);
    const started = performance.now();
    await controller.setDescription(description);
    const apply = performance.now() - started;
    await drawnMeshes();
    return {apply, identity: timed(() => modelActorIdentity(terrainActor)),
      refit: timed(() => modelStageRefit(description, describe(side))), ...await framesOf()};
  };
  const driver: TerrainSceneDriver = {
    async show(side) {
      await controller.setDescription(describe(side));
      return drawnMeshes();
    },
    async measure(side) {
      const runs = [];
      for (let run = 0; run < MEASURE_RUNS; run++) runs.push(await runOf(side));
      return {side, applyMilliseconds: median(runs.map(run => run.apply)),
        identityMilliseconds: median(runs.map(run => run.identity)),
        refitMilliseconds: median(runs.map(run => run.refit)),
        frameMilliseconds: median(runs.map(run => run.interval)), drawCalls: median(runs.map(run => run.calls)),
        renderedModelMeshes: await drawnMeshes()};
    },
    renderer() {
      const gl = document.createElement('canvas').getContext('webgl2');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      if (!gl || !info) throw new Error('The page has no WebGL2 context with WEBGL_debug_renderer_info.');
      return String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
    },
  };
  window.terrainScene = driver;
}

window.makeBoxGlbBytes = makeBoxGlbBytes;
window.bootTerrainScene = bootTerrainScene;
renderScene(<div id={TERRAIN_HOST_ID} style={{width: '100vw', height: '100vh'}}/>);
