// An opt-in form is a typed constant: a usage that names one of its members passes the suite's strict type check, and
// one that writes a word outside it fails as a mistyped value. One row a form, imported from where a consumer reads it.
import {describe, it} from 'node:test';
import {join} from 'node:path';
import {SUITE_ROOT} from './bundled.ts';
import {SUITE_COMPILER_OPTIONS, assertRefusesType, typeCheck} from './typeCheck.ts';

const FORMS = [
  {component: 'PhotoCompare', form: 'PhotoCompareForm', prop: 'form', from: 'src/react/index.ts',
    props: 'captures={[]}', member: 'INLINE'},
  {component: 'PipRow', form: 'PipRowForm', prop: 'form', from: 'src/react/PipRow.tsx',
    props: 'value={1} max={3} segments={3}', member: 'COMPACT'},
  {component: 'Modal', form: 'ModalWidth', prop: 'width', from: 'src/react/index.ts', props: 'open children=""',
    member: 'READING'},
  {component: 'ModuleFieldRows', form: 'RowsForm', prop: 'form', from: 'src/react/grid/ModuleFieldRows.tsx',
    props: 'children=""', member: 'LEAD'},
  {component: 'ModuleNotice', form: 'NoticeForm', prop: 'form', from: 'src/react/module/ModuleNotice.tsx',
    props: 'children=""', member: 'EMPTY'},
  {component: 'ListboxSelect', form: 'ListboxForm', prop: 'form', from: 'src/react/index.ts',
    props: 'label="Go" options={[]} onAction={() => undefined} children=""', member: 'MENU'},
  {component: 'Cycle', form: 'CycleForm', prop: 'variant', from: 'src/react/index.ts',
    props: 'options={[]} value="a" onChange={() => undefined}', member: 'TEXT'},
  {component: 'Boolean', form: 'BooleanForm', prop: 'form', from: 'src/react/index.ts',
    props: 'value onChange={() => undefined} label="Play" glyphs={{on: "", off: ""}}', member: 'ICON'},
] as const;
/** A word no form has. */
const OUTSIDE = "'wide'";
const REACT_ENTRY = JSON.stringify(join(SUITE_ROOT, 'src/react/index.ts'));
const MODAL_NAMES = 'Modal, ModalForm, ModalFrameInset, ModalPlacement, ModalWidth';

describe('opt-in forms at the type check', () => {
  for (const {component, form, prop, from, props, member} of FORMS) {
    it(`takes ${form}.${member} and refuses a form outside ${form}`, () => {
      const module = JSON.stringify(join(SUITE_ROOT, from));
      const usage = (value: string) => `import {${component}, ${form}} from ${module};\n`
        + `export const row = <${component} ${props} ${prop}={${value}} />; void ${form};\n`;
      assertRefusesType(value => typeCheck({'usage.tsx': usage(value)}, SUITE_COMPILER_OPTIONS), `${form}.${member}`,
        OUTSIDE);
    });
  }
});

// What a Modal's placement and form take: only a contained Modal fills its frame, keeps its frame's inset or sits at a
// top, an anchored or media Modal names no width, and only an anchored Modal, which must name its anchor, says where it
// goes beside it. Each row's accepted usage passes and its refused one fails.
const MODAL_SHAPES = [
  {accepted: 'placement={ModalPlacement.CONTAINED} width={ModalWidth.FILL}', refused: 'width={ModalWidth.FILL}'},
  {accepted: 'placement={ModalPlacement.CONTAINED} frameInset={ModalFrameInset.GUTTER}',
    refused: 'frameInset={ModalFrameInset.GUTTER}'},
  {accepted: 'placement={ModalPlacement.CONTAINED} top={8}', refused: 'top={8}'},
  {accepted: 'width={ModalWidth.STAGE}', refused: 'placement={ModalPlacement.ANCHORED} width={ModalWidth.STAGE}'},
  {accepted: 'form={ModalForm.MEDIA}', refused: 'form={ModalForm.MEDIA} width={ModalWidth.READING}'},
  {accepted: 'placement={ModalPlacement.ANCHORED} anchor={{x: 0, y: 0}}',
    refused: 'placement={ModalPlacement.ANCHORED}'},
  {accepted: 'placement={ModalPlacement.ANCHORED} anchor={{x: 0, y: 0}} popover={{above: true}}',
    refused: 'popover={{above: true}}'},
] as const;

describe('a Modal\'s width, frame inset and top at the type check', () => {
  for (const {accepted, refused} of MODAL_SHAPES) {
    it(`takes ${accepted} and refuses ${refused}`, () => {
      const usage = (value: string) => `import {${MODAL_NAMES}} from ${REACT_ENTRY};\n`
        + `export const shown = <Modal open ${value}>text</Modal>; void [${MODAL_NAMES}];\n`;
      assertRefusesType(value => typeCheck({'usage.tsx': usage(value)}, SUITE_COMPILER_OPTIONS), accepted, refused);
    });
  }
});

// What each ListboxSelect form takes: the menu holds no value, so it refuses the select's value, its onChange, its
// creating and its search, and its children, which alone draw its trigger, cannot be undefined; the select refuses
// the menu's onAction. Each row's accepted usage passes.
const MENU_FORM = 'form={ListboxForm.MENU} label="Go" options={[{value: \'a\', label: \'A\'}]}';
const MENU_PROPS = `${MENU_FORM} children=""`;
const SELECT_PROPS = 'label="Go" options={[{value: \'a\', label: \'A\'}]} value="a"';
const LISTBOX_SHAPES = [
  {props: `${MENU_FORM} onAction={() => undefined}`, accepted: 'children=""', refused: 'children={undefined}'},
  ...['value="a"', 'onChange={() => undefined}', 'onCreate={() => undefined}', 'searchSubject="places"',
    'searchSize={8}'].map(refused => ({props: MENU_PROPS, accepted: 'onAction={() => undefined}',
    refused: `onAction={() => undefined} ${refused}`})),
  {props: SELECT_PROPS, accepted: 'onChange={() => undefined}',
    refused: 'onChange={() => undefined} onAction={() => undefined}'},
] as const;

describe('a ListboxSelect form\'s props at the type check', () => {
  for (const {props, accepted, refused} of LISTBOX_SHAPES) {
    it(`takes ${accepted} and refuses ${refused}`, () => {
      const usage = (value: string) => `import {ListboxSelect, ListboxForm} from ${REACT_ENTRY};\n`
        + `export const shown = <ListboxSelect ${props} ${value} />; void ListboxForm;\n`;
      assertRefusesType(value => typeCheck({'usage.tsx': usage(value)}, SUITE_COMPILER_OPTIONS), accepted, refused);
    });
  }
});
