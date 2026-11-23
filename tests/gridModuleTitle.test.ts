// A module's title: without a choice it is its word alone, the markup every GridModule consumer has always drawn; with
// one it is the step form's trigger. A list holding an unavailable option with no onRefuse to say why fails as it
// draws.
import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {bundled} from './bundled.ts';

type Module = typeof import('../src/react/module/GridModule.tsx') & typeof import('../src/react/ListboxSelect.tsx')
  & typeof import('../src/react/listboxSelectElements.ts') & typeof import('../src/synth/StyleContext.tsx')
  & typeof import('../src/react/module/gridModuleElements.ts');
const {module, dispose} = await bundled<Module>(['src/react/module/GridModule.tsx', 'src/react/ListboxSelect.tsx',
  'src/react/listboxSelectElements.ts', 'src/synth/StyleContext.tsx', 'src/react/module/gridModuleElements.ts']);
const {GridModule, ListboxSelect, ListboxElement, ListboxForm, ModuleTitleChoiceElement, StyleProvider} = module;
after(dispose);
const TITLE = 'Preview';
const OPTIONS = Object.freeze([{value: 'grid', label: 'Grid'},
  {value: 'jungle', label: 'Jungle', unavailable: 'The jungle has no scene file yet.'}] as const);
type Value = typeof OPTIONS[number]['value'];
const drawn = (choice?: {options: typeof OPTIONS; value: Value; onChange(value: Value): void; onRefuse(): void}) =>
  renderToStaticMarkup(createElement(StyleProvider, {persist: false, documentStyles: false,
    children: createElement(GridModule<Value>, {title: TITLE, choice, children: null})}));
const heading = (markup: string) => /<h2[^>]*>(.*?)<\/h2>/.exec(markup)?.[1] ?? assert.fail(`no title in ${markup}`);

describe('a module title', () => {
  it('draws only its word when it heads no choice', () => {
    const markup = drawn();
    assert.equal(heading(markup), TITLE);
    assert.doesNotMatch(markup, new RegExp(ListboxElement.TRIGGER.className));
    assert.doesNotMatch(markup, /--module-title-gap/);
  });

  it('draws its word, the chosen name and the caret as the step form\'s trigger when it heads one', () => {
    const choice = {options: OPTIONS, value: 'grid', onChange: () => undefined, onRefuse: () => undefined} as const;
    const title = heading(drawn(choice));
    const trigger = `${ListboxElement.TRIGGER.className} ${ModuleTitleChoiceElement.className}`;
    assert.match(title, new RegExp(`class="${trigger}"`));
    assert.match(title, new RegExp(`>${TITLE}<span[^>]*>${OPTIONS[0].label}</span>`));
    assert.match(title, new RegExp(ListboxElement.CARET.className));
  });

  it('fails as it draws a list that holds an unavailable option and no onRefuse', () => {
    assert.throws(() => renderToStaticMarkup(createElement(ListboxSelect<Value>, {form: ListboxForm.SELECT,
      label: TITLE, options: OPTIONS, value: 'grid', onChange: () => undefined})),
    new RegExp(`${TITLE} offers ${OPTIONS[1].label}, unavailable, with no onRefuse`));
  });
});
