import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {after, before, it} from 'node:test';
import {build} from 'esbuild';
import {ModulationRoot} from '../src/synth/components/synth/modulation.ts';
import {blendedReach} from '../src/react/inputs/modulationBlend.ts';
import {blendEndGroups, END_CIRCLE_MIN} from '../src/react/inputs/blendEnds.ts';
import {ModulationPart} from '../src/react/inputs/modulationParts.ts';
import type {BlendedEnds} from '../src/react/inputs/BlendedEnds.tsx';

const root = fileURLToPath(new URL('../', import.meta.url));
let directory = '', draw: typeof BlendedEnds;
before(async () => {
  directory = mkdtempSync(join(root, '.blended-ends-'));
  const output = await build({absWorkingDir: root, entryPoints: ['src/react/inputs/BlendedEnds.tsx'],
    bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external'});
  const file = join(directory, 'BlendedEnds.mjs');
  writeFileSync(file, output.outputFiles[0].text);
  draw = (await import(pathToFileURL(file).href)).BlendedEnds;
});
after(() => rmSync(directory, {recursive: true, force: true}));

interface Press {key: string; preventDefault(): void; stopPropagation(): void}
interface Node {
  props: {children?: unknown; role?: string; 'aria-hidden'?: boolean; tabIndex?: number;
    onClick?: (event: Press) => void; onKeyDown?: (event: Press) => void;
    style?: {clipPath?: string; pointerEvents?: string}; [key: string]: unknown};
}
const endsIn = (node: unknown): Node[] => {
  if (Array.isArray(node)) return node.flatMap(endsIn);
  if (!node || typeof node !== 'object') return [];
  const element = node as Node;
  return [...(ModulationPart.END in element.props ? [element] : []), ...endsIn(element.props.children)];
};
const modulators = [ModulationRoot.SELF, ModulationRoot.GLOBAL, ModulationRoot.COMPUTATION]
  .map((root, index) => ({source: `source${index}`, root, depth: 20}));
const groups = blendEndGroups(blendedReach(modulators, 0, 99.5, 0, 100), 100, END_CIRCLE_MIN);
const props = {groups, modulators, colors: ['red', 'green', 'blue'],
  dot: END_CIRCLE_MIN, centre: END_CIRCLE_MIN / 2};

it('each sector retains its own pointer and keyboard source selection', () => {
  const selected: string[] = [], ends = endsIn(draw({...props, onSelectSource: source => selected.push(source)}));
  assert.equal(ends.length, 3);
  assert.equal(new Set(ends.map(end => end.props.style?.clipPath)).size, 3);
  for (const [index, end] of ends.entries()) {
    let stopped = 0, prevented = 0;
    const event = {key: 'Enter', stopPropagation: () => stopped++, preventDefault: () => prevented++};
    assert.equal(end.props.role, 'button'); assert.equal(end.props.tabIndex, 0);
    end.props.onClick!(event); end.props.onKeyDown!(event);
    assert.deepEqual(selected.slice(-2), [modulators[index].source, modulators[index].source]);
    assert.equal(stopped, 2); assert.equal(prevented, 1);
  }
});

it('without selection every sector remains passive, as on duration sliders', () => {
  for (const end of endsIn(draw(props))) {
    assert.equal(end.props['aria-hidden'], true);
    assert.equal(end.props.style?.pointerEvents, 'none');
    assert.equal(end.props.onClick, undefined);
  }
});
