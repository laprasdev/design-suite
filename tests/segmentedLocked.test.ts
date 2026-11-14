// A locked control, or an option unavailable on its own, changes nothing when pressed, in both the single and the
// [Flags] form, and with `onPoint` too, which keeps its options pointable instead of disabling them. The control is
// rendered once as a Component (renderedHooks.ts), and its buttons' own handlers are pressed.
import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {bundled, replacedHooks} from './bundled.ts';
import {Component, STATEFUL_HOOKS, rendered} from './renderedHooks.ts';

interface Node {type: unknown; props: {children?: unknown; onClick?: () => void; onActivate?: () => void}}
type Options = {value: number; label: string; disabled?: boolean}[];
interface Props {
  options: Options; onPoint?: (value: number | null) => void; disabled?: boolean;
  multiple?: boolean; value: number | number[]; onChange: (value: never) => void;
}
interface Module {SegmentedControl(props: Props): Node}

const pressables = (node: unknown): Node[] => {
  if (Array.isArray(node)) return node.flatMap(pressables);
  if (!node || typeof node !== 'object') return [];
  const element = node as Node;
  const pressed = element.props.onClick || element.props.onActivate ? [element] : [];
  return [...pressed, ...pressables(element.props.children)];
};

const {module, dispose} = await bundled<Module>(['src/react/SegmentedControl.tsx'], [replacedHooks(STATEFUL_HOOKS)]);
after(dispose);

describe('a locked segmented control', () => {
  const options: Options = [{value: 0, label: 'a'}, {value: 1, label: 'b', disabled: true}, {value: 2, label: 'c'}];
  const presses = (props: Partial<Props>) => {
    const changes: unknown[] = [];
    const onChange = (value: unknown) => changes.push(value);
    const control = new Component(() => module.SegmentedControl({options, value: 0, ...props, onChange}));
    rendered(control);
    const found = pressables(control.now);
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
