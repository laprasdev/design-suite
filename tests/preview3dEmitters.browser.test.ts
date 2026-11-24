// The stage draws an actor's emitters in Chromium through three.quarks: a profile following the panel and one left
// where it started, at the desktop and phone views, each one quarks system drawn as one instanced draw of its live
// particles, compiling with no GL error and changing a measured share of the picture.
// The captures are the review's; the share is screen coverage, what transparent overdraw costs.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {modelEmitterProfile} from '../src/react/preview3d/emitterProfileModel.ts';
import {checkAllocationCeiling, sumNamedSubtreeBytes} from './allocationProfile.ts';
import {openScene, SCENE_GL} from './browserScene.ts';
import {SUITE_ROOT} from './bundled.ts';
import {EMITTER_HOST_ID, EMITTER_SCENE_ENTRY, EMITTER_SCENE_PROFILES, EMITTER_SCENE_ROUTED, type EmitterCoverage}
  from './preview3dEmitterSceneCases.ts';
import type {TerrainViewport} from './preview3dTerrainCases.ts';
import {PANEL_GLB} from './preview3dPanelGlb.ts';
import {TERRAIN_VIEWPORTS} from './preview3dTerrainCases.ts';

const CAPTURES = join(SUITE_ROOT, '.local', 'captures', 'preview3dEmitters');
// The frame reader owns the change path's bytes: it checks the frame's own changes in place and allocates nothing.
// Nothing the stage runs after it allocates either: the load, the prepare and the commit write into what the emitters
// made once. A start's `restart` and a stop's `endEmit` are three.quarks' own and allocate (a closure for each
// `forEach`, an event for each `fire`); V8 inlines both into the emitters' `commit`, which the sampler then charges,
// so the commit's bytes are measured apart and held to the ceiling of the adapter that calls quarks
// (emitterSystems.ts).
const CHANGES_OWNER = 'src/react/preview3d/emitterFrameModel.ts';
const QUARKS_CHANGES = Object.freeze({owner: 'src/react/preview3d/emitterSystems.ts',
  functions: ['commit']});
// Named under the frame apply, so another owner's function of the same name elsewhere in the tick is not counted. The
// sampled profile charges an inlined callee's bytes to its caller, so `prepare` (which inlines the materials' and
// layers' prepares, allocating in both variants) and `applyModelFrame` are not held here; `addLoad` and the emitters'
// `commit` read a few bytes in 4,000 ticks, under what the 64-byte sampler resolves, and are reported. Their exact
// measure is a count of collections (perf-budgets' measured.md, the emitters' change path): 0 in 2,000,000 ticks.
const FRAME_APPLY = 'applyModelFrame';
const ALLOCATING_NOTHING = Object.freeze(['commitFrame', 'changesEmitters', 'frameEntity', 'checkModelEmitterBudget',
  'applyModelStageCommits']);
const REPORTED = Object.freeze(['addLoad', 'commit', 'prepare', FRAME_APPLY]);
// What the scene's emitters add to a frame's draws: one instanced draw for each profile, of its live particles, at
// most its cap; quarks draws billboards as instanced quads too, so no points draw.
const CAPS = Object.entries(EMITTER_SCENE_PROFILES).map(([id, profile]) =>
  modelEmitterProfile(profile, `Emitter scene ${id}`).maxParticles);
// The sparse run's rate (EMITTER_SCENE_ROUTED) changes under this share of the pixels the profile's own rate does.
const SPARSE_SHARE = 0.25;
mkdirSync(CAPTURES, {recursive: true});

// The emitter scene at `viewport`, booted, and the GL errors its page reports.
async function bootedScene(viewport: TerrainViewport) {
  const page = await openScene(EMITTER_SCENE_ENTRY, viewport, SCENE_GL.software);
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.locator(`#${EMITTER_HOST_ID}`).waitFor({state: 'attached'});
  const panel = Buffer.from(await page.evaluate(() => window.makePanelGlbBytes()));
  await page.route(PANEL_GLB.route, route => route.fulfill({body: panel, contentType: 'model/gltf-binary'}));
  await page.evaluate(async () => {window.emitterScene = await window.bootEmitterScene();});
  return {page, errors};
}

for (const [name, viewport] of Object.entries(TERRAIN_VIEWPORTS)) {
  test(`at the ${name} view, the emitters draw with no GL error, and each routed value changes the picture`,
  async () => {
    const run = async (variant: keyof typeof EMITTER_SCENE_ROUTED): Promise<EmitterCoverage> => {
      const {page, errors} = await bootedScene(viewport);
      const coverage = await page.evaluate(value => window.emitterScene.run(value), EMITTER_SCENE_ROUTED[variant]);
      await page.screenshot({path: join(CAPTURES, `${name}-${variant}.png`)});
      assert.deepEqual(errors, []);
      const {before, after} = coverage.draws;
      const drawn = after.instances.slice(before.instances.length);
      assert.equal(drawn.length, CAPS.length, `${name} ${variant}: not one instanced draw for each profile`);
      assert.ok(drawn.every(live => live > 0 && live <= Math.max(...CAPS)),
        `${name} ${variant}: a profile drew no live particle, or more than its cap: ${drawn.join(', ')}`);
      assert.equal(after.points, before.points, `${name} ${variant}: a profile drew points`);
      console.log(`${name} ${variant} ${viewport.width}x${viewport.height}: ${coverage.changed} of ` +
        `${coverage.pixels} pixels (${(100 * coverage.changed / coverage.pixels).toFixed(2)}%) in a box of ` +
        `${coverage.extent}; draws ` +
        `before ${JSON.stringify(before)}, after ${JSON.stringify(after)}`);
      await page.close();
      return coverage;
    };
    const own = await run('own'), dark = await run('dark'), sparse = await run('sparse'), wide = await run('wide');
    assert.ok(own.changed > 0, `${name}: the emitters changed no pixel`);
    assert.equal(dark.changed, 0, `${name}: a black tint still adds light`);
    assert.ok(sparse.changed < own.changed * SPARSE_SHARE, `${name}: a lower rate draws as many pixels`);
    assert.ok(wide.extent > own.extent, `${name}: a wider radius spans no more of the picture`);
  });
}

test('starting and stopping emitters each tick allocates no more than its ceiling', async () => {
  const {page} = await bootedScene(TERRAIN_VIEWPORTS.desktop);
  const report = await checkAllocationCeiling(page, CHANGES_OWNER, CAPTURES, {
    run: (changing, count) => page.evaluate(({ticks, change}) => window.emitterScene.runTicks(ticks, change),
      {ticks: count, change: changing}),
    inspect(head) {
      // The stage's own bytes: each function's, less what quarks' delegated functions under it allocate.
      const own = (name: string) => sumNamedSubtreeBytes(head, name, FRAME_APPLY) -
        QUARKS_CHANGES.functions.reduce((sum, quarks) => sum + sumNamedSubtreeBytes(head, quarks, name), 0);
      const bytes = Object.fromEntries(ALLOCATING_NOTHING.map(name => [name, own(name)]));
      const none = Object.fromEntries(ALLOCATING_NOTHING.map(name => [name, 0]));
      assert.deepEqual(bytes, none, 'the change path allocates');
      console.log(`sampled bytes under ${FRAME_APPLY}: ${JSON.stringify(Object.fromEntries(REPORTED.map(name =>
        [name, sumNamedSubtreeBytes(head, name, FRAME_APPLY)])))}`);
    },
    delegates: [{...QUARKS_CHANGES, parent: FRAME_APPLY}],
  });
  console.log(`emitter changes: ${report.extraBytesPerTick} B/tick (${report.withBytesPerTick.join(', ')} with, ` +
    `${report.withoutBytesPerTick.join(', ')} without); quarks: ${JSON.stringify(report.delegates)}`);
});
