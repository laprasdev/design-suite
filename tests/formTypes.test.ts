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
// top, and an anchored or media Modal names no width. Each row's accepted usage passes and its refused one fails.
const MODAL_SHAPES = [
  {accepted: 'placement={ModalPlacement.CONTAINED} width={ModalWidth.FILL}', refused: 'width={ModalWidth.FILL}'},
  {accepted: 'placement={ModalPlacement.CONTAINED} frameInset={ModalFrameInset.GUTTER}',
    refused: 'frameInset={ModalFrameInset.GUTTER}'},
  {accepted: 'placement={ModalPlacement.CONTAINED} top={8}', refused: 'top={8}'},
  {accepted: 'width={ModalWidth.STAGE}', refused: 'placement={ModalPlacement.ANCHORED} width={ModalWidth.STAGE}'},
  {accepted: 'form={ModalForm.MEDIA}', refused: 'form={ModalForm.MEDIA} width={ModalWidth.READING}'},
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
