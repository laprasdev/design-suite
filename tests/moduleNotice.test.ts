// A module's notice: a sentence, or in its empty form one short label centred in the module's fixed room, which a
// list's entries replace.
import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {bundled} from './bundled.ts';

type Module = typeof import('../src/react/module/ModuleNotice.tsx') & typeof import('../src/synth/StyleContext.tsx');
const {module, dispose} = await bundled<Module>(['src/react/module/ModuleNotice.tsx', 'src/synth/StyleContext.tsx']);
after(dispose);
const LABEL = 'No entries';
const render = (notice: Parameters<typeof module.ModuleNotice>[0]) => renderToStaticMarkup(createElement(
  module.StyleProvider, {persist: false, documentStyles: false, children: createElement(module.ModuleNotice, notice)}));

describe('the module notice', () => {
  it('draws the empty form as its label alone, centred in the room it fills', () => {
    const markup = render({form: module.NoticeForm.EMPTY, children: LABEL});
    const centred = /<div data-module-notice="empty" style="[^"]*flex:1[^"]*align-items:center;justify-content:center/;
    assert.match(markup, centred);
    assert.match(markup, new RegExp(`<span[^>]*>${LABEL}</span></div>$`));
  });

  it('draws the note form as its sentence by default and when named', () => {
    const expected = new RegExp(`<p data-module-notice[^>]*>${LABEL}</p>`);
    assert.match(render({children: LABEL}), expected);
    assert.match(render({form: module.NoticeForm.NOTE, children: LABEL}), expected);
  });
});
