// themeVariables publishes its --color-* entries through colorVariables' one name mapping, and its output stays what
// it was before that mapping moved: the fixture holds the base's output for the default theme and one custom theme.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { colorVariables, createTheme, themeVariables } from '../src/theme.ts';
import { isRecord } from '../src/valueChecks.ts';

const FIXTURE: unknown = JSON.parse(readFileSync(new URL('./themeVariables.fixture.json', import.meta.url), 'utf8'));
if (!isRecord(FIXTURE) || !isRecord(FIXTURE.custom) || !isRecord(FIXTURE.custom.colors)) {
  throw new Error('themeVariables.fixture.json holds no custom theme colours.');
}
const customColors = Object.fromEntries(Object.entries(FIXTURE.custom.colors).map(([name, color]) => {
  if (typeof color !== 'string') throw new Error(`themeVariables.fixture.json: colour ${name} is not a string.`);
  return [name, color];
}));

describe('theme variables', () => {
  it('match the base output for the default theme and a custom one, in order', () => {
    assert.equal(JSON.stringify(themeVariables(createTheme())), JSON.stringify(FIXTURE.default));
    assert.equal(JSON.stringify(themeVariables(createTheme({ colors: customColors }))),
      JSON.stringify(FIXTURE.customVariables));
  });

  it('name every theme colour once, in kebab case', () => {
    const theme = createTheme({ colors: customColors });
    const variables = colorVariables(theme);
    assert.equal(Object.keys(variables).length, Object.keys(theme.colors).length);
    assert.equal(variables['--color-surface-hi'], theme.colors.surfaceHi);
    assert.equal(variables['--color-gold-light'], theme.colors.goldLight);
  });
});
