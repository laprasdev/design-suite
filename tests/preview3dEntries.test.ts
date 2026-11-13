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
