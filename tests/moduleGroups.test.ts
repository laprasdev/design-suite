// A tab's groups: a group holding something wears the theme's one colour, an empty one stays plain, and on an inline
// row the group being shown is bold, at the title's weight, and glows. Under a header the shown group keeps its look.
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
  it('colours a group that holds something, and only those, in one colour', () => {
    for (const inline of [true, false]) {
      const all = looks(inline);
      const colors = new Set(all.filter(look => look.group.set).map(look => look.color));
      assert.equal(colors.size, 1);
      assert.notEqual([...colors][0], undefined);
      for (const look of all.filter(each => !each.group.set)) assert.equal(look.color, undefined);
    }
  });

  it('draws the group shown inline bold and glowing, and every other one at the label weight without a glow', () => {
    for (const look of looks(true)) {
      const shown = look.group.id === SHOWN;
      assert.equal(look.weight, String(shown ? Typography.title.fontWeight : Typography.moduleLabel.fontWeight));
      assert.equal(look.glows, shown);
    }
  });

  it('keeps the shown group\'s look under a header', () => {
    for (const look of looks(false)) {
      assert.equal(look.weight, String(Typography.moduleLabel.fontWeight));
      assert.equal(look.glows, false);
    }
  });
});
