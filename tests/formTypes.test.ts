// An opt-in form is a typed constant: a usage that names one of its members passes the suite's strict type check, and
// one that writes a word outside it fails as a mistyped value. One row a form, imported from where a consumer reads it.
import {describe, it} from 'node:test';
import {join} from 'node:path';
import {SUITE_ROOT} from './bundled.ts';
import {SUITE_COMPILER_OPTIONS, assertRefusesType, typeCheck, type TypeContract} from './typeCheck.ts';

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
      assertRefusesType(value => typeCheck({'usage.tsx': usage(value)}, SUITE_COMPILER_OPTIONS),
        {accepted: `${form}.${member}`, refused: [OUTSIDE]});
    });
  }
});

// What a Modal's placement and form take: only a contained Modal fills its frame, keeps its frame's inset or sits at a
// top, an anchored or media Modal names no width, and only an anchored Modal, which must name its anchor, names a group
// and says where it goes beside it, never at a point of its own, since the anchor names the point: not in a literal,
// and not in a placement held as a full `PopoverPlacement`. Each row's accepted usage passes and every refused one
// fails.
const AT_POINT = 'placement={ModalPlacement.ANCHORED} anchor={{x: 0, y: 0}}';
const PLACED = 'placed';
const PLACED_DECLARATION = `const ${PLACED}: PopoverPlacement = {above: true, at: {x: 0, y: 0}};`;
const MODAL_SHAPES: readonly TypeContract[] = [
  {accepted: 'placement={ModalPlacement.CONTAINED} width={ModalWidth.FILL}', refused: ['width={ModalWidth.FILL}']},
  {accepted: 'placement={ModalPlacement.CONTAINED} frameInset={ModalFrameInset.GUTTER}',
    refused: ['frameInset={ModalFrameInset.GUTTER}']},
  {accepted: 'placement={ModalPlacement.CONTAINED} top={8}', refused: ['top={8}']},
  {accepted: 'width={ModalWidth.STAGE}',
    refused: ['placement={ModalPlacement.ANCHORED} anchor={{x: 0, y: 0}} width={ModalWidth.STAGE}']},
  {accepted: 'form={ModalForm.MEDIA}', refused: ['form={ModalForm.MEDIA} width={ModalWidth.READING}']},
  {accepted: AT_POINT, refused: ['placement={ModalPlacement.ANCHORED}']},
  {accepted: `${AT_POINT} group="g"`, refused: ['group="g"']},
  {accepted: `${AT_POINT} popover={{above: true}}`, refused: ['popover={{above: true}}',
    `${AT_POINT} popover={{at: {x: 0, y: 0}}}`, `${AT_POINT} popover={${PLACED}}`]},
];

describe('a Modal\'s placement and form at the type check', () => {
  for (const shape of MODAL_SHAPES) {
    it(`takes ${shape.accepted} and refuses ${shape.refused.join(' or ')}`, () => {
      const usage = (value: string) => `import {${MODAL_NAMES}, type PopoverPlacement} from ${REACT_ENTRY};\n`
        + `${PLACED_DECLARATION}\n`
        + `export const shown = <Modal open ${value}>text</Modal>; void [${MODAL_NAMES}, ${PLACED}];\n`;
      assertRefusesType(value => typeCheck({'usage.tsx': usage(value)}, SUITE_COMPILER_OPTIONS), shape);
    });
  }
});

// What each ListboxSelect form takes: the menu holds no value, so it refuses the select's value, its onChange, its
// creating and its search, and its children, which alone draw its trigger, cannot be undefined; the select refuses
// the menu's onAction; and the list scrolls in its own frame, so a placement refuses `scroll`, and `at` as any
// anchored placement does. Each row's accepted usage passes.
const MENU_FORM = 'form={ListboxForm.MENU} label="Go" options={[{value: \'a\', label: \'A\'}]}';
const MENU_PROPS = `${MENU_FORM} children=""`;
const SELECT_PROPS = 'label="Go" options={[{value: \'a\', label: \'A\'}]} value="a"';
const ON_ACTION = 'onAction={() => undefined}';
const LISTBOX_SHAPES: readonly (TypeContract & {readonly props: string})[] = [
  {props: `${MENU_FORM} ${ON_ACTION}`, accepted: 'children=""', refused: ['children={undefined}']},
  {props: MENU_PROPS, accepted: ON_ACTION, refused: [`${ON_ACTION} value="a"`,
    `${ON_ACTION} onChange={() => undefined}`, `${ON_ACTION} onCreate={() => undefined}`,
    `${ON_ACTION} searchSubject="places"`, `${ON_ACTION} searchSize={8}`]},
  {props: SELECT_PROPS, accepted: 'onChange={() => undefined}', refused: [`onChange={() => undefined} ${ON_ACTION}`]},
  {props: `${SELECT_PROPS} onChange={() => undefined}`, accepted: 'popover={{above: true}}',
    refused: ['popover={{scroll: true}}', 'popover={{at: {x: 0, y: 0}}}']},
];

describe('a ListboxSelect form\'s props at the type check', () => {
  for (const {props, ...shape} of LISTBOX_SHAPES) {
    it(`takes ${shape.accepted} and refuses ${shape.refused.join(' or ')}`, () => {
      const usage = (value: string) => `import {ListboxSelect, ListboxForm} from ${REACT_ENTRY};\n`
        + `export const shown = <ListboxSelect ${props} ${value} />; void ListboxForm;\n`;
      assertRefusesType(value => typeCheck({'usage.tsx': usage(value)}, SUITE_COMPILER_OPTIONS), shape);
    });
  }
});

// A wrapper that fixes some of its component's props refuses them, so an object held as the component's wider props
// cannot carry one through. Each row spreads the wider props, refused, and the same props less the fixed keys.
const SYNTH = 'src/synth/components/synth';
const CONTAINER = {from: `${SYNTH}/base/BaseContainer.tsx`, propsFrom: `${SYNTH}/base/BaseContainer.tsx`,
  props: 'BaseContainerProps', keys: "'type'"} as const;
const BOOLEAN = {from: `${SYNTH}/BooleanPresets.tsx`, propsFrom: `${SYNTH}/Boolean.tsx`, props: 'BooleanProps'} as const;
const WRAPPERS = [
  {wrapper: 'ModuleContainer', ...CONTAINER}, {wrapper: 'CutoutContainer', ...CONTAINER},
  {wrapper: 'NodeContainer', ...CONTAINER},
  {wrapper: 'LightUpBoolean', ...BOOLEAN, keys: "'color' | 'variant'"},
  {wrapper: 'PinkBoolean', ...BOOLEAN, keys: "'color' | 'variant'"},
  {wrapper: 'BasicBoolean', ...BOOLEAN, keys: "'variant'"},
  {wrapper: 'MultiSelectEnum', from: `${SYNTH}/Enum.tsx`, propsFrom: `${SYNTH}/Enum.tsx`, props: 'MultiSelectEnumProps',
    keys: "'variant'"},
] as const;
const REFUSED_KEYS = JSON.stringify(join(SUITE_ROOT, 'src/react/refusedKeys.ts'));

describe('a wrapper\'s fixed props at the type check', () => {
  for (const {wrapper, from, propsFrom, props, keys} of WRAPPERS) {
    it(`${wrapper} refuses ${keys} from an object held as ${props}`, () => {
      const [source, propsSource] = [from, propsFrom].map(file => JSON.stringify(join(SUITE_ROOT, file)));
      const usage = (value: string) => `import {${wrapper}} from ${source};\nimport type {${props}} from ${propsSource};\n`
        + `import type {Without} from ${REFUSED_KEYS};\n`
        + `declare const wide: ${props}; declare const kept: Without<${props}, ${keys}>;\n`
        + `export const shown = <${wrapper} {...${value}} />; void [wide, kept];\n`;
      assertRefusesType(value => typeCheck({'usage.tsx': usage(value)}, SUITE_COMPILER_OPTIONS),
        {accepted: 'kept', refused: ['wide']});
    });
  }
});

// What an icon Boolean takes: its glyphs and its label, never the switch's `ariaLabel`; and a Cycle, a cell alone,
// takes no form at all (a module header's picker is GridModule's title choice).
const BOOLEAN_ICON = 'form={BooleanForm.ICON} value onChange={() => undefined}';
const SHAPES = [
  {component: 'Boolean', props: BOOLEAN_ICON, contract: {accepted: 'label="Play" glyphs={{on: "", off: ""}}',
    refused: ['label="Play"', 'ariaLabel="Play" glyphs={{on: "", off: ""}}']}},
  {component: 'Cycle', props: 'options={[]} value="a" onChange={() => undefined}',
    contract: {accepted: '', refused: ['variant="text"']}},
] as const;

describe('an icon Boolean\'s and a Cycle\'s props at the type check', () => {
  for (const {component, props, contract} of SHAPES) {
    it(`${component} takes ${contract.accepted || 'its own props'} and refuses ${contract.refused.join(', ')}`, () => {
      const usage = (value: string) => `import {${component}, BooleanForm} from ${REACT_ENTRY};\n`
        + `export const shown = <${component} ${props} ${value} />; void BooleanForm;\n`;
      assertRefusesType(value => typeCheck({'usage.tsx': usage(value)}, SUITE_COMPILER_OPTIONS), contract);
    });
  }
});
