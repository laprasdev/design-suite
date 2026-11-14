import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {hexToRgba} from '../src/color.ts';
import {ApplicationElement} from '../src/react/applicationElements.ts';
import {createSkinTheme} from '../src/skinTheme.ts';
import {SKIN_NAMES} from '../src/skins.ts';
import {createTheme, themeVariables, WASH_ALPHA} from '../src/theme.ts';

// How code reads is this package's: one skin for a span and a block, from theme variables only.
const FOUNDATION = new URL('../src/react/foundation.css', import.meta.url);
const SKIN_VARIABLES = ['--code-wash', '--line', '--line-width', '--r-sm', '--text', '--font-code', '--type-code',
  '--leading-code'];

test('every theme washes code in its own text colour, and a theme may set the wash', () => {
  for (const theme of [createTheme(), ...SKIN_NAMES.map(name => createSkinTheme(name))]) {
    assert.equal(theme.colors.codeWash, hexToRgba(theme.colors.text, WASH_ALPHA), theme.name);
    assert.equal(themeVariables(theme)['--code-wash'], theme.colors.codeWash, theme.name);
  }
  assert.equal(createTheme({colors: {codeWash: '#123456'}}).colors.codeWash, '#123456');
});

// Only inside a suite application root, where a host applies the theme; a page outside one keeps its own code.
const IN_ROOT = `:where(${ApplicationElement.ROOT.selector}) `;

test('the code skin sits inside the application root and reads its look from theme variables only', () => {
  const css = readFileSync(FOUNDATION, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => /(?:^|[\s,(])(?:code|pre)(?![\w-])/.test(selector));
  assert.ok(rules.length > 0, 'foundation.css holds the code skin');
  assert.deepEqual(rules.map(([, selector]) => selector.trim()).filter(selector => !selector.startsWith(IN_ROOT)), []);
  const bodies = rules.map(([, , body]) => body);
  const used = new Set(bodies.flatMap(body => [...body.matchAll(/var\((--[\w-]+)\)/g)].map(([, name]) => name)));
  const variables = themeVariables(createTheme());
  assert.deepEqual(SKIN_VARIABLES.filter(name => !used.has(name)), []);
  assert.deepEqual([...used].filter(name => !(name in variables)), [], 'every variable comes from the theme');
  assert.doesNotMatch(bodies.join(';'), /#[0-9a-f]{3,8}\b|rgba?\(|color-mix|monospace|\d+px/i);
});
