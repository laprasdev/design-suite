import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {join} from 'node:path';
import {isValidElement, type ReactElement, type ReactNode} from 'react';
import {SUITE_ROOT, bundled, replacedHooks} from './bundled.ts';
import {Component, STATEFUL_HOOKS, rendered} from './renderedHooks.ts';
import {SUITE_COMPILER_OPTIONS, assertRefusesType, typeCheck} from './typeCheck.ts';

interface PressEvent {preventDefault(): void}
interface PendingProps {
  children?: ReactNode;
  disabled?: boolean;
  onClick?: (event: PressEvent) => void;
  press?: {'aria-busy'?: boolean};
  'aria-busy'?: boolean;
}

type PendingSuiteModule =
  typeof import('../src/react/Button.tsx') &
  typeof import('../src/synth/components/synth/Boolean.tsx') &
  Pick<typeof import('../src/react/Pokeball.tsx'), 'PokeballSpinner'> &
  Pick<typeof import('../src/react/SelectionMark.tsx'), 'SelectionMark'> &
  Pick<typeof import('../src/react/accents.tsx'), 'Label'>;

const {module, dispose} = await bundled<PendingSuiteModule>([
  'src/react/Button.tsx',
  'src/synth/components/synth/Boolean.tsx',
  'src/react/Pokeball.tsx',
  'src/react/SelectionMark.tsx',
  'src/react/accents.tsx',
], [replacedHooks(STATEFUL_HOOKS)]);
after(dispose);

const findByType = (node: unknown, target: unknown): ReactElement<PendingProps>[] => {
  if (Array.isArray(node)) return node.flatMap(child => findByType(child, target));
  if (!isValidElement<PendingProps>(node)) return [];
  return [...(node.type === target ? [node] : []), ...findByType(node.props.children, target)];
};

// A press the control receives: whether its default action (a submit, say) was refused.
const press = () => {
  const event = {refused: false, preventDefault() { event.refused = true; }};
  return event;
};

describe('Button and SettingBoolean pending forms', () => {
  it('Button pending composes Label + PokeballSpinner, stays focusable and busy, and refuses presses whole', () => {
    let clicks = 0;
    const render = (pending: boolean) => {
      const component = new Component(() => module.Button({
        variant: 'subtle', pending, onClick: () => { clicks += 1; }, children: 'Reopen',
      }));
      rendered(component);
      const button = component.now;
      if (!isValidElement<PendingProps>(button) || !button.props.onClick) assert.fail('expected Button onClick');
      return {button, onClick: button.props.onClick};
    };
    const pending = render(true), pendingPress = press();
    assert.equal(pending.button.props.disabled, undefined);
    assert.equal(pending.button.props['aria-busy'], true);
    pending.onClick(pendingPress);
    assert.equal(clicks, 0);
    assert.equal(pendingPress.refused, true);
    assert.equal(findByType(pending.button, module.Label).length, 1);
    assert.equal(findByType(pending.button, module.PokeballSpinner).length, 1);

    const live = render(false), livePress = press();
    assert.equal(live.button.props['aria-busy'], undefined);
    assert.equal(findByType(live.button, module.PokeballSpinner).length, 0);
    live.onClick(livePress);
    assert.equal(clicks, 1);
    assert.equal(livePress.refused, false);
  });

  const changes: boolean[] = [];
  const renderSetting = (pending: boolean, detail?: string): ReactElement<PendingProps> => {
    const wrapper = module.Boolean({
      form: module.BooleanForm.SETTING, iconOnly: true, value: true, pending, detail,
      label: 'Reopen: Pool colliders', onChange: (next: boolean) => { changes.push(next); },
    });
    if (!isValidElement(wrapper) || typeof wrapper.type !== 'function') assert.fail('expected SettingBoolean');
    const node: unknown = Reflect.apply(wrapper.type, undefined, [wrapper.props]);
    if (!isValidElement<PendingProps>(node)) assert.fail('expected the setting element');
    return node;
  };

  it('SettingBoolean iconOnly pending lays the PokeballSpinner over its mark, stays focusable, ignores presses', () => {
    const pendingNode = renderSetting(true);
    assert.equal(pendingNode.props.disabled, false);
    assert.equal(pendingNode.props['aria-busy'], true);
    if (!pendingNode.props.onClick) assert.fail('expected pending checkbox onClick');
    const pendingPress = press();
    pendingNode.props.onClick(pendingPress);
    assert.deepEqual(changes, []);
    assert.equal(pendingPress.refused, true);
    assert.equal(findByType(pendingNode, module.PokeballSpinner).length, 1);
    assert.equal(findByType(pendingNode, module.SelectionMark).length, 1);

    const liveNode = renderSetting(false);
    assert.equal(liveNode.props['aria-busy'], undefined);
    if (!liveNode.props.onClick) assert.fail('expected live checkbox onClick');
    const livePress = press();
    liveNode.props.onClick(livePress);
    assert.deepEqual(changes, [false]);
    assert.equal(livePress.refused, false);
    assert.equal(findByType(liveNode, module.PokeballSpinner).length, 0);
  });

  it('SettingBoolean with detail passes its whole press, busy state included, to the detail\'s trigger', () => {
    assert.equal(renderSetting(true, 'Help').props.press?.['aria-busy'], true);
    assert.equal(renderSetting(false, 'Help').props.press?.['aria-busy'], undefined);
  });
});

// Each owner of a pending trigger's busy state, a usage of its trigger with one attribute set, and an attribute it
// takes: the trigger's own aria-busy fails the type check (pending.tsx's PendingButtonAttributes).
const BUSY_OWNERS = [
  {component: 'Button', accepted: 'pending', usage: (attribute: string) => `<Button ${attribute}={true}>Save</Button>`},
  {component: 'HoverDetail', accepted: 'aria-pressed',
    usage: (attribute: string) =>
      `<HoverDetail interactive content="Help" triggerProps={{'${attribute}': true}}>Save</HoverDetail>`},
] as const;

for (const {component, accepted, usage} of BUSY_OWNERS) {
  it(`a ${component} takes its busy state from the pending form alone: its own aria-busy fails the type check`, () => {
    const module = JSON.stringify(join(SUITE_ROOT, `src/react/${component}.tsx`));
    const file = (attribute: string) =>
      `import {${component}} from ${module};\nexport const row = ${usage(attribute)};\n`;
    assertRefusesType(attribute => typeCheck({'usage.tsx': file(attribute)}, SUITE_COMPILER_OPTIONS),
      {accepted, refused: ['aria-busy']});
  });
}
