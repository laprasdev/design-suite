// The suite's one notice: it shows what failed and the start of its detail, and an action bar floats it over what is
// below the bar, so showing it never moves that content.
import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement, type ReactElement} from 'react';
import {bundled} from './bundled.ts';

type Module = typeof import('../src/react/ActionBar.tsx') & typeof import('../src/react/pageBarElements.ts')
  & typeof import('../src/react/actionBarElements.ts') & typeof import('../src/react/barElements.ts');
const {module, dispose} = await bundled<Module>(['src/react/ActionBar.tsx', 'src/react/pageBarElements.ts',
  'src/react/actionBarElements.ts', 'src/react/barElements.ts']);
const {ActionBarElement, ActionNoticeElement, BarElement, BarSlotElement, HeaderNoticesElement} = module;
after(dispose);
const NOTICE = Object.freeze({tone: 'error', message: 'Not applied',
  detail: 'Actor second: clip swim is not an animation in the model file.'} as const);

describe('the action notice', () => {
  it('shows the detail as text beside the message, with the whole detail as the hint', () => {
    const markup = renderToStaticMarkup(createElement(module.ActionNotice, {notice: NOTICE}));
    const detail = new RegExp(`class="[^"]*${ActionNoticeElement.DETAIL.className}"[^>]*>${NOTICE.detail}<`);
    assert.match(markup, detail);
    assert.match(markup, new RegExp(`title="${NOTICE.detail}"`));
    assert.match(markup, />Not applied</);
    const bare = renderToStaticMarkup(createElement(module.ActionNotice, {notice: {tone: 'info', message: 'Saving…'}}));
    assert.doesNotMatch(bare, new RegExp(ActionNoticeElement.DETAIL.className));
  });

  it('floats an action bar\'s notice inside the bar, so nothing below the bar moves', () => {
    const bar = (notice: typeof NOTICE | null) => renderToStaticMarkup(createElement(module.ActionBar,
      {notice, slots: {left: 'Left'}}));
    const shown = bar(NOTICE), clear = bar(null);
    // One element either way: the notice is inside the bar, in the suite's floating notices container.
    for (const markup of [shown, clear]) assert.equal(closingDepth(markup), 0);
    assert.match(shown, new RegExp(`^<div class="${BarElement.className} ${ActionBarElement.className}">.*` +
      `<div class="${BarSlotElement.RIGHT.className}"><div class="${HeaderNoticesElement.className}">` +
      `<div [^>]*class="${BarElement.className} ${ActionNoticeElement.ROOT.className}"`));
    assert.doesNotMatch(clear, new RegExp(HeaderNoticesElement.className));
  });
});

// Where the first top-level element ends: 0 when it is the only one.
function closingDepth(markup: string) {
  let depth = 0, end = -1;
  for (const tag of markup.matchAll(/<(\/?)([a-z0-9]+)[^>]*?(\/?)>/g)) {
    if (tag[3]) continue;
    depth += tag[1] ? -1 : 1;
    if (depth === 0) {end = (tag.index ?? 0) + tag[0].length; break;}
  }
  return markup.length - end;
}
