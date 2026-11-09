import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
interface Element {
  type: string;
  props: {
    className?: string; 'data-photo-form'?: string; 'data-phone'?: string;
    src?: string; href?: string; alt?: string; title?: string; loading?: string;
    children?: Element | Element[] | string;
  };
}
interface PhotosModule {
  PhotoCompareForm: { readonly INLINE: 'inline' };
  PhotoCompare(props: { captures: { src: string; label: string; title?: string; href?: string }[];
    className?: string; form?: 'inline' }): Element | null;
  PhotoStrip(props: { photos: { src: string; title?: string; phone?: boolean }[]; className?: string }): Element | null;
}
const children = (element: Element): Element[] => element.props.children as Element[];

describe('PhotoCompare inline form', () => {
  let directory = '', photos: PhotosModule;
  before(async () => {
    directory = mkdtempSync(join(root, '.photos-form-'));
    const output = await build({ absWorkingDir: root, entryPoints: ['src/react/Photos.tsx'], bundle: true,
      write: false, format: 'esm', platform: 'node', external: ['react', 'react/*'] });
    const file = join(directory, 'Photos.mjs');
    writeFileSync(file, output.outputFiles[0].text);
    photos = await import(pathToFileURL(file).href);
  });
  after(() => rmSync(directory, { recursive: true, force: true }));

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

  it('keeps base layout and label CSS intact and scopes all new presentation to inline', () => {
    const css = readFileSync(join(root, 'src/react/photos.css'), 'utf8');
    const [base, inline] = css.split('/* Inline comparisons');
    assert.match(base, /\.bd-compare \{[^}]*margin: 8px 0;/);
    assert.match(base, /\.bd-compare img \{ display: block; width: 100%; height: auto; \}/);
    assert.match(base, /\.bd-compare figcaption \{ margin-top: 4px; \}/);
    assert.doesNotMatch(base, /max-height|font-size|cursor|:empty/);
    const selectors = [...inline.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map(match => match[1].replace(/^[\s\S]*\*\//, '').trim());
    assert.equal(selectors.length, 5);
    assert.ok(selectors.every(selector => selector.startsWith('.bd-compare[data-photo-form="inline"]')));
    assert.match(inline, /font-size: max\(12px,/);
    for (const token of ['max-height', 'background', 'caption-size']) {
      assert.ok(inline.includes(`--photo-compare-${token}`));
    }
  });

  it('exports the form and refuses unrecognized forms in strict TypeScript', () => {
    const { compilerOptions } = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'));
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ files: ['usage.tsx'], compilerOptions }));
    const check = (form: string) => {
      const imported = "import { PhotoCompare, PhotoCompareForm } from '../src/react/index.ts';\n";
      writeFileSync(join(directory, 'usage.tsx'), imported +
        `export const row = <PhotoCompare captures={[]} form={${form}} />; void PhotoCompareForm;\n`);
      return spawnSync(join(root, 'node_modules/.bin/tsc'),
        ['-p', join(directory, 'tsconfig.json'), '--pretty', 'false'], { encoding: 'utf8' });
    };
    const valid = check('PhotoCompareForm.INLINE'); assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    const invalid = check("'wide'"); assert.notEqual(invalid.status, 0);
    assert.deepEqual(invalid.stdout.match(/error TS\d+/g), ['error TS2322']);
  });
});
