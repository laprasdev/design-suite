import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { SUITE_ROOT, bundled } from './bundled.ts';

interface Element {
  type: string;
  props: {
    className?: string; 'data-photo-form'?: string; 'data-phone'?: string;
    src?: string; href?: string; alt?: string; title?: string; loading?: string; 'data-tile'?: string;
    style?: { objectPosition?: string }; children?: Element | Element[] | string;
  };
}
interface PhotosModule {
  PhotoCompareForm: { readonly INLINE: 'inline' };
  PhotoCompare(props: { captures: { src: string; label: string; title?: string; href?: string;
    tile?: { index: number; count: number } }[];
    className?: string; form?: 'inline' | 'rows' }): Element | null;
  StripTile(props: { src: string; alt: string; index: number; count: number }): Element;
  justifiedRows(ratios: number[], width: number, target: number, gap: number):
    { start: number; end: number; height: number }[];
  PhotoStrip(props: { photos: { src: string; title?: string; phone?: boolean }[]; className?: string }): Element | null;
}
const children = (element: Element): Element[] => element.props.children as Element[];
const { module: photos, directory, dispose } = await bundled<PhotosModule>(['src/react/Photos.tsx']);
after(dispose);

describe('PhotoCompare inline form', () => {
  it('preserves default captures, labels, links and empty behavior', () => {
    const captures = [{ src: '/first.png', label: 'Before', href: '/full.png', title: 'Original' }];
    const row = photos.PhotoCompare({ captures, className: 'consumer' })!;
    assert.equal(row.type, 'div'); assert.equal(row.props.className, 'bd-compare consumer');
    assert.equal(row.props['data-photo-form'], undefined);
    const [link, caption] = children(children(row)[0]);
    assert.equal(link.props.href, '/full.png'); assert.equal(link.props.title, 'Original');
    assert.equal((link.props.children as Element).props.src, '/first.png');
    assert.equal((link.props.children as Element).props.alt, 'Original');
    assert.equal((link.props.children as Element).props.loading, 'lazy');
    assert.equal(caption.props.className, 'bd-label bd-label--name');
    assert.equal(caption.props.children, 'Before');
    const inline = photos.PhotoCompare({ captures, className: 'consumer', form: photos.PhotoCompareForm.INLINE })!;
    assert.equal(inline.props['data-photo-form'], 'inline');
    assert.deepEqual(children(inline), children(row), 'the opt-in changes no capture content or default label classes');
    assert.equal(photos.PhotoCompare({ captures: [] }), null);
    const strip = photos.PhotoStrip({ photos: [{ src: '/phone.png', title: 'Phone', phone: true }] })!;
    assert.equal(strip.props.className, 'bd-photos');
    assert.equal(children(strip)[0].props['data-phone'], 'true');
    assert.equal(children(strip)[0].props.href, '/phone.png');
    assert.equal(photos.PhotoStrip({ photos: [] }), null);
  });

  it('keeps base layout and label CSS intact and scopes each form to its own selectors', () => {
    const css = readFileSync(join(SUITE_ROOT, 'src/react/photos.css'), 'utf8');
    const [base, rest] = css.split('/* StripTile');
    const [strip, afterStrip] = rest.split('/* Inline comparisons');
    const [inline, rows] = afterStrip.split('/* Rows');
    assert.match(base, /\.bd-compare \{[^}]*margin: 8px 0;/);
    assert.match(base, /\.bd-compare img \{ display: block; width: 100%; height: auto; \}/);
    assert.match(base, /\.bd-compare figcaption \{ margin-top: 4px; \}/);
    assert.doesNotMatch(base, /max-height|font-size|cursor|:empty/);
    const selectors = (section: string) => [...section.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map(match => match[1].replace(/^[\s\S]*\*\//, '').trim());
    assert.deepEqual(selectors(strip), ['.bd-strip-tile']);
    assert.equal(selectors(inline).length, 5);
    assert.ok(selectors(inline).every(selector => selector.startsWith('.bd-compare[data-photo-form="inline"]')));
    const rowRules = selectors(rows);
    const rowsForm = '.bd-compare[data-photo-form="rows"]';
    assert.ok(rowRules.length > 0 && rowRules.every(selector => selector.startsWith(rowsForm)));
    assert.match(inline, /font-size: max\(12px,/);
    const tokens = (section: string, names: string[]) =>
      names.every(name => section.includes(`--photo-compare-${name}`));
    assert.ok(tokens(inline, ['max-height', 'background', 'caption-size']));
    assert.ok(tokens(rows, ['row-height', 'background', 'caption-size']));
  });

  it('hands a tile capture to StripTile, the one strip crop, and measures rows captures from their own aspect', () => {
    const first = (form?: 'inline' | 'rows', tile?: { index: number; count: number }) =>
      children(photos.PhotoCompare({ captures: [{ src: '/strip.png', label: 'Front', tile }], form })!)[0];
    const whole = children(first())[0].props.children as Element;
    assert.equal(whole.type, 'img');
    type Tile = { type: unknown; props: { index: number; count: number } };
    const tiled = children(first('inline', { index: 2, count: 5 }))[0].props.children as unknown as Tile;
    assert.equal(tiled.type, photos.StripTile);
    assert.deepEqual([tiled.props.index, tiled.props.count], [2, 5]);
    type Rows = { props: { captures: unknown[] } };
    const rows = photos.PhotoCompare({ captures: [{ src: '/a.png', label: 'A' }], form: 'rows' }) as unknown as Rows;
    assert.equal(rows.props.captures.length, 1, 'rows hand their captures to the measured layout');
    const outside = { src: '/strip.png', alt: 'Front', index: 5, count: 5 };
    assert.throws(() => photos.StripTile(outside), /outside a strip of 5/);
    const pair = photos.PhotoCompare({ captures: [{ src: '/s.png', label: 'A', tile: { index: 0, count: 2 } },
      { src: '/s.png', label: 'B', tile: { index: 1, count: 2 } }] })!;
    const keys = children(pair).map(element => (element as unknown as { key: string }).key);
    assert.equal(new Set(keys).size, 2, 'two tiles of one strip keep distinct keys');
  });

  it('justifies rows to fill the width at each aspect, and joins a sparse last row to the one above', () => {
    // The seven brief references: a portrait, a five-view strip, two squares, a wide tail, a 3:2 sheet and a strip.
    const ratios = [0.667, 5, 1, 1, 2, 1.5, 5];
    const rows = photos.justifiedRows(ratios, 1100, 240, 8);
    assert.deepEqual(rows.map(row => [row.start, row.end]), [[0, 2], [2, 5], [5, 7]]);
    for (const row of rows) {
      let used = 8 * (row.end - row.start - 1);
      for (let index = row.start; index < row.end; index++) used += row.height * (ratios[index] ?? 1);
      assert.ok(Math.abs(used - 1100) < 0.01, 'every row fills the width');
    }
    const portraitLast = photos.justifiedRows([2, 2, 0.5], 1000, 240, 0);
    assert.equal(portraitLast.length, 1, 'a lone portrait last row joins the row above instead of standing tall');
    const single = photos.justifiedRows([1], 1000, 240, 0)[0]?.height;
    assert.equal(single, 360, 'a single row stays at most one and a half times the target');
    assert.deepEqual(photos.justifiedRows([1, 2], 0, 240, 8), []);
  });

  it('exports the form and refuses unrecognized forms in strict TypeScript', () => {
    const { compilerOptions } = JSON.parse(readFileSync(join(SUITE_ROOT, 'tsconfig.json'), 'utf8'));
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ files: ['usage.tsx'], compilerOptions }));
    const check = (form: string) => {
      const index = JSON.stringify(join(SUITE_ROOT, 'src/react/index.ts'));
      const imported = `import { PhotoCompare, PhotoCompareForm } from ${index};\n`;
      writeFileSync(join(directory, 'usage.tsx'), imported +
        `export const row = <PhotoCompare captures={[]} form={${form}} />; void PhotoCompareForm;\n`);
      return spawnSync(join(SUITE_ROOT, 'node_modules/.bin/tsc'),
        ['-p', join(directory, 'tsconfig.json'), '--pretty', 'false'], { encoding: 'utf8' });
    };
    const valid = check('PhotoCompareForm.INLINE'); assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    const invalid = check("'wide'"); assert.notEqual(invalid.status, 0);
    assert.deepEqual(invalid.stdout.match(/error TS\d+/g), ['error TS2322']);
  });
});
