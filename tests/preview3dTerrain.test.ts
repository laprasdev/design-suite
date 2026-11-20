// The terrain actor: its description's refusals, the grid it draws (positions, the cut of each cell, normals shared
// across chunk borders, triangles per chunk), the one surface checker and applier it shares with file actors, and the
// frame that may not name it.
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_TERRAIN_REFUSAL as TEXT, MODEL_TERRAIN_SAMPLE as SAMPLE, MODEL_TERRAIN_SPLIT, modelStageTerrain,
  modelTerrainChunkCells, modelTerrainChunks, type ModelStageTerrain} from '../src/react/preview3d/terrainModel.ts';
import {createModelTerrain, modelTerrainNormals} from '../src/react/preview3d/terrain.ts';
import {MODEL_ACTOR_REFUSAL, modelStageActorSet} from '../src/react/preview3d/actorModel.ts';
import {modelActorSurfaceSource} from '../src/react/preview3d/actorSurfaceModel.ts';
import {createModelActorSurfaces, MODEL_ACTOR_SURFACES_TEXT} from '../src/react/preview3d/actorSurfaces.ts';
import {modelSurfaceRecord} from '../src/react/preview3d/surfaceModel.ts';
import {createModelActor} from '../src/react/preview3d/actor.ts';
import {MODEL_ASSET_TEXT} from '../src/react/preview3d/asset.ts';
import {MODEL_STAGE_ORIGIN, MODEL_STAGE_SIZE} from '../src/react/preview3d/sizeModel.ts';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {modelFrameScope, modelPreviewFrame} from '../src/react/preview3d/frameModel.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {kindMaterials, kinds, record} from './preview3dKindFixture.ts';
import {actorContext, declaration, describing, STANDING} from './preview3dActorFixture.ts';
import {TERRAIN_GRID as GRID, TERRAIN_ID, terrainActor} from './preview3dTerrainFixture.ts';
import {CAPTURED_SIDE, rollingTerrain} from './preview3dTerrainCases.ts';

const refused = (run: () => unknown, message: string) => assert.throws(run, (error: unknown) =>
  error instanceof ModelStageRefusal && error.message === message, message);
const grid = (changes: Record<string, unknown> = {}) => modelStageTerrain({...GRID, ...changes}, 'T');
const meshes = (value: ModelStageTerrain) => createModelTerrain(value).scene.children.filter(
  (node): node is THREE.Mesh => node instanceof THREE.Mesh);
// The height the drawn ground has under a point, by a ray cast straight down onto its triangles.
function heightAt(value: ModelStageTerrain, x: number, z: number) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
  const [hit] = ray.intersectObjects(meshes(value));
  return (hit ?? assert.fail(`no ground under (${x}, ${z})`)).point.y;
}

describe('a terrain description', () => {
  it('refuses each malformed field by its name', () => {
    refused(() => grid({resolution: [1, 2]}), TEXT.resolution('T.resolution'));
    refused(() => grid({resolution: [2.5, 2]}), TEXT.resolution('T.resolution'));
    refused(() => grid({heights: [0, 1]}), TEXT.heights('T.heights', 6, 2));
    refused(() => grid({heights: [0, 1, 2, 3, 4, 0.5]}), TEXT.sample('T.heights[5]'));
    refused(() => grid({heights: [0, 1, 2, 3, 4, SAMPLE.most + 1]}), TEXT.sample('T.heights[5]'));
    refused(() => grid({heights: [0, 1, 2, 3, 4, SAMPLE.least - 1]}), TEXT.sample('T.heights[5]'));
    refused(() => grid({chunkTriangles: 1}), TEXT.chunk('T.chunkTriangles'));
    refused(() => grid({chunkTriangles: 2.5}), TEXT.chunk('T.chunkTriangles'));
    refused(() => grid({size: [4, 0]}), TEXT.positive('T.size[1]'));
    refused(() => grid({heightScale: 0}), TEXT.positive('T.heightScale'));
    assert.throws(() => grid({split: 'diagonal'}), /T\.split is one of ascending, descending/);
    assert.throws(() => grid({tiles: 4}), /T does not state tiles/);
  });

  it('takes every sample from the least to the most a heightfield stores', () => {
    const bounds = [SAMPLE.least, SAMPLE.most, 0, 0, 0, 0];
    assert.deepEqual(grid({heights: bounds}).heights, bounds);
  });

  it('is an actor chosen by the key it states, with no animation, and never the focus or a frame\'s entity', () => {
    const set = modelStageActorSet({focus: 'a', actors: [declaration('a'), terrainActor()]});
    const terrain = set.actors.find(({id}) => id === TERRAIN_ID) ?? assert.fail('no terrain actor in the set');
    assert.deepEqual(terrain.placement, STANDING);
    assert.throws(() => modelStageActorSet({focus: 'a', actors: [{...terrainActor(), animation: {kind: 'rest'}}]}),
      /Actor 0 does not state animation/);
    refused(() => modelStageActorSet({focus: 'g', actors: [terrainActor()]}), MODEL_ACTOR_REFUSAL.terrainFocus('g'));
    const described = modelStageDescription(describing({actors: {focus: 'a',
      actors: [declaration('a'), terrainActor()]}}));
    refused(() => modelPreviewFrame({simulationTimeSeconds: 0, entities: [{entityId: 'g'}]},
      modelFrameScope(described, kinds())), MODEL_ACTOR_REFUSAL.terrainFrame('g'));
  });

  it('builds flat, at its real size, and is refused by name by the normalized size rule, which needs a height', () => {
    const flat = grid({heights: new Array(6).fill(0)});
    const [actor] = modelStageActorSet({focus: 'a', actors: [terrainActor(flat), declaration('a')]}).actors;
    const built = createModelActor(createModelTerrain(flat), actor, actorContext().context);
    refused(() => built.prepareSizing({size: {rule: MODEL_STAGE_SIZE.normalized, height: 2},
      origin: MODEL_STAGE_ORIGIN.file}), MODEL_ASSET_TEXT.height('g'));
    assert.equal(built.placement.scale.x, 1);
    built.dispose();
  });
});

describe('the captured grid', () => {
  it('is a terrain the stage takes, drawn in several chunks so a chunk border is in the picture', () => {
    assert.ok(modelTerrainChunks(modelStageTerrain(rollingTerrain(CAPTURED_SIDE), 'T')).length > 1);
  });
});

describe('the drawn grid', () => {
  it('stands each chunk\'s samples at their places across the whole grid, at sample times heightScale', () => {
    // Chunk 0/0 holds rows 0-1 and chunk 1/0 rows 1-2: row 1 is in both, at one place.
    const drawn = meshes(grid()).map(({name, geometry}) => {
      const position = geometry.getAttribute('position');
      return {name, uv: Array.from(geometry.getAttribute('uv').array), position: Array.from({length: position.count},
        (_, at) => [position.getX(at), position.getY(at), position.getZ(at)])};
    });
    assert.deepEqual(drawn, [
      {name: 'terrain-chunk:0/0', position: [[-2, 0, -1], [-2, 1, 1], [0, -1, -1], [0, 2, 1]],
        uv: [0, 0, 0, 1, 0.5, 0, 0.5, 1]},
      {name: 'terrain-chunk:1/0', position: [[0, -1, -1], [0, 2, 1], [2, 3, -1], [2, 4, 1]],
        uv: [0.5, 0, 0.5, 1, 1, 0, 1, 1]},
    ]);
  });

  it('stands a grid split along both axes at its global rows and columns', () => {
    // Five samples two metres apart from -4 per side, two cells to a chunk along each: chunks 0/1 and 1/1 hold
    // columns 2-4 and chunks 1/0 and 1/1 rows 2-4, at 0, 2 and 4, and at the grid fractions 0.5, 0.75 and 1.
    const both = grid({resolution: [5, 5], size: [8, 8], heights: new Array(25).fill(0), chunkTriangles: 8});
    const low = {place: [-4, -2, 0], fraction: [0, 0.25, 0.5]}, high = {place: [0, 2, 4], fraction: [0.5, 0.75, 1]};
    const places = meshes(both).map(({name, geometry}) => {
      const axis = (attribute: string, read: 'getX' | 'getY' | 'getZ') => {
        const values = geometry.getAttribute(attribute);
        return [...new Set(Array.from({length: values.count}, (_, at) => values[read](at)))];
      };
      return {name, row: {place: axis('position', 'getX'), fraction: axis('uv', 'getX')},
        column: {place: axis('position', 'getZ'), fraction: axis('uv', 'getY')}};
    });
    assert.deepEqual(places, [{name: 'terrain-chunk:0/0', row: low, column: low},
      {name: 'terrain-chunk:0/1', row: low, column: high}, {name: 'terrain-chunk:1/0', row: high, column: low},
      {name: 'terrain-chunk:1/1', row: high, column: high}]);
  });

  it('cuts each cell along the split\'s diagonal: one raised corner reads differently off the diagonal', () => {
    // Corners a (-1, -1), b (-1, 1), c (1, -1), d (1, 1) in x and z; d is raised by 4.
    const bump = (split: string) => grid({resolution: [2, 2], size: [2, 2], heightScale: 1, heights: [0, 0, 0, 4],
      split});
    assert.equal(heightAt(bump(MODEL_TERRAIN_SPLIT.ascending), 0.5, -0.25), 4 * 0.375);
    assert.equal(heightAt(bump(MODEL_TERRAIN_SPLIT.descending), 0.5, -0.25), 4 * 0.125);
  });

  it('gives the two copies of a sample on a chunk border bit-equal normals', () => {
    const rolling = grid({resolution: [5, 5], size: [8, 8], heightScale: 0.25,
      heights: Array.from({length: 25}, (_, at) => ((at * at * 7) % 11) - 5), chunkTriangles: 8});
    const [first, second] = meshes(rolling);
    // Chunk 0/0 holds columns 0-2 and chunk 0/1 columns 2-4: sample (1, 2) is each one's border.
    const normal = (mesh: THREE.Mesh, at: number) =>
      Array.from(mesh.geometry.getAttribute('normal').array.slice(at * 3, at * 3 + 3));
    assert.deepEqual(normal(first, 1 * 3 + 2), normal(second, 1 * 3 + 0));
    assert.notDeepEqual(normal(first, 1 * 3 + 2), [0, 1, 0], 'a sloped sample');
  });

  it('tilts each normal against its slope along x and along z, one-sided at the border', () => {
    // Rows (x) and columns (z) one metre apart; heights rise 1 then 2 along one axis, flat along the other.
    const near = (actual: Float32Array, slopes: readonly (readonly [number, number])[]) =>
      slopes.forEach(([x, z], at) => new THREE.Vector3(-x, 1, -z).normalize().toArray().forEach((expected, axis) => {
        const value = actual[at * 3 + axis];
        assert.ok(Math.abs(value - expected) < 1e-6, `sample ${at} axis ${axis}: ${value}, expected ${expected}`);
      }));
    const alongX = grid({resolution: [3, 2], size: [2, 1], heightScale: 1, heights: [0, 0, 1, 1, 3, 3]});
    near(modelTerrainNormals(alongX), [[1, 0], [1, 0], [1.5, 0], [1.5, 0], [2, 0], [2, 0]]);
    const alongZ = grid({resolution: [2, 3], size: [1, 2], heightScale: 1, heights: [0, 1, 3, 0, 1, 3]});
    near(modelTerrainNormals(alongZ), [[0, 1], [0, 1.5], [0, 2], [0, 1], [0, 1.5], [0, 2]]);
  });

  it('keeps each chunk within chunkTriangles and draws every cell once', () => {
    const wide = grid({resolution: [6, 9], size: [5, 8], heights: new Array(54).fill(0), chunkTriangles: 20});
    assert.equal(modelTerrainChunkCells(wide), 3);
    const triangles = meshes(wide).map(mesh => (mesh.geometry.index?.count ?? Number.NaN) / 3);
    assert.ok(triangles.every(count => count <= wide.chunkTriangles), String(triangles));
    assert.equal(triangles.reduce((sum, count) => sum + count, 0), 2 * 5 * 8);
    // The spans along each axis run from the first sample to the last, each starting where the one before ends, and
    // every row span meets every column span once.
    const chunks = modelTerrainChunks(wide), spans = (axis: 'rows' | 'columns') =>
      [...new Map(chunks.map(chunk => [chunk[axis].join(), chunk[axis]])).values()];
    for (const [axis, samples] of [['rows', 6], ['columns', 9]] as const) {
      const [first, ...rest] = spans(axis);
      assert.equal(first[0], 0, axis);
      rest.reduce((previous, span) => {assert.equal(span[0], previous[1], axis); return span;}, first);
      assert.equal((rest.at(-1) ?? first)[1], samples - 1, axis);
    }
    assert.deepEqual(chunks.map(({rows, columns}) => `${rows}|${columns}`), spans('rows').flatMap(rows =>
      spans('columns').map(columns => `${rows}|${columns}`)));
    assert.deepEqual(chunks.map(({id}) => id), ['terrain-chunk:0/0', 'terrain-chunk:0/1',
      'terrain-chunk:0/2', 'terrain-chunk:1/0', 'terrain-chunk:1/1', 'terrain-chunk:1/2']);
  });
});

describe('a terrain drawn by a surface kind', () => {
  const surfaced = (kindsGiven: ReturnType<typeof kinds>, held: Awaited<ReturnType<typeof kindMaterials>>) => {
    const [actor] = modelStageActorSet({focus: 'a', actors: [terrainActor(), declaration('a')]}).actors;
    const drawn = createModelTerrain(grid());
    const surfaces = createModelActorSurfaces(drawn, actor.id, {materials: held.materials, kinds: kindsGiven,
      compile: () => undefined});
    return {drawn, commit: () => surfaces.prepare(modelActorSurfaceSource(actor, {}))};
  };

  it('draws its one record on every chunk through the file actors\' applier', async () => {
    const held = await kindMaterials(), {drawn, commit} = surfaced(kinds(), held);
    commit()();
    const material = held.materials.material(modelSurfaceRecord(record(), 'r')).material;
    assert.ok(drawn.scene.children.length > 1, 'a grid of several chunks');
    assert.ok(drawn.scene.children.every(node => node instanceof THREE.Mesh && node.material === material));
  });

  it('refuses a kind that reads a vertex attribute the grid does not have, in the attribute\'s words', async () => {
    const colorKinds = new Map([...kinds()].map(([id, kind]) => [id, {...kind, attributes: ['color']}]));
    const held = await kindMaterials();
    refused(() => surfaced(colorKinds, held).commit(), MODEL_ACTOR_SURFACES_TEXT.attribute(
      'Actor g, renderer terrain-chunk:0/0, kind test-pulse', 'color'));
  });
});
