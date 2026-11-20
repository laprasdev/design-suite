// Measures what the measured grids cost on this machine's GPU, each the median of its runs, and prints one line per
// grid with the renderer it ran on; run by hand (`node tests/preview3dTerrainMeasure.ts`), its numbers recorded in
// perf-budgets' references/measured.md. Refused on a software rasteriser, which measures no GPU.
import {SCENE_GL} from './browserScene.ts';
import {MEASURED_SIDES, TERRAIN_VIEWPORTS} from './preview3dTerrainCases.ts';
import {openTerrainScene} from './preview3dTerrainPage.ts';

const SOFTWARE_RENDERER = 'SwiftShader';
const page = await openTerrainScene(TERRAIN_VIEWPORTS.desktop, SCENE_GL.metal, false);
const renderer = await page.evaluate(() => window.terrainScene.renderer());
if (renderer.includes(SOFTWARE_RENDERER)) throw new Error(`The page draws with ${renderer}, not a GPU.`);
console.log(JSON.stringify({renderer, viewport: TERRAIN_VIEWPORTS.desktop}));
for (const side of MEASURED_SIDES) console.log(JSON.stringify(await page.evaluate(value =>
  window.terrainScene.measure(value), side)));
