// An opt-in form is a typed constant: a usage that names one of its members passes the suite's strict type check, and
// one that writes a word outside it fails as a mistyped value. One row a form, imported from where a consumer reads it.
import {describe, it} from 'node:test';
import {join} from 'node:path';
import {SUITE_ROOT} from './bundled.ts';
import {SUITE_COMPILER_OPTIONS, assertRefusesType, typeCheck} from './typeCheck.ts';

const FORMS = [
  {component: 'PhotoCompare', form: 'PhotoCompareForm', from: 'src/react/index.ts', props: 'captures={[]}',
    member: 'INLINE'},
  {component: 'PipRow', form: 'PipRowForm', from: 'src/react/PipRow.tsx', props: 'value={1} max={3} segments={3}',
    member: 'COMPACT'},
] as const;
/** A word no form has. */
const OUTSIDE = "'wide'";

describe('opt-in forms at the type check', () => {
  for (const {component, form, from, props, member} of FORMS) {
    it(`takes ${form}.${member} and refuses a form outside ${form}`, () => {
      const module = JSON.stringify(join(SUITE_ROOT, from));
      const usage = (value: string) => `import {${component}, ${form}} from ${module};\n`
        + `export const row = <${component} ${props} form={${value}} />; void ${form};\n`;
      assertRefusesType(value => typeCheck({'usage.tsx': usage(value)}, SUITE_COMPILER_OPTIONS), `${form}.${member}`,
        OUTSIDE);
    });
  }
});
