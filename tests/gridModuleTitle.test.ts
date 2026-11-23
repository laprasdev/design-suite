// A module's title: without a choice it is its word alone, the markup every GridModule consumer has always drawn; with
// one it is the step form's trigger and its carets. A list holding an unavailable option with no onRefuse to say why
// fails as it draws.
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
const {GridModule, ListboxSelect, ListboxElement, ListboxForm, MODULE_HEADER_FORM_ATTRIBUTE, ModuleHeaderForm,
  ModuleTitleChoiceElement, StyleProvider} = module;
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
    const headerTag = /<header[^>]*>/.exec(markup)?.[0] ?? assert.fail(`no header tag in ${markup}`);
    assert.equal(heading(markup), TITLE);
    assert.doesNotMatch(headerTag, new RegExp(MODULE_HEADER_FORM_ATTRIBUTE));
    assert.doesNotMatch(headerTag, /flex-wrap/);
    assert.doesNotMatch(markup, new RegExp(ListboxElement.TRIGGER.className));
    assert.doesNotMatch(markup, /--module-title-gap/);
  });

  it('draws its word, then previous caret, carousel slot and next caret when it heads a choice', () => {
    const choice = {options: OPTIONS, value: 'grid', onChange: () => undefined, onRefuse: () => undefined} as const;
    const markup = drawn(choice), title = heading(markup);
    const headingTag = /<h2[^>]*>/.exec(markup)?.[0] ?? assert.fail(`no heading tag in ${markup}`);
    assert.match(markup, new RegExp(`${MODULE_HEADER_FORM_ATTRIBUTE}="${ModuleHeaderForm.CHOICE}"`));
    assert.doesNotMatch(headingTag, /white-space:nowrap|overflow:hidden/, 'the title does not clip its carets');
    const trigger = `${ListboxElement.TRIGGER.className} ${ModuleTitleChoiceElement.className}`;
    assert.match(title, new RegExp(`class="${trigger}"[^>]*>${TITLE}</button>`));
    assert.match(title, /data-form="carousel"/);
    const stepMatches = [...title.matchAll(new RegExp(`class="[^"]*\\b${ListboxElement.STEP.className}\\b`, 'g'))];
    assert.equal(stepMatches.length, 2);
    const chosenIndex = title.indexOf(`class="${ListboxElement.CHOSEN.className}"`);
    assert.ok(stepMatches[0].index < chosenIndex && chosenIndex < stepMatches[1].index,
      'the carets flank the chosen slot instead of sitting together');
    assert.doesNotMatch(title, /data-shows-value/, 'the title is no field, so it paints no field caret');
  });

  it('fails as it draws a list that holds an unavailable option and no onRefuse', () => {
    assert.throws(() => renderToStaticMarkup(createElement(ListboxSelect<Value>, {form: ListboxForm.SELECT,
      label: TITLE, options: OPTIONS, value: 'grid', onChange: () => undefined})),
    new RegExp(`${TITLE} offers ${OPTIONS[1].label}, unavailable, with no onRefuse`));
  });
});
