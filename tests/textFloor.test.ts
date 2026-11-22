// Every text size the suite states is at or above the text floor: its typography tokens, a theme's sizes, every
// step of a skin's type scale, which its tiers index, and every pixel font size its stylesheets write.
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'node:test';
import {flattenSkin, resolveDesignSystem, SKIN_NAMES} from '../src/skins.ts';
import {labelVariables, TEXT_SIZE_VARIABLES, THEME_TYPOGRAPHY} from '../src/theme.ts';
import {TEXT_FLOOR, Typography} from '../src/tokens.ts';

const source = fileURLToPath(new URL('../src/', import.meta.url));
const stylesheets = readdirSync(source, {recursive: true, encoding: 'utf8'}).filter(file => file.endsWith('.css'));
const PIXEL_FONT_SIZE = /font-size\s*:\s*(\d+(?:\.\d+)?)px/g;
// A Label type custom property assigned in a stylesheet (only `labelVariables()` publishes them), a Label type
// variable read with a fallback, or a size, weight or tracking written by hand on a rule that draws a Label.
const LABEL_TYPE_LITERAL = new RegExp([
  String.raw`--label-[a-z]+-(?:size|weight|tracking)\s*:`, String.raw`var\(--label-[a-z]+-(?:size|weight|tracking)\s*,`,
  String.raw`\.bd-label[^{]*\{[^}]*(?:font-size|font-weight|letter-spacing|font)\s*:(?!\s*var\(--label-)[^;}]+`,
].join('|'), 'g');

const atFloor = (size: number, name: string) =>
  assert.ok(size >= TEXT_FLOOR, `${name} is ${size}px, under the ${TEXT_FLOOR}px text floor`);

describe('the text floor', () => {
  it('holds every typography token', () => {
    for (const [name, token] of Object.entries(Typography)) atFloor(token.fontSize, `Typography.${name}`);
  });

  it('holds every theme text size', () => {
    for (const key of new Set(Object.values(TEXT_SIZE_VARIABLES)))
      atFloor(THEME_TYPOGRAPHY[key], `THEME_TYPOGRAPHY.${key}`);
  });

  it('holds every step of every skin\'s type scale', () => {
    for (const skin of SKIN_NAMES) {
      const scale = flattenSkin(resolveDesignSystem(skin)).get('forms.text.sizeScale');
      assert.ok(Array.isArray(scale), `${skin} states no forms.text.sizeScale`);
      for (const size of scale) atFloor(size, `${skin} forms.text.sizeScale`);
    }
  });

  it('draws every Label kind at the one text size', () => {
    for (const [name, size] of Object.entries(labelVariables()).filter(([name]) => name.endsWith('-size')))
      assert.equal(size, `${TEXT_FLOOR}px`, name);
  });

  it('leaves the Label kind\'s type to its typography roles', () => {
    for (const file of stylesheets)
      for (const [rule] of readFileSync(join(source, file), 'utf8').matchAll(LABEL_TYPE_LITERAL))
        assert.fail(`src/${file} sets a Label\'s type by hand: ${rule}`);
  });

  it('holds every pixel font size in the suite\'s stylesheets', () => {
    for (const file of stylesheets)
      for (const [, size] of readFileSync(join(source, file), 'utf8').matchAll(PIXEL_FONT_SIZE))
        atFloor(Number(size), `src/${file} font-size`);
  });
});
