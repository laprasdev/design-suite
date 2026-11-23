import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { kindListAt, parseKindsFile, type KindRow } from '../catalog/kindsFile.ts';

const TEXT = readFileSync(new URL('../catalog/kinds.json', import.meta.url), 'utf8');
const KIND = 'MultiChoice';

/** kinds.json with `KIND`'s row replaced by what `row` makes of it. */
function withRow(row: (was: KindRow) => unknown): string {
  const file = parseKindsFile(TEXT);
  return JSON.stringify({ ...file, kinds: { ...file.kinds, [KIND]: row(file.kinds[KIND]) } });
}

describe('reading kinds.json', () => {
  it('reads the map as it is kept, every field of each row with it', () => {
    const read: unknown = JSON.parse(TEXT);
    assert.deepEqual(parseKindsFile(TEXT), read);
  });

  it('refuses a value of the wrong type, naming its place one way', () => {
    const wrong: readonly (readonly [string, string])[] = [
      [withRow(row => ({ ...row, data: '' })), `kinds["${KIND}"].data must be a non-empty string`],
      [withRow(row => ({ ...row, webFirst: 3 })), `kinds["${KIND}"].webFirst must be a string`],
      [withRow(row => ({ ...row, web: [3] })), `kinds["${KIND}"].web[0] must be a string`],
      [withRow(row => ({ ...row, webDirs: 'src' })), `kinds["${KIND}"].webDirs must be a list`],
      [withRow(() => 3), `kinds["${KIND}"] must be a record`],
      [JSON.stringify({ kinds: [] }), 'kinds must be a record'],
      ['[]', 'the file must be a record'],
    ];
    for (const [text, refusal] of wrong) {
      assert.throws(() => parseKindsFile(text), new Error(`kinds.json: ${refusal}.`));
    }
  });

  it('names a kind\'s list where its refusal does', () => {
    assert.throws(() => parseKindsFile(withRow(row => ({ ...row, web: 'Button' }))),
      new Error(`kinds.json: ${kindListAt(KIND, 'web')} must be a list.`));
  });
});
