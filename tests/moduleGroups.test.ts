// A tab's groups: under a header a group holding something wears the primary colour and an empty one stays plain; on
// an inline row the group being shown is primary, bold at the title's weight and glowing, the others holding something
// are secondary, and empty ones stay plain.
import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {bundled} from './bundled.ts';

type Module = typeof import('../src/react/module/ModuleGroups.tsx') & typeof import('../src/synth/StyleContext.tsx')
  & typeof import('../src/tokens.ts');
const {module, dispose} = await bundled<Module>(['src/react/module/ModuleGroups.tsx', 'src/synth/StyleContext.tsx',
  'src/tokens.ts']);
const {ModuleGroups, StyleProvider, Typography} = module;
after(dispose);

const SHOWN = '2';
const GROUPS = [{id: '0', label: '1', set: true}, {id: '1', label: '2', set: false}, {id: SHOWN, label: '3', set: true},
  {id: '3', label: '4', set: false}];
const COLOR = / style="color:([^";]+)"/;

/** What `pattern` captures in `text`, or a failure naming what was missing. */
function captured(pattern: RegExp, text: string, what: string): string {
  const match = pattern.exec(text)?.[1];
  if (match === undefined) throw new Error(`No ${what} in ${text}`);
  return match;
}

interface Look {readonly group: (typeof GROUPS)[number]; readonly color: string | undefined; readonly weight: string;
  readonly glows: boolean}
/** Each group's button as the markup draws it, in order: its own colour, and its label's weight and glow. */
function looks(inline: boolean): Look[] {
  const children = createElement(ModuleGroups<string>, {groups: GROUPS, value: SHOWN, onChange: () => {},
    ariaLabel: 'Slots', inline});
  const markup = renderToStaticMarkup(createElement(StyleProvider, {persist: false, documentStyles: false, children}));
  const buttons = markup.split('<button ').slice(1);
  assert.deepEqual(buttons.map(button => captured(/data-group="([^"]+)"/, button, 'group')),
    GROUPS.map(group => group.id));
  return buttons.map((button, index) => {
    const label = captured(/<span style="([^"]*)">/, button, 'label style');
    return {group: GROUPS[index], color: COLOR.exec(button.slice(0, button.indexOf('>')))?.[1],
      weight: captured(/font-weight:(\d+)/, label, 'weight'), glows: label.includes('text-shadow:')};
  });
}

describe('a tab\'s groups', () => {
  it('under a header colours a group that holds something, and only those, in the primary colour', () => {
    const all = looks(false);
    const colors = new Set(all.filter(look => look.group.set).map(look => look.color));
    assert.equal(colors.size, 1);
    assert.notEqual([...colors][0], undefined);
    for (const look of all.filter(each => !each.group.set)) assert.equal(look.color, undefined);
  });

  it('inline colours the shown group primary, the others holding something secondary, empty ones not at all', () => {
    const primary = looks(false).find(look => look.group.set)?.color;
    const all = looks(true), others = all.filter(look => look.group.id !== SHOWN);
    assert.equal(all.find(look => look.group.id === SHOWN)?.color, primary);
    const secondary = new Set(others.filter(look => look.group.set).map(look => look.color));
    assert.equal(secondary.size, 1);
    assert.notEqual([...secondary][0], undefined);
    assert.notEqual([...secondary][0], primary);
    for (const look of others.filter(each => !each.group.set)) assert.equal(look.color, undefined);
  });

  it('draws the group shown inline bold and glowing, and every other one at the label weight without a glow', () => {
    for (const look of looks(true)) {
      const shown = look.group.id === SHOWN;
      assert.equal(look.weight, String(shown ? Typography.title.fontWeight : Typography.label.fontWeight));
      assert.equal(look.glows, shown);
    }
  });

  it('keeps the shown group\'s look under a header', () => {
    for (const look of looks(false)) {
      assert.equal(look.weight, String(Typography.label.fontWeight));
      assert.equal(look.glows, false);
    }
  });
});
