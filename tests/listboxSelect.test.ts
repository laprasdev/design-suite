// LISTBOX_FORM_ROLES.holdsValue is the one owner of whether a ListboxSelect form holds a current value: the select
// form opens on its current value and skips choosing it again, while the menu form opens at the start and runs every
// chosen action even if a value matches the chosen option.
import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';
import {isValidElement, type ReactElement, type ReactNode} from 'react';
import {ListboxForm, type ListboxForm as ListboxFormValue} from '../src/react/listboxSelectElements.ts';
import {bundled, replacedHooks} from './bundled.ts';
import {Component, STATEFUL_HOOKS, rendered} from './renderedHooks.ts';

interface KeyPress {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  preventDefault(): void;
}
interface TriggerProps {
  readonly children?: ReactNode;
  readonly onClick?: () => void;
  readonly onKeyDown?: (event: KeyPress) => void;
}
interface RuntimeListboxProps {
  readonly form?: ListboxFormValue;
  readonly label: string;
  readonly options: readonly {readonly value: string; readonly label: string}[];
  readonly value?: string;
  readonly children?: ReactNode;
  readonly onChange?: (value: string) => void;
  readonly onAction?: (value: string) => void;
}
interface ListboxModule {
  ListboxSelect(props: RuntimeListboxProps): ReactNode;
}

const HOOKS = `${STATEFUL_HOOKS}\nexport const useId = () => 'listbox';`;
const {module, dispose} = await bundled<ListboxModule>(['src/react/ListboxSelect.tsx'], [replacedHooks(HOOKS)]);
const OPTIONS = Object.freeze([{value: 'a', label: 'A'}, {value: 'b', label: 'B'}]);
const key = (name: string): KeyPress => ({key: name, preventDefault() {}});

const findTrigger = (node: unknown): ReactElement<TriggerProps> => {
  if (Array.isArray(node)) {
    for (const child of node) {
      if (isValidElement<TriggerProps>(child) && child.type === 'button') return child;
    }
  }
  if (isValidElement<{children?: ReactNode}>(node)) return findTrigger(node.props.children);
  assert.fail('expected ListboxSelect trigger button');
};

describe('ListboxSelect value ownership by LISTBOX_FORM_ROLES.holdsValue', () => {
  const priorDocument = Reflect.get(globalThis, 'document');
  before(() => { Object.assign(globalThis, {document: {body: null}}); });
  after(() => {
    if (priorDocument === undefined) Reflect.deleteProperty(globalThis, 'document');
    else Object.assign(globalThis, {document: priorDocument});
    dispose();
  });

  const openAndPress = (component: Component<ReactNode>, keys: readonly string[]) => {
    rendered(component);
    findTrigger(component.now).props.onClick?.();
    for (const name of keys) {
      rendered(component);
      findTrigger(component.now).props.onKeyDown?.(key(name));
    }
  };

  it('skips an unchanged choice on the select form and runs a changed one', () => {
    const chosen: string[] = [];
    const component = new Component(() => module.ListboxSelect({
      form: ListboxForm.SELECT, label: 'Go', options: OPTIONS, value: 'b', onChange: next => { chosen.push(next); },
    }));
    openAndPress(component, ['Enter']);
    assert.deepEqual(chosen, []);
    openAndPress(component, ['ArrowUp', 'Enter']);
    assert.deepEqual(chosen, ['a']);
  });

  it('opens at the first action and runs every choice on the menu form even when value matches', () => {
    const actions: string[] = [];
    const component = new Component(() => module.ListboxSelect({
      form: ListboxForm.MENU, label: 'Go', options: OPTIONS, value: 'b', children: 'Go',
      onAction: next => { actions.push(next); },
    }));
    openAndPress(component, ['ArrowDown', 'Enter']);
    assert.deepEqual(actions, ['b']);
    openAndPress(component, ['Enter']);
    assert.deepEqual(actions, ['b', 'a']);
  });
});
