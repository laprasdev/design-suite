import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {after, before, describe, it} from 'node:test';
import {loadModelStageAsset} from '../src/react/preview3d/asset.ts';
import {MODEL_FILE_TEXT} from '../src/react/preview3d/files.ts';
import {modelAssetDigest, modelStageActorSet} from '../src/react/preview3d/actorModel.ts';
import {declaration} from './preview3dActorFixture.ts';

// A model file as the page's server would answer it: a whole glTF (one node), served from memory. Every read goes
// through the page's fetch, which the test holds, so the reads the stage makes are counted.
const FILE = new TextEncoder().encode(JSON.stringify({asset: {version: '2.0'}, scenes: [{nodes: [0]}], scene: 0,
  nodes: [{name: 'blue'}]}));
const DIGEST = createHash('sha256').update(FILE).digest('hex');
const reads: string[] = [];
const page = globalThis as unknown as {fetch: typeof fetch; document?: {baseURI: string}};
const held = {fetch: page.fetch, document: page.document};
before(() => {
  page.document = {baseURI: 'http://stage.invalid/'};
  page.fetch = async (input, init) => {
    reads.push(String(input));
    init?.signal?.throwIfAborted();
    return new Response(FILE.slice().buffer);
  };
});
after(() => Object.assign(page, held));
const PROFILE = {asset: {id: 'blue', revision: 'r1', sha256: 'c'.repeat(64)}, profile: 'base-color-tinted-emission',
  colorSpace: 'srgb', emissionMask: 'white', noiseBlend: 0, nightBoost: 1,
  renderers: [{rendererId: 'body', nodeIndex: 0, meshIndex: 0, primitiveIndex: 0, slot: 0}]};

describe('an actor\'s file: one read', () => {
  it('reads the file through the one read, checks the digest it states, and parses what it read', async () => {
    reads.length = 0;
    const asset = await loadModelStageAsset('/models/blue.glb', DIGEST, new AbortController().signal);
    assert.equal(asset.scene.children[0].name, 'blue');
    assert.deepEqual(reads, ['/models/blue.glb']);
  });

  it('refuses a file whose bytes are not the stated digest, naming the file and both digests', async () => {
    const stated = 'd'.repeat(64);
    await assert.rejects(loadModelStageAsset('/models/blue.glb', stated, new AbortController().signal),
      new RegExp(MODEL_FILE_TEXT.digest('/models/blue.glb', stated, DIGEST)));
  });

  it('reads a file with no stated digest through the same read, unverified', async () => {
    reads.length = 0;
    const asset = await loadModelStageAsset('/models/blue.glb', undefined, new AbortController().signal);
    assert.equal(asset.scene.children.length, 1);
    assert.deepEqual(reads, ['/models/blue.glb']);
  });

  it('lets an abandoned read go: its load rejects with the abort', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(loadModelStageAsset('/models/blue.glb', DIGEST, controller.signal), {name: 'AbortError'});
  });

  it('reads against the asset\'s own digest, or its runtime profile\'s while it states one', () => {
    const own = declaration('a', 'blue', {asset: {id: 'blue', path: '/blue.glb', sha256: DIGEST}});
    assert.equal(modelAssetDigest(own), DIGEST);
    assert.equal(modelAssetDigest(declaration('a', 'blue')), undefined);
    const profiled = declaration('a', 'blue', {asset: {id: 'blue', path: '/blue.glb', revision: 'r1',
      runtimeMaterials: PROFILE as never}});
    assert.equal(modelAssetDigest(profiled), PROFILE.asset.sha256);
    assert.throws(() => modelStageActorSet({focus: 'a', actors: [declaration('a', 'blue', {asset: {id: 'blue',
      path: '/blue.glb', sha256: 'x'}})]}), /Actor a.asset.sha256 must be a SHA-256: 64 lowercase hex digits/);
  });
});
