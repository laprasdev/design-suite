import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {Children, isValidElement, type ReactElement, type ReactNode} from 'react';
import {bundled, replacedHooks} from './bundled.ts';
import {Component, STATEFUL_HOOKS, rendered} from './renderedHooks.ts';

interface PendingProps {
  children?: ReactNode;
  disabled?: boolean;
  fit?: boolean;
  onClick?: (event: never) => void;
  'aria-busy'?: boolean;
  'data-pending'?: boolean;
}

type PendingSuiteModule =
  typeof import('../src/react/Button.tsx') &
  typeof import('../src/synth/components/synth/Boolean.tsx') &
  Pick<typeof import('../src/react/Pokeball.tsx'), 'PokeballSpinner'> &
  Pick<typeof import('../src/react/accents.tsx'), 'Label'>;

const {module, dispose} = await bundled<PendingSuiteModule>([
  'src/react/Button.tsx',
  'src/synth/components/synth/Boolean.tsx',
  'src/react/Pokeball.tsx',
  'src/react/accents.tsx',
], [replacedHooks(STATEFUL_HOOKS)]);
after(dispose);

const findByType = (node: unknown, target: unknown): ReactElement<PendingProps>[] => {
  if (Array.isArray(node)) return node.flatMap(child => findByType(child, target));
  if (!isValidElement<PendingProps>(node)) return [];
  return [...(node.type === target ? [node] : []), ...findByType(node.props.children, target)];
};

describe('Button and SettingBoolean pending forms', () => {
  it('Button pending composes Label + PokeballSpinner, stays focusable (not disabled), and ignores presses', () => {
    let clicks = 0;
    const pendingComp = new Component(() => module.Button({
      variant: 'subtle', pending: true, onClick: () => { clicks += 1; }, children: 'Reopen',
    }));
    rendered(pendingComp);
    const pendingBtn = pendingComp.now;
    if (!isValidElement<PendingProps & {'aria-labelledby'?: string}>(pendingBtn)) {
      assert.fail('expected Button element');
    }
    assert.equal(pendingBtn.props.disabled, undefined);
    assert.equal(pendingBtn.props['aria-busy'], true);
    assert.equal(pendingBtn.props['data-pending'], true);
    assert.equal(typeof pendingBtn.props['aria-labelledby'], 'string');
    if (pendingBtn.props.onClick) assert.fail('pending Button must not expose active onClick');
    assert.equal(clicks, 0);
    assert.equal(findByType(pendingBtn, module.Label).length, 1);
    assert.equal(findByType(pendingBtn, module.PokeballSpinner).length, 1);

    const liveComp = new Component(() => module.Button({
      variant: 'subtle', pending: false, onClick: () => { clicks += 1; }, children: 'Reopen',
    }));
    rendered(liveComp);
    const liveBtn = liveComp.now;
    if (!isValidElement<{onClick?: () => void}>(liveBtn) || !liveBtn.props.onClick) {
      assert.fail('expected live Button onClick');
    }
    assert.equal(findByType(liveBtn, module.PokeballSpinner).length, 0);
    liveBtn.props.onClick();
    assert.equal(clicks, 1);
  });

  it('SettingBoolean iconOnly pending shows PokeballSpinner, stays focusable, and ignores presses', () => {
    const changes: boolean[] = [];
    const renderCheck = (pending: boolean): unknown => {
      const wrapper = module.Boolean({
        form: module.BooleanForm.SETTING, iconOnly: true, value: true, pending,
        label: 'Reopen: Pool colliders', onChange: (next: boolean) => { changes.push(next); },
      });
      if (!isValidElement(wrapper) || typeof wrapper.type !== 'function') assert.fail('expected SettingBoolean');
      return Reflect.apply(wrapper.type, undefined, [wrapper.props]);
    };
    const pendingNode = renderCheck(true);
    if (!isValidElement<PendingProps>(pendingNode)) assert.fail('expected checkbox button');
    assert.equal(pendingNode.props.disabled, false);
    assert.equal(pendingNode.props['aria-busy'], true);
    assert.equal(pendingNode.props['data-pending'], true);
    assert.equal(pendingNode.props.onClick, undefined);
    assert.equal(changes.length, 0);
    const spinners = findByType(pendingNode, module.PokeballSpinner);
    assert.equal(spinners.length, 1);
    assert.equal(spinners[0].props.fit, true);
    if (!isValidElement<PendingProps>(pendingNode.props.children)) assert.fail('expected status span');
    assert.equal(Children.toArray(pendingNode.props.children.props.children).length, 1);

    const liveNode = renderCheck(false);
    if (!isValidElement<{onClick?: () => void}>(liveNode) || !liveNode.props.onClick) {
      assert.fail('expected live checkbox onClick');
    }
    liveNode.props.onClick();
    assert.deepEqual(changes, [false]);
  });
});
