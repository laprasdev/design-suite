import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'node:test';
import {build} from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const external = ['react', 'react/*', 'react-dom', 'react-dom/*', 'lucide-react', 'three', 'three/*'];
const bundleEntry = (entry: string) => build({
  absWorkingDir: root, entryPoints: [entry], bundle: true, write: false, metafile: true,
  format: 'esm', platform: 'neutral', external,
});

describe('optional 3D package boundary', () => {
  it('keeps Three outside the ordinary root, React and model-data entrypoints', async () => {
    const entries = ['src/index.ts', 'src/react/index.ts', 'src/react/preview3d/model.ts'];
    for (const entry of entries) {
      const output = await bundleEntry(entry);
      const imports = Object.values(output.metafile.outputs).flatMap(file => file.imports);
      assert.ok(imports.every(item => !item.path.startsWith('three')), entry);
      assert.ok(Object.keys(output.metafile.inputs).every(path => !path.endsWith('preview3d/stage.ts')), entry);
    }
  });

  it('gives a host, a scene package or a kind\'s author every check of a description and a frame, without three',
    async () => {
      const model = await import('../src/react/preview3d/model.ts');
      const checks = ['modelStageDescription', 'modelStageActorSets', 'modelSurfaceKind', 'modelSurfaceKinds',
        'modelActorSurfaces', 'modelSurfaceSets', 'modelSurfaceRecordsFit', 'modelSurfaceFiles', 'modelSurfaceTakes',
        'modelFrameScope', 'modelPreviewFrame', 'modelEnvironment', 'modelStagePolicy', 'MODEL_RECORD_REFUSAL',
        'MODEL_SURFACE_KIND_REFUSAL', 'MODEL_SURFACE_REFUSAL', 'MODEL_SURFACE_OUTPUT_REFUSAL'] as const;
      for (const name of checks) assert.ok(name in model, name);
      // A frame scope built from a checked description, and a frame checked against it, with nothing but this entry.
      const description = model.modelStageDescription({actors: {focus: 'a', actors: [{id: 'a', asset: {id: 'm',
        path: '/m.glb'}, placement: {position: [0, 0, 0], rotationQuaternion: [0, 0, 0, 1], scale: [1, 1, 1]},
      animation: {kind: 'rest'}, surfaces: {from: 'file'}}]}, environment: null, framing: {kind: 'focus'}, orbit: true,
      lighting: model.MODEL_STAGE_THEME_LIGHTING, surfaceSets: {}, display: 'model', surfaceMode: 'lit',
      size: {rule: 'real'}, origin: 'file'});
      const scope = model.modelFrameScope(description, model.modelSurfaceKinds([]));
      assert.equal(model.modelPreviewFrame({simulationTimeSeconds: 0, entities: []}, scope).entities.length, 0);
    });

  it('bundles the optional complete view with shared controls and external rendering dependencies', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const output = await bundleEntry(manifest.exports['./preview3d/react'].source);
    const inputs = Object.keys(output.metafile.inputs);
    for (const source of ['preview3d/ModelPreview.tsx', 'ListboxSelect.tsx', 'SegmentedControl.tsx', 'Button.tsx']) {
      assert.ok(inputs.some(path => path.endsWith(source)), source);
    }
    const imports = Object.values(output.metafile.outputs).flatMap(file => file.imports);
    assert.ok(imports.some(item => item.path === 'three' && item.external));
    assert.ok(imports.some(item => item.path === 'react' && item.external));
    assert.ok(!inputs.some(path => /slowbro|model_factory|InfiniteStateMachine/.test(path)));
  });

  it('declares a distinct optional Three peer and compiles a focused stage with external Three imports', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(manifest.peerDependencies.three, '0.180.0');
    assert.equal(manifest.peerDependenciesMeta.three.optional, true);
    assert.equal(manifest.exports['./preview3d/model'].source, './src/react/preview3d/model.ts');
    const output = await bundleEntry(manifest.exports['./preview3d'].source);
    const imports = Object.values(output.metafile.outputs).flatMap(file => file.imports);
    assert.ok(imports.some(item => item.path === 'three' && item.external));
    assert.ok(imports.some(item => item.path === 'three/addons/loaders/GLTFLoader.js' && item.external));
    assert.ok(Object.keys(output.metafile.inputs).every(path => !path.includes('/node_modules/three/')));
  });

  it('loads the glow\'s passes only once a look brings glow: a page that never glows never fetches them', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const passes = /^three\/addons\/postprocessing\//;
    for (const entry of [manifest.exports['./preview3d'].source, manifest.exports['./preview3d/react'].source]) {
      const output = await bundleEntry(entry);
      const imports = Object.values(output.metafile.outputs).flatMap(file => file.imports)
        .filter(item => passes.test(item.path));
      assert.deepEqual([...new Set(imports.map(item => `${item.path} ${item.kind}`))].sort(), [
        'three/addons/postprocessing/Pass.js dynamic-import',
        'three/addons/postprocessing/UnrealBloomPass.js dynamic-import'], entry);
    }
  });
});
