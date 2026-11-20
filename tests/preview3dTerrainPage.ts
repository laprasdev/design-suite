// Opens the terrain's stage scene in Chromium with its files routed and the stage booted, for the capture test and the
// cost measurement alike.
import {createHash} from 'node:crypto';
import {openScene, type SceneGl} from './browserScene.ts';
import {GROUND_PROGRAM, TERRAIN_HOST_ID, TERRAIN_ROUTES, TERRAIN_SCENE_ENTRY, type TerrainViewport}
  from './preview3dTerrainCases.ts';

const programSha256 = createHash('sha256').update(GROUND_PROGRAM).digest('hex');

/** The scene at a view, drawn with a GL, its stage booted with its floor aid on or off. */
export async function openTerrainScene(viewport: TerrainViewport, gl: SceneGl, floor: boolean) {
  const page = await openScene(TERRAIN_SCENE_ENTRY, viewport, gl);
  await page.locator(`#${TERRAIN_HOST_ID}`).waitFor({state: 'attached'});
  const box = Buffer.from(await page.evaluate(() => window.makeBoxGlbBytes()));
  await page.route(TERRAIN_ROUTES.box, route => route.fulfill({body: box, contentType: 'model/gltf-binary'}));
  await page.route(TERRAIN_ROUTES.program, route => route.fulfill({body: GROUND_PROGRAM, contentType: 'text/plain'}));
  await page.evaluate(([sha, on]) => window.bootTerrainScene(sha, on), [programSha256, floor] as const);
  return page;
}
