// A locked control, or an option unavailable on its own, changes nothing when pressed, in both the single and the
// [Flags] form, and with `onPoint` too, which keeps its options pointable instead of disabling them. The control is
// rendered once with hooks that hold no state, and its buttons' own handlers are pressed.
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {after, before, describe, it} from 'node:test';
import {build} from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
interface Node {type: unknown; props: {children?: unknown; onClick?: () => void; onActivate?: () => void}}
type Options = {value: number; label: string; disabled?: boolean}[];
interface Props {
  options: Options; onPoint?: (value: number | null) => void; disabled?: boolean;
  multiple?: boolean; value: number | number[]; onChange: (value: never) => void;
}
interface Module {SegmentedControl(props: Props): Node}

const STATELESS_REACT = (react: string) => `export * from ${JSON.stringify(react)};
export const useContext = () => ({}), useRef = () => ({current: null}), useLayoutEffect = () => undefined;`;

const pressables = (node: unknown): Node[] => {
  if (Array.isArray(node)) return node.flatMap(pressables);
  if (!node || typeof node !== 'object') return [];
  const element = node as Node;
  const pressed = element.props.onClick || element.props.onActivate ? [element] : [];
  return [...pressed, ...pressables(element.props.children)];
};

describe('a locked segmented control', () => {
  let dir = '', module: Module;
  before(async () => {
    dir = mkdtempSync(join(root, '.segmented-locked-'));
    const react = fileURLToPath(import.meta.resolve('react'));
    const output = await build({absWorkingDir: root, entryPoints: ['src/react/SegmentedControl.tsx'], bundle: true,
      write: false, format: 'esm', platform: 'node', jsx: 'automatic', loader: {'.css': 'empty'},
      plugins: [{name: 'stateless-react', setup(builder) {
        builder.onResolve({filter: /^react$/}, () => ({path: 'react', namespace: 'stateless'}));
        builder.onResolve({filter: /^react-dom/}, () => ({path: 'react-dom', namespace: 'stateless'}));
        builder.onLoad({filter: /.*/, namespace: 'stateless'}, args => ({resolveDir: root,
          contents: args.path === 'react' ? STATELESS_REACT(react) : 'export const createPortal = () => null;'}));
      }}]});
    const file = join(dir, 'SegmentedControl.mjs');
    writeFileSync(file, output.outputFiles[0].text);
    module = await import(pathToFileURL(file).href);
  });
  after(() => rmSync(dir, {recursive: true, force: true}));

  const options: Options = [{value: 0, label: 'a'}, {value: 1, label: 'b', disabled: true}, {value: 2, label: 'c'}];
  const presses = (props: Partial<Props>) => {
    const changes: unknown[] = [];
    const onChange = (value: unknown) => changes.push(value);
    const found = pressables(module.SegmentedControl({options, value: 0, ...props, onChange}));
    assert.equal(found.length, options.length);
    found.forEach(each => (each.props.onClick ?? each.props.onActivate)?.());
    return changes;
  };

  for (const [form, shape] of [['single', {value: 0}], ['flags', {multiple: true, value: [0]}]] as const) {
    for (const pointable of [false, true]) {
      const onPoint = pointable ? () => undefined : undefined, name = `${form}${pointable ? ' with onPoint' : ''}`;
      it(`${name}: presses nothing when the control is locked`, () => {
        assert.deepEqual(presses({...shape, onPoint, disabled: true}), []);
      });
      it(`${name}: presses nothing on an option unavailable on its own, and the others change`, () => {
        assert.equal(presses({...shape, onPoint}).length, 2);
      });
    }
  }
});
