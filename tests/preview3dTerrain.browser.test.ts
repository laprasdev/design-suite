// Draws a box on the stage's flat floor, and the same box on a rolling terrain with no floor aid, in headless Chromium
// at the desktop and phone views, and keeps each capture for review; the terrain draws at both views and its chunks
// stay within one mesh each.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {SCENE_GL} from './browserScene.ts';
import {SUITE_ROOT} from './bundled.ts';
import {CAPTURED_SIDE, TERRAIN_VIEWPORTS, rollingTerrain} from './preview3dTerrainCases.ts';
import {openTerrainScene} from './preview3dTerrainPage.ts';
import {modelTerrainChunks, modelStageTerrain} from '../src/react/preview3d/terrainModel.ts';

const CAPTURES = join(SUITE_ROOT, '.local', 'captures', 'preview3dTerrain');
mkdirSync(CAPTURES, {recursive: true});
const capturedChunks = modelTerrainChunks(modelStageTerrain(rollingTerrain(CAPTURED_SIDE), 'T')).length;

for (const [name, viewport] of Object.entries(TERRAIN_VIEWPORTS)) {
  test(`at the ${name} view the terrain draws its chunks where the floor stood`, async () => {
    const [floor, ground] = await Promise.all([openTerrainScene(viewport, SCENE_GL.software, true),
      openTerrainScene(viewport, SCENE_GL.software, false)]);
    const before = await floor.evaluate(() => window.terrainScene.show(null));
    await floor.screenshot({path: join(CAPTURES, `${name}-before.png`)});
    const after = await ground.evaluate(side => window.terrainScene.show(side), CAPTURED_SIDE);
    await ground.screenshot({path: join(CAPTURES, `${name}-after.png`)});
    assert.equal(before, 1, 'the box alone');
    assert.ok(after > before && after <= capturedChunks + 1, `the box and the terrain's chunks draw: ${after} meshes`);
  });
}
